async function runStemHandoffRenderTests(pairIds = [1, 2]) {
  const [firstDeck, secondDeck] = pairIds;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const context=new OfflineAudioContext(2,24000,48000);let clock=0;
  const events=[];
  const adapter={get currentTime(){return clock;},state:'running',sampleRate:48000,destination:context.destination,
    resume:async()=>{},close:async()=>{},decodeAudioData:bytes=>context.decodeAudioData(bytes),
    createBufferSource:()=>context.createBufferSource(),createGain(){const node=context.createGain();
      const set=node.gain.setValueAtTime.bind(node.gain),ramp=node.gain.linearRampToValueAtTime.bind(node.gain);
      node.gain.setValueAtTime=(value,when)=>{events.push({type:'set',value,when});return set(value,when);};
      node.gain.linearRampToValueAtTime=(value,when)=>{events.push({type:'ramp',value,when});return ramp(value,when);};
      return node;}};
  function stereoFile(channel, value) {
    const frames=24000, bytes=new ArrayBuffer(44+frames*4), view=new DataView(bytes);
    const text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,36+frames*4,true);text(8,'WAVE');text(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
    view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);
    text(36,'data');view.setUint32(40,frames*4,true);
    for(let i=0;i<frames;i++)view.setInt16(44+i*4+channel*2,Math.round(value*32767),true);
    return new File([bytes],'channel-stem.wav',{type:'audio/wav'});
  }
  const mixer=createNativeStemMixer(()=>adapter),state=createHandoffAudioTestState();
  const participation=createParticipationActions(state);
  for(const id of [1,2,3,4]) participation.set(id,'stemHandoff',pairIds.includes(id));
  const bridge=createStemHandoffAudioBridge(state,mixer);
  bridge.synchronizeAudio();
  bridge.setStemLevel(firstDeck,'flow',1,'introduce-first');
  bridge.setMainVolume(firstDeck,1,'volume1');bridge.setMainVolume(secondDeck,1,'volume2');
  for(const id of pairIds) {
    const files=Object.fromEntries(prototypeStemNames.map(name=>[name,stereoFile(pairIds.indexOf(id),name==='flow'?0.1:0)]));
    await mixer.getDeck(id).loadFiles(files);await mixer.getDeck(id).play();
  }
  clock=0.05;const before=events.length;bridge.setStemLevel(secondDeck,'flow',0.5,'half');
  const batch=events.slice(before).filter(event=>event.type==='set');
  check(batch.length===2&&batch.every(event=>event.when===batch[0].when),'Related Flow gains must share one scheduling time');
  clock=0.10;bridge.setStemLevel(secondDeck,'flow',1,'full');
  clock=0.15;bridge.setMainVolume(secondDeck,0.5,'main-volume');
  clock=0.20;bridge.setParticipation(secondDeck,false);bridge.setStemLevel(secondDeck,'flow',0.5,'excluded');
  clock=0.23;bridge.setParticipation(secondDeck,true); // No immediate normalization.
  clock=0.25;bridge.setStemLevel(secondDeck,'flow',0.8,'rapid-a');
  clock=0.254;bridge.setStemLevel(secondDeck,'flow',0.2,'rapid-b');
  clock=0.258;bridge.setStemLevel(secondDeck,'flow',0.9,'rapid-c');
  const snapshot=JSON.stringify(state),eventCount=events.length,original=calculateTwoDeckStemHandoff;
  let failed=false;
  try{calculateTwoDeckStemHandoff=()=>{throw new Error('render rollback');};clock=0.30;bridge.setStemLevel(secondDeck,'flow',0.1,'failed');}
  catch(_){failed=true;}finally{calculateTwoDeckStemHandoff=original;}
  check(failed&&JSON.stringify(state)===snapshot&&events.length===eventCount,'Failure must not schedule partial audio changes');
  const pcm=await context.startRendering();
  for(const [time,left,right] of [[0.03,0.1,0],[0.08,0.05,0.05],[0.13,0,0.1],[0.18,0.05,0.05],[0.225,0.05,0.025],[0.24,0.05,0.025],[0.29,0.05,0.045],[0.33,0.05,0.045]]) {
    for(const [channel,expected] of [[0,left],[1,right]]) {
      const actual=pcm.getChannelData(channel)[Math.round(time*48000)];
      check(Math.abs(actual-expected)<0.0002,'Rendered handoff mismatch at '+time+' channel '+channel+': '+actual+' vs '+expected);
    }
  }
  for(const channel of [0,1]) {
    const data=pcm.getChannelData(channel);
    for(let frame=12000;frame<14000;frame++)check(Math.abs(data[frame]-data[frame-1])<0.001,'Rapid reversal must not introduce a gain discontinuity');
  }
  await mixer.close();
  console.log('Rendered handoff tests passed: [1,0] -> [0.5,0.5] -> [0,1], main volume once, participation, reversal continuity and rollback');
}
