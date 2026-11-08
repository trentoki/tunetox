// Generated local WAVs exercise actual browser decoding; no downloaded media.
function makeStemTestFile(value) {
  const frames=24000, data=new ArrayBuffer(44+frames*2), view=new DataView(data);
  function text(offset,value){for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));}
  text(0,'RIFF');view.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,48000,true);view.setUint32(28,96000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,frames*2,true);
  for(let i=0;i<frames;i++)view.setInt16(44+i*2,Math.round(value*32767),true);
  return new File([data],'generated-stem.wav',{type:'audio/wav'});
}
document.getElementById('run').addEventListener('click',async()=>{
  const result=document.getElementById('result');result.textContent='Running';
  const check=(v,m)=>{if(!v)throw new Error(m);};let player, pair;
  try {
    runStemHandoffAudioBridgeTests();
    await runStemHandoffRenderTests();
    await runStemHandoffRenderTests([3,4]);
    await runStemHandoffRenderTests([1,4]);
    await runFourDeckStemPlayerTests();
    await runFourDeckStemRenderTests();
    await runFourStemPlayerTests();
    await runTwoDeckStemPlayerTests();
    const offline=new OfflineAudioContext(1,24000,48000);let clock=0;const starts=[];
    const adapter={get currentTime(){return clock;},state:'running',sampleRate:48000,destination:offline.destination,
      resume:async()=>{},close:async()=>{},decodeAudioData:data=>offline.decodeAudioData(data),
      createGain:()=>offline.createGain(),createBufferSource(){const node=offline.createBufferSource();
        const start=node.start.bind(node);node.start=(when,offset)=>{starts.push([when,offset]);start(when,offset);};return node;}};
    player=createFourStemPlayer(()=>adapter);
    const files=Object.fromEntries(prototypeStemNames.map((name,i)=>[name,makeStemTestFile((i+1)*0.01)]));
    await player.loadFiles(files);
    for(const name of prototypeStemNames)player.setStemLevel(name,0);
    await player.play();
    check(starts.length===4&&starts.every(s=>s[0]===starts[0][0]&&s[1]===0),'Real sources must share scheduling coordinates');
    // Separate windows make each path's contribution independently measurable.
    prototypeStemNames.forEach((name,i)=>{clock=0.02+i*0.08;player.setStemLevel(name,1);clock+=0.04;player.setStemLevel(name,0);});
    const rendered=await offline.startRendering(), pcm=rendered.getChannelData(0);
    prototypeStemNames.forEach((name,i)=>{
      const sample=pcm[Math.round((0.045+i*0.08)*48000)];
      check(Math.abs(sample-(i+1)*0.01)<0.0001,'Rendered path amplitude mismatch: '+name+' '+sample);
    });
    // During the first 10 ms opening ramp, constant PCM should follow a linear gain envelope.
    check(Math.abs(pcm[1200]-0.005)<0.0001,'Rendered gain ramp must reach half amplitude at 5 ms');
    check(Math.abs(pcm[4800])<0.00001,'Closed paths must render silence between windows');
    await player.close();
    const mixContext=new OfflineAudioContext(1,24000,48000);let mixClock=0;
    const mixAdapter={get currentTime(){return mixClock;},state:'running',sampleRate:48000,destination:mixContext.destination,
      resume:async()=>{},close:async()=>{},decodeAudioData:data=>mixContext.decodeAudioData(data),
      createGain:()=>mixContext.createGain(),createBufferSource:()=>mixContext.createBufferSource()};
    pair=createTwoDeckStemPlayer(()=>mixAdapter);
    const first=pair.getDeck(1),second=pair.getDeck(2);
    await first.loadFiles(files);await second.loadFiles(files);
    first.setMainVolume(0.5);second.setMainVolume(0.25);await first.play();mixClock=0.02;await second.play();
    mixClock=0.05;first.setMainVolume(0);mixClock=0.10;first.setMainVolume(1);
    const sum=(await mixContext.startRendering()).getChannelData(0);
    for(const [time,expected] of [[0.015,0.05],[0.04,0.075],[0.08,0.025],[0.12,0.125]]) {
      check(Math.abs(sum[Math.round(time*48000)]-expected)<0.0003,'Two-deck rendered gain/time isolation failed at '+time);
    }
    await pair.close();pair=null;
    player=createFourStemPlayer();
    // Explicit resume is invoked by loadFiles; headless trials use autoplay permission.
    await player.loadFiles(files);for(const name of prototypeStemNames)player.setStemLevel(name,0);
    await player.play();const deadline=performance.now()+5000;
    while(player.getState().position<0.03&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    check(player.getState().position>=0.03,'Real AudioContext did not advance: '+JSON.stringify(player.getState()));
    player.pause();const position=player.getState().position;await player.play();
    check(player.getState().position>=position,'Real resume must preserve position');
    player.stop();check(player.getState().position===0,'Real Stop must reset position');
    player.eject();await player.close();
    pair=createTwoDeckStemPlayer();
    const liveA=pair.getDeck(1),liveB=pair.getDeck(2);
    await liveA.loadFiles(files);await liveB.loadFiles(files);
    liveA.setMainVolume(0);liveB.setMainVolume(0);
    await liveA.play();await liveB.play();
    check(liveA.getState().isPlaying&&liveB.getState().isPlaying,'Both native decks must play simultaneously');
    liveA.pause();check(liveB.getState().isPlaying,'Pause cannot stop the other deck');
    await liveA.play();liveA.stop();check(liveB.getState().isPlaying,'Stop cannot stop the other deck');
    liveA.eject();check(liveB.getState().isPlaying,'Eject cannot stop the other deck');
    await pair.close();pair=null;
    result.textContent='Four-deck/sixteen-stem and arbitrary-pair handoff tests passed: mocks, real WAV decode, synchronized scheduling, rendered stem/main-volume isolation and 10 ms envelope, simultaneous native playback and independent cleanup. No listening performed.';
  } catch(error){result.textContent='FAIL: '+error.message;console.error(error);}
  finally{if(player)await player.close().catch(console.error);if(pair)await pair.close().catch(console.error);}
});
