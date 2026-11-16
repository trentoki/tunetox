// H2 derivative of the frozen H1 deck renderer. The only base change keeps stems
// in Waveform on phones too, avoiding repeated DOM moves during active gestures.
(() => {
 const d=globalThis.TuneToxDesign,ui=d.components;
 d.compact.createDeck=function(id,getState,actions){
  const getDeck=()=>d.compact.deck(getState(),id);
  const node=ui.element('section','design-deck h1-deck');node.dataset.deck=id;node.setAttribute('aria-label','Simulated deck '+id);
  const heading=ui.element('div','h1-song');
  const identity=ui.button('h1-deck-id','D'+id,'Select deck '+id+' header controls',()=>actions.select(id));
  const title=ui.element('strong','h1-song-title');heading.append(identity,title);
  const matching=ui.element('div','h1-matching');matching.setAttribute('aria-label','Matching on deck '+id);
  const toggles=[['beatMatch','Beat Match'],['tuneMatch','Tune Match'],['handoff','Handoff']].map(([key,text])=>{
   const b=ui.button('',text,({beatMatch:'Beat Match',tuneMatch:'Tune Match',handoff:'Handoff'})[key]+' on simulated deck '+id,()=>actions.toggle(id,key));b.dataset.control=key;matching.append(b);return {key,b};
  });
  const transport=ui.element('div','h1-transport');
  const play=ui.button('h1-play','▶','Play simulated deck '+id,()=>actions.play(id));
  const main=ui.slider('MAIN','h1-main-'+id,value=>actions.level(id,null,value));transport.append(play,main.node);
  const nav=ui.element('nav','h1-page-nav');nav.setAttribute('aria-label','Pages for deck '+id);
  const pages=['performance','controls','library'].map(page=>{
   const b=ui.button('',page==='performance'?'Waveform ⇄':page==='controls'?'Controls':'Library','Show '+page+' on deck '+id,()=>actions.page(id,page));b.dataset.page=page;nav.append(b);return {page,b};
  });
  const content=ui.element('div','h1-content');
  const wave=ui.element('section','h1-wave');wave.setAttribute('aria-label','Illustrative waveform for deck '+id);
  const zoom=ui.element('div','h1-zoom'),zoomArt=ui.waveform(id);zoomArt.classList.add('h1-scrolling-wave');
  zoom.append(zoomArt,ui.element('span','h1-stationary-playhead'),ui.element('span','h1-wave-caption','ZOOM · SIMULATED'));
  const overview=ui.element('div','h1-overview');overview.append(ui.waveform(id));const position=ui.element('span','h1-overview-position');overview.append(position,ui.element('span','h1-wave-caption','FULL SONG'));
  const time=ui.element('output','h1-position');wave.append(zoom,overview,time);
  const cue=ui.element('section','h1-cue');cue.setAttribute('aria-label','Simulated Cue tools, not song queue');
  const hot=ui.element('div','h1-hot-cues');
  ['A','B','C','D'].forEach((label,index)=>hot.append(ui.button('','Cue '+label,'Jump to hot cue '+label+' on deck '+id+' — simulated',()=>actions.cue(id,'cue',index))));
  const jumps=ui.element('div','h1-jumps');const quantize=ui.button('','Quantize','Toggle simulated beat-quantized cue jumps',()=>actions.cue(id,'quantize'));
  jumps.append(ui.button('','−4 beats','Simulated jump backward four beats',()=>actions.cue(id,'jump',-4)),ui.button('','+4 beats','Simulated jump forward four beats',()=>actions.cue(id,'jump',4)),quantize);
  const repeat=ui.button('h1-beat-repeat','Hold · Repeat','Hold simulated beat repeat on deck '+id,()=>{});
  repeat.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();try{repeat.setPointerCapture(e.pointerId);}catch(_){}actions.cue(id,'repeat',true);});
  for(const type of ['pointerup','pointercancel','lostpointercapture','blur'])repeat.addEventListener(type,()=>{if(getDeck().compact.repeat)actions.cue(id,'repeat',false);});
  repeat.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();actions.cue(id,'repeat',true);}});
  repeat.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();actions.cue(id,'repeat',false);}});
  cue.append(ui.element('p','h1-cue-label','CUE · position preview, no audio'),hot,jumps,repeat);
  const controls=ui.element('section','h1-controls');controls.setAttribute('aria-label','Stems EQ and effects for deck '+id);
  const stems=ui.element('div','stem-controls h1-stems');
  const faders=d.model.stems.map((name,index)=>{const f=ui.slider(name,'h1-stem-'+id+'-'+index,value=>actions.level(id,index,value));stems.append(f.node);return f;});
  const performance=d.createPerformanceControls({scope:'h1-'+id,getDeck,actions,id});
  // Reuse working simulated knobs/effects and looping, moving only their DOM.
  performance.node.querySelector('.performance-transport').remove();
  const looping=performance.node.querySelector('.performance-loop');cue.append(looping);
  const strip=performance.node.querySelector('.vertical-mixer-strip');
  const filter=strip.querySelector('[data-control=filter]'),eq=strip.querySelector('.performance-eq');
  strip.replaceChildren(filter,...[...eq.children].reverse());
  controls.append(stems,performance.node);content.append(wave,cue,controls);
  node.append(heading,matching,transport,nav,content);
  return {node,render(){
   const deck=getDeck(),song=d.model.findSong(deck.songId),view=deck.compact;
   node.dataset.page=view.page;node.dataset.waveCue=view.waveCue;node.classList.toggle('is-playing',deck.playing);
   title.textContent=song?.title||'Load an example';title.title=song?song.title+' — '+song.artist:'No example loaded';
   identity.setAttribute('aria-pressed',String(getState().editingDeckId===id));
   for(const {key,b} of toggles)b.setAttribute('aria-pressed',String(deck[key]));
   play.textContent=deck.playing?'Ⅱ':'▶';play.setAttribute('aria-pressed',String(deck.playing));play.disabled=!song;play.setAttribute('aria-label',(deck.playing?'Pause':'Play')+' simulated deck '+id);
   main.render(deck.volume);for(const f of [main,...faders])f.node.querySelector('input').setAttribute('aria-valuetext',Math.round((f===main?deck.volume:deck.stems[faders.indexOf(f)])*100)+' percent simulated');
   faders.forEach((f,index)=>f.render(deck.stems[index]));
   for(const {page,b} of pages){b.setAttribute('aria-pressed',String(view.page===page));if(page==='performance'){b.textContent=(view.waveCue==='waveform'?'Waveform':'Cue')+' ⇄';b.setAttribute('aria-label',view.page==='performance'?'Switch to '+(view.waveCue==='waveform'?'Cue':'Waveform')+' on deck '+id:'Return to '+view.waveCue+' on deck '+id);}}
   const stemParent=view.page==='performance'&&view.waveCue==='waveform'?wave:controls;
   if(stems.parentElement!==stemParent){if(stemParent===wave)wave.append(stems);else controls.prepend(stems);}
   wave.classList.toggle('has-stems',stemParent===wave);
   wave.hidden=view.page!=='performance'||view.waveCue!=='waveform';cue.hidden=view.page!=='performance'||view.waveCue!=='cue';controls.hidden=view.page!=='controls';
   const progress=d.performanceProgress(deck);time.value=progress.text.replace(' · simulated','')+' · preview';
   position.style.left=(progress.fraction*100)+'%';zoomArt.style.transform='translateX('+(-(deck.position*20)%180)+'px)';
   quantize.setAttribute('aria-pressed',String(view.quantize));repeat.setAttribute('aria-pressed',String(view.repeat));
   performance.render();
  }};
 };
})();
