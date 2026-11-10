async function runNativeStemHandoffTests() {
  let checks=0;
  const check=(value,message)=>{checks++;if(!value)throw new Error(message);};
  const near=(a,b)=>Math.abs(a-b)<1e-12;
  async function rejects(action,message){let failed=false;try{await action();}catch(_){failed=true;}check(failed,message);}
  async function fixture(loadDecks = true) {
    const f=createStemSchedulingFixture();
    const state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
    const displays={};let notifications=0;
    const actions=createNativeStemHandoffActions(state,f.mixer,(_,details)=>{
      notifications++;
      // Same allocation projection used by the reusable controls' refresh function.
      for(const deck of state.decks)for(const name of stemCategories)displays[getStemControlId(deck.id,name)]=deck.stems.allocatedLevels[name];
    });
    actions.synchronizeAudio();
    if (loadDecks) for(const id of [1,2,3,4])await f.load(id);
    return {...f,state,actions,displays,notifications:()=>notifications};
  }
  // Unloaded and loaded-never-played decks are distinct from retained paused owners.
  const isolation=await fixture(false);
  isolation.actions.setMainVolume(1,1,'prepare-first');
  isolation.actions.setStemLevel(2,'voice',1,'prepare-unloaded-voice');
  for(const loaded of [false,true]) {
    if(loaded)await isolation.load(2);
    const deckBefore=JSON.stringify(isolation.state.decks[0]);
    const membersBefore=JSON.stringify(isolation.state.stemSession.nativeHandoff.members);
    for(const volume of [0.25,0.75,0,1])isolation.actions.setMainVolume(2,volume,'inactive-volume-'+volume);
    check(JSON.stringify(isolation.state.decks[0])===deckBefore,'Unloaded/never-played volume does not change Deck 1 state');
    check(JSON.stringify(isolation.state.stemSession.nativeHandoff.members)===membersBefore,'Preparation never acquires ownership');
    check(isolation.mixer.getDeck(2).getState().loaded===loaded,'Test distinguishes unloaded and loaded states');
  }
  await isolation.load(1);await isolation.actions.play(1);isolation.audio.currentTime=0.005;
  const isolatedLiveBefore=JSON.stringify(isolation.state.decks[0]);
  const liveEvents=JSON.stringify(isolation.gains.slice(0,6).map(g=>g.events));
  isolation.actions.setMainVolume(2,0.4,'inactive-while-playing');
  check(JSON.stringify(isolation.state.decks[0])===isolatedLiveBefore,'Never-played preparation preserves active allocation/request state');
  check(JSON.stringify(isolation.gains.slice(0,6).map(g=>g.events))===liveEvents,'Never-played preparation must not retime active envelopes');
  isolation.mixer.getDeck(2).eject();
  const unloadedLiveBefore=JSON.stringify(isolation.state.decks[0]);
  const unloadedLiveEvents=JSON.stringify(isolation.gains.slice(0,6).map(g=>g.events));
  isolation.actions.setMainVolume(2,0.8,'unloaded-while-playing');
  isolation.actions.setStemLevel(2,'voice',0.25,'unloaded-stem-while-playing');
  check(JSON.stringify(isolation.state.decks[0])===unloadedLiveBefore,'Unloaded volume/stem preparation preserves active deck state');
  check(JSON.stringify(isolation.gains.slice(0,6).map(g=>g.events))===unloadedLiveEvents,'Unloaded preparation leaves active envelopes unchanged');
  check(!isolation.state.stemSession.nativeHandoff.members[2],'Unloaded deck has no ownership');
  isolation.actions.dispose();await isolation.mixer.close();
  const paused=await fixture();
  for(const id of [1,2]) {
    paused.actions.setMainVolume(id,1,'prepare-volume-'+id);
    paused.actions.setStemLevel(id,'voice',1,'prepare-voice-'+id);
  }
  await paused.actions.play(1);paused.audio.currentTime=0.1;await paused.actions.play(2);
  paused.audio.currentTime=0.2;paused.actions.setStemLevel(2,'voice',0.5,'share-voice');
  paused.mixer.getDeck(1).pause();paused.mixer.getDeck(2).pause();
  paused.actions.setMainVolume(2,0.5,'paused-owner-volume');
  check(paused.state.stemSession.nativeHandoff.members[2]&&paused.state.decks[0].stems.allocatedLevels.voice===0.75,
    'Silent retained owner can redistribute allocations; this is real ownership, not UI cross-wiring');
  await paused.load(2);
  const afterReplacement=JSON.stringify(paused.state.decks[0]);
  paused.actions.setMainVolume(2,1,'replacement-preparation');
  check(!paused.state.stemSession.nativeHandoff.members[2]&&JSON.stringify(paused.state.decks[0])===afterReplacement,
    'Load replacement releases old ownership and restores preparation isolation');
  paused.actions.dispose();await paused.mixer.close();
  // Rejected gestures must never enter shared-session failure cleanup.
  const guarded=await fixture(false);
  guarded.actions.setMainVolume(1,1,'guarded-volume');await guarded.load(1);await guarded.actions.play(1);
  guarded.audio.currentTime=0.1;
  const transportEvents=[];const remove=guarded.mixer.getDeck(1).subscribe(type=>transportEvents.push(type));
  const beforeRejected=JSON.stringify(guarded.state.decks);
  const automationBefore=JSON.stringify(guarded.gains.map(g=>g.events));
  await rejects(()=>guarded.actions.setMainVolume(1,0.4,'rejected-playing-volume'),'Unsupported playing volume rejects before scheduling');
  check(guarded.mixer.getDeck(1).getState().isPlaying&&transportEvents.length===0,'Rejected volume cannot pause Deck 1');
  check(JSON.stringify(guarded.state.decks)===beforeRejected&&JSON.stringify(guarded.gains.map(g=>g.events))===automationBefore,
    'Rejected playing volume preserves state and all native automation');
  for(const loaded of [false,true]) {
    if(loaded)await guarded.load(2);
    guarded.actions.setMainVolume(2,0.8,'silent-deck-volume');
    guarded.actions.setMainVolume(2,0.3,'silent-deck-volume-again');
    check(guarded.mixer.getDeck(1).getState().isPlaying&&transportEvents.length===0,'Unloaded/never-played Deck 2 volume leaves Deck 1 playing');
    check(JSON.stringify(guarded.gains.map(g=>g.events))===automationBefore,'Silent preparation performs no audible native scheduling');
  }
  check(guarded.mixer.getLastSchedulingFailure()===null,'Preflight rejection/preparation never records a shared scheduling failure');
  const inactiveDiagnostic=guarded.actions.getDiagnostics().decks.find(deck=>deck.id===2);
  check(inactiveDiagnostic.loaded&&!inactiveDiagnostic.isPlaying&&!inactiveDiagnostic.ownsAllocation,'Diagnostic identifies loaded-never-played state');
  remove();guarded.actions.dispose();await guarded.mixer.close();
  // Retained owner: accepted redistribution differs from a rejected live volume.
  const deadline=await fixture();
  for(const id of [1,2]) {
    deadline.actions.setMainVolume(id,1,'deadline-volume-'+id);
    deadline.actions.setStemLevel(id,'voice',1,'deadline-voice-'+id);
  }
  await deadline.actions.play(1);deadline.audio.currentTime=0.1;await deadline.actions.play(2);
  deadline.audio.currentTime=0.2;deadline.actions.setStemLevel(2,'voice',0.5,'deadline-sharing');
  const rejectionAutomation=JSON.stringify(deadline.gains.map(g=>g.events));
  const rejectionDomain=JSON.stringify(deadline.state.decks);
  await rejects(()=>deadline.actions.setMainVolume(2,0.6,'unsupported-deck-two'),'Unsupported Deck 2 volume rejects while both decks play');
  check(deadline.mixer.getDeck(1).getState().isPlaying&&deadline.mixer.getDeck(2).getState().isPlaying,
    'Rejected Deck 2 gesture leaves both native sessions playing');
  check(JSON.stringify(deadline.gains.map(g=>g.events))===rejectionAutomation&&JSON.stringify(deadline.state.decks)===rejectionDomain,
    'Rejected Deck 2 volume performs no native writes or domain commit');
  check(deadline.mixer.getLastSchedulingFailure()===null,'Unsupported Deck 2 gesture never invokes shared failure handler');
  deadline.mixer.getDeck(2).pause();deadline.audio.currentTime=0.3;
  deadline.actions.setMainVolume(2,0.5,'retained-owner-volume');
  check(deadline.mixer.getDeck(1).getState().isPlaying,'Accepted paused-owner volume redistribution does not normally pause Deck 1');
  // Simulate native calls taking longer than the one-quantum scheduling reservation.
  const originalSet=deadline.gains[0].gain.setValueAtTime;
  deadline.gains[0].gain.setValueAtTime=function(value,time) {
    originalSet(value,time);deadline.audio.currentTime=time+0.01;
  };
  const domainBeforeDeadline=JSON.stringify(deadline.state.decks);
  await rejects(()=>deadline.actions.setMainVolume(2,0.25,'retained-owner-deadline'),'Actual scheduling deadline failure is surfaced');
  check(!deadline.mixer.getDeck(1).getState().isPlaying,'Actual partial scheduling failure intentionally invokes shared pause');
  check(JSON.stringify(deadline.state.decks)===domainBeforeDeadline,'Native failure does not commit the rejected domain proposal');
  const failureDiagnostic=deadline.actions.getDiagnostics();
  check(failureDiagnostic.lastSchedulingFailure.operation==='retarget'&&
    failureDiagnostic.lastSchedulingFailure.message.includes('deadline missed')&&
    failureDiagnostic.lastSchedulingFailure.playingDeckIds.join(',')==='1',
    'Diagnostic identifies actual shared failure and decks playing immediately before safety pause');
  check(failureDiagnostic.lastSchedulingFailure.observedTime>failureDiagnostic.lastSchedulingFailure.scheduledTime,
    'Diagnostic distinguishes elapsed scheduling deadline from gesture rejection');
  check(failureDiagnostic.decks[1].ownsAllocation&&!failureDiagnostic.decks[1].isPlaying,
    'Diagnostic exposes retained paused owner');
  deadline.actions.dispose();await deadline.mixer.close();
  const f=await fixture();
  const voice=id=>f.state.decks[id-1].stems.allocatedLevels.voice;
  const owner=id=>f.state.stemSession.nativeHandoff.members[id];
  const set=(id,value)=>f.actions.setStemLevel(id,'voice',value,'test-'+id+'-'+value);
  for(const id of [1,2,3,4])f.actions.setMainVolume(id,1,'volume-'+id);
  set(1,0.5);set(2,0.5);
  check(![1,2,3,4].some(owner),'Loaded preparation has no owners');
  check(await f.actions.play(1),'First native deck starts');check(owner(1)&&!owner(2),'First successful native start owns allocation');
  f.audio.currentTime=0.1;
  check(await f.actions.play(2),'Second deck starts');
  check(near(voice(1),0.5)&&near(voice(2),0.5),'Two playing decks share Voice');
  const authorization=JSON.stringify(f.state.stemSession.authorization);
  set(3,1);check(near(voice(1),0.5)&&near(voice(2),0.5),'Never-played preparation leaves live allocations alone');
  const beforePlayAuthorization=JSON.stringify(f.state.stemSession.authorization);
  f.audio.currentTime=0.2;
  check(await f.actions.play(3),'Third deck starts');
  check(voice(1)===0&&voice(2)===0&&voice(3)===1,'Third-deck Voice takeover');
  check(JSON.stringify(f.state.stemSession.authorization)===beforePlayAuthorization,'Play grants no authorization');
  check(f.state.decks[0].stems.requestedLevels.voice===0.5,'Suppressed human request retained');
  check(f.displays['deck.1.stem.voice.level']===0&&f.displays['deck.3.stem.voice.level']===1,'Commit refresh projects all faders');
  f.mixer.getDeck(3).pause();check(owner(3)&&voice(3)===1,'Pause retains ownership and allocation');
  const allocations=JSON.stringify(f.state.decks.map(d=>d.stems));
  f.audio.currentTime=0.3;check(await f.actions.play(3),'Resume succeeds');
  check(JSON.stringify(f.state.decks.map(d=>d.stems))===allocations,'Resume does not allocate from requests again');
  f.mixer.getDeck(3).eject();check(!owner(3)&&near(voice(1),0.5)&&near(voice(2),0.5),'Eject restores latest equal requests');
  set(4,0.25);f.audio.currentTime=0.4;await f.actions.play(4);await f.load(3);set(3,0.25);
  f.audio.currentTime=0.5;await f.actions.play(3);
  check([1,2,3,4].every(owner),'Four owners supported');
  check(f.state.decks.reduce((sum,d)=>sum+d.volume*d.stems.allocatedLevels.voice,0)<=1+1e-12,'Four-deck Voice targets capped');
  f.audio.currentTime=0.6;set(4,0.7);
  check(voice(4)===0.7&&near(voice(1)+voice(2)+voice(3),0.3),'Live fader has priority with proportional receivers');
  check(f.displays['deck.1.stem.voice.level']===voice(1),'Automatic receiver fader projection synchronized');
  check(f.state.decks[1].stems.allocatedLevels.flow===0,'Untouched zero category never introduced');
  await rejects(()=>f.actions.setMainVolume(1,0.2,'unsupported'),'Unsupported live main-volume adjustment rejects');
  check(f.state.decks[0].volume===1,'Rejected volume does not commit domain state');
  const liveBefore=JSON.stringify(f.state.participation);
  await rejects(()=>f.actions.setParticipation(4,false),'Unsafe audible exclusion rejects instead of exceeding cap');
  check(JSON.stringify(f.state.participation)===liveBefore,'Rejected participation leaves authoritative store unchanged');
  f.mixer.getDeck(3).pause();f.actions.setParticipation(3,false);
  check(!f.state.participation.byDeck[3].stemHandoff&&owner(3),'Checkbox excludes retained paused owner');
  f.actions.setParticipation(3,true);check(f.state.participation.byDeck[3].stemHandoff,'Reenable checkbox rebalances');
  f.actions.setEnabled(false);const before=voice(2);set(1,0.01);
  check(voice(2)===before,'Global OFF leaves other controls independent');f.actions.setEnabled(true);
  // Replacement releases the old song; no auto-entry until new successful Play.
  await f.load(4);check(!owner(4)&&!f.mixer.getDeck(4).getState().isPlaying,'Replacement releases ownership');
  f.audio.currentTime=0.7;await f.actions.play(4);
  const last=f.sources.slice(-4);for(const source of last)source.onended();
  check(owner(4)&&f.mixer.getDeck(4).getState().loaded&&!f.mixer.getDeck(4).getState().isPlaying,'Natural end retains loaded song/ownership');
  f.actions.dispose();await f.mixer.close();
  const bad=await fixture();bad.actions.setMainVolume(1,1,'prepare');
  bad.fail(3);await rejects(()=>bad.actions.play(1),'Partial source failure surfaces');
  check(!bad.state.stemSession.nativeHandoff.members[1],'Failed join never owns allocations');
  bad.fail(0);let resume;bad.wait(new Promise(resolve=>{resume=resolve;}));
  const cancelled=bad.actions.play(1);bad.mixer.getDeck(1).eject();resume();
  check(await cancelled===false&&!bad.state.stemSession.nativeHandoff.members[1],'Cancelled join never owns allocations');
  bad.wait(null);await bad.load(1);
  let finish;bad.wait(new Promise(resolve=>{finish=resolve;}));
  const pending=bad.actions.play(1);
  await rejects(()=>bad.actions.setStemLevel(2,'voice',0.5,'racing'),'Gestures during async start reject rather than commit stale snapshots');
  bad.mixer.getDeck(2).pause();finish();check(await pending===false,'Other native lifecycle event invalidates pending join');
  bad.actions.dispose();await bad.mixer.close();
  console.log('Native handoff integration tests passed: '+checks+' checks; 1-4 owners, preparation, takeover, lifecycle, fader projection, participation and start failures');
}
