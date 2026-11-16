async function runFirstPlayHandoffTests(options={}) {
 let checks=0;const check=(x,label)=>{checks++;if(!x)throw new Error(label);};
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 for(const manualZero of [false,true])for(const prepared of [0,.01,.3])for(const participation of [false,true])for(const fourth of ['unloaded','loaded','playing','participating']){
  const label=JSON.stringify({manualZero,prepared,participation,fourth});
  const f=createStemSchedulingFixture();
  const state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
  const a=createNativeStemHandoffActions(state,f.mixer,()=>{},{incremental:true,firstPlayIncremental:!!options.fixed});
  for(const id of [1,2,3,4]){
   a.setParticipation(id,id!==4);
   a.setMainVolume(id,1,'main');
   for(const name of stemCategories)a.setStemLevel(id,name,0,'silence');
  }
  for(const id of [1,2]){await f.load(id);await a.play(id);}
  a.setStemLevel(1,'tune',1,'first-owner');a.setStemLevel(2,'tune',1,'second-owner');
  if(manualZero)a.setStemLevel(1,'tune',0,'explicit-zero');
  if(fourth!=='unloaded'){
   await f.load(4);a.setStemLevel(4,'tune',.4,'independent');
   if(['playing','participating'].includes(fourth))await a.play(4);
   if(fourth==='participating'){a.setParticipation(4,true);a.setStemLevel(4,'tune',0,'fourth-silent');a.setStemLevel(4,'tune',.4,'fourth-owner');a.setStemLevel(2,'tune',1,'restore-second');}
  }
  const beforeLoad=JSON.stringify(state.decks.slice(0,2).map(d=>d.stems));
  await f.load(3);
  check(JSON.stringify(state.decks.slice(0,2).map(d=>d.stems))===beforeLoad,'Load preserves peers '+label);
  a.setStemLevel(3,'tune',prepared,'prepared');a.setParticipation(3,participation);
  const history=JSON.stringify(state.stemSession.nativeHandoff.touchOrder),auth=state.stemSession.authorization;
  const fourthBefore=state.decks[3].stems;
  check(state.decks[0].stems.allocatedLevels.tune===0&&state.decks[1].stems.allocatedLevels.tune===1,'0/100 preparation '+label);
  check(await a.play(3),'First Play starts '+label);
  const expected=participation?1-prepared:1;
  console.log('FIRST PLAY '+label+' -> '+state.decks.map(d=>d.stems.allocatedLevels.tune).join('/'));
  check(state.decks[0].stems.allocatedLevels.tune===0&&near(state.decks[1].stems.allocatedLevels.tune,expected),'First Play preserves unrelated zero and transfers only needed gain '+label);
  check(near(state.decks[2].stems.allocatedLevels.tune,prepared),'Entrant priority '+label);
  check(stemCategories.every(name=>near(state.decks[3].stems.allocatedLevels[name],fourthBefore.allocatedLevels[name])) && state.decks[3].stems.requestedLevels===fourthBefore.requestedLevels,'Unrelated fourth preserved '+label);
  check(JSON.stringify(state.stemSession.nativeHandoff.touchOrder)===history&&state.stemSession.authorization===auth,'Play is not a touch or authorization '+label);
  const allocated=JSON.stringify(state.decks.map(d=>d.stems));
  f.mixer.getDeck(3).pause();check(await a.play(3),'Resume starts '+label);
  check(JSON.stringify(state.decks.map(d=>d.stems))===allocated,'Pause/resume preserves allocations '+label);
  f.mixer.getDeck(3).stop();check(await a.play(3),'Restart starts '+label);
  check(JSON.stringify(state.decks.map(d=>d.stems))===allocated,'Stop/restart retains ownership '+label);
  f.audio.currentTime+=.1;
  for(const id of [1,2,3])check(near(f.mixer.getDeck(id).getDiagnostics().stems.tune.modeledEffectiveGain,state.decks[id-1].stems.allocatedLevels.tune),'Native target agrees '+label);
  a.dispose();await f.mixer.close();
 }
 console.log('First-play handoff tests passed: '+checks+' checks');
}
