// Acceptance regression checks for the focused Phase 1D repair.
// Run: osascript -l JavaScript tests/handoff-regression-investigation.js
ObjC.import('Foundation');
function read(path) { return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path,$.NSUTF8StringEncoding,null)); }
const files=['participation.js','development/audio/handoff/stem-state.js','development/audio/handoff/two-deck-stem-handoff.js','development/audio/handoff/four-deck-stem-allocation.js','app.js','experimental/four-stem-player.js','experimental/stem-handoff-audio-bridge.js','native-stem-handoff.js','tests/coordinated-stem-start-tests.js'];
let source=files.map(read).join('\n');
source += `
(async()=>{
  const result=[];
  function check(value,label){if(!value)throw new Error(label);}
  function record(name,data){result.push({name,...data});}
  async function fixture(participation=[true,true], levels=[.5,.5], start=true){
    const f=createStemSchedulingFixture();
    f.state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
    for(const id of [1,2,3,4])createParticipationActions(f.state).set(id,'stemHandoff',id<=2 && participation[id-1]);
    f.actions=createNativeStemHandoffActions(f.state,f.mixer);
    for(const id of [1,2]){
      f.actions.setMainVolume(id,1,'prepare-main');
      for(const name of prototypeStemNames)f.actions.setStemLevel(id,name,name==='flow'?levels[id-1]:0,'prepare-stem');
      await f.load(id);
    }
    if(start){await f.actions.play(1);f.audio.currentTime=.1;await f.actions.play(2);f.audio.currentTime=.2;}
    f.snapshot=()=>({alloc:f.state.decks.slice(0,2).map(d=>d.stems.allocatedLevels.flow),requested:f.state.decks.slice(0,2).map(d=>d.stems.requestedLevels.flow),playing:[1,2].map(id=>f.mixer.getDeck(id).getState().isPlaying),participation:[1,2,3,4].map(id=>f.state.participation.byDeck[id].stemHandoff),failure:f.mixer.getLastSchedulingFailure()});
    return f;
  }
  function attempt(f,id,value){let error=null;try{f.actions.setStemLevel(id,'flow',value,'direct-test');}catch(e){error=e.message;}return {error,...f.snapshot()};}
  for(const p of [[true,true],[true,false],[false,true],[false,false]]){
    const f=await fixture(p);const up=attempt(f,1,.8);f.audio.currentTime=.3;const reverse=attempt(f,2,.8);
    if(p.every(Boolean)){check(Math.abs(up.alloc[0]-.8)<1e-10 && Math.abs(reverse.alloc[1]-.8)<1e-10,'Participating active gesture priority');}
    else {check(!up.error && Math.abs(up.alloc[0]-.8)<1e-10 && Math.abs(up.alloc[1]-.5)<1e-10,'Independent gesture must not consume participating capacity');check(!reverse.error && Math.abs(reverse.alloc[1]-.8)<1e-10,'Independent reverse gesture accepted');}
    for(let frame=0;frame<=9600;frame++){
      const time=.2+frame/48000;let cohort=0;
      for(let index=0;index<2;index++){
        const gain=stemSchedulingValueAt(f.gains[index*6+1].events,time)*stemSchedulingValueAt(f.gains[index*6+4].events,time)*stemSchedulingValueAt(f.gains[index*6+5].events,time);
        if(p[index])cohort+=gain;
        if(frame===9600)check(Math.abs(gain-reverse.alloc[index])<1e-9,'Native gain envelope matches displayed allocation after settling');
      }
      check(cohort<=1+1e-9,'Participating gain envelopes stay capped through both directions');
    }
    check(up.participation[2]===false && up.participation[3]===false,'Hidden decks excluded');
    record('50/50 -> D1 .8 -> D2 .8',{participation:p,up,reverse});f.actions.dispose();await f.mixer.close();
  }
  for(const p of [[true,false],[false,true],[false,false]]){
    const f=await fixture(p,[1,1],false);await f.actions.play(1);f.audio.currentTime=.1;let error=null;
    try{await f.actions.play(2);}catch(e){error=e.message;}
    check(!error && f.snapshot().playing.every(Boolean),'Independent full-level second deck starts');
    record('Start D2 against independent/conflicting D1 at 1',{participation:p,error,...f.snapshot()});f.actions.dispose();await f.mixer.close();
  }
  const reenable=await fixture([false,false],[1,1]);const highBefore=reenable.snapshot();
  reenable.actions.setParticipation(1,true);reenable.actions.setParticipation(2,true);
  check(JSON.stringify(reenable.snapshot().alloc)===JSON.stringify(highBefore.alloc),'Re-enable above unity preserves targets');
  reenable.actions.setStemLevel(1,'flow',.8,'resolve-preserved-overlap');
  check(Math.abs(reenable.snapshot().alloc[0]-.8)<1e-9 && Math.abs(reenable.snapshot().alloc[1]-.2)<1e-9,'Next priority gesture resolves preserved overlap');
  reenable.audio.currentTime=.4;reenable.actions.setStemLevel(1,'flow',0,'explicit-zero');reenable.actions.setStemLevel(2,'flow',.2,'zero-test');
  check(reenable.snapshot().alloc[0]===0,'Zero eligibility unchanged');
  const stable=JSON.stringify(reenable.snapshot().alloc), auth=JSON.stringify(reenable.state.stemSession.authorization);
  reenable.actions.setEnabled(false);reenable.actions.setEnabled(true);
  check(JSON.stringify(reenable.snapshot().alloc)===stable && JSON.stringify(reenable.state.stemSession.authorization)===auth,'Global OFF/ON preserves coefficients and authorization');
  reenable.actions.dispose();await reenable.mixer.close();
  const rapid=await fixture();let errorCount=0;
  for(let i=0;i<200;i++){rapid.audio.currentTime+=.001;const r=attempt(rapid,i%2+1,i%2?.8:.2);if(r.error)errorCount++;}
  check(errorCount===0 && rapid.snapshot().playing.every(Boolean),'Rapid gestures with deterministic clock must preserve transport');
  record('Rapid gestures with zero-duration native calls',{errorCount,...rapid.snapshot()});rapid.actions.dispose();await rapid.mixer.close();
  const delayedSafe=await fixture();const safeSet=delayedSafe.gains[0].gain.setValueAtTime;
  delayedSafe.gains[0].gain.setValueAtTime=function(value,time){safeSet(value,time);delayedSafe.audio.currentTime+=.008;};
  const safeResult=attempt(delayedSafe,1,.8);check(!safeResult.error && safeResult.playing.every(Boolean),'Eight-ms batch fits reserved lead without pause');
  check(delayedSafe.mixer.getDiagnostics().lastRetargetReservation.finishedAt<delayedSafe.mixer.getDiagnostics().lastRetargetReservation.scheduledTime,'Measured native batch completes within reservation');
  record('Eight-ms native batch',safeResult);delayedSafe.actions.dispose();await delayedSafe.mixer.close();
  const missed=await fixture();const original=missed.gains[0].gain.setValueAtTime;
  missed.gains[0].gain.setValueAtTime=function(value,time){original(value,time);missed.audio.currentTime=time+.01;};
  const delayed=attempt(missed,1,.8);check(delayed.error.includes('deadline missed') && delayed.playing.every(v=>!v),'Characterize shared deadline pause');
  record('Injected native-call delay crossing retarget deadline',delayed);missed.actions.dispose();await missed.mixer.close();
  const expired=await fixture();const expiredBefore=JSON.stringify(expired.gains.map(g=>g.events));
  const targets=Object.fromEntries([1,2,3,4].map(id=>[id,{mainVolume:expired.state.decks[id-1].volume,levels:{...expired.state.decks[id-1].stems.allocatedLevels},capacityMember:id<=2}]));
  targets[1].levels.flow=.8;targets[2].levels.flow=.2;
  let reads=0;Object.defineProperty(targets[1],'mainVolume',{get(){if(++reads===2)expired.audio.currentTime+=.03;return 1;}});
  let expiredError=null;try{expired.mixer.applyGainSnapshot(targets);}catch(e){expiredError=e.message;}
  check(expiredError?.includes('expired before native writes') && expired.snapshot().playing.every(Boolean),'Pre-write reservation expiry does not pause');
  check(JSON.stringify(expired.gains.map(g=>g.events))===expiredBefore,'Pre-write expiry makes no native automation changes');
  expired.actions.dispose();await expired.mixer.close();
  const guarded=await fixture();const bad=Object.fromEntries([1,2,3,4].map(id=>[id,{mainVolume:guarded.state.decks[id-1].volume,levels:{...guarded.state.decks[id-1].stems.allocatedLevels},capacityMember:id<=2}]));
  bad[1].levels.flow=.8;bad[2].levels.flow=.5;
  const guardEvents=JSON.stringify(guarded.gains.map(g=>g.events));let guardError=null;
  try{guarded.mixer.applyGainSnapshot(bad);}catch(e){guardError=e.message;}
  check(guardError?.includes('capacity') && JSON.stringify(guarded.gains.map(g=>g.events))===guardEvents,'Explicit membership cannot grow an established capped cohort above unity');
  bad[1].capacityMember='false';guardError=null;try{guarded.mixer.applyGainSnapshot(bad);}catch(e){guardError=e.message;}
  check(guardError?.includes('membership'),'Malformed membership rejected');guarded.actions.dispose();await guarded.mixer.close();
  const main=await fixture();const before=main.snapshot();let error=null;
  try{main.actions.setMainVolume(1,.5,'main-test');}catch(e){error=e.message;}
  check(!error && main.state.decks[0].volume===.5 && main.snapshot().playing.every(Boolean),'Live Main commits without interrupting playback');
  record('Live Main accepted',{error,before,after:main.snapshot()});main.actions.dispose();await main.mixer.close();
  const leave=await fixture();leave.actions.setStemLevel(1,'flow',1,'authorize');leave.audio.currentTime=.3;leave.actions.setStemLevel(2,'flow',.5,'share');leave.audio.currentTime=.4;
  const prior=leave.snapshot();let leaveError=null;try{leave.actions.setParticipation(2,false);}catch(e){leaveError=e.message;}
  check(!leaveError && JSON.stringify(prior.alloc)===JSON.stringify(leave.snapshot().alloc),'Disable preserves all allocations');
  leave.actions.setParticipation(2,true);check(JSON.stringify(prior.alloc)===JSON.stringify(leave.snapshot().alloc),'Re-enable preserves all allocations');
  record('Leave established sharing',{before:prior,error:leaveError,after:leave.snapshot()});leave.actions.dispose();await leave.mixer.close();
  console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.log('REGRESSION FAILED '+error.message+' '+error.stack);throw error;});
`;
eval(source);
