// H3 fixed frame. One overview, center and stem group per underlying deck.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,ui=d.components;
 h.createDeck=function(id,getState,actions){
  const getDeck=()=>h.deck(getState(),id),node=ui.element('section','design-deck h1-deck h3-deck');node.dataset.deck=id;node.setAttribute('aria-label','Simulated deck '+id);
  const top=ui.element('div','h3-top'),matching=h.createMatching(id,node,getDeck,actions),tuning=ui.element('div','h3-tuning-slot');
  const library=ui.button('h3-open-library','Library','Open full workspace Library for deck '+id,()=>{actions.page(id,'library');back.focus();});
  top.append(matching.label,tuning,library);
  const songRow=ui.element('div','h3-song-row'),title=ui.element('strong','h1-song-title');
  const selector=h.createSlideSelector(id,getDeck,mode=>actions.page(id,mode));songRow.append(title,selector.node);
  const transport=ui.element('div','h1-transport'),play=ui.button('h1-play','▶','Play simulated deck '+id,()=>actions.play(id));
  const main=ui.slider('MAIN','h1-main-'+id,value=>actions.level(id,null,value));const swap=ui.button('h4-swap','⇄','Swap queued song and play on deck '+id,()=>actions.swap(id));transport.append(play,main.node,swap);
  const queueInfo=ui.element('div','h4-queue-info');queueInfo.hidden=true;
  const queued=ui.button('h4-queue','','Inspect queued song on deck '+id,()=>{queueInfo.hidden=!queueInfo.hidden;queued.setAttribute('aria-expanded',String(!queueInfo.hidden));});songRow.append(queued,queueInfo);
  const overview=ui.element('div','h1-overview h3-overview'),marker=ui.element('span','h1-overview-position');overview.append(ui.waveform(id),marker,ui.element('span','h1-wave-caption','FULL SONG · PREVIEW'));
  const center=ui.element('section','h3-center');center.id='h3-center-'+id;center.setAttribute('role','tabpanel');
  selector.node.querySelectorAll('button').forEach(button=>button.setAttribute('aria-controls',center.id));
  const wave=ui.element('div','h3-wave'),zoom=ui.element('div','h1-zoom'),art=ui.waveform(id);art.classList.add('h1-scrolling-wave');
  zoom.append(art,ui.element('span','h1-stationary-playhead'),ui.element('span','h1-wave-caption','ZOOM · SIMULATED'));
  const progress=ui.element('output','h1-position');wave.append(zoom,progress);
  const cue=ui.element('div','h3-cue'),hot=ui.element('div','h3-hot-cues');
  const cueButtons=Array.from({length:8},(_,index)=>{const b=ui.button('',''+(index+1),'Simulated hot cue '+(index+1)+' on deck '+id,event=>actions.cue(id,'cue',{index,shift:event.shiftKey}));hot.append(b);return b;});
  const performance=d.createPerformanceControls({scope:'h3-'+id,getDeck,actions,id});
  performance.node.querySelector('.performance-transport').remove();
  const loop=performance.node.querySelector('.performance-loop');
  const strip=performance.node.querySelector('.vertical-mixer-strip'),filter=strip.querySelector('[data-control=filter]'),eq=strip.querySelector('.performance-eq');strip.replaceChildren(filter,...[...eq.children].reverse());
  function holdButton(text,kind){
   const b=ui.button('',text,'Hold simulated '+kind+' on deck '+id,()=>{});b.dataset.modifier=kind;
   b.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();try{b.setPointerCapture(event.pointerId);}catch(_){}actions.cue(id,kind,true);});
   for(const type of ['pointerup','pointercancel','lostpointercapture','blur'])b.addEventListener(type,()=>{if(getDeck().compact[kind])actions.cue(id,kind,false);});
   b.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();actions.cue(id,kind,true);}});
   b.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();actions.cue(id,kind,false);}});
   return b;
  }
  const modifiers=ui.element('div','h3-modifiers'),repeat=holdButton('Hold · Repeat','repeat'),shift=holdButton('Hold · Shift','shift');modifiers.append(repeat,shift);cue.append(hot,loop,modifiers);
  cue.addEventListener('keydown',event=>{if(event.key==='Shift'&&!getDeck().compact.shift)actions.cue(id,'shift',true);});
  cue.addEventListener('keyup',event=>{if(event.key==='Shift')actions.cue(id,'shift',false);});
  window.addEventListener('blur',()=>{if(getDeck().compact.shift)actions.cue(id,'shift',false);});
  const controls=ui.element('section','h3-controls');controls.append(performance.node);center.append(wave,cue,controls);
  const stems=ui.element('div','stem-controls h1-stems h3-stems');
  const faders=d.model.stems.map((name,index)=>{const f=ui.slider(name,'h1-stem-'+id+'-'+index,value=>actions.level(id,index,value));stems.append(f.node);return f;});
  const libraryTop=ui.element('div','h3-library-top');
  const back=ui.button('','← Performance','Return to performance on deck '+id,()=>{actions.page(id,getDeck().compact.mode);library.focus();});libraryTop.append(ui.element('span','h4-library-deck','D'+id),back);
  node.append(top,songRow,transport,overview,center,stems,matching.menu,libraryTop);
  return {node,render(){
   const deck=getDeck(),view=deck.compact,song=d.model.findSong(deck.songId);node.dataset.mode=view.mode;node.dataset.workspace=view.workspace;
   node.classList.toggle('is-playing',deck.playing);title.textContent=song?.title||'Load an example';title.title=song?song.title+' — '+song.artist:'No song';
   selector.render();matching.render();
   const next=d.model.findSong(deck.queuedSongId);node.dataset.queued=String(!!next);queued.textContent=next?'NEXT · '+next.title+' — '+next.artist:'';queued.title=queued.textContent;queueInfo.textContent=next?'Queued: '+next.title+' — '+next.artist:'';if(!next)queueInfo.hidden=true;queued.setAttribute('aria-expanded',String(!queueInfo.hidden));swap.disabled=!next;swap.hidden=!next;
   play.textContent=deck.playing?'Ⅱ':'▶';play.disabled=!song;play.setAttribute('aria-label',(deck.playing?'Pause':'Play')+' simulated deck '+id);play.setAttribute('aria-pressed',String(deck.playing));
   main.render(deck.volume);faders.forEach((f,index)=>f.render(deck.stems[index]));
   wave.hidden=view.mode!=='wave';cue.hidden=view.mode!=='cue';controls.hidden=view.mode!=='controls';
   center.setAttribute('aria-labelledby','h3-mode-'+id+'-'+view.mode);
   const position=d.performanceProgress(deck);marker.style.left=position.fraction*100+'%';progress.value=position.text+' · preview';art.style.transform='translateX('+(-(deck.position*20)%180)+'px)';
   cueButtons.forEach((b,index)=>{const empty=view.cues[index]===null;b.textContent=(index+1)+(empty?' · Set':'');b.dataset.empty=String(empty);b.title=empty?'Tap to set at preview position':'Jump to '+view.cues[index].toFixed(1)+'s; hold Shift to delete';b.setAttribute('aria-label','Cue '+(index+1)+(empty?' empty; tap to set':' set at '+view.cues[index].toFixed(1)+' seconds')+' on deck '+id);});
   repeat.setAttribute('aria-pressed',String(view.repeat));shift.setAttribute('aria-pressed',String(view.shift));performance.render();
   // Column browser is mounted by the shared host after the card. It then covers
   // the full workspace below the persistent Library return header.
   const browser=node.querySelector('.column-library');if(browser)browser.setAttribute('aria-label','Full-panel Library for deck '+id);
  }};
 };
})();
