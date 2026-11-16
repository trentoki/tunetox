// Separate H1 host: no production app, audio lifecycle, IndexedDB or media imports.
(() => {
 const d=globalThis.TuneToxDesign,m=d.model;let state=d.compact.createState();
 const announce=text=>{document.getElementById('h1-status').textContent=text+' · SIMULATED / NO AUDIO';};
 const actions={
  select(id){state.editingDeckId=id;render();},
  page(id,page){d.compact.changePage(state,id,page);render();},
  level(id,index,value){m.setLevel(state,id,index,value);render();},
  play(id){m.togglePlay(state,id);render();},
  toggle(id,key){const deck=d.compact.deck(state,id);m.setDeckControl(state,id,key,!deck[key]);announce(key+' preview only; no audio allocation');render();},
  performance(id,key,value,index){m.setPerformanceControl(state,id,key,value,index);render();},
  cue(id,kind,value){d.compact.cueAction(state,id,kind,value);announce('D'+id+' '+kind+' position preview');render();}
 };
 const cards=[1,2,3,4].map(id=>d.compact.createDeck(id,()=>state,actions));
 document.getElementById('h1-decks').append(...cards.map(c=>c.node));
 const columns=d.createColumnLibraries(cards,()=>state,render,announce);
 const header=d.compact.createHeader(()=>state,render,announce),tools=d.compact.createDesignTools();
 function render(){cards.forEach(card=>card.render());header.render();columns.render();}
 render();
 // Illustrative playback clock only. Native audio/transport is never constructed.
 let previous=performance.now();
 setInterval(()=>{const now=performance.now(),elapsed=Math.min(.5,(now-previous)/1000);previous=now;
  if(document.visibilityState!=='visible')return;
  let moved=false;for(const deck of state.decks)if(deck.playing){deck.position+=elapsed;const song=m.findSong(deck.songId);const [min,sec]=song.duration.split(':').map(Number);if(deck.position>=min*60+sec){deck.position=0;deck.playing=false;}moved=true;}
  if(moved)render();
 },100);
 window.addEventListener('resize',()=>requestAnimationFrame(render));
 window.addEventListener('blur',()=>{for(const deck of state.decks)deck.compact.repeat=false;render();});
 // Read-only snapshot / presentation test hooks, deliberately no production actions.
 d.h1={getSnapshot:()=>JSON.parse(JSON.stringify(state)),layout:tools.values,render};
})();
