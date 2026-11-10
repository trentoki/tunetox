async function runFourStemPlayerTests() {
  const check = (value,message) => { if (!value) throw new Error(message); };
  const near = (a,b) => Math.abs(a-b)<1e-10;
  const buffer = (length=48000) => ({ length, sampleRate:48000, numberOfChannels:2, duration:length/48000 });
  const files = () => Object.fromEntries(prototypeStemNames.map(name => [name,{arrayBuffer:async()=>buffer()}]));
  const sources=[], gains=[];
  let resumeWait=null, closeCalls=0;
  const audio={currentTime:0,state:'running',sampleRate:48000,destination:{},
    resume:()=>resumeWait || Promise.resolve(), close:async()=>{closeCalls++;audio.state='closed';},
    decodeAudioData:async data=>{if(data.bad)throw new Error('bad audio');return data;},
    createBufferSource(){const source={connect(){},disconnect(){this.disconnected=true;},
      start(time,offset){this.time=time;this.offset=offset;},stop(){this.stopped=true;}};sources.push(source);return source;},
    createGain(){const events=[];const gain={gain:{setValueAtTime(v,t){events.push(['set',v,t]);},
      linearRampToValueAtTime(v,t){events.push(['ramp',v,t]);},cancelScheduledValues(t){events.push(['cancel',t]);}},
      events,connect(){},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;}};
  let contexts=0;
  const player=createFourStemPlayer(()=>{contexts++;return audio;});
  async function rejects(action,message){let failed=false;try{await action();}catch(_){failed=true;}check(failed,message);}
  await rejects(()=>player.loadFiles({}),'Missing mapped files must reject');
  check(contexts===0,'Invalid selection must not create a context');
  const invalid=files();invalid.flow={arrayBuffer:async()=>({bad:true})};
  await rejects(()=>player.loadFiles(invalid),'Undecodable audio must reject');
  const short=files();short.voice={arrayBuffer:async()=>buffer(47999)};
  let alignmentError='';
  try { await player.loadFiles(short); } catch(error) { alignmentError=error.message; }
  check(alignmentError.includes('validation failed')&&alignmentError.includes('47999 frames')&&alignmentError.includes('48000 Hz'),
    'A one-frame mismatch rejects with decoded measurements');
  check(await player.play()===false&&!player.getState().isPlaying,'Rejected initial set cannot enter playing state');
  const namedInvalid=files();namedInvalid.flow={name:'SecondSong_bass.wav',arrayBuffer:async()=>({bad:true})};
  let decodeError='';
  try { await player.loadFiles(namedInvalid); } catch(error) { decodeError=error.message; }
  check(decodeError.includes('SecondSong_bass.wav')&&decodeError.includes('read/decode'),
    'Decode failure names the selected file and failure boundary');
  for(const invalidBuffer of [{...buffer(),numberOfChannels:4},{...buffer(),length:0},{...buffer(),sampleRate:44100}]){
    const set=files();set.tune={arrayBuffer:async()=>invalidBuffer};
    await rejects(()=>player.loadFiles(set),'Unsupported/empty/mismatched decoded audio must reject');
  }
  check(!player.getState().loaded && !player.getState().loading,'Validation failure recovers loading state');
  player.setStemLevel('flow',0.8);
  await player.loadFiles(files());await player.play();
  check(contexts===1 && sources.length===4 && gains.length===6,'One shared context, four stem gains and separate main/transport gains');
  check(sources.every(s=>s.time===sources[0].time && s.offset===0),'All four sources share exact scheduled time and offset');
  check(gains[1].events[0][1]===0.8,'Pre-load levels must be preserved');
  player.setStemLevel('flow',0.2);audio.currentTime=0.005;player.setStemLevel('flow',1);
  check(near(gains[1].events[gains[1].events.length-2][1],0.5),'Rapid reversal anchors to current halfway gain');
  check(near(gains[1].events[gains[1].events.length-1][2],0.015),'Gain smoothing lasts 10 ms');
  check(gains[0].events.length===1 && gains[2].events.length===1,'Gain paths are independent');
  audio.currentTime=0.25;player.pause();const bookmark=player.getState().position;
  check(sources.every(s=>s.stopped&&s.disconnected)&&gains.every(g=>g.disconnected),'Pause retires all sources and gains');
  await player.play();check(sources.slice(4).every(s=>s.offset===bookmark),'Resume uses same saved position for every stem');
  const stale=sources[4].onended;player.stop();check(player.getState().position===0,'Stop resets source position');
  await player.play();stale();check(player.getState().isPlaying,'Old callbacks cannot finish a newer session');
  for(const source of sources.slice(-4))source.onended();
  check(!player.getState().isPlaying&&player.getState().position===1,'Natural completion releases all four paths');
  await player.play();check(sources.slice(-4).every(s=>s.offset===0),'Play after natural completion restarts at zero');
  player.eject();check(!player.getState().loaded,'Eject clears buffers');
  await player.loadFiles(files());check(player.getState().levels.flow===1,'Replacement preserves gain targets');
  // Resolve a controlled pending resume to verify stale continuation cancellation.
  let resumeResolve;resumeWait=new Promise(resolve=>{resumeResolve=resolve;});
  const cancelled=player.play();player.eject();resumeResolve();await cancelled;
  check(!player.getState().isPlaying,'Eject cancels pending Play');
  resumeWait=null;
  let readResolve;const slow=files();slow.transients={arrayBuffer:()=>new Promise(resolve=>{readResolve=resolve;})};
  const pendingLoad=player.loadFiles(slow);await Promise.resolve();player.eject();
  await player.loadFiles(files());readResolve(buffer());check(await pendingLoad===false&&player.getState().loaded,'Stale decode/read cannot replace a newer load');
  await rejects(()=>player.setStemLevel('flow',NaN),'Nonfinite gain rejects');
  await rejects(()=>player.setStemLevel('other',0.5),'Unknown category rejects');
  // A partially started graph must be completely retired when a later start fails.
  const originalSourceFactory=audio.createBufferSource;
  let attempts=0;
  audio.createBufferSource=function(){const source=originalSourceFactory();const start=source.start;
    source.start=function(time,offset){if(++attempts===3)throw new Error('start failed');start.call(source,time,offset);};return source;};
  const firstPartial=sources.length;
  await rejects(()=>player.play(),'Partial source-start failure must reject');
  check(!player.getState().isPlaying&&sources.slice(firstPartial).every(source=>source.disconnected&&source.stopped),
    'Partial graph failure must leave no audible sources');
  audio.createBufferSource=originalSourceFactory;
  await player.play();player.stop();
  const priorLevels=JSON.stringify(player.getState().levels);
  await rejects(()=>player.loadFiles(short),'Invalid replacement rejects');
  check(player.getState().loaded&&JSON.stringify(player.getState().levels)===priorLevels,
    'Failed replacement retains previous validated buffers and levels');
  await player.close();await player.close();
  check(closeCalls===1&&player.getState().closed&&!player.getState().loaded,'Close clears resources and closes context once');
  console.log('Four-stem native player tests passed: validation, scheduling, smoothing, lifecycle, cancellation and cleanup');
}
