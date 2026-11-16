// Test only the UI adapter ownership/validation boundary; native algorithm tests are separate.
async function runPlayableControllerTests() {
  let checks=0, contexts=0;
  const check=(v,label)=>{checks++;if(!v)throw new Error(label);};
  const f=createStemSchedulingFixture();
  globalThis.performance={now:()=>f.audio.currentTime*1000};
  globalThis.AudioContext=function(){contexts++;return f.audio;};
  const stem=()=>({format:'IEEE float32',channels:1,sampleRate:48000,frames:48000,duration:1,encodedBytes:123,url:'/test-stem'});
  const metadata={song:'Prepared test',stems:Object.fromEntries(prototypeStemNames.map(n=>[n,stem()])),mainCeiling:.1};
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>({byteLength:123,length:48000,sampleRate:48000,numberOfChannels:1,duration:1})});
  const messages=[];
  const c=TuneToxDesign.createPlayableController({decks:{1:metadata,2:{...metadata,song:'Second test'}}},m=>messages.push(m));
  const view=c.createViewState();
  check(contexts===0,'UI creation never activates audio');
  check(view.decks.length===4 && view.decks.every(d=>d.volume===0 && !d.songId),'Real decks start empty at zero Main');
  check(!appState.participation.byDeck[3].stemHandoff && !appState.participation.byDeck[4].stemHandoff,'Hidden participation absent');
  check(await c.load(1,'hypnotic'),'Real load boundary completes');
  check(contexts===1 && view.decks[0].songId==='hypnotic' && !view.decks[0].playing,'Native loading, no autoplay');
  check(view.decks[0].volume===0 && appState.stemSession.authorization.ceilingsByStem.flow===null,'Loading never authorizes gains');
  c.level(1,null,.5);check(view.decks[0].volume===appState.decks[0].volume && view.decks[0].volume===.5,'Main projection reads authoritative state');
  c.level(1,1,.2);check(view.decks[0].stems[1]===appState.decks[0].stems.allocatedLevels.flow,'Stem projection reads actual allocation');
  const saved=JSON.stringify(appState.decks[0]);c.level(1,null,NaN);
  check(JSON.stringify(appState.decks[0])===saved && view.decks[0].volume===.5,'Failed command cannot leave a simulated optimistic value');
  check(messages.at(-1).includes('ERROR'),'Failure reported');
  check(!TuneToxDesign.model.setDeckControl(view,1,'beatMatch',true) && !view.decks[0].beatMatch,'No fake matching state');
  check(!TuneToxDesign.model.setPerformanceControl(view,1,'filter',.5) && view.decks[0].performance.filter===0,'No fake effect changes');
  check(await c.play(1) && view.decks[0].playing,'UI transport projection reads native playback');
  f.audio.currentTime=.2;const position=view.decks[0].position;
  c.handoff(1);check(view.decks[0].handoff===appState.participation.byDeck[1].stemHandoff,'Handoff reflects actual store');
  check(await c.load(2,'cut-me-loose') && view.decks[0].playing,'Loading second deck does not interrupt first');
  check(!await c.load(3,'hypnotic') && !view.decks[2].songId,'Initial third loaded deck refused with no false identity');
  check(!await c.load(1,'cut-me-loose') && view.decks[0].songId==='hypnotic' && view.decks[0].playing,'Replacement requires explicit Release, preserves playing source');
  c.stop(1);check(!view.decks[0].playing && view.decks[0].position===0,'Stop projects real position');
  c.release(1);check(!view.decks[0].songId,'Release clears real source identity');
  check(await c.load(3,'hypnotic') && view.decks[2].songId==='hypnotic','Any two of the four persistent slots may load');
  check(view.decks[2].volume===0 && view.decks[2].stems.every(v=>v===0),'Loading alternate slot preserves safe musical state');
  await c.close();check(f.audio.state==='running' && c.mixer.getDeck(3).getState().closed,'Close retires players (mock context close has no state side effect)');
  console.log('Playable UI controller tests passed: '+checks+' checks');
}
