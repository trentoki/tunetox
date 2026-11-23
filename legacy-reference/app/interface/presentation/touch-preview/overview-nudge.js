// Separate captured edge gestures; no overview seeking or partner-selection side effect.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.h53OverviewNudges=function(getDeck,actions){
  const node=ui.element('div','h53-overview-nudges');let held=null,keyboardDeck=null;
  function release(){if(!held)return;const previous=held;held=null;previous.button.dataset.pressed='false';actions.wave(previous.deckId,'nudge',0);}
  function releaseKeyboard(){if(keyboardDeck===null)return;const id=keyboardDeck;keyboardDeck=null;actions.wave(id,'nudge',0);}
  const buttons=[[-1,'−'],[1,'+']].map(([direction,text])=>{
   const b=ui.button('',text,'Nudge overview deck',event=>{if(event.detail===0&&!event.pointerType&&getDeck().beatMatch)actions.wave(getDeck().id,'skip',direction);});
   b.dataset.direction=direction;node.append(b);
   b.addEventListener('pointerdown',event=>{if(event.button!==0||held)return;event.preventDefault();event.stopPropagation();const deck=getDeck();held={pointer:event.pointerId,deckId:deck.id,button:b};b.dataset.pressed='true';try{b.setPointerCapture(event.pointerId);}catch(_){}actions.wave(deck.id,deck.beatMatch?'skip':'nudge',direction);});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,event=>{if(event.pointerId===held?.pointer){event.preventDefault();event.stopPropagation();release();}});
   b.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)&&!getDeck().beatMatch){event.preventDefault();event.stopPropagation();keyboardDeck=getDeck().id;actions.wave(keyboardDeck,'nudge',direction);}});
   b.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)&&!getDeck().beatMatch){event.preventDefault();releaseKeyboard();}});
   b.addEventListener('blur',releaseKeyboard);return {b,direction};
  });
  window.addEventListener('blur',()=>{release();releaseKeyboard();});
  return {node,render(){const deck=getDeck();if(keyboardDeck!==null&&(keyboardDeck!==deck.id||!node.getClientRects().length))releaseKeyboard();if(held&&(held.deckId!==deck.id||!node.getClientRects().length))release();for(const {b,direction} of buttons)b.setAttribute('aria-label',(deck.beatMatch?'Skip on next beat ':'Hold to nudge ')+(direction<0?'slower/backward':'faster/forward')+' deck '+deck.id);}};
 };
})();
