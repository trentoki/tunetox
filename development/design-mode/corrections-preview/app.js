// Separate H5.1 host: no production app, audio lifecycle, IndexedDB or media imports.
(() => {
 const d=globalThis.TuneToxDesign,m=d.model;let state=d.compact.createState();
 const announce=text=>{document.getElementById('h1-status').textContent=text+' · SIMULATED / NO AUDIO';};
 const actions={
  swap(id){if(d.h4Queue.swap(state,id))announce('Queued example swapped on D'+id);render();},
  partner(id,other){d.h5.setPartner(state,id,other);render();},
  wave(id,kind,value){d.h5.waveAction(state,id,kind,value);render();},
  select(id){state.editingDeckId=id;render();},
  page(id,page){d.compact.changePage(state,id,page);render();},
  level(id,index,value){m.setLevel(state,id,index,value);render();},
  play(id){m.togglePlay(state,id);d.compact.deck(state,id).wave.nudge=0;render();},
  toggle(id,key){const deck=d.compact.deck(state,id);m.setDeckControl(state,id,key,!deck[key]);if(key==='beatMatch'){deck.wave.nudge=0;deck.wave.pending=null;}announce(key+' preview only; no audio allocation');render();},
  performance(id,key,value,index){m.setPerformanceControl(state,id,key,value,index);render();},
  cue(id,kind,value){d.compact.cueAction(state,id,kind,value);announce('D'+id+' '+kind+' position preview');render();}
 };
 const cards=[1,2,3,4].map(id=>d.compact.createDeck(id,()=>state,actions));
 document.getElementById('h1-decks').append(...cards.map(c=>c.node));
 const columns=d.createColumnLibraries(cards,()=>state,render,announce);
 const header=d.compact.createHeader(()=>state,render,announce),tools=d.compact.createDesignTools();
 function render(){d.h51ReconcileViews(state);cards.forEach(card=>card.render());header.render();columns.render();}
 render();
 // Illustrative playback clock only. Native audio/transport is never constructed.
 let previous=performance.now();
 function tick(elapsed){d.h5.advance(state,elapsed);render();}
 if(!window.H5_TEST_CLOCK)setInterval(()=>{const now=performance.now(),elapsed=Math.min(.5,(now-previous)/1000);previous=now;if(document.visibilityState==='visible')tick(elapsed);},33);
 if(window.H5_TEST_CLOCK)d.h5Test={advance:tick};
 window.addEventListener('resize',()=>requestAnimationFrame(render));
 window.addEventListener('blur',()=>{for(const deck of state.decks){deck.compact.repeat=false;deck.wave.nudge=0;}render();});
 // Read-only snapshot / presentation test hooks, deliberately no production actions.
 d.h1={getSnapshot:()=>JSON.parse(JSON.stringify(state)),layout:tools.values,presets:tools.getPresets,render};
})();
