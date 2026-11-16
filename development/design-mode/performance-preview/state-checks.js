function runH5StateChecks(){
 let count=runH4StateChecks();const d=TuneToxDesign,h=d.compact,m=d.model;
 const check=(x,label)=>{count++;if(!x)throw new Error(label);},near=(x,y)=>Math.abs(x-y)<1e-7;
 for(const id of [1,2,3,4]){
  const s=h.createState(),deck=h.deck(s,id),before=JSON.stringify(s.decks);h.changePage(s,id,'transition');
  check(deck.compact.mode==='transition'&&deck.compact.workspace==='performance','Transition is presentation only');
  const partner=id===4?3:4;check(d.h5.setPartner(s,id,partner),'Valid partner');h.changePage(s,id,'wave');h.changePage(s,id,'transition');check(deck.transitionPartner===partner,'Partner survives mode switches');
  check(!d.h5.setPartner(s,id,id)&&!d.h5.setPartner(s,id,9),'Invalid/self partner rejected');
 }
 for(const beats of [1,2,4,8])for(const direction of [-1,1]){
  const s=h.createState(),deck=s.decks[0];deck.tempo=120;deck.playing=true;deck.beatMatch=true;deck.position=10.1;deck.wave.clock=.2;
  check(d.h5.waveAction(s,1,'distance',beats)&&d.h5.waveAction(s,1,'skip',direction),'Schedule beat skip');d.h5.advance(s,.39);
  check(near(deck.position,10.49)&&!!deck.wave.pending,'Never skip before boundary');d.h5.advance(s,.01);
  check(near(deck.position,10.5+direction*beats*.5)&&!deck.wave.pending,'Execute from boundary position, not press position');
  check(deck.tempo===120&&near(deck.wave.clock,1),'Tempo and beat phase preserved');
 }
 const s=h.createState(),deck=s.decks[0];deck.playing=true;deck.beatMatch=true;deck.position=20;deck.wave.clock=1;
 d.h5.waveAction(s,1,'skip',1);d.h5.advance(s,0);check(deck.position===20&&deck.wave.pending.boundary===2,'Exact-boundary press waits for next boundary');
 deck.playing=false;d.h5.advance(s,5);check(deck.position===20&&deck.wave.clock===1,'Paused scheduler stationary');deck.playing=true;d.h5.advance(s,.75);check(near(deck.position,21.25)&&near(deck.wave.clock,2.5),'Delayed render retains boundary and post-boundary elapsed');
 deck.beatMatch=false;const start=deck.position,tempo=deck.tempo;d.h5.waveAction(s,1,'nudge',1);d.h5.advance(s,1);check(near(deck.position,start+1.05)&&deck.tempo===tempo,'Positive temporary nudge, unchanged tempo value');
 d.h5.waveAction(s,1,'nudge',0);const released=deck.position;d.h5.advance(s,1);check(near(deck.position,released+1),'Nudge release restores original rate');
 d.h5.waveAction(s,1,'nudge',-1);const slow=deck.position;d.h5.advance(s,1);check(near(deck.position,slow+.95),'Negative temporary nudge');
 h.changePage(s,1,'controls');check(deck.wave.nudge===0,'Changing view clears held nudge');
 for(const matched of [true,false]){deck.beatMatch=matched;check(d.h5.waveAction(s,1,'scrub',12.3)&&deck.position===12.3,'Scrub regardless of BeatMatch');}
 deck.beatMatch=true;d.h5.waveAction(s,1,'skip',1);d.h5.waveAction(s,1,'scrub',-4);check(deck.position===0&&!deck.wave.pending,'Direct scrub clamps and cancels stale pending action');
 d.h5.waveAction(s,1,'scrub',9999);check(deck.position===d.h5.duration(deck),'Scrub clamps to duration');
 check(!d.h5.waveAction(s,1,'distance',3)&&!d.h5.waveAction(s,1,'scrub',NaN)&&!d.h5.advance(s,-1),'Invalid preview inputs rejected');
 const peers=JSON.stringify(s.decks.slice(1));deck.position=30;deck.playing=true;d.h5.waveAction(s,1,'skip',-1);d.h5.advance(s,.5);check(JSON.stringify(s.decks.slice(1))===peers,'Other stopped decks remain unaffected');
 deck.wave.nudge=1;deck.wave.pending={boundary:20,direction:1,beats:4};deck.playing=false;d.h4Queue.load(s,1,'blue');check(deck.wave.nudge===0&&!deck.wave.pending&&deck.wave.clock===0,'Actual replacement clears old transient actions');
 deck.position=d.h5.duration(deck)-.1;deck.playing=true;d.h5.advance(s,.2);check(!deck.playing&&deck.position===0,'Natural preview end retains H4 stop/reset behavior');
 return count;
}
