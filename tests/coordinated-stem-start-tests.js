  function createStemSchedulingFixture() {
    const sources = [], gains = [];
    let attempts = 0, failAt = 0, waiting = null;
    const audio = { currentTime: 0, state: 'running', sampleRate: 48000, destination: {},
      resume: () => waiting || Promise.resolve(), close: async () => {}, decodeAudioData: async value => value,
      createBufferSource() { const node = { connect() {}, disconnect() { this.disconnected = true; },
        start(time,offset) { if (++attempts === failAt) throw new Error('start failed'); this.time=time;this.offset=offset; },
        stop() { this.stopped=true; } }; sources.push(node); return node; },
      createGain() { const events=[];const node={events,connect(){},disconnect(){},gain:{
        setValueAtTime(value,time){events.push({type:'set',value,time});},
        linearRampToValueAtTime(value,time){events.push({type:'ramp',value,time});},
        cancelScheduledValues(time){for(let i=events.length-1;i>=0;i--)if(events[i].time>=time)events.splice(i,1);}
      }};gains.push(node);return node; }
    };
    const mixer=createNativeStemMixer(()=>audio);
    const levels=value=>Object.fromEntries(prototypeStemNames.map(name=>[name,value]));
    const snapshot=value=>Object.fromEntries([1,2,3,4].map(id=>[id,{mainVolume:1,levels:levels(value)}]));
    async function load(id) { await mixer.getDeck(id).loadFiles(Object.fromEntries(prototypeStemNames.map(name=>[name,
      {arrayBuffer:async()=>({length:48000,sampleRate:48000,numberOfChannels:1,duration:1})}]))); }
    return {audio,mixer,sources,gains,levels,snapshot,load,fail(value){failAt=value;},wait(value){waiting=value;},attempts:()=>attempts};
  }
  function stemSchedulingValueAt(events,time) {
    let previous={time:0,value:1};
    for(const event of events) {
      if(event.time>time) return event.type==='ramp' ? previous.value+(event.value-previous.value)*(time-previous.time)/(event.time-previous.time) : previous.value;
      previous=event;
    }
    return previous.value;
  }

async function runCoordinatedStemStartTests() {
  let checks = 0;
  function check(value, message) { checks++; if (!value) throw new Error(message); }
  async function rejects(action,message) {let rejected=false;try{await action();}catch(_){rejected=true;}check(rejected,message);}
  for(const count of [2,3]) {
    const f=createStemSchedulingFixture(),targets=f.snapshot(0);
    for(let id=1;id<=count;id++) { targets[id].levels=f.levels(1/count);await f.load(id); }
    f.mixer.applyGainSnapshot(targets);
    for(let id=1;id<=count;id++)await f.mixer.getDeck(id).play();
    f.audio.currentTime=0.1;
    const oldSources=f.sources.slice(),oldTimes=oldSources.map(s=>s.time);
    const entering=count+1;await f.load(entering);
    const next=f.snapshot(0);next[entering].levels=f.levels(0.8);
    for(let id=1;id<=count;id++)next[id].levels=f.levels(0.2/count);
    check(await f.mixer.startCoordinated(entering,next),'Coordinated start succeeds');
    const joining=f.sources.slice(-4),start=joining[0].time;
    check(joining.every(source=>source.time===start),'Four joining sources share one start');
    check(oldSources.every((source,i)=>!source.stopped&&source.time===oldTimes[i]),'Existing decks never restart or stop');
    for(let id=1;id<=count;id++)check(f.gains[(id-1)*6].events.some(e=>e.type==='ramp'&&Math.abs(e.time-start-0.01)<1e-12),'Existing reduction ends with joining fade');
    const transport=f.gains[count*6+5];
    check(stemSchedulingValueAt(transport.events,start)===0,'Joining starts silent');
    // Reconstruct every AudioParam envelope at each sample, not just endpoints.
    for(let frame=0;frame<=960;frame++) {
      const time=start-0.005+frame/48000;
      for(let stem=0;stem<4;stem++) {
        let combined=0;
        for(let deck=0;deck<=count;deck++) {
          if(time<f.sources[deck*4].time)continue;
          combined+=stemSchedulingValueAt(f.gains[deck*6+stem].events,time)*stemSchedulingValueAt(f.gains[deck*6+4].events,time)*stemSchedulingValueAt(f.gains[deck*6+5].events,time);
        }
        check(combined<=1+1e-12&&combined>=0,'Every transition sample stays capped');
        check(Math.abs(combined-1)<1e-12,'Complementary transition has no gain discontinuity');
      }
    }
    await f.mixer.close();
  }
  const f=createStemSchedulingFixture();await f.load(1);await f.load(2);
  const initial=f.snapshot(0);initial[1].levels=f.levels(1);f.mixer.applyGainSnapshot(initial);await f.mixer.getDeck(1).play();f.audio.currentTime=0.1;
  const next=f.snapshot(0);next[2].levels=f.levels(1);
  const before=JSON.stringify(f.gains.slice(0,6).map(g=>g.events));
  f.fail(f.attempts()+3);
  await rejects(()=>f.mixer.startCoordinated(2,next),'Partial start rejects');
  check(!f.mixer.getDeck(2).getState().isPlaying&&f.sources.slice(4).every(s=>s.stopped&&s.disconnected),'Partial graph fully retired');
  check(JSON.stringify(f.gains.slice(0,6).map(g=>g.events))===before,'Partial failure never touches existing automation');
  f.fail(0);let resume;f.wait(new Promise(resolve=>{resume=resolve;}));
  const pending=f.mixer.startCoordinated(2,next);f.mixer.getDeck(2).eject();resume();
  check(await pending===false,'Eject cancels pending coordinated Play');
  check(JSON.stringify(f.gains.slice(0,6).map(g=>g.events))===before,'Cancelled start never touches existing automation');
  f.wait(null);await f.load(2);
  const invalid=f.snapshot(1);
  await rejects(()=>f.mixer.startCoordinated(2,invalid),'Over-capacity endpoint rejects before sources');
  const volumeChange=f.snapshot(0);volumeChange[1].mainVolume=0.5;
  await rejects(()=>f.mixer.startCoordinated(2,volumeChange),'Existing main-volume change rejects');
  let finishResume;f.wait(new Promise(resolve=>{finishResume=resolve;}));
  const cancelled=f.mixer.startCoordinated(2,next);
  await rejects(()=>f.mixer.startCoordinated(2,next),'Concurrent coordinated request rejects');
  f.mixer.getDeck(2).pause();finishResume();
  check(await cancelled===false,'Pause cancels pending coordinated start');f.wait(null);
  // A source factory can consume the reservation; reject before existing automation changes.
  const originalFactory=f.audio.createBufferSource;
  f.audio.createBufferSource=function(){const source=originalFactory();const start=source.start;
    source.start=function(time,offset){start.call(source,time,offset);f.audio.currentTime=time+0.001;};return source;};
  const beforeDeadline=JSON.stringify(f.gains.slice(0,6).map(g=>g.events));
  await rejects(()=>f.mixer.startCoordinated(2,next),'Expired reservation rejects');
  check(!f.mixer.getDeck(2).getState().isPlaying&&JSON.stringify(f.gains.slice(0,6).map(g=>g.events))===beforeDeadline,'Missed deadline cannot commit a join');
  f.audio.createBufferSource=originalFactory;f.audio.currentTime=0.1;
  // Pending existing smoothing must finish before a coordinated join begins.
  f.mixer.getDeck(1).setStemLevel('flow',0.5,0.2);
  check(await f.mixer.startCoordinated(2,next),'Join waits out pending ramps');
  check(f.sources.slice(-4).every(source=>source.time>=0.21),'Join boundary is after existing ramp');
  await f.mixer.close();
  console.log('Coordinated stem start tests passed: '+checks+' checks; samplewise caps, 2/3 existing decks, timing, cancellation and partial failures');
}
