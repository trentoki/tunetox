function runH52StateChecks(){
 const d=TuneToxDesign,h=d.compact;let count=0;const check=(x,label)=>{count++;if(!x)throw new Error(label);};
 for(const playing of [false,true])for(const id of [1,2,3,4]){
  const state=h.createState(),deck=h.deck(state,id);deck.playing=playing;deck.position=12.345;deck.beatMatch=true;deck.queuedSongId='blue';const transport=()=>JSON.stringify({playing:deck.playing,queue:deck.queuedSongId,volume:deck.volume,stems:deck.stems});const before=transport();
  check(deck.compact.cues.every(v=>v===null),'Empty initial cue pads');
  check(h.cueAction(state,id,'cue',0)&&deck.compact.cues[0]===12.345,'Set exact unquantized current position');
  check(transport()===before,'Creating cue preserves playback, queue and levels');deck.position=22.5;
  check(h.cueAction(state,id,'cue',0)&&deck.position===12.345&&transport()===before,'Jump preserves playing/paused state');
  h.cueAction(state,id,'shift',true);check(h.cueAction(state,id,'cue',0)&&deck.compact.cues[0]===null&&deck.position===12.345&&transport()===before,'Shift deletes only assigned cue');
  const snapshot=JSON.stringify(state);check(!h.cueAction(state,id,'cue',0)&&JSON.stringify(state)===snapshot,'Shift+empty is an exact no-op');
  h.cueAction(state,id,'shift',false);deck.position=17.1234;h.cueAction(state,id,'cue',2);check(deck.compact.cues[2]===17.1234,'Never-started/paused/playing position precision');
  check(h.cueAction(state,id,'cue',{index:2,shift:true})&&deck.compact.cues[2]===null&&deck.queuedSongId==='blue','Keyboard modifier also preserves queue');
 }
 const state=h.createState(),deck=state.decks[0],original=deck.songId;deck.position=4.125;h.cueAction(state,1,'cue',1);deck.playing=true;deck.volume=.6;deck.stems=[0,.2,.7,1];
 const cues=deck.compact.cues;
 check(d.h4Queue.load(state,1,'blue')&&deck.songId===original&&deck.playing&&deck.compact.cues===cues&&deck.compact.cues[1]===4.125,'Queue load preserves current song cues');
 check(!d.h4Queue.load(state,1,'home')&&deck.queuedSongId==='blue','Occupied queue protected');
 check(d.h4Queue.swap(state,1)&&deck.songId==='blue'&&deck.playing&&deck.compact.cues.every(v=>v===null)&&deck.volume===.6&&deck.stems[2]===.7,'Swap has new-song cues and inherited levels');
 deck.playing=false;d.h4Queue.load(state,1,original);check(deck.compact.cues[1]===4.125&&!deck.playing,'Session cues stay associated with their song');
 check(!h.changePage(state,1,'cue')&&h.changePage(state,1,'wave')&&h.changePage(state,1,'controls'),'Only two primary views');
 check(h.changePage(state,1,'transition'),'Phone retains Transition');const media=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});check(!h.changePage(state,1,'transition'),'Tablet rejects Transition');d.h51ReconcileViews(state);check(deck.compact.mode==='controls','Tablet reconciles phone-only view');globalThis.matchMedia=media;
 check(!h.cueAction(state,1,'quantizeOverride',true)&&!h.cueAction(state,1,'quantizeAuto'),'Removed quantize controls have no cue action');
 const saved=JSON.stringify(state);check(!h.cueAction(state,1,'cue',8)&&!h.cueAction(state,9,'cue',0)&&JSON.stringify(state)===saved,'Invalid cue actions safe');
 deck.songId=null;check(!h.cueAction(state,1,'cue',0),'Empty deck cannot set cue');
 for(const vertical of [true,false])for(const value of [0,.5,1]){const p=d.h51Fader.geometry(120,value,vertical);check(d.h51Fader.fromPoint(120,p,vertical)===value,'Stem and Transition Main endpoint math unchanged');}
 return count;
}
