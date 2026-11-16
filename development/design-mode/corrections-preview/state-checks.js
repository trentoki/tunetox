function runH51StateChecks(){
 let count=runH5StateChecks();const d=TuneToxDesign,h=d.compact;
 const check=(x,label)=>{count++;if(!x)throw new Error(label);};
 for(const length of [60,122,244])for(const vertical of [true,false])for(const value of [0,.25,.5,.75,1]){
  const point=d.h51Fader.geometry(length,value,vertical),back=d.h51Fader.fromPoint(length,point,vertical);
  check(Math.abs(back-value)<.001&&point>=12&&point<=length-12,'Shared visual/touch geometry round trip');
 }
 const state=h.createState(),deck=state.decks[0];deck.playing=false;d.h4Queue.load(state,1,'amber');check(!deck.playing&&deck.songId==='amber'&&deck.position===0,'First loaded song stays stopped');
 deck.playing=true;deck.position=22.4;deck.volume=.64;deck.stems=[0,.3,.8,1];const before=JSON.stringify({song:deck.songId,playing:deck.playing,position:deck.position,volume:deck.volume,stems:deck.stems});
 check(d.h4Queue.load(state,1,'blue')&&deck.queuedSongId==='blue','Second load while playing queues');
 check(JSON.stringify({song:deck.songId,playing:deck.playing,position:deck.position,volume:deck.volume,stems:deck.stems})===before,'Playing load changes no current song/position/gain state');
 check(!d.h4Queue.load(state,1,'home')&&deck.queuedSongId==='blue','Occupied queue rejected');
 check(d.h4Queue.swap(state,1)&&deck.songId==='blue'&&deck.playing&&deck.position===0&&!deck.queuedSongId&&deck.volume===.64&&JSON.stringify(deck.stems)==='[0,0.3,0.8,1]','Swap starts with inherited levels');
 const saved=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});
 check(!h.changePage(state,1,'transition'),'Tablet rejects Transition');
 deck.compact.mode='transition';d.h51ReconcileViews(state);check(deck.compact.mode==='controls','Tablet layout reconciles old phone view without musical changes');
 globalThis.matchMedia=saved;check(h.changePage(state,1,'transition'),'Phone retains Transition');return count;
}
