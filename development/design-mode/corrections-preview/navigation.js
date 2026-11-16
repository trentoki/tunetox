// Phone deck buttons select decks on tap; a deliberate downward drag chooses a view.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,ui=d.components,createHeader=h.createHeader;
 const modes=['wave','cue','controls','transition'],names={wave:'Wave',cue:'Cue',controls:'Controls',transition:'Transition'};
 h.createHeader=function(getState,refresh,announce){
  const base=createHeader(getState,refresh,announce),root=document.querySelector('.h5-app');
  for(const cell of document.querySelectorAll('.h1-tuning-cell'))document.querySelector('.h3-deck[data-deck="'+cell.dataset.deck+'"] .h3-tuning-slot').append(cell);
  const phone=ui.element('nav','h3-phone-decks');phone.setAttribute('aria-label','Select deck; slide downward to choose performance view');
  const menu=ui.element('div','h5-view-menu');menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Performance views');document.body.append(menu);
  let owner=1,highlight='wave',anchor=null,gesture=null,suppress=false;
  const options=modes.map(mode=>{const b=ui.button('',names[mode],'Show '+names[mode],()=>{choose(mode);});b.dataset.view=mode;b.setAttribute('role','menuitemradio');menu.append(b);return b;});
  function close(){menu.hidden=true;gesture=null;}
  function mark(){options.forEach(b=>b.setAttribute('aria-checked',String(b.dataset.view===highlight)));}
  function open(id,from,focus=false){owner=id;menu.dataset.deck=id;anchor=from;highlight=h.deck(getState(),id).compact.mode;const r=from.getBoundingClientRect();menu.style.left=Math.max(6,Math.min(innerWidth-154,r.left))+'px';menu.hidden=false;menu.style.top=Math.max(6,Math.min(innerHeight-menu.getBoundingClientRect().height-6,r.bottom+4))+'px';mark();if(focus)options[modes.indexOf(highlight)]?.focus();}
  function choose(mode){h.changePage(getState(),owner,mode);getState().editingDeckId=owner;close();refresh();anchor?.focus();}
  d.h5OpenViews=(id,from)=>open(id,from,true);
  function tap(id){const state=getState();if(state.editingDeckId===id){const deck=h.deck(state,id);h.changePage(state,id,modes[(modes.indexOf(deck.compact.mode)+1)%modes.length]);}else state.editingDeckId=id;close();refresh();}
  // Pointerup owns pointer taps. Click is only a keyboard/assistive fallback,
  // preventing a delayed Safari compatibility click from cycling a second time.
  const buttons=[1,2,3,4].map(id=>{
   const b=ui.button('h5-phone-deck','','Select deck '+id+'; drag down for views',event=>{if(event.detail===0&&!event.pointerType&&!suppress){tap(id);}});b.dataset.deck=id;
   const text=ui.element('span'),track=ui.element('span','h5-deck-position'),head=ui.element('i');track.append(head);b.append(text,track);phone.append(b);
   b.addEventListener('pointerdown',e=>{if(e.button!==0||gesture)return;e.preventDefault();suppress=true;gesture={pointer:e.pointerId,id,startY:e.clientY,started:performance.now(),opened:false};try{b.setPointerCapture(e.pointerId);}catch(_){} });
   b.addEventListener('pointermove',e=>{if(gesture?.pointer!==e.pointerId)return;e.preventDefault();if(!gesture.opened&&e.clientY-gesture.startY>12){gesture.opened=true;getState().editingDeckId=id;open(id,b);refresh();}
    if(gesture?.opened){const r=menu.getBoundingClientRect(),index=Math.max(0,Math.min(3,Math.floor((e.clientY-r.top-4)/((r.height-8)/4))));highlight=modes[index];mark();}
   });
   b.addEventListener('pointerup',e=>{if(gesture?.pointer!==e.pointerId)return;const moved=gesture.opened,shortTap=performance.now()-gesture.started<450;gesture=null;if(moved)choose(highlight);else if(shortTap)tap(id);else close();setTimeout(()=>{suppress=false;},0);});
   for(const type of ['pointercancel','lostpointercapture'])b.addEventListener(type,e=>{if(gesture?.pointer===e.pointerId){close();suppress=false;}});
   b.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();getState().editingDeckId=id;refresh();open(id,b,true);}});
   return {id,b,text,head,track};
  });
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'){close();anchor?.focus();}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const i=Math.max(0,Math.min(3,modes.indexOf(highlight)+(e.key==='ArrowDown'?1:-1)));highlight=modes[i];mark();options[i].focus();}});
  document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!gesture&&!menu.contains(e.target)&&!e.target.closest('.h5-view-open'))close();});
  window.addEventListener('resize',close);window.addEventListener('blur',close);
  document.querySelector('.h1-header').append(phone);
  return {render(){base.render();root.dataset.selectedDeck=getState().editingDeckId;for(const {id,b,text,head,track} of buttons){const deck=h.deck(getState(),id),p=d.performanceProgress(deck);b.setAttribute('aria-pressed',String(getState().editingDeckId===id));text.textContent='D'+id+' · '+names[deck.compact.mode];head.style.left=p.fraction*100+'%';track.dataset.empty=String(!deck.songId);}}};
 };
})();
