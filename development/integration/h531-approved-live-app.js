// Separate H5.1 host: no production app, audio lifecycle, IndexedDB or media imports.
(() => {
 const d=globalThis.TuneToxDesign,m=d.model;let state=d.compact.createState();
 const native=createMainStemIntegration(createAudioEngine());
 const audio=createH531AudioControls({appState,handoff:native.handoff,router:native.router});
 const names=['transients','flow','tune','voice'];
 const status=document.getElementById('h1-status');
 const fileDialog=document.getElementById('h531-files');
 document.getElementById('h531-files-open').addEventListener('click',()=>fileDialog.showModal());
 document.getElementById('h531-files-close').addEventListener('click',()=>fileDialog.close());
 const filesRoot=document.getElementById('h531-file-inputs');
 for(const id of [1,2,3,4]){
  const fieldset=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent='Deck '+id;fieldset.append(legend);
  const inputs={};
  for(const name of names){const label=document.createElement('label');label.textContent=name+' ';label.style.display='block';const input=document.createElement('input');input.type='file';input.accept='audio/*,.wav,.aiff,.aif,.mp3,.m4a';label.append(input);fieldset.append(label);inputs[name]=input;}
  const load=document.createElement('button');load.textContent='Load Deck '+id;load.type='button';
  load.addEventListener('click',async()=>{
   const selected=Object.fromEntries(names.map(name=>[name,inputs[name].files[0]]));
   if(names.some(name=>!selected[name])){status.textContent='Select all four stem files for Deck '+id;return;}
   try{
    status.textContent='Loading Deck '+id+'…';
    if(!native.router.setSourceMode(id,'stems')&&native.router.getSourceMode(id)!=='stems')throw Error('Eject deck before changing source');
    await native.router.loadStems(id,selected);
    const songId='local-'+id+'-'+Date.now();
    d.data.songs.push({id:songId,title:selected.transients.name.replace(/\.[^.]+$/,''),artist:'Local audio',bpm:120,key:'—',duration:'0:00',color:'#80baff'});
    state.decks[id-1].songId=songId;state.decks[id-1].position=0;
    syncAudio();render();status.textContent='Deck '+id+' loaded. Raise Main and a stem, then Play.';fileDialog.close();
   }catch(error){status.textContent='Load failed: '+error.message;console.error(error);}
  });fieldset.append(load);filesRoot.append(fieldset);
 }
 function syncAudio(){for(const deck of state.decks){const levels=audio.getLevels(deck.id);deck.volume=levels.volume;deck.stems=levels.stems;deck.playing=audio.getPlaybackState(deck.id).playing;}}
 function safe(action){try{const result=action();if(result&&typeof result.then==='function')result.then(()=>{syncAudio();render();}).catch(error=>{status.textContent=error.message;console.error(error);});else{syncAudio();render();}}catch(error){status.textContent=error.message;console.error(error);}}
 state.decks.forEach(deck=>{deck.songId=null;deck.playing=false;deck.volume=0;deck.stems=[0,0,0,0];});
 const announce=text=>{document.getElementById('h1-status').textContent=text+' · preview only (no audio effect)';};
 const actions={
  swap(id){if(d.h4Queue.swap(state,id))announce('Queued example swapped on D'+id);render();},
  partner(id,other){d.h5.setPartner(state,id,other);render();},
  wave(id,kind,value){d.h5.waveAction(state,id,kind,value);render();},
  select(id){state.editingDeckId=id;render();},
  page(id,page){d.compact.changePage(state,id,page);render();},
  level(id,index,value){safe(()=>index===null?audio.setMainVolume(id,value):audio.setStemLevel(id,index,value));},
  play(id){safe(()=>audio.togglePlayback(id));},
  toggle(id,key){const deck=d.compact.deck(state,id);m.setDeckControl(state,id,key,!deck[key]);if(key==='beatMatch'){deck.wave.nudge=0;deck.wave.pending=null;}announce(key+' preview only; no audio allocation');render();},
  performance(id,key,value,index){m.setPerformanceControl(state,id,key,value,index);render();},
  cue(id,kind,value){d.compact.cueAction(state,id,kind,value);announce('D'+id+' '+kind+' position preview');render();}
 };
 const cards=[1,2,3,4].map(id=>d.compact.createDeck(id,()=>state,actions));
 document.getElementById('h1-decks').append(...cards.map(c=>c.node));
 const columns=d.createColumnLibraries(cards,()=>state,render,announce);
 const header=d.compact.createHeader(()=>state,render,announce),tools=d.compact.createDesignTools();
 function render(){d.h51ReconcileViews(state);cards.forEach(card=>card.render());header.render();columns.render();}
 syncAudio();render();
 // Illustrative playback clock only. Native audio/transport is never constructed.
 setInterval(()=>{syncAudio();render();},250);
 let previous=performance.now();
 function tick(elapsed){for(const deck of state.decks){if(deck.playing)deck.position+=elapsed;}render();}
 if(!window.H5_TEST_CLOCK)setInterval(()=>{const now=performance.now(),elapsed=Math.min(.5,(now-previous)/1000);previous=now;if(document.visibilityState==='visible')tick(elapsed);},33);
 if(window.H5_TEST_CLOCK)d.h5Test={advance:tick};
 window.addEventListener('resize',()=>requestAnimationFrame(render));
 window.addEventListener('blur',()=>{for(const deck of state.decks){deck.compact.repeat=false;deck.wave.nudge=0;}render();});
 // Read-only snapshot / presentation test hooks, deliberately no production actions.
 d.h1={getSnapshot:()=>JSON.parse(JSON.stringify(state)),layout:tools.values,presets:tools.getPresets,render};
})();
