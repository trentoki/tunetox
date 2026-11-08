async function runStemSourceRouterTests() {
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const empty=()=>({loaded:false,loading:false,isPlaying:false});
  const whole={1:empty(),2:empty(),3:empty(),4:empty()},stems={1:empty(),2:empty()},calls=[];
  let finishLoad;
  const complete={getState:id=>whole[id],loadFile(id){whole[id].loading=true;return new Promise(resolve=>{finishLoad=()=>{whole[id].loading=false;resolve(false);};});},
    play:id=>calls.push('complete-play-'+id),pause(){},stop(){},eject(id){whole[id].loaded=false;whole[id].loading=false;},
    getMode:()=> 'normal',isPitchPreserving:()=>false,setMode:()=>true,setTempo:()=>true};
  const mixer={getDeck:id=>({getState:()=>stems[id],play:()=>calls.push('stem-play-'+id),pause(){},stop(){},eject(){stems[id].loaded=false;},
    loadFiles:async()=>{stems[id].loaded=true;}})};
  const router=createStemSourceRouter(complete,mixer);
  check(router.getSourceMode(1)==='complete'&&!router.setSourceMode(3,'stems'),'Two-deck compatibility owner keeps unowned decks in complete-song mode');
  const load=router.loadFile(1,{});await router.eject(1);
  check(!router.setSourceMode(1,'stems'),'Eject cannot permit switching before underlying asynchronous load settles');
  finishLoad();await load;
  check(router.setSourceMode(1,'stems'),'Settled empty backend permits opt-in');
  await router.loadStems(1,{});await router.play(1);await router.play(2);await router.play(3);
  check(calls.join(',')==='stem-play-1,complete-play-2,complete-play-3','Exactly one backend handles each deck transport');
  check(!router.setSourceMode(1,'complete')&&!router.setTempo(1,100,120),'Loaded stem source locks switching and rejects tempo');
  await router.eject(1);whole[1].closureBlocked=true;
  check(!router.setSourceMode(1,'complete'),'Pending complete-backend closure blocks mode changes');
  whole[1].closureBlocked=false;
  check(router.setSourceMode(1,'complete'),'Both empty settled sources allow returning');
  let finishPlay;
  complete.play=()=>new Promise(resolve=>{finishPlay=resolve;});
  const starting=router.play(1);
  check(!router.setSourceMode(1,'stems'),'Pending Play prevents a replacement backend');
  finishPlay();await starting;
  check(router.setSourceMode(1,'stems'),'Settled Play unlocks empty sources');
  mixer.deckIds=[1,2,3,4];stems[3]=empty();stems[4]=empty();
  const fourRouter=createStemSourceRouter(complete,mixer);
  check(fourRouter.setSourceMode(3,'stems')&&fourRouter.setSourceMode(4,'stems'),'Four-deck owner allows source opt-in for Decks 3/4');
  await fourRouter.loadStems(3,{});await fourRouter.play(3);
  check(calls[calls.length-1]==='stem-play-3'&&!fourRouter.setSourceMode(3,'complete'),'Deck 3 routes exclusively and locks a loaded source');
  await fourRouter.eject(3);check(fourRouter.setSourceMode(3,'complete'),'Eject unlocks Deck 3 without affecting Deck 4 mode');
  check(fourRouter.getSourceMode(4)==='stems','Other deck source mode is preserved');
  console.log('Stem source router tests passed: opt-in, exclusive routing, pending loads/closure and tempo guards');
}
