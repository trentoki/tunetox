// H3 preview only. Share H1's four objects/actions; no native musical-state imports.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,originalState=h.createState;
 h.parameters={
  header:{label:'Tempo/Pitch row height',min:40,max:60,step:2,value:44,unit:'px'},
  headerGap:{label:'Header / deck row spacing',min:2,max:8,step:1,value:3,unit:'px'},
  navigation:{label:'Sliding selector height',min:32,max:44,step:2,value:36,unit:'px'},
  selectorWidth:{label:'Sliding selector width',min:120,max:180,step:2,value:132,unit:'px'},
  navGap:{label:'Selector position spacing',min:0,max:4,step:1,value:1,unit:'px'},
  matching:{label:'Matching popover target height',min:40,max:56,step:2,value:44,unit:'px'},
  transport:{label:'Play/Main strip height',min:32,max:36,step:2,value:36,unit:'px'},
  transportGap:{label:'Play/Main spacing',min:3,max:12,step:1,value:5,unit:'px'},
  overviewHeight:{label:'Full-song overview height',min:24,max:72,step:2,value:40,unit:'px'},
  centralHeight:{label:'Central performance height',min:120,max:360,step:2,value:168,unit:'px'},
  stemSection:{label:'Fixed stem section height',min:144,max:280,step:4,value:176,unit:'px'},
  fader:{label:'Minimum stem fader height',min:36,max:56,step:2,value:44,unit:'px'},
  cuePad:{label:'Cue target height',min:32,max:48,step:2,value:36,unit:'px'},
  sectionGap:{label:'Cue / Controls spacing',min:3,max:12,step:1,value:4,unit:'px'},
  padding:{label:'Deck padding',min:3,max:10,step:1,value:5,unit:'px'},
  gap:{label:'Deck gaps',min:4,max:12,step:1,value:8,unit:'px'}
 };
 h.createState=function(){const state=originalState();for(const deck of state.decks)deck.compact={
  ...deck.compact,mode:'wave',workspace:'performance',menuOpen:false,shift:false,
  cues:[0,16,32,48,64,80,96,112],quantizeOverride:null
 };return state;};
 h.changePage=function(state,id,page){
  const deck=h.deck(state,id);if(!deck||!['wave','cue','controls','library'].includes(page))return false;
  if(page==='library'){deck.compact.workspace='library';deck.compact.menuOpen=false;}
  else{deck.compact.workspace='performance';deck.compact.mode=page;}
  deck.compact.repeat=false;deck.compact.shift=false;return true;
 };
 h.previewQuantized=deck=>deck.compact.quantizeOverride===null?deck.beatMatch:deck.compact.quantizeOverride;
 h.cueAction=function(state,id,kind,value){
  const deck=h.deck(state,id);if(!deck)return false;const view=deck.compact;
  if(['repeat','shift'].includes(kind)){view[kind]=!!value;return true;}
  if(kind==='quantizeOverride'&&typeof value==='boolean'){view.quantizeOverride=value;return true;}
  if(kind==='quantizeAuto'){view.quantizeOverride=null;return true;}
  if(kind!=='cue')return false;
  const index=typeof value==='number'?value:value?.index;
  if(!Number.isInteger(index)||index<0||index>7)return false;
  if(view.shift||value?.shift){view.cues[index]=null;return true;}
  const beat=60/deck.tempo,quantize=position=>h.previewQuantized(deck)?Math.round(position/beat)*beat:position;
  if(view.cues[index]===null)view.cues[index]=quantize(deck.position);
  else deck.position=quantize(view.cues[index]);
  return true;
 };
})();
