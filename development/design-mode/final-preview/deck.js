// H5.2 keeps one deck state; cues and stems share the lower workspace by view.
(() => {
 const d=globalThis.TuneToxDesign,h=d.compact,ui=d.components;
 h.createDeck=function(id,getState,actions){
  const getDeck=()=>h.deck(getState(),id),node=ui.element('section','design-deck h1-deck h3-deck');node.dataset.deck=id;node.setAttribute('aria-label','Simulated deck '+id);
  const top=ui.element('div','h3-top'),matching=h.createMatching(id,node,getDeck,actions),tuning=ui.element('div','h3-tuning-slot');
  const library=ui.button('h3-open-library','Library','Open full workspace Library for deck '+id,()=>{actions.page(id,'library');back.focus();});
  top.append(matching.label,tuning,library);
  const songRow=ui.element('div','h3-song-row'),title=ui.element('strong','h1-song-title');
  const selector=h.createSlideSelector(id,getDeck,mode=>actions.page(id,mode),{modes:['wave','controls'],labels:{wave:'Wave + Cue',controls:'Controls'}});songRow.append(title,selector.node);
  const transport=ui.element('div','h1-transport'),play=ui.button('h1-play','▶','Play simulated deck '+id,()=>actions.play(id));
  const queue=ui.button('h5-queue','','Queue empty',()=>actions.swap(id));const main=ui.slider('MAIN','h1-main-'+id,value=>actions.level(id,null,value));transport.append(play,queue,main.node);
  const overview=ui.element('div','h1-overview h3-overview'),marker=ui.element('span','h1-overview-position');overview.append(ui.waveform(id),marker,ui.element('span','h1-wave-caption','FULL SONG · PREVIEW'));
  const center=ui.element('section','h3-center');center.id='h3-center-'+id;center.setAttribute('role','tabpanel');
  selector.node.querySelectorAll('button').forEach(button=>button.setAttribute('aria-controls',center.id));
  const wave=ui.element('div','h3-wave'),zoom=ui.element('div','h1-zoom'),art=ui.waveform(id);art.classList.add('h1-scrolling-wave');
  zoom.append(art,ui.element('span','h1-stationary-playhead'),ui.element('span','h1-wave-caption','ZOOM · SIMULATED'));
  const progress=ui.element('output','h1-position'),waveTools=d.h5CreateWave(id,getDeck,actions,zoom);zoom.append(waveTools.node);wave.append(zoom,progress);
  const performance=d.createPerformanceControls({scope:'h3-'+id,getDeck,actions,id});
  performance.node.querySelector('.performance-transport').remove();
  const loop=performance.node.querySelector('.performance-loop');
  const strip=performance.node.querySelector('.vertical-mixer-strip'),filter=strip.querySelector('[data-control=filter]'),eq=strip.querySelector('.performance-eq');strip.replaceChildren(filter,...[...eq.children].reverse());
  const cueView=d.h52CreateCues(id,getDeck,actions,zoom,loop),cue=cueView.node;
  const controls=ui.element('section','h3-controls');controls.append(performance.node);const transition=d.h5CreateTransition(id,getState,actions);center.append(wave,controls,transition.node);
  const stems=ui.element('div','stem-controls h1-stems h3-stems');
  const faders=d.model.stems.map((name,index)=>{const f=ui.slider(name,'h1-stem-'+id+'-'+index,value=>actions.level(id,index,value));const touch=d.h5AttachStem(f.node.querySelector('input'),value=>actions.level(id,index,value));stems.append(f.node);return {...f,touch};});
  const libraryTop=ui.element('div','h3-library-top');
  const back=ui.button('','← Performance','Return to performance on deck '+id,()=>{actions.page(id,getDeck().compact.mode);library.focus();});back.replaceChildren(d.h5Icon('back'));libraryTop.append(ui.element('span','h4-library-deck','D'+id),back);
  node.append(top,songRow,transport,overview,center,cue,stems,matching.menu,libraryTop);
  return {node,render(){
   const deck=getDeck(),view=deck.compact,song=d.model.findSong(deck.songId);node.dataset.mode=view.mode;node.dataset.workspace=view.workspace;
   node.classList.toggle('is-playing',deck.playing);title.textContent=song?.title||'Load an example';title.title=song?song.title+' — '+song.artist:'No song';
   selector.render();matching.render();waveTools.render();
   let deckTrack=matching.label.querySelector('.h5-deck-position');if(!deckTrack){deckTrack=ui.element('span','h5-deck-position');deckTrack.append(ui.element('i'));matching.label.append(deckTrack);}deckTrack.querySelector('i').style.left=d.performanceProgress(deck).fraction*100+'%';deckTrack.dataset.empty=String(!song);
   const next=d.model.findSong(deck.queuedSongId);node.dataset.queued=String(!!next);queue.textContent=next?'READY':'EMPTY';queue.title=next?'Swap queued song and start playback':'No queued song';queue.setAttribute('aria-label',next?'Ready: swap queued song and play':'Queue empty');queue.disabled=!next;
   play.textContent=deck.playing?'Ⅱ':'▶';play.disabled=!song;play.setAttribute('aria-label',(deck.playing?'Pause':'Play')+' simulated deck '+id);play.setAttribute('aria-pressed',String(deck.playing));
   wave.hidden=view.mode!=='wave';cue.hidden=view.mode!=='wave';controls.hidden=view.mode!=='controls';stems.hidden=view.mode!=='controls';transition.node.hidden=view.mode!=='transition';
   transition.render();main.render(deck.volume);faders.forEach((f,index)=>{f.render(deck.stems[index]);f.touch.render();});
   if(view.mode==='transition'){center.removeAttribute('aria-labelledby');center.setAttribute('aria-label','Two-deck Transition');}else{center.setAttribute('aria-labelledby','h3-mode-'+id+'-'+view.mode);center.removeAttribute('aria-label');}
   const position=d.performanceProgress(deck);marker.style.left=position.fraction*100+'%';progress.value=position.text+' · preview';art.style.transform='translateX('+(-(deck.position*20)%180)+'px)';
   cueView.render();performance.render();loop.querySelector('.loop-length').textContent=deck.performance.loopBeats+'b';loop.querySelector('.loop-length').title=deck.performance.loopBeats+' beat loop · simulated';
   // Column browser is mounted by the shared host after the card. It then covers
   // the full workspace below the persistent Library return header.
   const browser=node.querySelector('.column-library');if(browser)browser.setAttribute('aria-label','Full-panel Library for deck '+id);
  }};
 };
})();
