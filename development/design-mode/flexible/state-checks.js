function runFlexibleStateChecks(){
 const d=TuneToxDesign,h=d.compact,s=h.createState();let count=0;
 const check=(value,label)=>{count++;if(!value)throw new Error(label);};
 check(s.decks.every(deck=>deck.compact.menuOpen===false),'Deck matching menus initially closed');
 const musical=()=>JSON.stringify(s.decks.map(({songId,playing,position,volume,stems,tempo,pitch,performance,beatMatch,tuneMatch,handoff})=>({songId,playing,position,volume,stems,tempo,pitch,performance,beatMatch,tuneMatch,handoff})));
 const before=musical();h.setMatchingMenu(s,1,true);h.setMatchingMenu(s,2,true);h.setMatchingMenu(s,1,false);
 check(!s.decks[0].compact.menuOpen&&s.decks[1].compact.menuOpen,'Independent per-deck menu state');
 check(musical()===before,'Opening menus does not change musical preview values');
 check(!h.setMatchingMenu(s,5,true)&&!h.setMatchingMenu(s,1,'yes'),'Invalid menu identity/value rejected');
 for(const id of [1,2,3,4]){
  h.changePage(s,id,'performance');check(s.decks[id-1].compact.waveCue==='cue','One combined toggle reaches Cue');
  h.changePage(s,id,'controls');h.changePage(s,id,'performance');check(s.decks[id-1].compact.waveCue==='cue','Controls retains same combined mode');
  h.changePage(s,id,'performance');check(s.decks[id-1].compact.waveCue==='waveform','One combined toggle returns Waveform+Stems');
 }
 check(!('overview' in h.parameters)&&!!h.parameters.overviewHeight,'Overview has one explicit height control');
 for(const name of ['waveHeight','stemSection','sectionGap','cuePad'])check(!!h.parameters[name],'Required H2 layout control '+name);
 return count;
}
