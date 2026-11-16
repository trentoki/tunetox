async function runLiveLifecycleTests(options={}){
 let checks=0;const check=(x,label)=>{checks++;if(!x)throw new Error(label);};
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 async function fixture(count=3){
  const f=createStemSchedulingFixture();
  const state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
  const a=createNativeStemHandoffActions(state,f.mixer,()=>{},{incremental:true,firstPlayIncremental:true,liveLifecycle:!!options.fixed});
  for(const id of [1,2,3,4]){a.setParticipation(id,id<=count);for(const name of stemCategories)a.setStemLevel(id,name,0,'zero');a.setMainVolume(id,1,'main');}
  for(let id=1;id<=count;id++){await f.load(id);await a.play(id);}
  const level=(id,name,value)=>{f.audio.currentTime+=.05;return a.setStemLevel(id,name,value,'gesture');};
  return {...f,state,a,level,close:async()=>{a.dispose();await f.mixer.close();}};
 }
 if(options.reproduceRelease){
  for(const paused of [false,true]){
   const f=await fixture();f.level(1,'tune',1);f.level(2,'tune',1);
   if(paused)f.mixer.getDeck(3).pause();
   f.mixer.getDeck(3).eject();console.log('RELEASE '+(paused?'paused':'playing')+' '+f.state.decks.map(d=>d.stems.allocatedLevels.tune).join('/'));
   check(f.state.decks[0].stems.allocatedLevels.tune===0&&f.state.decks[1].stems.allocatedLevels.tune===1,'Silent Release must preserve 0/100');await f.close();
  }return;
 }
 for(const count of [3,4])for(const name of stemCategories)for(const subject of Array.from({length:count},(_,i)=>i+1)){
  const f=await fixture(count),other=subject===1?2:1,zero=[1,2,3,4].find(id=>id!==other&&id!==subject&&id<=count);
  f.level(zero,name,1);f.level(other,name,1);f.level(subject,name,.3);
  check(near(f.state.decks[other-1].stems.allocatedLevels[name],.7),'Setup donor 70%');
  const beforePause=JSON.stringify(f.state.decks.map(d=>d.stems));f.mixer.getDeck(subject).pause();
  check(JSON.stringify(f.state.decks.map(d=>d.stems))===beforePause,'Pause never redistributes');
  f.level(subject,name,1);
  console.log('PAUSED '+count+' '+subject+' '+name+' '+f.state.decks.map(d=>d.stems.allocatedLevels[name]).join('/'));
  check(near(f.state.decks[other-1].stems.allocatedLevels[name],.7)&&f.state.decks[zero-1].stems.allocatedLevels[name]===0,'Paused fader isolates live peers');
  check(f.state.decks[subject-1].stems.allocatedLevels[name]===1,'Paused prepared target retained');
  const history=JSON.stringify(f.state.stemSession.nativeHandoff.touchOrder),auth=f.state.stemSession.authorization;
  check(await f.a.play(subject),'Resume succeeds');
  check(f.state.decks[other-1].stems.allocatedLevels[name]===0&&f.state.decks[subject-1].stems.allocatedLevels[name]===1&&f.state.decks[zero-1].stems.allocatedLevels[name]===0,'Resume transfers only required contribution');
  check(JSON.stringify(f.state.stemSession.nativeHandoff.touchOrder)===history&&f.state.stemSession.authorization===auth,'Resume never changes history or authorizes');
  await f.close();
 }
 // Release preserves peers for every subject/category and both zero provenances.
 for(const count of [3,4])for(const name of stemCategories)for(let subject=1;subject<=count;subject++)for(const paused of [false,true])for(const amount of [0,.3])for(const manualZero of [false,true]){
  const f=await fixture(count),other=subject===1?2:1,zero=[1,2,3,4].find(id=>id!==other&&id!==subject&&id<=count);
  f.level(zero,name,1);f.level(other,name,1);if(manualZero)f.level(zero,name,0);
  if(amount)f.level(subject,name,amount);
  if(paused)f.mixer.getDeck(subject).pause();
  const peers=JSON.stringify(f.state.decks.filter(d=>d.id!==subject).map(d=>d.stems));
  const history=JSON.stringify(f.state.stemSession.nativeHandoff.touchOrder),auth=f.state.stemSession.authorization;
  f.mixer.getDeck(subject).eject();
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==subject).map(d=>d.stems))===peers,'Release never normalizes peers');
  check(!f.state.stemSession.nativeHandoff.members[subject]&&!f.mixer.getDeck(subject).getState().loaded,'Release removes retained ownership and native asset');
  check(JSON.stringify(f.state.stemSession.nativeHandoff.touchOrder)===history&&f.state.stemSession.authorization===auth,'Release preserves history and authorization');
  check(Array.from({length:count},(_,i)=>i+1).filter(id=>id!==subject).every(id=>f.mixer.getDeck(id).getState().isPlaying),'Release preserves independent transports');
  f.mixer.getDeck(subject).eject();
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==subject).map(d=>d.stems))===peers,'Already empty Release is inert');
  await f.close();
 }
 // A paused automatic zero must not be restored by another deck or by Resume.
 for(const name of stemCategories)for(const manualZero of [false,true]){
  const f=await fixture(4);f.level(3,name,1);f.level(2,name,1);if(manualZero)f.level(3,name,0);
  f.mixer.getDeck(3).pause();f.level(2,name,.7);
  check(f.state.decks[2].stems.allocatedLevels[name]===0,'Paused peer is not a restoration recipient');
  const peers=JSON.stringify(f.state.decks.filter(d=>d.id!==3).map(d=>d.stems));
  await f.a.play(3);
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==3).map(d=>d.stems))===peers&&f.state.decks[2].stems.allocatedLevels[name]===0,'Silent Resume never reintroduces a stale request');
  f.mixer.getDeck(3).stop();f.level(3,name,1);
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==3).map(d=>d.stems))===peers,'Stopped prepared edits isolate too');
  await f.a.play(3);check(f.state.decks[1].stems.allocatedLevels[name]===0,'Stopped prepared restart enters incrementally');
  f.audio.currentTime+=.1;
  for(const d of f.state.decks)check(near(f.mixer.getDeck(d.id).getDiagnostics().stems[name].modeledEffectiveGain,d.volume*d.stems.allocatedLevels[name]),'Committed native/UI agreement');
  await f.close();
 }
 for(const name of stemCategories){
  const f=await fixture(4);f.level(1,name,.4);f.level(2,name,.4);f.level(3,name,.4);
  check(near(f.state.stemSession.authorization.ceilingsByStem[name],.4),'Setup bounded high-water');
  f.mixer.getDeck(3).pause();const other=f.state.decks[1].stems.allocatedLevels[name];f.level(3,name,.2);
  check(f.state.decks[1].stems.allocatedLevels[name]===other,'Paused gesture preserves donors under authorization');
  const auth=f.state.stemSession.authorization;await f.a.play(3);
  check(f.state.stemSession.authorization===auth,'Resume cannot raise high-water');
  f.level(2,name,.1);
  check(f.state.decks.every(d=>d.stems.allocatedLevels[name]<=.4+1e-9),'Restoration stays below authorization');
  f.a.setParticipation(3,false);const independent=f.state.decks[2].stems;f.level(1,name,.4);
  check(f.state.decks[2].stems===independent || f.state.decks[2].stems.allocatedLevels[name]===independent.allocatedLevels[name],'OFF peer stays independent');
  f.mixer.getDeck(3).pause();f.level(3,name,1);const before=JSON.stringify(f.state.decks.filter(d=>d.id!==3).map(d=>d.stems));await f.a.play(3);
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==3).map(d=>d.stems))===before,'OFF Resume is independent');
  await f.close();
 }
 for(const name of stemCategories){
  const f=await fixture(4);f.level(1,name,1);f.mixer.getDeck(2).pause();f.mixer.getDeck(3).pause();
  f.level(2,name,.6);f.level(3,name,.8);
  check(f.state.decks[0].stems.allocatedLevels[name]===1,'Multiple paused preparations leave donor untouched');
  await f.a.play(3);
  check(near(f.state.decks[0].stems.allocatedLevels[name],.2)&&f.state.decks[1].stems.allocatedLevels[name]===.6,'Resume excludes another prepared paused deck');
  await f.a.play(2);
  check(near(f.state.decks[0].stems.allocatedLevels[name],.08)&&near(f.state.decks[2].stems.allocatedLevels[name],.32)&&f.state.decks[1].stems.allocatedLevels[name]===.6,'Second Resume reduces only live donors proportionally');
  check(f.a.getDiagnostics().decks.every(d=>d.liveParticipant),'All resumed members reported live');
  await f.close();
 }
 for(const name of stemCategories){
  const f=await fixture(4);f.level(1,name,1);f.level(1,name,.5);f.level(2,name,.5);
  const history=JSON.stringify(f.state.stemSession.nativeHandoff.touchOrder);
  f.a.setMainVolume(1,.5,'live-main');
  check(near(f.state.decks[1].stems.allocatedLevels[name],.75),'Playing Main retains existing effective-gain handoff');
  f.a.setMainVolume(1,0,'main-zero');check(near(f.state.decks[1].stems.allocatedLevels[name],1),'Main zero retains existing restoration behavior');
  f.a.setMainVolume(1,1,'main-return');check(near(f.state.decks[1].stems.allocatedLevels[name],.5),'Main restoration retains coefficient semantics');
  f.mixer.getDeck(2).pause();const before=JSON.stringify(f.state.decks.filter(d=>d.id!==2).map(d=>d.stems));
  f.a.setMainVolume(2,0,'paused-main');
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==2).map(d=>d.stems))===before,'Paused Main cannot redistribute peers');
  await f.a.play(2);
  check(JSON.stringify(f.state.decks.filter(d=>d.id!==2).map(d=>d.stems))===before,'Main-zero Resume leaves donors unchanged');
  check(JSON.stringify(f.state.stemSession.nativeHandoff.touchOrder)===history,'Main/transport do not change stem recency');
  await f.close();
 }
 {
  const f=await fixture(3);f.level(1,'tune',1);f.level(2,'tune',1);f.mixer.getDeck(3).eject();
  const peers=JSON.stringify(f.state.decks.slice(0,2).map(d=>d.stems));
  f.a.setParticipation(3,true);f.mixer.getDeck(3).eject();
  check(JSON.stringify(f.state.decks.slice(0,2).map(d=>d.stems))===peers,'Empty enabled deck and repeated empty Release are inert');
  await f.load(3);f.mixer.getDeck(3).eject();
  check(JSON.stringify(f.state.decks.slice(0,2).map(d=>d.stems))===peers,'Loaded never-started Release preserves peers');
  check(!f.a.getDiagnostics().decks.find(d=>d.id===3).liveParticipant,'Released slot not a live participant');
  await f.close();
 }
 console.log('Live lifecycle tests passed: '+checks+' checks');
}
