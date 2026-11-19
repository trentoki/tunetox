// H5.2 approved cue semantics; session-only, separate from the queued song.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,createH51=h.createState,changeH51=h.changePage;
 h.parameters.stemSection={...h.parameters.stemSection,label:'Lower workspace height (cues / stems)'};
 function bindCues(deck){
  const key=deck.songId||'empty';deck.cueSets=deck.cueSets||{};
  if(!deck.cueSets[key])deck.cueSets[key]=Array(8).fill(null);
  deck.compact.cues=deck.cueSets[key];deck.compact.shift=false;
 }
 h.createState=function(){const state=createH51();for(const deck of state.decks){bindCues(deck);delete deck.compact.quantizeOverride;}return state;};
 h.changePage=function(state,id,mode){if(!['wave','controls','transition','library'].includes(mode))return false;return changeH51(state,id,mode);};
 h.cueAction=function(state,id,kind,value){
  const deck=h.deck(state,id);if(!deck)return false;
  if(['shift','repeat'].includes(kind)){deck.compact[kind]=!!value;return true;}
  if(kind!=='cue'||!deck.songId)return false;
  const index=typeof value==='number'?value:value?.index;if(!Number.isInteger(index)||index<0||index>7)return false;
  const cues=deck.compact.cues,shift=deck.compact.shift||!!value?.shift;
  if(shift){if(cues[index]===null)return false;cues[index]=null;return true;}
  if(cues[index]===null)cues[index]=deck.position;
  else{deck.position=cues[index];deck.wave.pending=null;}
  return true;
 };
 for(const name of ['load','swap']){const original=d.h4Queue[name];d.h4Queue[name]=function(state,id,...args){const deck=h.deck(state,id),old=deck?.songId;const ok=original(state,id,...args);if(ok&&deck.songId!==old)bindCues(deck);return ok;};}
 d.model.loadSelected=(state,id)=>d.h4Queue.load(state,id,state.songId);
 d.h52={bindCues};
})();
