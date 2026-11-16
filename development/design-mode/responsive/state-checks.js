function runFixedStateChecks(){
 const d=TuneToxDesign,h=d.compact,s=h.createState();let count=0;const check=(x,label)=>{count++;if(!x)throw new Error(label);};
 const snapshot=()=>JSON.stringify(s.decks.map(({id,songId,playing,position,stems,volume,tempo,pitch,performance,beatMatch,tuneMatch,handoff})=>({id,songId,playing,position,stems,volume,tempo,pitch,performance,beatMatch,tuneMatch,handoff})));
 check(s.decks.length===4&&s.decks.every(deck=>deck.compact.cues.length===8),'Four persistent decks with eight preview cues');
 for(const id of [1,2,3,4]){
  const deck=h.deck(s,id);deck.playing=true;deck.handoff=true;d.model.setLevel(s,id,2,.37);const before=snapshot();
  for(const mode of ['wave','cue','controls','wave']){h.changePage(s,id,mode);check(deck.compact.mode===mode&&snapshot()===before,'Modes alter only central presentation');}
  h.changePage(s,id,'cue');h.changePage(s,id,'library');check(deck.compact.workspace==='library'&&deck.compact.mode==='cue'&&snapshot()===before,'Library preserves mode/playback/controls');
  h.changePage(s,id,deck.compact.mode);check(deck.compact.workspace==='performance'&&snapshot()===before,'Library return preserves performance');
 }
 check(!h.changePage(s,1,'sampler')&&!h.changePage(s,5,'wave'),'Unsupported modes/decks rejected');
 const deck=s.decks[0];deck.beatMatch=false;
 check(!h.previewQuantized(deck),'Default preview timing follows BeatMatch off');deck.beatMatch=true;check(h.previewQuantized(deck),'Default preview timing follows BeatMatch on');
 h.cueAction(s,1,'quantizeOverride',false);check(!h.previewQuantized(deck),'Performer can disable preview quantization');
 h.cueAction(s,1,'shift',true);check(!h.previewQuantized(deck),'Shift is not quantization');
 const before=deck.compact.cues.slice();h.cueAction(s,1,'cue',3);check(deck.compact.cues[3]===null&&deck.compact.cues.every((v,i)=>i===3||v===before[i]),'Held Shift deletes only chosen preview cue');
 h.cueAction(s,1,'shift',false);deck.position=12.25;h.cueAction(s,1,'cue',3);check(deck.compact.cues[3]===12.25,'Tap empty cue records preview position');
 h.cueAction(s,1,'cue',{index:7,shift:true});check(deck.compact.cues[7]===null,'Keyboard Shift cue deletion');
 h.cueAction(s,1,'quantizeAuto');check(h.previewQuantized(deck),'Follow BeatMatch restores default');
 deck.tempo=120;h.cueAction(s,1,'cue',7);check(deck.compact.cues[7]===12.5,'Optional preview quantization rounds cursor only');
 const cues=JSON.stringify(deck.compact.cues);check(!h.cueAction(s,1,'cue',8)&&JSON.stringify(deck.compact.cues)===cues,'Invalid cue index rejected');
 const originalPlaying=s.decks.map(d=>d.playing);s.editingDeckId=4;check(JSON.stringify(s.decks.map(d=>d.playing))===JSON.stringify(originalPlaying),'Phone selection never stops decks');
 check(h.parameters.overviewHeight.value===46&&h.parameters.centralHeight.value===360,'H4 landscape defaults');
 return count;
}
function runH4StateChecks(){
 let count=runFixedStateChecks();const d=TuneToxDesign,h=d.compact,m=d.model,q=d.h4Queue;
 const check=(x,label)=>{count++;if(!x)throw new Error(label);};
 for(const id of [1,2,3,4]){
  const state=h.createState(),deck=d.compact.deck(state,id),others=()=>JSON.stringify(state.decks.filter(x=>x.id!==id));
  const beforeOthers=others(),stems=JSON.stringify(deck.stems);deck.playing=true;deck.position=87;h.changePage(state,id,'controls');h.changePage(state,id,'library');const oldSong=deck.songId;
  check(q.load(state,id,'blue'),'Queue playing load');
  check(deck.songId===oldSong&&deck.position===87&&deck.playing&&JSON.stringify(deck.stems)===stems,'Queue never replaces current waveform/transport/stems');
  check(deck.queuedSongId==='blue'&&deck.compact.mode==='wave'&&deck.compact.workspace==='performance','Queue returns only destination to Wave');
  check(!q.load(state,id,'home')&&deck.queuedSongId==='blue','Full queue not silently overwritten');
  check(q.swap(state,id)&&deck.songId==='blue'&&deck.playing&&deck.position===0&&!deck.queuedSongId,'Swap consumes queue and starts');
  check(JSON.stringify(deck.stems)===stems&&others()===beforeOthers,'Swap inherits stems and preserves all other decks');
  deck.playing=false;h.changePage(state,id,'cue');check(q.load(state,id,'home')&&deck.songId==='home'&&!deck.playing&&deck.position===0&&deck.compact.mode==='wave','Paused load replaces without autoplay and selects Wave');
  deck.songId=null;check(q.load(state,id,'night')&&deck.songId==='night'&&!deck.playing,'Empty load remains stopped');
 }
 const state=h.createState();const before=JSON.stringify(state);
 check(!q.load(state,9,'neon')&&!q.load(state,1,'bad')&&!q.swap(state,1)&&JSON.stringify(state)===before,'Invalid load/swap have no side effects');
 const songs=d.data.songs;check(d.h4Library.sorted(songs,'bpm',false)[0].bpm===110,'BPM numeric ascending');
 check(d.h4Library.sorted(songs,'bpm',true)[0].bpm===128,'BPM numeric descending');
 const source=JSON.stringify(songs);for(const key of ['title','artist','key'])check(d.h4Library.sorted(songs,key,false).length===songs.length,'Metadata sort '+key);
 check(JSON.stringify(songs)===source,'Sorting preserves source examples');
 return count;
}
