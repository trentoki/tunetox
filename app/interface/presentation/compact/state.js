// Extend only the preview state; reuse existing simulated musical actions unchanged.
(() => {
 const design=globalThis.TuneToxDesign;
 const deckFor=(state,id)=>state.decks.find(deck=>deck.id===id);
 const parameters={
  header:{label:'Header height',min:60,max:100,step:2,value:68,unit:'px'},
  navigation:{label:'Navigation height',min:32,max:44,step:2,value:36,unit:'px'},
  navGap:{label:'Navigation spacing',min:2,max:8,step:1,value:3,unit:'px'},
  matching:{label:'Matching row height',min:36,max:48,step:2,value:36,unit:'px'},
  transport:{label:'Play/Main strip height',min:32,max:36,step:2,value:36,unit:'px'},
  fader:{label:'Stem fader height',min:36,max:56,step:2,value:44,unit:'px'},
  cuePad:{label:'Cue pad height',min:44,max:72,step:2,value:52,unit:'px'},
  overview:{label:'Overview waveform share',min:12,max:32,step:1,value:20,unit:'%'},
  padding:{label:'Deck padding',min:3,max:10,step:1,value:5,unit:'px'},
  gap:{label:'Deck gap',min:4,max:12,step:1,value:8,unit:'px'}
 };
 function createState(){
  const state=design.model.createState();
  state.layout='full';state.arrangement='slices';
  state.decks.forEach((deck,index)=>{
   deck.songId=design.data.songs[index].id;deck.playing=false;deck.position=[32,78,18,55][index];
   deck.compact={page:'performance',waveCue:'waveform',cues:[0,16,32,64],quantize:true,repeat:false};
  });return state;
 }
 function changePage(state,id,page){
  const deck=deckFor(state,id);
  if(!deck||!['performance','controls','library'].includes(page))return false;
  if(page==='performance'&&deck.compact.page==='performance')deck.compact.waveCue=deck.compact.waveCue==='waveform'?'cue':'waveform';
  deck.compact.page=page;deck.columnMode=page==='performance'?'waveform':page;return true;
 }
 function cueAction(state,id,kind,value){
  const deck=deckFor(state,id);if(!deck)return false;
  if(kind==='quantize'){deck.compact.quantize=!deck.compact.quantize;return true;}
  if(kind==='repeat'){deck.compact.repeat=!!value;return true;}
  let next;
  if(kind==='cue'&&[0,1,2,3].includes(value))next=deck.compact.cues[value];
  else if(kind==='jump'&&[-4,4].includes(value))next=deck.position+value*60/deck.tempo;
  else return false;
  if(deck.compact.quantize){const beat=60/deck.tempo;next=Math.round(next/beat)*beat;}
  const duration=design.model.findSong(deck.songId)?.duration.split(':').map(Number)||[0,0];
  deck.position=Math.max(0,Math.min(duration[0]*60+duration[1],next));return true;
 }
 design.compact={deck:deckFor,parameters,createState,changePage,cueAction};
})();
