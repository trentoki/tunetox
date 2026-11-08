// Fixture has no file.arrayBuffer(): all access must go through bounded slice ranges.
function makeBoundedWavFixture({rate=48000,frames=480000,channels=2,bits=16,sample=(frame,channel)=>Math.sin(frame*.01)*0.1,extra=true}={}) {
  const offset=extra?56:44,align=channels*bits/8,raw=new ArrayBuffer(offset+frames*align),view=new DataView(raw),reads=[];
  const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,raw.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*align,true);view.setUint16(32,align,true);view.setUint16(34,bits,true);
  if(extra){text(36,'JUNK');view.setUint32(40,3,true);}// odd chunk + pad byte
  text(offset-8,'data');view.setUint32(offset-4,frames*align,true);
  for(let f=0;f<frames;f++)for(let c=0;c<channels;c++){
    const at=offset+f*align+c*bits/8,value=Math.max(-1,Math.min(0.999999,sample(f,c)));
    if(bits===8)view.setUint8(at,Math.round(value*127)+128);
    else if(bits===16)view.setInt16(at,Math.round(value*32767),true);
    else if(bits===24){let v=Math.round(value*8388607);view.setUint8(at,v&255);view.setUint8(at+1,(v>>8)&255);view.setUint8(at+2,(v>>16)&255);}
    else view.setInt32(at,Math.round(value*2147483647),true);
  }
  return {size:raw.byteLength,reads,raw,slice(start,end){reads.push([start,end]);return{arrayBuffer:async()=>raw.slice(start,end)};}};
}
function makeWavEncodingFixture({encoding=1,extensible=false,bits=32,validBits=bits,channels=2,frames=480,rate=48000,sample=()=>0.5}={}) {
  const fmtBytes=extensible?40:18,offset=12+8+fmtBytes+8,align=channels*bits/8;
  const raw=new ArrayBuffer(offset+frames*align),view=new DataView(raw),reads=[];
  const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,raw.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,fmtBytes,true);
  view.setUint16(20,extensible?0xfffe:encoding,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);
  view.setUint32(28,rate*align,true);view.setUint16(32,align,true);view.setUint16(34,bits,true);view.setUint16(36,extensible?22:0,true);
  if(extensible){view.setUint16(38,validBits,true);view.setUint32(40,channels===1?4:3,true);view.setUint32(44,encoding,true);
    [0,0,0x10,0,0x80,0,0,0xaa,0,0x38,0x9b,0x71].forEach((v,i)=>view.setUint8(48+i,v));}
  text(offset-8,'data');view.setUint32(offset-4,frames*align,true);
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++){
    const at=offset+(frame*channels+channel)*bits/8,value=sample(frame,channel);
    if(encoding===3){if(bits===64)view.setFloat64(at,value,true);else view.setFloat32(at,value,true);}
    else {const integer=Math.round(value*(2**(validBits-1)-1))*2**(bits-validBits);
      if(bits===8)view.setUint8(at,integer+128);else if(bits===16)view.setInt16(at,integer,true);
      else if(bits===24){view.setUint8(at,integer&255);view.setUint8(at+1,(integer>>8)&255);view.setUint8(at+2,(integer>>16)&255);}
      else view.setInt32(at,integer,true);}
  }
  return {name:'encoding.wav',raw,size:raw.byteLength,reads,slice(start,end){reads.push([start,end]);return{arrayBuffer:async()=>raw.slice(start,end)};}};
}
async function runWavFormatDiagnosticTests(){
  const check=(v,message)=>{if(!v)throw new Error(message);};
  async function rejectCode(file,code){let message='';try{await inspectPcmWav(file);}catch(error){message=error.message;}check(message.includes(code),'Expected '+code+', received '+message);return message;}
  for(const extensible of [false,true])for(const encoding of [1,3]){
    const file=makeWavEncodingFixture({extensible,encoding,sample:(f,c)=>c?-.25:.5});const wav=await inspectPcmWav(file);
    const pcm=await readPcmWavFrames(wav,10,20);
    check(Math.abs(pcm[0][0]-.5)<1e-6&&Math.abs(pcm[1][0]+.25)<1e-6,'Standard/extensible PCM/float conversion and stereo order');
    check(file.reads.slice(0,-1).every(([a,b])=>b-a<=40),'Extended header parsing remains bounded');
  }
  for(const bits of [8,16,24,32]){
    const wav=await inspectPcmWav(makeWavEncodingFixture({extensible:true,bits,validBits:bits-1,sample:()=>-.5}));
    check(Math.abs((await readPcmWavFrames(wav,0,1))[0][0]+.5)<.02,'Left-aligned reduced valid bits: '+bits);
  }
  const headroom=await inspectPcmWav(makeWavEncodingFixture({encoding:3,sample:()=>1.25}));
  check((await readPcmWavFrames(headroom,0,1))[0][0]===1.25,'Float headroom must not be silently clipped');
  const nonfinite=await inspectPcmWav(makeWavEncodingFixture({encoding:3,sample:()=>NaN}));
  let rejected=false;try{await readPcmWavFrames(nonfinite,0,1);}catch(error){rejected=error.message.includes('WAV_NONFINITE_FLOAT');}check(rejected,'Nonfinite float data rejects during bounded reads');
  for(const [magic,code] of [['RF64','WAV_RF64_UNSUPPORTED'],['BW64','WAV_RF64_UNSUPPORTED'],['RIFX','WAV_ENDIAN_UNSUPPORTED'],['FORM','WAV_NOT_RIFF'],['junk','WAV_NOT_RIFF']]){
    const file=makeWavEncodingFixture();for(let i=0;i<4;i++)new DataView(file.raw).setUint8(i,magic.charCodeAt(i));
    const message=await rejectCode(file,code);check(message.includes('first 12 bytes:'),'Container diagnostics must include actual header bytes');
  }
  const notWave=makeWavEncodingFixture();new DataView(notWave.raw).setUint32(8,0);await rejectCode(notWave,'WAV_NOT_WAVE');
  const short=makeWavEncodingFixture();short.size=8;await rejectCode(short,'WAV_TRUNCATED');
  const wrongSize=makeWavEncodingFixture();new DataView(wrongSize.raw).setUint32(4,wrongSize.size+50,true);await rejectCode(wrongSize,'WAV_RIFF_SIZE');
  const missing=makeWavEncodingFixture();new DataView(missing.raw).setUint32(12,0);await rejectCode(missing,'WAV_MISSING_FMT');
  await rejectCode(makeWavEncodingFixture({encoding:6}),'WAV_COMPRESSION_UNSUPPORTED');
  await rejectCode(makeWavEncodingFixture({encoding:6,extensible:true}),'WAV_COMPRESSION_UNSUPPORTED');
  await rejectCode(makeWavEncodingFixture({encoding:3,bits:64}),'WAV_FLOAT_WIDTH_UNSUPPORTED');
  const badWidth=makeWavEncodingFixture();new DataView(badWidth.raw).setUint16(34,12,true);await rejectCode(badWidth,'WAV_PCM_WIDTH_UNSUPPORTED');
  const truncatedExt=makeWavEncodingFixture({extensible:true});new DataView(truncatedExt.raw).setUint16(36,100,true);await rejectCode(truncatedExt,'WAV_FMT_EXTENSION');
  const badGuid=makeWavEncodingFixture({extensible:true});new DataView(badGuid.raw).setUint8(59,0);await rejectCode(badGuid,'WAV_EXTENSIBLE_SUBFORMAT');
  const badBits=makeWavEncodingFixture({extensible:true});new DataView(badBits.raw).setUint16(38,33,true);await rejectCode(badBits,'WAV_VALID_BITS');
  const badAlign=makeWavEncodingFixture();new DataView(badAlign.raw).setUint16(32,1,true);await rejectCode(badAlign,'WAV_FRAME_LAYOUT');
  console.log('WAV format diagnostics tests passed: PCM/float/extensible, valid bits, signatures, malformed headers and bounded reads');
}
async function runBoundedWavTests(){
  await runWavFormatDiagnosticTests();
  const check=(v,m)=>{if(!v)throw new Error(m);};
  async function rejects(fn,message){let failed=false;try{await fn();}catch(_){failed=true;}check(failed,message);}
  for(const bits of [8,16,24,32]){
    const fixture=makeBoundedWavFixture({bits,frames:480,channels:2,sample:(f,c)=>c?-.5:.5}),wav=await inspectPcmWav(fixture);
    const channels=await readPcmWavFrames(wav,100,10);
    check(channels.length===2&&Math.abs(channels[0][0]-.5)<.01&&Math.abs(channels[1][0]+.5)<.01,'PCM conversion, channel order and odd chunk parsing');
    check(fixture.reads.slice(0,-1).every(([a,b])=>b-a<=16),'Header validation never reads payload');
  }
  for(const [name,type] of [['stem.wav','audio/wav'],['stem.WAV','audio/x-wav'],['stem.wave','application/octet-stream'],['stem.WAVE','']]){
    const fixture=makeBoundedWavFixture({frames:480});fixture.name=name;fixture.type=type;
    check((await inspectPcmWav(fixture)).frames===480,'WAV header validation is independent of extension and MIME metadata');
  }
  const disguised=makeBoundedWavFixture({frames:480});disguised.name='song.wav';disguised.type='audio/wav';
  new DataView(disguised.raw).setUint32(0,0);
  await rejects(()=>inspectPcmWav(disguised),'A WAV name/MIME must not bypass RIFF validation');
  const bad=makeBoundedWavFixture({frames:480});new DataView(bad.raw).setUint16(20,6,true);
  await rejects(()=>inspectPcmWav(bad),'Compressed formats reject');
  const invalid=makeBoundedWavFixture({frames:480});new DataView(invalid.raw).setUint32(40,0xffffffff,true);
  await rejects(()=>inspectPcmWav(invalid),'Invalid chunk extents reject');
  const nodes=[];let closes=0;
  const context={sampleRate:48000,currentTime:0,state:'running',destination:{},resume:async()=>{},close:async()=>{closes++;context.state='closed';},
    createGain:()=>({gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}),
    createBuffer:(channels,length,rate)=>({length,numberOfChannels:channels,sampleRate:rate,copyToChannel(){}}),
    createBufferSource(){const node={connect(){},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},start(time){this.time=time;}};nodes.push(node);return node;}};
  const player=createBoundedWavPlayer({createContext:()=>context,setTimer:()=>1,clearTimer:()=>{},nowMs:()=>0});
  const files=Object.fromEntries(streamingStemNames.map(name=>[name,makeBoundedWavFixture()]));
  await player.loadFiles(files);check(nodes.length===0&&files.voice.reads.every(([a,b])=>b-a<=16),'Load inspects headers only');
  await player.play();await player.tick();check(nodes.length===24,'Three enabled stems prepare eight quarter-second chunks each; Voice is dormant');
  for(let chunk=0;chunk<8;chunk++)check(nodes.filter(node=>Math.abs(node.time-(.01+chunk*.25))<1e-9).length===3,'Stems share scheduled source-frame positions');
  check(player.getState().applicationPcmBytes<=3*2*48000*2*4,'Scheduled PCM remains within configured capacity');
  context.currentTime=.8;await player.tick();
  check(player.getState().underruns===0&&player.getState().position===.79,'Normal refill advances one authoritative timeline');
  player.setEnabled('voice',true);await player.tick();
  // Activation starts a pump immediately; drain it deterministically through microtasks.
  for(let i=0;i<100;i++)await Promise.resolve();
  check(files.voice.reads.some(([a,b])=>a>=56+.79*48000*4),'Dormant activation reads the current timeline, not its old zero position');
  player.pause();const bookmark=player.getState().position;
  await player.play();check(Math.abs(player.getState().position-bookmark)<1e-9,'Pause/resume retains common bookmark');
  await player.seek(4);check(player.getState().position===4,'Playing seek replaces all streams at the requested position');
  player.stop();check(player.getState().position===0&&player.getState().applicationPcmBytes<=4*.25*48000*2*4,'Stop resets timeline and retains only bounded restart PCM');
  for(const seconds of [1,2,5]){player.setWindow(seconds);await player.play();check(player.getState().applicationPcmBytes<=seconds*4*48000*2*4,'All window sizes remain bounded');player.stop();}
  player.setWindow(1);await player.play();context.currentTime+=3;await player.tick();check(player.getState().underruns>0,'Missed refill deadlines are reported');
  player.stop();await rejects(()=>player.seek(-1),'Invalid seek rejects');
  const mismatch={...files,flow:makeBoundedWavFixture({rate:44100})};
  await rejects(()=>player.loadFiles(mismatch),'Mismatched context rate must reject without resampling');
  await player.loadFiles(files);
  await player.whenReady();
  let releaseRead;const originalSlice=files.transients.slice;
  files.transients.slice=function(start,end){if(start>=56&&!releaseRead)return{arrayBuffer:()=>new Promise(resolve=>{releaseRead=()=>resolve(files.transients.raw.slice(start,end));})};return originalSlice.call(this,start,end);};
  const pending=player.seek(6);for(let i=0;i<20;i++)await Promise.resolve();
  check(!!releaseRead,'Cancellation fixture must reach a payload read');
  player.stop();releaseRead();check(await pending===false&&!player.getState().playing,
    'Stop cancels pending preparation without scheduling stale audio');
  files.transients.slice=originalSlice;
  await player.play();player.stop();
  const broken=makeBoundedWavFixture();const slice=broken.slice;
  broken.slice=function(start,end){if(start>=56)return{arrayBuffer:async()=>{throw new Error('storage failed');}};return slice.call(this,start,end);};
  await player.loadFiles({...files,voice:broken});
  await rejects(()=>player.play(),'Preparation read failure must surface');
  check(!player.getState().playing&&player.getState().applicationPcmBytes===0,'Read failure retires partial prepared PCM');
  await player.close();check(closes===1&&nodes.every(node=>node.disconnected),'Shutdown retires every source and owned context');
  console.log('Bounded WAV tests passed: sliced PCM conversion, validation, common timeline, windows, dormancy, seeking, underruns and cleanup');
}
