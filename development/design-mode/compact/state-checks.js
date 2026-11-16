function runCompactStateChecks(){
 const d=TuneToxDesign,m=d.model,h=d.compact,s=h.createState();let checks=0;
 const check=(value,label)=>{checks++;if(!value)throw new Error(label);};
 check(s.decks.length===4&&s.decks.every((deck,index)=>deck.id===index+1),'Four persistent identities');
 check(s.decks.every(deck=>deck.songId&&!deck.playing),'All sample songs loaded without starting');
 function musical(){return JSON.stringify(s.decks.map(({id,songId,playing,position,tempo,pitch,volume,stems,performance,beatMatch,tuneMatch,handoff})=>({id,songId,playing,position,tempo,pitch,volume,stems,performance,beatMatch,tuneMatch,handoff})));}
 for(const id of [1,2,3,4]){
  const otherViews=s.decks.filter(deck=>deck.id!==id).map(deck=>JSON.stringify(deck.compact)).join();
  const before=musical();h.changePage(s,id,'performance');h.changePage(s,id,'controls');h.changePage(s,id,'library');h.changePage(s,id,'performance');
  check(musical()===before,'Changing deck pages never mutates musical values');
  check(s.decks.filter(deck=>deck.id!==id).map(deck=>JSON.stringify(deck.compact)).join()===otherViews,'View state independent per deck');
  const deck=h.deck(s,id);m.setLevel(s,id,2,.37);m.setLevel(s,id,null,.63);m.setDeckControl(s,id,'handoff',true);
  h.changePage(s,id,'controls');h.changePage(s,id,'library');
  check(deck.stems[2]===.37&&deck.volume===.63&&deck.handoff,'Stem Main and matching retained');
  m.setPerformanceControl(s,id,'loopBeats',8);m.setPerformanceControl(s,id,'loopEnabled',true);h.changePage(s,id,'performance');
  check(deck.performance.loopBeats===8&&deck.performance.loopEnabled,'Cue looping retained across pages');
  check(!h.changePage(s,id,'queue'),'Cue not conflated with queue');
 }
 m.setDeckControl(s,1,'beatMatch',true);m.setDeckControl(s,2,'beatMatch',true);s.decks[1].tempo=125;
 m.adjustMatchedControl(s,1,'tempo',130);
 check(s.decks[0].tempo===130&&s.decks[1].tempo===135&&s.decks[2].tempo===120,'Existing delta-linked tempo semantics preserved');
 m.adjustMatchedControl(s,1,'tempo',150);
 check(s.decks[0].tempo===145&&s.decks[1].tempo===150,'Existing common bounded delta retained');
 const before=musical();check(!m.adjustMatchedControl(s,1,'tempo',151)&&musical()===before,'Out-of-range tempo rejected');
 m.setDeckControl(s,1,'tuneMatch',true);m.setDeckControl(s,2,'tuneMatch',true);m.adjustMatchedControl(s,1,'pitch',1.2);
 check(s.decks[0].pitch===1.2&&s.decks[1].pitch===1.2&&s.decks[0].tempo===145,'Pitch preview distinct from tempo');
 s.decks[2].tempo=120;s.decks[2].position=10.1;h.cueAction(s,3,'jump',4);
 check(s.decks[2].position===12,'Quantized simulated jump');
 h.cueAction(s,3,'quantize');s.decks[2].position=10.1;h.cueAction(s,3,'jump',-4);
 check(s.decks[2].position===8.1,'Unquantized simulated jump');
 h.cueAction(s,3,'cue',0);check(s.decks[2].position===0,'Hot cue position preview');
 h.cueAction(s,3,'repeat',true);check(s.decks[2].compact.repeat,'Held repeat state');h.cueAction(s,3,'repeat',false);check(!s.decks[2].compact.repeat,'Repeat release');
 for(const p of Object.values(h.parameters))check(p.value>=p.min&&p.value<=p.max,'Layout defaults in bounds');
 return checks;
}
