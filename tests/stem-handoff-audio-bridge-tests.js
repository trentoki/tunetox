function createHandoffAudioTestState() {
  const state={decks:[1,2,3,4].map(createDeck),participation:createParticipationState(),stemSession:createStemSessionState()};
  const actions=createParticipationActions(state);actions.set(3,'stemHandoff',false);actions.set(4,'stemHandoff',false);
  return state;
}
function runStemHandoffAudioBridgeTests() {
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const state=createHandoffAudioTestState(), batches=[], updates=[];
  const bridge=createStemHandoffAudioBridge(state,{applyGainSnapshot:snapshot=>{batches.push(snapshot);return 2;}},
    (s,details)=>updates.push(details));
  bridge.synchronizeAudio();
  check(batches[0][1].mainVolume===0&&batches[0][2].levels.flow===0,'Bridge applies authoritative startup without new defaults');
  bridge.setMainVolume(1,1,'volume-one');bridge.setMainVolume(2,1,'volume-two');
  bridge.setStemLevel(2,'flow',0.5,'half');
  check(batches.at(-1)[1].levels.flow===0.5&&batches.at(-1)[2].levels.flow===0.5,'Committed allocations reach both audio targets');
  check(state.decks[0].stems.requestedLevels.flow===1&&updates.at(-1).automaticControls.includes('deck.1.stem.flow.level')&&
    updates.at(-1).directControl==='deck.2.stem.flow.level','Requested intent and direct/automatic display metadata stay separate');
  check(state.decks[0].stems.allocatedLevels.voice===1&&state.decks[1].stems.allocatedLevels.voice===0,'Independent category handoff');
  bridge.setStemLevel(2,'flow',1,'full');bridge.setStemLevel(2,'flow',0,'reverse');
  check(state.decks[0].stems.allocatedLevels.flow===1&&state.stemSession.relationshipsByStem.flow,'Immediate reversal retains sharing');
  bridge.setStemLevel(2,'flow',1,'again');bridge.setMainVolume(2,0.5,'volume-handoff');
  check(batches.at(-1)[1].levels.flow===0.5&&batches.at(-1)[2].levels.flow===1&&batches.at(-1)[2].mainVolume===0.5,
    'Main volume is separate from allocation, not multiplied into stem targets');
  const allocation=state.decks[0].stems.allocatedLevels.flow;
  bridge.setParticipation(2,false);bridge.setStemLevel(2,'flow',0.2,'excluded');
  check(state.decks[0].stems.allocatedLevels.flow===allocation,'Excluded deck cannot redistribute');
  bridge.setParticipation(2,true);check(state.decks[0].stems.allocatedLevels.flow===allocation,'Re-enable does not normalize');
  const original=calculateTwoDeckStemHandoff, before=JSON.stringify(state), count=batches.length, notifications=updates.length;
  let failed=false;
  try {calculateTwoDeckStemHandoff=()=>{throw new Error('calculator failure');};bridge.setStemLevel(2,'flow',0.4,'rollback');}
  catch(_){failed=true;}finally{calculateTwoDeckStemHandoff=original;}
  check(failed&&JSON.stringify(state)===before&&batches.length===count&&updates.length===notifications,
    'Calculator exception rolls back state and emits no audio or display update');
  console.log('Stem handoff audio bridge tests passed: canonical actions, direct/automatic intent, main volume, participation and rollback');
}
