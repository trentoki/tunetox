async function runFourDeckStemRenderTests() {
  const context=new OfflineAudioContext(1,24000,48000);let clock=0;
  const adapter={get currentTime(){return clock;},state:'running',sampleRate:48000,destination:context.destination,
    resume:async()=>{},close:async()=>{},decodeAudioData:bytes=>context.decodeAudioData(bytes),
    createGain:()=>context.createGain(),createBufferSource:()=>context.createBufferSource()};
  const mixer=createNativeStemMixer(()=>adapter);
  const targets=Object.fromEntries([1,2,3,4].map(id=>[id,{mainVolume:0.25,levels:Object.fromEntries(prototypeStemNames.map(name=>[name,1]))}]));
  mixer.applyGainSnapshot(targets);
  for(const id of mixer.deckIds) {
    await mixer.getDeck(id).loadFiles(Object.fromEntries(prototypeStemNames.map(name=>[name,makeStemTestFile(id*0.01)])));
    await mixer.getDeck(id).play();
  }
  clock=0.05;targets[4].mainVolume=0;mixer.applyGainSnapshot(targets);
  clock=0.10;targets[3].levels.flow=0;mixer.applyGainSnapshot(targets);
  const data=(await context.startRendering()).getChannelData(0);
  for(const [time,expected] of [[0.03,0.10],[0.08,0.06],[0.13,0.0525]]) {
    const actual=data[Math.round(time*48000)];
    if(Math.abs(actual-expected)>0.0003)throw new Error('Sixteen-stem rendered sum/isolation mismatch: '+actual+' vs '+expected);
  }
  await mixer.close();
  console.log('Sixteen-stem rendered sum, Deck 4 volume isolation and Deck 3 Flow isolation passed');
}
