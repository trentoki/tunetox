// Native-only shared action adapter. No DOM, metadata playback state or gain mathematics.
// Proposals reuse domain validators/authorization and the pure allocator; only the bridge
// schedules audio. Legacy two-deck hosts keep their existing actions and bridge.
function createNativeStemHandoffActions(state, mixer, onCommit = () => {}) {
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
      members: Object.freeze({ ...members }), sharing: Object.freeze({ ...sharing }) }) });
  }
  function targets(next) {
    return Object.fromEntries(ids.map(id => {
      const deck = next.decks.find(item => item.id === id);
      return [id, { mainVolume: deck.volume, levels: deck.stems.allocatedLevels }];
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
  function allocate(next, trigger, priorityId = null, categories = stemCategories) {
    const members = next.stemSession.nativeHandoff.members;
    const sharing = { ...next.stemSession.nativeHandoff.sharing };
    for (const name of categories) {
      const snapshots = next.decks.map(deck => ({ id: deck.id, volume: deck.volume,
        requestedLevel: deck.stems.requestedLevels[name], allocatedLevel: deck.stems.allocatedLevels[name],
        active: members[deck.id], participating: next.participation.byDeck[deck.id].stemHandoff,
        returnEligible: next.stemSession.eligibilityByDeck[deck.id][name] }));
      const enabled = next.stemSession.automaticHandoffEnabled;
      const total = snapshots.filter(deck=>deck.active&&deck.participating).reduce((sum,deck)=>
        sum + deck.volume * (deck.id===priorityId ? deck.requestedLevel : deck.allocatedLevel),0);
      if (enabled && total >= 1 - 1e-12) sharing[name] = true;
      const result = calculateFourDeckStemAllocation({ decks: snapshots, enabled,
        relationshipEstablished: sharing[name], authorizationCeiling: next.stemSession.authorization.ceilingsByStem[name],
        trigger, priorityDeckId: priorityId });
      for (const deck of next.decks) deck.stems = Object.freeze({ requestedLevels: deck.stems.requestedLevels,
        allocatedLevels: Object.freeze({ ...deck.stems.allocatedLevels, [name]: result.allocationsByDeck[deck.id] }) });
    }
    nativeState(next,members,sharing);
  }
  function ready() { if (pending) throw new Error('A native start is pending. Retry after Play completes.'); }
  function apply(next, control) { bridge.applySnapshot(targets(next)); publish(next,control); }
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
    if(changed && before.nativeHandoff.members[id] && next.participation.byDeck[id].stemHandoff) {
      allocate(next,'directGesture',id,name?[name]:stemCategories);
    }
    apply(next,name?getStemControlId(id,name):getDeckVolumeControlId(id));
    return changed;
  }
  async function play(id) {
    ready(); const player=mixer.getDeck(id), was=player.getState();
    if(was.isPlaying||was.closed||was.loading||!was.loaded)return false;
    const next=copy(), existing=next.stemSession.nativeHandoff.members[id];
    const enabled=next.stemSession.automaticHandoffEnabled&&next.participation.byDeck[id].stemHandoff;
    if(!existing) {
      nativeState(next,{ ...next.stemSession.nativeHandoff.members,[id]:true });
      if(enabled)allocate(next,'entry',id);
    }
    const token={id, revision};pending=token;
    try {
      // Resume uses current allocations, not retained requests. It is scheduled safely
      // but does not run the allocator or create another ownership transition.
      const started=await bridge.startCoordinated(id,targets(next));
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
    try { allocate(next,'departure');apply(next); }
    catch(error) {
      // Audio has already departed. Preserve truthful ownership even when a new gain
      // plan rejects; retain the old coefficients and surface the scheduling error.
      const retained=copy();nativeState(retained,next.stemSession.nativeHandoff.members);publish(retained);
      lastError=error;onCommit(state,{ directControl:null,automaticControls:[],error });
    }
  }
  const unsubscribe=ids.map(id=>mixer.getDeck(id).subscribe(type=>lifecycle(id,type)));
  return Object.freeze({ play,
    setStemLevel:(id,name,value,gestureId)=>gesture(id,name,value,gestureId),
    setMainVolume:(id,value,gestureId)=>gesture(id,null,value,gestureId),
    setParticipation(id,value) {
      ready();const next=copy();createParticipationActions(next).set(id,'stemHandoff',value);
      if(next.stemSession.nativeHandoff.members[id])allocate(next,'rebalance');
      apply(next);return true;
    },
    setEnabled(value) {
      ready();const next=copy();createAutomaticStemHandoffActions(next).set(value);
      if(value)allocate(next,'rebalance');apply(next);
    },
    synchronizeAudio:()=>bridge.synchronizeAudio(),
    getLastError:()=>lastError,
    getDiagnostics:()=>({
      lastSchedulingFailure:mixer.getLastSchedulingFailure(),
      nativeAudio:mixer.getDiagnostics(),
      automaticHandoffEnabled:state.stemSession.automaticHandoffEnabled,
      decks:ids.map(id=>({ id, loaded:mixer.getDeck(id).getState().loaded,
        isPlaying:mixer.getDeck(id).getState().isPlaying,
        ownsAllocation:state.stemSession.nativeHandoff.members[id],
        participating:state.participation.byDeck[id].stemHandoff }))
    }),
    dispose:()=>unsubscribe.forEach(remove=>remove())
  });
}
