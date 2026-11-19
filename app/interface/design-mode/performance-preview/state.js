// H5 preview clock/actions, isolated from every native engine and allocator.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,createH4=h.createState,changeH4=h.changePage;
 h.parameters={...h.parameters,deckTarget:{label:'Phone deck button target',min:40,max:56,step:2,value:44,unit:'px'},viewTarget:{label:'View menu target height',min:36,max:56,step:2,value:42,unit:'px'}};
 const duration=deck=>{const parts=(d.model.findSong(deck.songId)?.duration||'0:00').split(':').map(Number);return parts[0]*60+parts[1];};
 h.createState=function(){const s=createH4();for(const deck of s.decks){deck.transitionPartner=deck.id===1?2:1;deck.wave={beats:1,clock:0,pending:null,nudge:0};}return s;};
 h.changePage=function(state,id,mode){const deck=h.deck(state,id);if(mode==='transition'&&deck){deck.compact.mode=mode;deck.compact.workspace='performance';deck.compact.menuOpen=false;deck.wave.nudge=0;return true;}const ok=changeH4(state,id,mode);if(ok)deck.wave.nudge=0;return ok;};
 function setPartner(s,id,partner){const deck=h.deck(s,id);if(!deck||id===partner||!h.deck(s,partner))return false;deck.transitionPartner=partner;return true;}
 function waveAction(s,id,kind,value){
  const deck=h.deck(s,id);if(!deck||!deck.songId)return false;const w=deck.wave;
  if(kind==='distance'&&[1,2,4,8].includes(value)){w.beats=value;return true;}
  if(kind==='nudge'&&[-1,0,1].includes(value)){w.nudge=deck.beatMatch?0:value;return true;}
  if(kind==='skip'&&deck.beatMatch&&[-1,1].includes(value)){w.pending={boundary:Math.floor(w.clock+1e-9)+1,direction:value,beats:w.beats};return true;}
  if(kind==='scrub'&&Number.isFinite(value)){deck.position=Math.max(0,Math.min(duration(deck),value));w.pending=null;return true;}
  return false;
 }
 function advance(s,elapsed){
  if(!Number.isFinite(elapsed)||elapsed<0)return false;
  for(const deck of s.decks){if(!deck.playing||!deck.songId)continue;const w=deck.wave,beat=60/deck.tempo,rate=deck.beatMatch?1:1+w.nudge*.05,oldClock=w.clock;
   w.clock+=elapsed/beat;let position=deck.position+elapsed*rate;
   if(w.pending&&deck.beatMatch&&w.clock+1e-9>=w.pending.boundary){
    const until=(w.pending.boundary-oldClock)*beat;
    const boundaryPosition=deck.position+until;
    // Compute at the execution boundary, preserving elapsed time after it.
    position=Math.max(0,Math.min(duration(deck),boundaryPosition+w.pending.direction*w.pending.beats*beat))+(elapsed-until);w.pending=null;
   }
   deck.position=Math.max(0,Math.min(duration(deck),position));
   if(deck.position>=duration(deck)){deck.position=0;deck.playing=false;w.nudge=0;w.pending=null;}
  }return true;
 }
 // Keep H4's load/queue/Swap rules; clear transient actions only on actual replacement.
 for(const name of ['load','swap']){const original=d.h4Queue[name];d.h4Queue[name]=function(s,id,...args){const deck=h.deck(s,id),old=deck?.songId;const ok=original(s,id,...args);if(ok&&(name==='swap'||deck.songId!==old)){deck.wave.clock=0;deck.wave.pending=null;deck.wave.nudge=0;}return ok;};}
 d.h5={duration,setPartner,waveAction,advance};
})();
