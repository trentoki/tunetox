// Native-only shared action adapter. No DOM, metadata playback state or gain mathematics.
// Proposals reuse domain validators/authorization and the pure allocator; only the bridge
// schedules audio. Legacy two-deck hosts keep their existing actions and bridge.
function createNativeStemHandoffActions(state, mixer, onCommit = () => {}, options = {}) {
  const ids = mixer.deckIds;
  const bridge = createStemHandoffAudioBridge(state, mixer);
  let pending = null, revision = 0, lastError = null;
  if (!state.stemSession.nativeHandoff) {
    state.stemSession = Object.freeze({ ...state.stemSession, nativeHandoff: Object.freeze({
      members: Object.freeze(Object.fromEntries([1,2,3,4].map(id => [id,false]))),
      sharing: Object.freeze(Object.fromEntries(stemCategories.map(name => [name,false])))
    }) });
  }
  function copy() {
    return { ...state, decks: state.decks.map(deck => ({ ...deck })), stemSession: state.stemSession };
  }
  function nativeState(next, members, sharing = next.stemSession.nativeHandoff.sharing) {
    next.stemSession = Object.freeze({ ...next.stemSession, nativeHandoff: Object.freeze({
      ...next.stemSession.nativeHandoff, members: Object.freeze({ ...members }), sharing: Object.freeze({ ...sharing }) }) });
  }
  // Ownership records prior starts. G2 derives live capacity from the native
  // transport, adding a proposed entrant only while preparing its safe start.
  function activeMember(next,id,enteringId=null) {
    return next.stemSession.nativeHandoff.members[id] && (!options.liveLifecycle ||
      id===enteringId || (ids.includes(id) && mixer.getDeck(id).getState().isPlaying));
  }
  function targets(next, enteringId=null) {
    return Object.fromEntries(ids.map(id => {
      const deck = next.decks.find(item => item.id === id);
      return [id, { mainVolume: deck.volume, levels: deck.stems.allocatedLevels,
        capacityMember: next.stemSession.automaticHandoffEnabled &&
          next.participation.byDeck[id].stemHandoff && activeMember(next,id,enteringId) }];
    }));
  }
  function publish(next, directControl = null) {
    const automaticControls = [];
    for (const deck of next.decks) {
      const previous = state.decks.find(item => item.id === deck.id);
      for (const name of stemCategories) {
        const control = getStemControlId(deck.id,name);
        if (previous.stems.allocatedLevels[name] !== deck.stems.allocatedLevels[name] && control !== directControl) automaticControls.push(control);
      }
      previous.stems = deck.stems; previous.volume = deck.volume;
    }
    state.stemSession = next.stemSession; state.participation = next.participation;
    revision++; lastError = null; onCommit(state,{ directControl, automaticControls });
  }
  function allocate(next, trigger, priorityId = null, categories = stemCategories, mainGesture = false, incremental = null) {
    const members = next.stemSession.nativeHandoff.members;
    const sharing = { ...next.stemSession.nativeHandoff.sharing };
    for (const name of categories) {
      const snapshots = next.decks.map(deck => ({ id: deck.id, volume: deck.volume,
        // Main scales the current stem coefficient, not a suppressed old request.
        // Requests remain stored unchanged for receiver weighting and later gestures.
        requestedLevel: mainGesture && deck.id === priorityId ? deck.stems.allocatedLevels[name] : deck.stems.requestedLevels[name],
        allocatedLevel: deck.stems.allocatedLevels[name],
        active: activeMember(next,deck.id,trigger==='entry'?priorityId:null), participating: next.participation.byDeck[deck.id].stemHandoff,
        returnEligible: next.stemSession.eligibilityByDeck[deck.id][name] }));
      const enabled = next.stemSession.automaticHandoffEnabled;
      const total = snapshots.filter(deck=>deck.active&&deck.participating).reduce((sum,deck)=>
        sum + deck.volume * (deck.id===priorityId ? deck.requestedLevel : deck.allocatedLevel),0);
      if (enabled && total >= 1 - 1e-12) sharing[name] = true;
      // A new owner previously contributed zero. F3 entry consumes only its
      // effective requested gain; silent entry leaves every existing peer intact.
      const transferInput=incremental || (options.firstPlayIncremental && trigger==='entry' ? {
        previousGain:0,history:next.stemSession.nativeHandoff.touchOrder?.[name] || []
      }:null);
      const result = calculateFourDeckStemAllocation({ decks: snapshots, enabled,
        relationshipEstablished: sharing[name], authorizationCeiling: next.stemSession.authorization.ceilingsByStem[name],
        trigger, priorityDeckId: priorityId, incremental:transferInput });
      if(transferInput && result.excess>1e-9) throw new Error('Incremental gesture exceeds stem capacity: existing allocation mismatch; lower independent levels before joining.');
      if(transferInput) next.stemSession=Object.freeze({...next.stemSession,nativeHandoff:Object.freeze({
        ...next.stemSession.nativeHandoff,transfers:Object.freeze({...next.stemSession.nativeHandoff.transfers,
          [name]:Object.freeze({...result.transfer,deficit:result.deficit,excess:result.excess})})
      })});
      for (const deck of next.decks) deck.stems = Object.freeze({ requestedLevels: deck.stems.requestedLevels,
        allocatedLevels: Object.freeze({ ...deck.stems.allocatedLevels, [name]: result.allocationsByDeck[deck.id] }) });
    }
    nativeState(next,members,sharing);
  }
  function ready() { if (pending) throw new Error('A native start is pending. Retry after Play completes.'); }
  function apply(next, control) { bridge.applySnapshot(targets(next)); publish(next,control); }
  function rememberTouch(next,id,name) {
    const previous=next.stemSession.nativeHandoff.touchOrder?.[name] ||
      state.decks.filter(item=>item.stems.allocatedLevels[name]>0).map(item=>item.id);
    const touchOrder={...next.stemSession.nativeHandoff.touchOrder,
      [name]:Object.freeze([...previous.filter(item=>item!==id),id])};
    next.stemSession=Object.freeze({...next.stemSession,nativeHandoff:Object.freeze({
      ...next.stemSession.nativeHandoff,touchOrder:Object.freeze(touchOrder)
    })});
  }
  function gesture(id, name, value, gestureId) {
    ready(); const next=copy(), before=next.stemSession;
    // Reuse existing direct validation and eligibility without invoking the legacy pair path.
    next.stemSession=Object.freeze({ ...before, automaticHandoffEnabled:false });
    const actions=createStemActions(next);
    const changed=name ? actions.setStemLevel(id,name,value,gestureId) : actions.setDeckVolume(id,value,gestureId);
    next.stemSession=Object.freeze({ ...next.stemSession, automaticHandoffEnabled:before.automaticHandoffEnabled });
    const deck=next.decks.find(item=>item.id===id);
    if(changed&&before.automaticHandoffEnabled&&next.participation.byDeck[id].stemHandoff) {
      next.stemSession=Object.freeze({ ...next.stemSession,
        authorization:calculateStemAuthorization(before.authorization,deck.volume,deck.stems.allocatedLevels,name||null) });
    }
    if(changed && activeMember(next,id) && next.participation.byDeck[id].stemHandoff) {
      const incremental=options.incremental && name ? {
        previousGain:state.decks.find(item=>item.id===id).volume * state.decks.find(item=>item.id===id).stems.allocatedLevels[name],
        history:before.nativeHandoff.touchOrder?.[name] || state.decks.filter(item=>item.stems.allocatedLevels[name]>0).map(item=>item.id)
      }:null;
      allocate(next,'directGesture',id,name?[name]:stemCategories,!name,incremental);
    }
    if(options.incremental && name) rememberTouch(next,id,name);
    apply(next,name?getStemControlId(id,name):getDeckVolumeControlId(id));
    return changed;
  }
  async function play(id) {
    ready(); const player=mixer.getDeck(id), was=player.getState();
    if(was.isPlaying||was.closed||was.loading||!was.loaded)return false;
    const next=copy(), existing=next.stemSession.nativeHandoff.members[id];
    const enabled=next.stemSession.automaticHandoffEnabled&&next.participation.byDeck[id].stemHandoff;
    if(!existing || options.liveLifecycle) {
      nativeState(next,{ ...next.stemSession.nativeHandoff.members,[id]:true });
      if(enabled)allocate(next,'entry',id,stemCategories,!!(options.liveLifecycle && existing));
    }
    const token={id, revision};pending=token;
    try {
      // Legacy Resume retains ownership without allocation. G2 Resume re-enters
      // with current prepared coefficients, never a suppressed historical request.
      const started=await bridge.startCoordinated(id,targets(next,id));
      if(!started||revision!==token.revision){ if(started)player.pause();return false; }
      publish(next);return true;
    } finally { if(pending===token)pending=null; }
  }
  function lifecycle(id,type) {
    if(type==='started')return; // Successful scheduling is committed by play(), not this event.
    if(pending && !pending.cancelled) {
      pending.cancelled=true; mixer.getDeck(pending.id).pause();
    }
    revision++;
    if(!['eject','replacement'].includes(type))return; // Pause/Stop/end retain ownership.
    const next=copy();
    if(!next.stemSession.nativeHandoff.members[id])return;
    nativeState(next,{ ...next.stemSession.nativeHandoff.members,[id]:false });
    try {
      // G2 departure never distributes freed capacity. Preserve every peer's
      // current levels, including automatic zeros and deliberate manual zeros.
      if(!options.liveLifecycle)allocate(next,'departure');
      apply(next);
    }
    catch(error) {
      // Audio has already departed. Preserve truthful ownership even when a new gain
      // plan rejects; retain the old coefficients and surface the scheduling error.
      const retained=copy();nativeState(retained,next.stemSession.nativeHandoff.members);publish(retained);
      lastError=error;onCommit(state,{ directControl:null,automaticControls:[],error });
    }
  }
  const unsubscribe=ids.map(id=>mixer.getDeck(id).subscribe(type=>lifecycle(id,type)));
  return Object.freeze({ play,
    touchStem(id,name) {
      if(!options.incremental)return false;
      ready();requireStemDeckId(id);
      if(!stemCategories.includes(name))throw new RangeError('Unknown stem category');
      const next=copy();rememberTouch(next,id,name);publish(next);return true;
    },
    setStemLevel:(id,name,value,gestureId)=>gesture(id,name,value,gestureId),
    setMainVolume:(id,value,gestureId)=>gesture(id,null,value,gestureId),
    setParticipation(id,value) {
      ready();const next=copy();createParticipationActions(next).set(id,'stemHandoff',value);
      apply(next);return true;
    },
    setEnabled(value) {
      ready();const next=copy();createAutomaticStemHandoffActions(next).set(value);
      apply(next);
    },
    synchronizeAudio:()=>bridge.applySnapshot(targets(state)),
    getLastError:()=>lastError,
    getDiagnostics:()=>({
      lastSchedulingFailure:mixer.getLastSchedulingFailure(),
      nativeAudio:mixer.getDiagnostics(),
      automaticHandoffEnabled:state.stemSession.automaticHandoffEnabled,
      decks:ids.map(id=>({ id, loaded:mixer.getDeck(id).getState().loaded,
        isPlaying:mixer.getDeck(id).getState().isPlaying,
        ownsAllocation:state.stemSession.nativeHandoff.members[id],
        liveParticipant:!!(activeMember(state,id) && state.stemSession.automaticHandoffEnabled && state.participation.byDeck[id].stemHandoff),
        participating:state.participation.byDeck[id].stemHandoff }))
    }),
    dispose:()=>unsubscribe.forEach(remove=>remove())
  });
}
