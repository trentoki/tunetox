function runH53StateChecks(){
 let count=runH52StateChecks();const d=TuneToxDesign,h=d.compact;
 const check=(x,label)=>{count++;if(!x)throw new Error(label);},near=(a,b)=>Math.abs(a-b)<1e-7;
 const s=h.createState(),a=s.decks[0],b=s.decks[3];a.playing=b.playing=true;a.position=10;b.position=20;const tempos=s.decks.map(deck=>deck.tempo);
 d.h5.waveAction(s,1,'nudge',1);d.h5.waveAction(s,4,'nudge',-1);d.h5.advance(s,1);
 check(near(a.position,11.05)&&near(b.position,20.95),'Independent opposite nudge rates');check(JSON.stringify(s.decks.map(deck=>deck.tempo))===JSON.stringify(tempos),'Nudges do not change tempo values');
 d.h5.waveAction(s,1,'nudge',0);d.h5.waveAction(s,4,'nudge',0);d.h5.advance(s,1);check(near(a.position,12.05)&&near(b.position,21.95),'Release restores both original rates');
 const positions=JSON.stringify(s.decks.map(deck=>[deck.position,deck.playing]));for(const id of [2,3,4])check(d.h5.setPartner(s,1,id)&&JSON.stringify(s.decks.map(deck=>[deck.position,deck.playing]))===positions,'Partner selection leaves transport untouched');check(!d.h5.setPartner(s,1,1),'Primary excluded');
 a.beatMatch=true;a.wave.clock=.5;a.position=30;d.h5.waveAction(s,1,'skip',1);d.h5.advance(s,.249);check(a.wave.pending!==null&&near(a.position,30.249),'Overview skip uses unchanged next-boundary scheduler');d.h5.advance(s,.001);check(a.wave.pending===null&&near(a.position,30.75),'Overview skip preserves boundary math');
 return count;
}
