// H4 session-only queue. One visible next-song slot; a full slot is not silently overwritten.
(() => {
 const d=globalThis.TuneToxDesign,m=d.model;
 function load(state,deckId,songId,queueOnly=false){
  const deck=d.compact.deck(state,deckId),song=m.findSong(songId);
  if(!deck||!song)return false;
  if(deck.playing||queueOnly){
   if(deck.queuedSongId&&deck.queuedSongId!==song.id)return false;
   deck.queuedSongId=song.id;
  }
  else{deck.songId=song.id;deck.position=0;deck.playing=false;}
  d.compact.changePage(state,deckId,'wave');return true;
 }
 function swap(state,deckId){
  const deck=d.compact.deck(state,deckId);if(!deck||!m.findSong(deck.queuedSongId))return false;
  deck.songId=deck.queuedSongId;deck.queuedSongId=null;deck.position=0;deck.playing=true;
  d.compact.changePage(state,deckId,'wave');return true;
 }
 d.h4Queue={load,swap};
 m.loadSelected=(state,id)=>load(state,id,state.songId);
})();
