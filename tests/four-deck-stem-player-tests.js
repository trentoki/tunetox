async function runFourDeckStemPlayerTests() {
  const check=(value,message)=>{if(!value)throw new Error(message);};
  const sources=[],gains=[];let contexts=0,closed=0;
  const context={currentTime:0,sampleRate:48000,state:'running',destination:{},resume:async()=>{},
    close:async()=>{closed++;context.state='closed';},decodeAudioData:async data=>data,
    createBufferSource(){const node={connect(){},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},start(time,offset){this.time=time;this.offset=offset;}};sources.push(node);return node;},
    createGain(){const events=[];const node={events,gain:{setValueAtTime(v,t){events.push([v,t]);},cancelScheduledValues(){},linearRampToValueAtTime(v,t){events.push([v,t]);}},connect(){},disconnect(){this.disconnected=true;}};gains.push(node);return node;}};
  const mixer=createNativeStemMixer(()=>{contexts++;return context;});
  const files=()=>Object.fromEntries(prototypeStemNames.map(name=>[name,{arrayBuffer:async()=>({length:480000,sampleRate:48000,numberOfChannels:2,duration:10})}]));
  for(const id of mixer.deckIds){await mixer.getDeck(id).loadFiles(files());await mixer.getDeck(id).play();context.currentTime+=0.1;}
  check(contexts===1&&sources.length===16&&mixer.deckIds.every(id=>mixer.getDeck(id).getState().isPlaying),'Sixteen sources use one context and play simultaneously');
  for(const id of mixer.deckIds) {
    const group=sources.slice((id-1)*4,id*4);
    check(group.every(source=>source.time===group[0].time&&source.offset===0),'Within-deck source scheduling remains aligned');
  }
  const untouched=gains.slice(0,18).map(gain=>JSON.stringify(gain.events));
  mixer.getDeck(4).setMainVolume(0.5);mixer.getDeck(4).setStemLevel('flow',0.3);
  check(gains.slice(0,18).every((gain,i)=>JSON.stringify(gain.events)===untouched[i]),'Deck 4 changes do not schedule any other deck gains');
  mixer.getDeck(3).pause();const bookmark=mixer.getDeck(3).getState().position;
  check(mixer.getDeck(1).getState().isPlaying&&mixer.getDeck(4).getState().isPlaying,'Deck 3 Pause preserves other transports');
  await mixer.getDeck(3).play();check(sources.slice(-4).every(source=>source.offset===bookmark),'Deck 3 Resume retains common source position');
  mixer.getDeck(2).stop();mixer.getDeck(3).eject();
  await mixer.getDeck(4).loadFiles(files());
  check(mixer.getDeck(4).getState().mainVolume===0.5&&mixer.getDeck(4).getState().levels.flow===0.3&&mixer.getDeck(1).getState().isPlaying,'Replacement preserves controls and other decks');
  const state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
  const actions=createParticipationActions(state);actions.set(1,'stemHandoff',false);actions.set(2,'stemHandoff',false);
  const bridge=createStemHandoffAudioBridge(state,mixer);bridge.synchronizeAudio();
  bridge.setStemLevel(3,'flow',1,'introduce-three');bridge.setMainVolume(3,1,'volume-three');bridge.setMainVolume(4,1,'volume-four');
  bridge.setStemLevel(4,'flow',0.5,'half');
  check(mixer.getDeck(3).getState().levels.flow===0.5&&mixer.getDeck(4).getState().levels.flow===0.5,'Bridge projects arbitrary participant pair 3/4');
  bridge.setStemLevel(4,'flow',1,'full');
  check(mixer.getDeck(3).getState().levels.flow===0&&state.decks[2].stems.requestedLevels.flow===1,'Deck 3 automatic allocation preserves request');
  actions.set(1,'stemHandoff',true);bridge.setStemLevel(4,'flow',0.2,'three-participants');
  check(mixer.getDeck(3).getState().levels.flow===0,'Three participants remain direct-only');
  actions.set(2,'stemHandoff',true);bridge.setStemLevel(4,'flow',0.4,'four-participants');
  check(mixer.getDeck(3).getState().levels.flow===0,'Four participants remain direct-only');
  await mixer.close();await mixer.close();
  check(closed===1&&sources.every(source=>source.disconnected)&&gains.every(gain=>gain.disconnected),'All graphs retire and shared context closes once');
  for(const ids of [[1,1],[0,2],[1,2,5],[]]){let rejected=false;try{createNativeStemMixer(()=>context,ids);}catch(_){rejected=true;}check(rejected,'Invalid owned deck IDs must reject');}
  console.log('Four-deck native tests passed: sixteen paths, one context, independent transports, pair 3/4, gain isolation and cleanup');
}
