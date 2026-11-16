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
 check(h.parameters.overviewHeight.value===40&&h.parameters.centralHeight.value===168,'H3 geometry defaults');
 return count;
}
