async function runIncrementalNativeTests(){
 let checks=0;const check=(x,label)=>{checks++;if(!x)throw new Error(label);};
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 const f=createStemSchedulingFixture();
 const state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
 const a=createNativeStemHandoffActions(state,f.mixer,()=>{},{incremental:true});
 const level=(id,value)=>{f.audio.currentTime+=.03;return a.setStemLevel(id,'tune',value,'test-'+checks+'-'+value);};
 const gains=()=>state.decks.map(d=>d.stems.allocatedLevels.tune);
 for(const id of [1,2,3,4]){
  await f.load(id);a.setMainVolume(id,1,'main');
  for(const name of ['transients','flow','voice'])a.setStemLevel(id,name,0,'zero');
  a.setStemLevel(id,'tune',0,'prepare-zero');await a.play(id);
 }
 a.setParticipation(4,false);
 level(1,1);level(2,1);level(1,1);
 check(gains().every((v,i)=>near(v,i===0?1:0)),'Established automatic-zero reproduction setup');
 level(3,.01);
 check(near(gains()[0],.99)&&gains()[1]===0&&near(gains()[2],.01),'Real native adapter reproduction 99/0/1');
 level(3,0);check(near(gains()[0],1)&&gains()[1]===0,'Reverse history returns to last donor, not stale requester');
 level(2,1);level(2,.6);check(near(gains()[0],.4)&&near(gains()[1],.6),'100 -> 60 restores previous owner 40');
 level(1,0);level(2,.5);check(gains()[0]===0,'Manual zero excluded despite history');
 level(1,.5);level(3,.3);
 check(near(gains()[0],.35)&&near(gains()[1],.35)&&near(gains()[2],.3),'Arbitrary three-way distribution');
 level(2,.3);check(near(gains()[2],.35),'Most recent third deck gets freed gain');
 a.setParticipation(4,true);level(4,.2);
 for(let i=0;i<100;i++){
  const id=i%4+1;level(id,(i*13%100)/100);
  check(gains().reduce((sum,v)=>sum+v,0)<=1+1e-9,'Four-deck cap rapid');
  check([1,2,3,4].every(id=>f.mixer.getDeck(id).getState().isPlaying),'No unintended pauses');
 }
 f.audio.currentTime+=.1;
 for(const id of [1,2,3,4])check(near(f.mixer.getDeck(id).getDiagnostics().stems.tune.modeledEffectiveGain,gains()[id-1]),'Committed native gain agrees');
 const before=state.stemSession.nativeHandoff.touchOrder.tune;
 a.setMainVolume(1,0,'main-zero');check(state.stemSession.nativeHandoff.touchOrder.tune===before,'Main does not rewrite per-category stem touch history');
 a.setMainVolume(1,1,'main-restore');
 const flowHistoryBeforeTouch=state.stemSession.nativeHandoff.touchOrder.flow;
 const levelsBeforeTouch=JSON.stringify(gains()),authBeforeTouch=state.stemSession.authorization;
 a.touchStem(2,'tune');
 check(JSON.stringify(gains())===levelsBeforeTouch && state.stemSession.authorization===authBeforeTouch,'Touch without movement does not change gains or authorization');
 check(state.stemSession.nativeHandoff.touchOrder.tune.slice(-1)[0]===2,'Touch without movement updates history');
 check(state.stemSession.nativeHandoff.touchOrder.flow===flowHistoryBeforeTouch,'Category histories remain independent');
 const snapshot=JSON.stringify(state.stemSession.nativeHandoff.touchOrder);
 // Preserve-on-enable can create an over-cap mismatch. A small delta must not
 // conceal it by normalizing everyone; the native safety check rejects atomically.
 for(const id of [1,2,3,4])a.setParticipation(id,false);
 level(1,.8);level(2,.8);level(3,0);level(4,0);
 for(const id of [1,2,3])a.setParticipation(id,true);
 const prior=JSON.stringify(state);let rejected=false;
 try{level(3,.01);}catch(e){rejected=/capacity/.test(e.message);}
 check(rejected&&JSON.stringify(state)===prior,'Unresolvable preexisting excess rejects gesture and history atomically');
 check([1,2,3,4].every(id=>f.mixer.getDeck(id).getState().isPlaying),'Rejected unsafe proposal does not pause transport');
 check(!f.mixer.getLastSchedulingFailure(),'No native partial failure');
 a.dispose();await f.mixer.close();
 console.log('Incremental native tests passed: '+checks+' checks');
}
