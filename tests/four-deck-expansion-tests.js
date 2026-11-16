// Phase 1F loading/lifecycle regression. Uses unchanged production handoff actions.
async function runFourDeckExpansionTests() {
  let checks=0,contexts=0,decodes=0,fetches=0;
  const check=(value,label)=>{checks++;if(!value)throw new Error(label);};
  const near=(a,b)=>Math.abs(a-b)<1e-9;
  const f=createStemSchedulingFixture();
  globalThis.AudioContext=function(){contexts++;return f.audio;};
  globalThis.performance={now:()=>f.audio.currentTime*1000};
  f.audio.decodeAudioData=async value=>{decodes++;return value;};
  const stem=()=>({format:'IEEE float32',channels:1,sampleRate:48000,frames:48000,duration:1,encodedBytes:123,url:'/test'});
  const metadata={song:'First prepared',stems:Object.fromEntries(prototypeStemNames.map(n=>[n,stem()])),mainCeiling:.1};
  globalThis.fetch=async()=>{fetches++;return {ok:true,arrayBuffer:async()=>({byteLength:123,length:48000,sampleRate:48000,numberOfChannels:1,duration:1})};};
  const notices=[],c=TuneToxDesign.createPlayableController({decks:{1:metadata,2:{...metadata,song:'Second prepared'}}},m=>notices.push(m),{fourDeck:true});
  const view=c.createViewState(),state=appState;
  for(const id of [1,2,3,4]){
    check(await c.load(id,id%2?'hypnotic':'cut-me-loose'),'All four slots load');
    check(!view.decks[id-1].playing && view.decks[id-1].volume===0,'Load neither plays nor raises Main');
    for(const index of [0,2,3])c.level(id,index,0);
    c.handoff(id);c.level(id,1,id===1?1:.25);c.level(id,null,1);
  }
  check(contexts===1 && decodes===8 && fetches===8,'One context, eight decodes/downloads for four repeated-song decks');
  check(c.mixer.getDeck(1).getDecodedBuffers().flow===c.mixer.getDeck(3).getDecodedBuffers().flow,'Hypnotic PCM shared by identity');
  check(c.mixer.getDeck(2).getDecodedBuffers().flow===c.mixer.getDeck(4).getDecodedBuffers().flow,'Other song PCM shared by identity');
  check(Object.isFrozen(c.mixer.getDeck(3).getDecodedBuffers()),'Borrowed map immutable');
  check(c.diagnostics().sharedPCM.uniqueDecodedBytes===8*48000*4,'Unique PCM accounting excludes duplicate deck references');
  for(const id of [1,2,3,4]){
    f.audio.currentTime+=.1;check(await c.play(id),'Independent start D'+id);
    const total=state.decks.filter(d=>state.stemSession.nativeHandoff.members[d.id]).reduce((n,d)=>n+d.volume*d.stems.allocatedLevels.flow,0);
    check(total<=1+1e-9,'Two/three/four ownership allocations within cap');
    check([1,2,3,4].filter(d=>state.stemSession.nativeHandoff.members[d]).length===id,'Correct native ownership count');
  }
  check(f.sources.length===16 && f.sources[0]!==f.sources[8] && f.sources[0].buffer===f.sources[8].buffer,'Sixteen independent source nodes, shared read-only data');
  check(f.sources[0].time!==f.sources[8].time,'Same-song sources have independent start times');
  for(const id of [1,2,3,4])c.level(id,1,.25);
  check(state.decks.every(d=>near(d.stems.allocatedLevels.flow,.25)),'Four-way equal sharing');
  c.level(4,1,.8);
  check(near(state.decks[3].stems.allocatedLevels.flow,.8) && state.decks.slice(0,3).every(d=>near(d.stems.allocatedLevels.flow,.2/3)),'Direct priority with three proportional receivers');
  for(const index of [0,2,3]){
    const flowBefore=JSON.stringify(state.decks.map(d=>d.stems.allocatedLevels.flow));
    for(const id of [1,2,3,4])c.level(id,index,.15);
    const name=prototypeStemNames[index];
    check(state.decks.every(d=>near(d.stems.allocatedLevels[name],.15)),'Independent category controls on four decks: '+name);
    check(JSON.stringify(state.decks.map(d=>d.stems.allocatedLevels.flow))===flowBefore,'Other-category gestures preserve Flow');
    for(const id of [1,2,3,4])c.level(id,index,0);
    check(state.decks.every(d=>d.stems.requestedLevels[name]===0 && d.stems.allocatedLevels[name]===0),'Explicit zeros protected for '+name);
  }
  const beforeZero={stem:state.decks[3].stems.allocatedLevels.flow,requested:state.decks[3].stems.requestedLevels.flow,eligible:state.stemSession.eligibilityByDeck[4].flow,ceiling:state.stemSession.authorization.ceilingsByStem.flow};
  f.audio.currentTime+=.1;c.level(4,null,0);
  check(state.decks[3].stems.allocatedLevels.flow===beforeZero.stem && state.decks[3].stems.requestedLevels.flow===beforeZero.requested,'Main zero preserves coefficients and requests');
  check(state.stemSession.eligibilityByDeck[4].flow===beforeZero.eligible && state.stemSession.authorization.ceilingsByStem.flow===beforeZero.ceiling,'Main zero preserves eligibility and high-water');
  check(view.decks[3].playing && state.stemSession.nativeHandoff.members[4],'Main zero does not pause or depart');
  f.audio.currentTime+=.1;check(c.mixer.getDeck(4).getDiagnostics().stems.flow.modeledEffectiveGain===0,'Settled Main zero gives zero physical effective gain');
  c.level(2,1,0);c.level(1,1,.2);
  check(state.decks[1].stems.allocatedLevels.flow===0 && state.decks[1].stems.requestedLevels.flow===0,'Explicit zero keeps its zero request weight');
  check(state.decks[3].stems.allocatedLevels.flow===beforeZero.stem,'Peer actions retain muted positive stem coefficients');
  c.level(4,null,1);check(state.decks[1].stems.allocatedLevels.flow===0,'Main restore does not resurrect explicit zero');
  c.level(1,1,1);f.audio.currentTime+=.1;
  check(state.decks[3].stems.allocatedLevels.flow===0 && state.decks[3].stems.requestedLevels.flow>0,'Suppressed zero differs from explicit zero');
  c.level(4,null,0);f.audio.currentTime+=.1;c.level(4,null,1);f.audio.currentTime+=.1;
  check(state.decks[3].stems.allocatedLevels.flow===0,'Restoring Main does not reinstate a historical request over a suppressed coefficient');
  c.level(1,1,.2);
  check(state.decks[3].stems.allocatedLevels.flow>0 && state.decks[1].stems.allocatedLevels.flow===0,'Later peer gesture restores eligible auto-zero but not explicit zero');
  c.handoff(4);const otherBefore=JSON.stringify(state.decks.slice(0,3).map(d=>d.stems));c.level(4,1,1);
  check(JSON.stringify(state.decks.slice(0,3).map(d=>d.stems))===otherBefore,'OFF deck independent of participating allocations');
  c.level(1,1,.8);check(state.decks[3].stems.allocatedLevels.flow===1,'Participant cannot reduce independent source');
  const pauseBefore=JSON.stringify(state.decks.map(d=>d.stems));await c.play(2);c.stop(1);
  check(state.stemSession.nativeHandoff.members[1] && state.stemSession.nativeHandoff.members[2] && JSON.stringify(state.decks.map(d=>d.stems))===pauseBefore,'Pause/Stop retain ownership and coefficients');
  check(view.decks[2].playing && view.decks[3].playing,'Other transports continue');
  await c.play(1);await c.play(2);
  for(let i=0;i<80;i++){
    f.audio.currentTime+=.003;const id=i%4+1;
    c.level(id,null,[0,.3,.8,1][i%4]);c.level(id,1,[.2,.5,.8,.3][i%4]);
    check(view.decks.every(d=>d.playing) && !c.mixer.getLastSchedulingFailure(),'Rapid four-deck Main/stem gestures preserve transport');
    const capped=state.decks.filter(d=>state.participation.byDeck[d.id].stemHandoff);
    check(capped.reduce((n,d)=>n+d.volume*d.stems.allocatedLevels.flow,0)<=1+1e-9,'Participating cap under mixed ON/OFF stress');
  }
  let patternIndex=0;
  for(const pattern of [[],[1,3],[2,4],[1,2,3,4]]){
    const before=JSON.stringify(state.decks.map(d=>d.stems));
    for(const id of [1,2,3,4])if(view.decks[id-1].handoff!==pattern.includes(id))c.handoff(id);
    check(JSON.stringify(state.decks.map(d=>d.stems))===before,'Mixed participation toggles preserve all coefficients');
    for(const id of [1,2,3,4])c.level(id,1,.60+patternIndex*.03+id*.01);
    patternIndex++;
    check(pattern.reduce((sum,id)=>sum+state.decks[id-1].volume*state.decks[id-1].stems.allocatedLevels.flow,0)<=1+1e-9,'Four-deck OFF/alternating/ON cohort capacity');
    check(view.decks.every(d=>d.playing),'All four transports survive participation combinations');
  }
  c.release(3);check(!state.stemSession.nativeHandoff.members[3] && !view.decks[2].songId,'Release removes only that ownership');
  check(c.mixer.getDeck(1).getDecodedBuffers().flow!==null,'Releasing duplicate does not discard original owner data');
  check(await c.load(3,'cut-me-loose') && decodes===8,'Explicit replacement reuses surviving song without re-decode');
  check(!state.stemSession.nativeHandoff.members[3] && c.mixer.getDeck(3).getState().position===0,'Loaded replacement has no old ownership or borrowed position');
  await c.play(3);check(state.stemSession.nativeHandoff.members[3],'Replacement acquires ownership only on Play');
  c.release(1);check(c.diagnostics().sharedPCM.songs.every(s=>s.songId!=='hypnotic'),'Last-owner release evicts unused cache entry');
  await c.close();check(c.diagnostics().sharedPCM.uniqueDecodedBytes===0,'Close drops all pool references');
  // Invalid shared buffers must reject without changing valid decoded state.
  const isolated=createStemSchedulingFixture();await isolated.load(1);const data=isolated.mixer.getDeck(1).getDecodedBuffers();
  let rejected=false;try{await isolated.mixer.getDeck(2).loadDecodedBuffers({...data,voice:{...data.voice,length:2}});}catch(e){rejected=true;}
  check(rejected && !isolated.mixer.getDeck(2).getState().loaded,'Misaligned shared PCM rejected');
  rejected=false;try{await isolated.mixer.getDeck(2).loadDecodedBuffers(Object.fromEntries(prototypeStemNames.map(n=>[n,{...data[n],sampleRate:44100}])));}catch(e){rejected=true;}
  check(rejected,'Wrong-context sample rate rejected');
  const waiting=Promise.withResolvers ? Promise.withResolvers() : (()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};})();
  isolated.wait(waiting.promise);const load=isolated.mixer.getDeck(2).loadDecodedBuffers(data);isolated.mixer.getDeck(2).eject();waiting.resolve();
  check(await load===false && !isolated.mixer.getDeck(2).getState().loaded,'Cancelled shared load cannot resurrect released deck');
  await isolated.mixer.close();
  console.log('Four-deck expansion tests passed: '+checks+' checks; Main-zero behavior unchanged');
}
