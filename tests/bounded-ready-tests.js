async function runBoundedReadyTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const flush = async () => { for (let i=0;i<100;i++) await Promise.resolve(); };
  const nodes=[]; let wall=0, reads=0, nextGain=0, releaseVoice=null, delayVoice=false, voiceStart=null, closes=0, delaySeek=false, releaseSeek=null;
  const context={sampleRate:48000,currentTime:0,state:'running',destination:{},resume:async()=>{},close:async()=>{closes++;context.state='closed';},
    createGain(){return{id:nextGain++,gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};},
    createBuffer(channels,length,rate){wall+=1;return{length,numberOfChannels:channels,sampleRate:rate,copyToChannel(){}};},
    createBufferSource(){const node={connect(target){this.target=target;},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},
      start(time,offset,duration){this.time=time;this.offset=offset;this.duration=duration;}};nodes.push(node);return node;}};
  const files=Object.fromEntries(streamingStemNames.map(name=>{const file=makeBoundedWavFixture();file.name=name;return[name,file];}));
  const player=createBoundedWavPlayer({createContext:()=>context,setTimer:()=>1,clearTimer:()=>{},nowMs:()=>wall,
    async readFrames(wav,start,count,timing){reads++;
      if(wav.file.name==='voice'&&delayVoice){voiceStart=start;await new Promise(resolve=>{releaseVoice=resolve;});delayVoice=false;}
      if(wav.file.name==='transients'&&delaySeek){delaySeek=false;await new Promise(resolve=>{releaseSeek=resolve;});}
      const channels=await readPcmWavFrames(wav,start,count);
      timing.readMs=5;timing.conversionMs=2;wall+=7;return channels;
    }});
  await player.loadFiles(files);await player.whenReady();
  check(player.getState().ready&&!player.getState().playing&&player.getState().position===0&&reads===3,'Load prepares one small window per enabled stem without starting transport');
  const readyReads=reads;await player.play();
  check(reads===readyReads&&nodes.length===3&&nodes.every(node=>node.time===.01&&node.offset===0),'Ready Play reuses exact starting PCM with one shared 10 ms onset');
  check(player.getState().lastStartup.payloadReads===0&&player.getState().lastStartup.readyAtCommand&&player.getState().lastStartup.actualAudibleLatencyMs===null,
    'Startup diagnostics distinguish cache hits and predicted versus actual onset');
  check(player.getState().lastPreparation.readMs===5&&player.getState().lastPreparation.conversionMs===2&&player.getState().lastPreparation.bufferMs===1,'Read/conversion/buffer timings stay separate');
  await player.tick();context.currentTime=.1;
  check(Object.values(player.getState().stems).every(stem=>stem.position===player.getState().position)&&!player.getState().stems.voice.enabled,
    'Dormant stem shares continuously advancing timeline');
  delayVoice=true;player.setEnabled('voice',true);await flush();check(!!releaseVoice,'Activation must reach delayed read');
  context.currentTime=.14;wall+=40;
  check(player.getState().position===.13&&player.getState().stems.voice.position===.13,'Timeline advances during asynchronous preparation');
  releaseVoice();await player.tick();await flush();delayVoice=false;
  const voiceNode=nodes.find(node=>node.target.id===3);
  check(!!voiceNode&&voiceNode.offset>0,'Late activation trims prepared PCM rather than playing request-time samples');
  const audibleFrame=voiceStart+Math.round(voiceNode.offset*48000),timelineFrame=Math.round((voiceNode.time-.01)*48000);
  check(audibleFrame===timelineFrame&&voiceNode.time>=.15-1/48000,'Activated source frame equals authoritative timeline at scheduled onset');
  context.currentTime=.2;player.pause();const bookmark=player.getState().position;
  await player.whenReady();const pauseReads=reads,resumeFirst=nodes.length;await player.play();
  const resumed=nodes.slice(resumeFirst);
  check(resumed.length===4&&resumed.every(node=>node.time===resumed[0].time),
    'All four enabled stems resume at one common output coordinate');
  check(reads===pauseReads&&player.getState().position===bookmark,'Pause/Resume reuses covering cache without moving bookmark');
  player.pause();await player.seek(1.23);await player.whenReady();context.currentTime=.3;
  check(player.getState().position===1.23&&player.getState().ready&&Object.values(player.getState().stems).every(stem=>stem.enabled),
    'Paused seek preserves enabled/dormant policy and freezes selected position while preparing');
  const seekReads=reads;await player.play();check(reads===seekReads&&player.getState().lastStartup.sourceFrame===59040,'Prepared seek starts at selected sample without reading again');
  delaySeek=true;const seeking=player.seek(4);await flush();check(!!releaseSeek,'Playing seek must reach delayed preparation');
  context.currentTime+=.04;
  check(player.getState().playing&&player.getState().position>4&&Object.values(player.getState().stems).every(stem=>stem.enabled),
    'Playing seek timeline advances during delayed preparation without making stems dormant');
  releaseSeek();await seeking;
  const timeline=player.getState().timeline,activation=player.getState().stems.transients.lastActivation;
  check(Math.abs(activation.sourceFrame-(timeline.anchorFrame+(activation.contextTime-timeline.anchorContextTime)*48000))<=1,
    'Delayed seek audio follows the current authoritative timeline');
  player.stop();await player.whenReady();
  for(let i=0;i<5;i++){const before=reads;await player.play();player.stop();await player.whenReady();check(reads===before&&player.getState().position===0,'Fast repeated Stop/Play retains bounded start cache');}
  let releaseResume;context.resume=()=>new Promise(resolve=>{releaseResume=resolve;});
  const count=nodes.length,pending=player.play();player.stop();releaseResume();
  check(await pending===false&&nodes.length===count&&!player.getState().playing,'Stale resumed Play cannot schedule after Stop');
  context.resume=async()=>{};
  await player.whenReady();check(player.getState().applicationPcmBytes<=4*.25*48000*2*4,'Paused/stopped readiness retains only one bounded chunk per enabled stem');
  let releaseHeader;const original=files.transients;
  const gated={...original,slice(start,end){if(start===0&&!releaseHeader)return{arrayBuffer:()=>new Promise(resolve=>{releaseHeader=()=>resolve(original.raw.slice(start,end));})};return original.slice(start,end);}};
  const loading=player.loadFiles({...files,transients:gated});await flush();check(!!releaseHeader,'Header cancellation fixture reached pending read');
  player.stop();check(!player.getState().loading,'Stop releases loading controls while an old header read remains pending');
  releaseHeader();check(await loading===false,'Stale load cannot commit metadata after Stop');
  await player.whenReady();
  for(const name of streamingStemNames)player.setEnabled(name,false);
  await player.whenReady();const dormantNodes=nodes.length;await player.play();context.currentTime+=.2;
  check(player.getState().position>0&&nodes.length===dormantNodes&&Object.values(player.getState().stems).every(stem=>stem.position===player.getState().position),
    'A deck with all stems dormant still advances one musical timeline without audio sources');
  player.stop();
  await player.close();check(closes===1&&nodes.every(node=>node.disconnected),'Readiness does not leak retired source nodes');
  console.log('Bounded readiness tests passed: cache reuse, timing stages, delayed current-position activation, paused/playing seeks and stale transport cancellation');
}
