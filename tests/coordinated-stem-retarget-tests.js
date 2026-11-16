async function runCoordinatedStemRetargetTests() {
  let checks=0, maximum=0;
  const check=(value,message)=>{checks++;if(!value)throw new Error(message);};
  async function rejects(action,message){let rejected=false;try{await action();}catch(_){rejected=true;}check(rejected,message);}
  async function setup(count=1) {
    const f=createStemSchedulingFixture();const initial=f.snapshot(0);
    for(let id=1;id<=count+1;id++)await f.load(id);
    for(let id=1;id<=count;id++)initial[id].levels=f.levels(1/count);
    f.mixer.applyGainSnapshot(initial);
    for(let id=1;id<=count;id++)await f.mixer.getDeck(id).play();
    f.audio.currentTime=0.1;
    const target=f.snapshot(0);target[count+1].levels=f.levels(1);
    await f.mixer.startCoordinated(count+1,target);
    return { ...f,count,start:f.sources[count*4].time };
  }
  function combined(f,time,stem=0) {
    let sum=0;
    for(let deck=0;deck<=f.count;deck++) {
      const source=f.sources[deck*4];
      if(source.stopped||time<source.time)continue;
      sum+=stemSchedulingValueAt(f.gains[deck*6+stem].events,time)*
        stemSchedulingValueAt(f.gains[deck*6+4].events,time)*stemSchedulingValueAt(f.gains[deck*6+5].events,time);
    }
    return sum;
  }
  function scan(f,from,to) {
    for(let frame=0;frame<=Math.ceil((to-from)*96000);frame++) {
      const time=from+frame/96000;
      for(let stem=0;stem<4;stem++) {
        const gain=combined(f,time,stem);maximum=Math.max(maximum,gain);
        check(gain>=-1e-12&&gain<=1+1e-12,'Continuous envelope sampling stays within capacity: '+gain);
      }
    }
  }
  // Preserve the original failure independently of the fixed scheduler: emulate the old
  // snapshot path on a COPY of AudioParam events, leaving transport opening untouched.
  const original=await setup();const copied=original.gains.map(g=>({events:g.events.map(e=>({...e}))}));
  const boundary=original.start+0.005+128/48000;
  for(let deck=0;deck<2;deck++)for(let stem=0;stem<4;stem++) {
    const events=copied[deck*6+stem].events;
    const from=stemSchedulingValueAt(events,boundary);
    for(let i=events.length-1;i>=0;i--)if(events[i].time>=boundary)events.splice(i,1);
    if(deck===0)events.push({type:'ramp',value:from,time:boundary});
    events.push({type:'set',value:from,time:boundary},{type:'ramp',value:deck===0?1:0,time:boundary+0.01});
  }
  const legacy={...original,gains:copied};let oldMaximum=0;
  for(let frame=0;frame<=2000;frame++)oldMaximum=Math.max(oldMaximum,combined(legacy,original.start+frame/96000));
  check(Math.abs(oldMaximum-1.178888888888889)<1e-10,'Permanent reproduction preserves original 1.178889 overshoot');
  original.audio.currentTime=original.start+0.005;
  const reversal=original.snapshot(0);reversal[1].levels=original.levels(1);
  const when=original.mixer.applyGainSnapshot(reversal);
  check(Math.abs(when-(original.audio.currentTime+.020))<1e-12,'Retarget reserves 20 ms for a full native batch');
  check(Math.abs(combined(original,when-1e-10)-combined(original,when+1e-10))<1e-7,'Transport folding preserves effective continuity');
  scan(original,original.start,original.start+0.04);await original.mixer.close();
  for(const count of [1,2,3])for(const fraction of [0,0.1,0.25,0.5,0.9]) {
    const f=await setup(count);
    for(let step=0;step<4;step++) {
      f.audio.currentTime=f.start+fraction*0.01+step*0.001;
      scan(f,f.audio.currentTime,f.audio.currentTime+128/48000);
      const snapshot=f.snapshot(0);
      // Simultaneous per-category targets across every existing and entering deck.
      for(let stem=0;stem<4;stem++) {
        const weights=Array.from({length:count+1},(_,i)=>((i+step+stem)%3)+1);
        const total=weights.reduce((sum,value)=>sum+value,0);
        for(let deck=0;deck<=count;deck++)snapshot[deck+1].levels[prototypeStemNames[stem]]=weights[deck]/total;
      }
      const time=f.mixer.applyGainSnapshot(snapshot);
      check(Math.abs(combined(f,time-1e-10)-combined(f,time+1e-10))<1e-6,'Repeated retarget remains continuous');
      scan(f,time,time+0.001);
    }
    scan(f,f.audio.currentTime,f.start+0.05);
    // Participation exclusion is an allocation-only snapshot; no source restart.
    const excluded=f.snapshot(0);excluded[1].levels=f.levels(1);
    f.audio.currentTime=f.start+0.055;f.mixer.applyGainSnapshot(excluded);
    scan(f,f.audio.currentTime,f.audio.currentTime+0.02);
    // Departure: stop/eject is immediate; redistributed remaining gains still stay capped.
    f.audio.currentTime+=0.025;f.mixer.getDeck(count+1).eject();
    f.mixer.applyGainSnapshot(excluded);scan(f,f.audio.currentTime,f.audio.currentTime+0.02);
    check(f.sources.slice(0,count*4).every(source=>!source.stopped),'Retargets never stop remaining decks');
    await f.mixer.close();
  }
  const scaled=createStemSchedulingFixture();
  for(let id=1;id<=3;id++)await scaled.load(id);
  const scaledInitial=scaled.snapshot(0);
  for(const id of [1,2]){scaledInitial[id].mainVolume=0.5;scaledInitial[id].levels=scaled.levels(1);}
  scaledInitial[3].mainVolume=0.8;scaled.mixer.applyGainSnapshot(scaledInitial);
  await scaled.mixer.getDeck(1).play();await scaled.mixer.getDeck(2).play();scaled.audio.currentTime=0.1;
  const scaledJoin=JSON.parse(JSON.stringify(scaledInitial));
  for(const id of [1,2])scaledJoin[id].levels=scaled.levels(0.2);
  scaledJoin[3].levels=scaled.levels(1);
  await scaled.mixer.startCoordinated(3,scaledJoin);
  scaled.count=2;scaled.start=scaled.sources[8].time;
  scaled.audio.currentTime=scaled.start+0.003;
  const scaledReturn=JSON.parse(JSON.stringify(scaledInitial));scaledReturn[3].levels=scaled.levels(0);
  scaled.mixer.applyGainSnapshot(scaledReturn);scan(scaled,scaled.start,scaled.start+0.04);
  check(Math.abs(combined(scaled,scaled.start+0.04)-1)<1e-12,'Nonunit main gains included in effective cap');
  await scaled.mixer.close();
  const rejected=await setup();rejected.audio.currentTime=rejected.start+0.002;
  const before=JSON.stringify(rejected.gains.map(g=>g.events));
  const volume=rejected.snapshot(0);volume[1].mainVolume=1.2;
  await rejects(()=>rejected.mixer.applyGainSnapshot(volume),'Invalid Main volume rejects before writes');
  await rejects(()=>rejected.mixer.getDeck(1).setStemLevel('voice',1),'Direct gain writes cannot bypass protected scheduler');
  await rejects(()=>rejected.mixer.applyGainSnapshot(rejected.snapshot(1)),'Over-capacity target rejects');
  check(before===JSON.stringify(rejected.gains.map(g=>g.events)),'Unsupported plans do not mutate automation');
  // Native automation failure must not leave a partially retargeted mix audible.
  rejected.gains[6].gain.setValueAtTime=()=>{throw new Error('native scheduling failed');};
  const failTarget=rejected.snapshot(0);failTarget[1].levels=rejected.levels(1);
  await rejects(()=>rejected.mixer.applyGainSnapshot(failTarget),'Native failure is surfaced');
  check(rejected.sources.every(source=>source.stopped),'Native partial failure silences all affected sessions');
  await rejected.mixer.close();
  console.log('Coordinated retarget tests passed: '+checks+' checks; legacy peak='+oldMaximum.toFixed(9)+'; corrected maximum='+maximum.toFixed(12));
}
