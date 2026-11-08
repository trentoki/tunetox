async function runTwoDeckStemPlayerTests() {
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const sources=[], gains=[];let created=0, closes=0;
  const context={currentTime:0,sampleRate:48000,state:'running',destination:{},resume:async()=>{},
    close:async()=>{closes++;context.state='closed';},decodeAudioData:async data=>data,
    createBufferSource(){const node={connect(target){this.target=target;},disconnect(){this.disconnected=true;},
      start(when,offset){this.when=when;this.offset=offset;},stop(){this.stopped=true;}};sources.push(node);return node;},
    createGain(){const events=[];const node={gain:{setValueAtTime(v,t){events.push(['set',v,t]);},
      cancelScheduledValues(t){events.push(['cancel',t]);},linearRampToValueAtTime(v,t){events.push(['ramp',v,t]);}},events,
      connect(target){this.target=target;},disconnect(){this.disconnected=true;}};gains.push(node);return node;}};
  const files=()=>Object.fromEntries(prototypeStemNames.map(name=>[name,{arrayBuffer:async()=>({length:480000,sampleRate:48000,numberOfChannels:2,duration:10})}]));
  const pair=createTwoDeckStemPlayer(()=>{created++;return context;}), a=pair.getDeck(1), b=pair.getDeck(2);
  await a.loadFiles(files());await b.loadFiles(files());
  await a.play();context.currentTime=1;await b.play();
  check(created===1 && a.getState().isPlaying && b.getState().isPlaying,'Both decks share one context and play simultaneously');
  check(sources.slice(0,4).every(s=>s.when===sources[0].when)&&sources.slice(4).every(s=>s.when===sources[4].when),'Within-deck sources share starts');
  check(a.getState().position>b.getState().position,'Decks retain independent timelines');
  check(gains[0].target===gains[4]&&gains[4].target===gains[5]&&gains[5].target===context.destination,
    'Stem, main volume and transport gain stages must be distinct');
  const otherEvents=JSON.stringify(gains.slice(6).map(g=>g.events));
  a.setMainVolume(0);context.currentTime=1.005;a.setMainVolume(1);
  check(Math.abs(gains[4].events.slice(-2)[0][1]-0.5)<1e-9,'Main-volume reversal retains instantaneous envelope value');
  a.setStemLevel('flow',0.3);
  check(JSON.stringify(gains.slice(6).map(g=>g.events))===otherEvents && b.getState().mainVolume===1,'Main/stem gains are isolated between decks');
  context.currentTime=2;a.pause();const bookmark=a.getState().position;
  check(b.getState().isPlaying && sources.slice(0,4).every(s=>s.disconnected)&&sources.slice(4,8).every(s=>!s.disconnected),'Pause one deck retires only its graph');
  await a.play();check(sources.slice(-4).every(s=>s.offset===bookmark),'Resume keeps four stems aligned at saved offset');
  a.stop();check(a.getState().position===0&&b.getState().isPlaying,'Stop does not interrupt the other deck');
  a.setMainVolume(0.7);await a.loadFiles(files());
  check(a.getState().mainVolume===0.7&&a.getState().levels.flow===0.3&&b.getState().isPlaying,'Replacement retains musical controls and leaves other deck playing');
  let finish;const slow=files();slow.transients={arrayBuffer:()=>new Promise(resolve=>{finish=resolve;})};
  const pending=a.loadFiles(slow);await Promise.resolve();a.eject();finish({});await pending;
  check(!a.getState().loaded&&b.getState().isPlaying&&closes===0,'Eject cancels one load without closing the shared context');
  for(let i=0;i<3;i++){await a.loadFiles(files());await a.play();a.eject();}
  await a.close();check(closes===0&&b.getState().isPlaying,'Individual close must not close a borrowed context');
  await pair.close();await pair.close();
  check(closes===1 && gains.every(g=>g.disconnected)&&sources.every(s=>s.disconnected)&&b.getState().closed,'Pair shutdown retires every graph and closes shared context once');
  console.log('Two-deck stem player tests passed: shared ownership, independent transports, gain isolation, replacement and cleanup');
}
