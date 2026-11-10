  function createStemSchedulingFixture(createTemporaryContext) {
    const sources = [], gains = [];
    let attempts = 0, failAt = 0, waiting = null;
    const audio = { currentTime: 0, state: 'running', sampleRate: 48000, destination: {},
      resume: () => waiting || Promise.resolve(), close: async () => {}, decodeAudioData: async value => value,
      createBufferSource() { const node = { connect(target) { this.connectedTo=target; }, disconnect() { this.disconnected = true; this.connectedTo=null; },
        start(time,offset) { if (++attempts === failAt) throw new Error('start failed'); this.time=time;this.offset=offset; },
        stop() { this.stopped=true; } }; sources.push(node); return node; },
      createGain() { const events=[];const node={events,connect(target){this.connectedTo=target;},disconnect(){this.connectedTo=null;},gain:{
        setValueAtTime(value,time){events.push({type:'set',value,time});},
        linearRampToValueAtTime(value,time){events.push({type:'ramp',value,time});},
        cancelScheduledValues(time){for(let i=events.length-1;i>=0;i--)if(events[i].time>=time)events.splice(i,1);}
      }};gains.push(node);return node; }
    };
    const mixer=createNativeStemMixer(()=>audio,[1,2,3,4],createTemporaryContext);
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
  // Meter arithmetic uses actual analyser arrays, including opposite-polarity stereo.
  const meterNodes=[];
  const meterAudio={currentTime:0,createAnalyser(){
    const index=meterNodes.length;
    const node={connections:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;},
      getFloatTimeDomainData(samples){samples.fill(index%3===1?0.25:-0.25);}};
    meterNodes.push(node);return node;
  },createChannelSplitter(){return {connect(){},disconnect(){}};}};
  const meter=createNativeOutputMeter(meterAudio),connectionsBefore=JSON.stringify(meterNodes.map(node=>node.connections.length));
  const measured=meter.read();
  check(measured.peak===0.25&&measured.rms===0.25&&measured.left.peak===0.25&&measured.right.peak===0.25,
    'Opposite-polarity stereo meters cannot cancel into false silence');
  check(Object.isFrozen(measured.left)&&JSON.stringify(meterNodes.map(node=>node.connections.length))===connectionsBefore,
    'Meter capture is read-only and returns frozen measurements');
  meter.disconnect();check(meterNodes.every(node=>node.disconnected),'Meter resources disconnect on retirement');
  const metered=createStemSchedulingFixture();
  metered.audio.createAnalyser=meterAudio.createAnalyser;
  metered.audio.createChannelSplitter=meterAudio.createChannelSplitter;
  await metered.load(1);
  check(metered.mixer.getDiagnostics().outputMeter.available,'Shared context creates final output meter at Load');
  const meteredTargets=metered.snapshot(0);meteredTargets[1].levels=metered.levels(1);
  await metered.mixer.startCoordinated(1,meteredTargets);
  const live=metered.mixer.getDiagnostics();
  check(live.decks[1].liveMeters.transientsSource.available&&live.decks[1].liveMeters.transientsStemGain.available&&
    live.decks[1].liveMeters.main.available&&live.decks[1].liveMeters.transport.available,'Actual graph stages all expose live meters');
  check(live.outputRoute==='deck transport -> shared analyser -> destination','One shared inline meter owns the final route');
  metered.mixer.getDeck(1).pause();
  check(Object.keys(metered.mixer.getDeck(1).getDiagnostics().liveMeters).length===0,'Pause retires graph stage meters');
  await metered.mixer.close();
  // The controlled hardware probe must use the same context/output and stay idle-only.
  const probe=createStemSchedulingFixture();
  await rejects(()=>probe.mixer.playDiagnosticTone(),'Tone cannot create a replacement context before Load');
  await probe.load(1);
  const probeTargets=probe.snapshot(0);probeTargets[1].levels=probe.levels(1);
  await probe.mixer.startCoordinated(1,probeTargets);
  const beforeProbe=JSON.stringify(probe.gains.map(gain=>gain.events));
  await rejects(()=>probe.mixer.playDiagnosticTone(),'Tone rejects while a native deck is playing');
  check(probe.mixer.getDeck(1).getState().isPlaying&&JSON.stringify(probe.gains.map(gain=>gain.events))===beforeProbe,
    'Rejected tone leaves live playback and gain scheduling unchanged');
  probe.mixer.getDeck(1).pause();
  let probePcm;
  probe.audio.createBuffer=(channels,frames,rate)=>{
    probePcm=new Float32Array(frames);
    return {numberOfChannels:channels,length:frames,sampleRate:rate,getChannelData:()=>probePcm};
  };
  const levelsBefore=JSON.stringify(probe.mixer.getDeck(1).getState().levels);
  const toneResult=await probe.mixer.playDiagnosticTone();
  check(toneResult.started&&toneResult.frequency===440&&probe.mixer.getDiagnostics().diagnosticToneActive,
    'Probe starts a bounded tone on the loaded shared context');
  check(probe.sources.slice(-1)[0].buffer.getChannelData(0)===probePcm&&
    probe.gains.slice(-1)[0].connectedTo===probe.audio.destination&&
    probePcm.some(value=>value!==0),'Probe has generated PCM and uses the actual existing destination');
  await rejects(()=>probe.mixer.startCoordinated(1,probeTargets),'Normal Play rejects while the diagnostic tone is active');
  await rejects(()=>probe.load(2),'Loading rejects during the isolated hardware probe');
  await rejects(()=>probe.mixer.playDiagnosticTone(),'Overlapping tones reject');
  probe.sources.slice(-1)[0].onended();
  check(!probe.mixer.getDiagnostics().diagnosticToneActive&&
    JSON.stringify(probe.mixer.getDeck(1).getState().levels)===levelsBefore,
    'Tone end disconnects without changing allocations or musical levels');
  check(probe.mixer.getDiagnostics().contextAtCreation.sampleRate===48000&&
    probe.mixer.getDiagnostics().contextNow.destination.channelCount===null,
    'Creation/current snapshots expose context output configuration without inventing unsupported fields');
  const originalProbeResume=probe.audio.resume;
  probe.audio.resume=async()=>{throw new Error('probe resume rejected');};
  await rejects(()=>probe.mixer.playDiagnosticTone(),'Tone propagates resume rejection');
  check(!probe.mixer.getDiagnostics().diagnosticToneActive&&
    probe.mixer.getDiagnostics().lastDiagnosticTone.error==='probe resume rejected',
    'Resume rejection clears the tone lock and records the actual error');
  probe.audio.resume=originalProbeResume;
  await probe.mixer.startCoordinated(1,probeTargets);
  check(probe.mixer.getDeck(1).getState().isPlaying,'Normal coordinated playback works after the probe');
  probe.mixer.getDeck(1).pause();await probe.mixer.playDiagnosticTone();
  const finalTone=probe.sources.slice(-1)[0];
  await probe.mixer.close();
  check(finalTone.stopped&&finalTone.disconnected&&!probe.mixer.getDiagnostics().diagnosticToneActive,
    'Closing the owner cancels and disconnects the hardware probe');
  let freshCreates=0,freshResume=0,freshClose=0,rejectFreshResume=false,freshAudio,freshSource;
  const fresh=createStemSchedulingFixture(()=>{
    freshCreates++;
    freshAudio={currentTime:0,state:'suspended',sampleRate:44100,destination:{channelCount:2,
      maxChannelCount:16,channelCountMode:'explicit',channelInterpretation:'speakers'},
      resume:async()=>{freshResume++;if(rejectFreshResume)throw new Error('fresh resume rejected');freshAudio.state='running';},
      close:async()=>{freshClose++;freshAudio.state='closed';},
      createBuffer:(channels,length,sampleRate)=>{const data=new Float32Array(length);return {
        length,sampleRate,numberOfChannels:channels,getChannelData:()=>data};},
      createBufferSource:()=>{freshSource={connect(target){this.target=target;},disconnect(){this.disconnected=true;},
        start(time){this.startTime=time;},stop(){this.stopped=true;}};return freshSource;},
      createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},
        connect(target){this.target=target;},disconnect(){this.disconnected=true;}})
    };return freshAudio;
  });
  await rejects(()=>fresh.mixer.playFreshDiagnosticTone(),'Fresh probe requires an existing production context');
  check(freshCreates===0,'Unavailable comparison does not allocate a temporary context');
  await fresh.load(1);
  const freshTargets=fresh.snapshot(0);freshTargets[1].levels=fresh.levels(1);
  await fresh.mixer.startCoordinated(1,freshTargets);
  await rejects(()=>fresh.mixer.playFreshDiagnosticTone(),'Fresh probe rejects active production playback');
  check(freshCreates===0,'Active-playback rejection occurs before context creation');
  fresh.mixer.getDeck(1).pause();
  const productionState=JSON.stringify(fresh.mixer.getDeck(1).getState());
  const productionEvents=JSON.stringify(fresh.gains.map(gain=>gain.events));
  let productionResumes=0;fresh.audio.resume=async()=>{productionResumes++;};
  const freshResult=await fresh.mixer.playFreshDiagnosticTone();
  check(freshCreates===1&&freshResume===1&&productionResumes===0&&freshResult.afterResume.sampleRate===44100,
    'Fresh probe creates/resumes only its own default context and records its configuration');
  check(freshSource.target.target===freshAudio.destination&&freshSource.buffer.getChannelData(0).some(value=>value!==0),
    'Fresh generated PCM reaches its own destination without production routing');
  check(JSON.stringify(fresh.mixer.getDeck(1).getState())===productionState&&
    JSON.stringify(fresh.gains.map(gain=>gain.events))===productionEvents,'Fresh probe preserves loaded deck and gain automation');
  await rejects(()=>fresh.mixer.playDiagnosticTone(),'Shared and fresh probes cannot overlap');
  await rejects(()=>fresh.mixer.startCoordinated(1,freshTargets),'Play cannot overlap the temporary comparison');
  freshSource.onended();for(let i=0;i<8;i++)await Promise.resolve();
  check(freshClose===1&&freshSource.disconnected&&!fresh.mixer.getDiagnostics().freshDiagnosticToneActive&&
    fresh.mixer.getDiagnostics().lastFreshDiagnosticTone.temporaryContextClosed,'Temporary context closes after tone completion');
  rejectFreshResume=true;
  await rejects(()=>fresh.mixer.playFreshDiagnosticTone(),'Fresh resume errors are preserved');
  check(freshClose===2&&!fresh.mixer.getDiagnostics().freshDiagnosticToneActive&&
    fresh.mixer.getDiagnostics().lastFreshDiagnosticTone.error==='fresh resume rejected','Failed fresh probe closes only the temporary context');
  rejectFreshResume=false;await fresh.mixer.playFreshDiagnosticTone();
  await fresh.mixer.close();
  check(freshClose===3&&freshSource.disconnected,'Owner shutdown cleans up an in-progress temporary probe');
  const samplerTasks=[],cancelledTasks=[],published=[];
  let sampleClock=0;
  const sampler=createNativeProbeSampler(()=>({contextTime:sampleClock,outputMeter:Object.freeze({peak:0.2,rms:0.1})}),
    value=>published.push(value),{setTimer(callback,delay){samplerTasks.push({callback,delay});return samplerTasks.length;},
      clearTimer:id=>cancelledTasks.push(id)});
  check(sampler.available&&samplerTasks.map(task=>task.delay).join()==='150,500','Tone observation schedules exactly two bounded in-tone samples');
  sampleClock=0.15;samplerTasks[0].callback();sampleClock=0.5;samplerTasks[1].callback();
  check(published[1].length===2&&published[1][1].contextTime===0.5&&published[1][1].outputMeter.peak===0.2&&
    Object.isFrozen(published[1])&&Object.isFrozen(published[1][0]),'Measured samples persist in immutable snapshots');
  sampler.stop();samplerTasks[0].callback();
  check(cancelledTasks.length===2&&published.length===2,'Retirement cancels observations and suppresses stale callbacks');
  const errorTasks=[];
  createNativeProbeSampler(()=>{throw new Error('analyser read failed');},value=>published.push(value),
    {setTimer(callback){errorTasks.push(callback);return 1;}});
  errorTasks[0]();
  check(published[2][0].measurementError==='analyser read failed','Measurement errors are retained rather than reported as silence');
  // Diagnostic snapshots must explain silent gates without changing the audio graph.
  const diagnostic=createStemSchedulingFixture();
  check(diagnostic.mixer.getDiagnostics().contextState==='uncreated','Diagnostics do not create a context');
  const pcm=new Float32Array(48000);pcm.fill(0.25);
  const diagnosticFiles=Object.fromEntries(prototypeStemNames.map(name=>[name,{arrayBuffer:async()=>({
    length:48000,sampleRate:48000,numberOfChannels:1,duration:1,getChannelData:()=>pcm
  })}]));
  await diagnostic.mixer.getDeck(1).loadFiles(diagnosticFiles);
  const diagnosticTargets=diagnostic.snapshot(0);diagnosticTargets[1].levels=diagnostic.levels(0.5);
  diagnosticTargets[1].mainVolume=0.8;
  check(await diagnostic.mixer.startCoordinated(1,diagnosticTargets),'Diagnostic fixture starts coordinated audio');
  const player=diagnostic.mixer.getDeck(1),start=diagnostic.sources[0].time;
  check(diagnostic.sources.every((source,i)=>source.connectedTo===diagnostic.gains[i])&&
    diagnostic.gains.slice(0,4).every(gain=>gain.connectedTo===diagnostic.gains[4])&&
    diagnostic.gains[4].connectedTo===diagnostic.gains[5]&&diagnostic.gains[5].connectedTo===diagnostic.audio.destination,
    'Every native source connects through stem, main and transport gains to the shared destination');
  const eventsBefore=JSON.stringify(diagnostic.gains.map(gain=>gain.events));
  const preparation=diagnostic.snapshot(0);preparation[1]=diagnosticTargets[1];
  preparation[2].levels=diagnostic.levels(0.3);
  diagnostic.mixer.applyGainSnapshot(preparation);
  check(JSON.stringify(diagnostic.gains.map(gain=>gain.events))===eventsBefore,
    'Silent preparation does not reset the joining transport gate');
  const sourcesBefore=diagnostic.sources.length;
  let resumeCalls=0;diagnostic.audio.resume=async()=>{resumeCalls++;};
  let snapshot=player.getDiagnostics();
  check(snapshot.modeledTransport===0&&!snapshot.sourceClockReachedStart&&snapshot.sourceStartCalls===4,
    'Reserved start reports four successful starts behind the zero transport gate');
  check(snapshot.connectedToDestination&&snapshot.stems.flow.sampledPcmPeak===0.25,
    'Snapshot exposes successful destination connection and nonzero decoded PCM');
  diagnostic.audio.currentTime=start+0.005;
  snapshot=player.getDiagnostics();
  check(Math.abs(snapshot.modeledTransport-0.5)<1e-10&&Math.abs(snapshot.stems.flow.modeledEffectiveGain-0.2)<1e-10,
    'Diagnostic effective product follows the in-flight coordinated transport');
  diagnostic.audio.currentTime=start+0.05;
  const settled=player.getDiagnostics();
  check(settled.modeledTransport===1&&settled.position>snapshot.position&&settled.stems.flow.modeledEffectiveGain===0.4,
    'Settled coordinated transport is open with advancing source clock and nonzero effective gain');
  check(Object.isFrozen(settled)&&Object.isFrozen(settled.stems)&&Object.isFrozen(settled.stems.flow),
    'Diagnostic snapshots are deeply frozen');
  diagnostic.audio.state='suspended';
  check(player.getDiagnostics().contextState==='suspended','Diagnostic reports suspended context without resuming');
  check(resumeCalls===0&&diagnostic.sources.length===sourcesBefore&&
    JSON.stringify(diagnostic.gains.map(gain=>gain.events))===eventsBefore,'Diagnostic reads never resume, start or rewrite automation');
  diagnostic.audio.state='running';player.pause();
  check(!player.getDiagnostics().connectedToDestination&&player.getDiagnostics().modeledTransport===0,
    'Pause reports disconnected silent graph');
  diagnostic.audio.resume=async()=>{throw new Error('controlled resume rejection');};
  await rejects(()=>player.play(),'Resume rejection remains visible to caller');
  check(player.getDiagnostics().lastPlayError.message==='controlled resume rejection'&&!player.getState().isPlaying,
    'Read-only diagnostics retain playback resume error without creating a session');
  await diagnostic.mixer.close();
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
