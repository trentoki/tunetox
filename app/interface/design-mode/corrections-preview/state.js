// H5.1 corrections extend only simulated H5 state/actions.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,changeH5=h.changePage;
 d.h51Phone=()=>matchMedia('(max-width:700px) and (orientation:portrait)').matches;
 h.changePage=function(state,id,mode){if(mode==='transition'&&!d.h51Phone())return false;return changeH5(state,id,mode);};
 d.h51ReconcileViews=function(state){if(!d.h51Phone())for(const deck of state.decks)if(deck.compact.mode==='transition')changeH5(state,deck.id,'controls');};
 // Single explicit load route for this page: playing decks can only acquire a queue.
 // An occupied queue is rejected before any presentation, transport or gain change.
 function load(state,id,songId){
  const deck=h.deck(state,id),song=d.model.findSong(songId);if(!deck||!song)return false;
  if(deck.playing){if(deck.queuedSongId&&deck.queuedSongId!==songId)return false;deck.queuedSongId=songId;}
  else{deck.songId=songId;deck.position=0;deck.playing=false;deck.wave.clock=0;deck.wave.pending=null;deck.wave.nudge=0;}
  h.changePage(state,id,'wave');return true;
 }
 d.h4Queue.load=load;d.model.loadSelected=(state,id)=>load(state,id,state.songId);
})();
