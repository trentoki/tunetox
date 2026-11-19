// Separate H5.1 host: no production app, audio lifecycle, IndexedDB or media imports.
(() => {
 const d=globalThis.TuneToxDesign,m=d.model;let state=d.compact.createState();
 // Use the established F2/F3/G2 allocator and lifecycle fixes, not the legacy request-weighted path.
 // All four decks join the same shared Handoff relationship by default.
 // Participation defaults are supplied by the authoritative application state.
 const native=createMainStemIntegration(createAudioEngine(), { incremental:true, firstPlayIncremental:true, liveLifecycle:true });
 const stemNames=['transients','flow','tune','voice'];
 // G2's native Handoff actions are the sole musical command path.
 // Presentation components call these actions directly; no H5 audio adapter or preview allocation.
 let gestureNumber=0;
 const gestureId=()=> 'h531-ui-'+(++gestureNumber);
 const audio={
  setStemLevel:(id,index,value)=>native.handoff.setStemLevel(id,stemNames[index],Math.round(value*100)/100,gestureId()),
  setMainVolume:(id,value)=>native.handoff.setMainVolume(id,value,gestureId()),
  togglePlayback:id=>native.router.getState(id).isPlaying?native.router.pause(id):native.handoff.play(id),
  getLevels:id=>({stems:stemNames.map(name=>appState.decks[id-1].stems.allocatedLevels[name]),volume:appState.decks[id-1].volume})
 };
 // Diagnostic snapshot: real native state, not the design-mode preview.
 window.TuneToxLiveDiagnostics=()=>({
  build:'h531-native-diagnostics-20261118',
  handoff:native.handoff.getDiagnostics(),
  decks:appState.decks.map(deck=>({
   id:deck.id,main:deck.volume,
   playing:native.router.getState(deck.id).isPlaying,
   handoff:appState.participation.byDeck[deck.id].stemHandoff,
   requested:{...deck.stems.requestedLevels},
   allocated:{...deck.stems.allocatedLevels}
  }))
 });

 // Native musical state is authoritative; visual decks retain only presentation state.
 const names=['transients','flow','tune','voice'];
 const status=document.getElementById('h1-status');
 const fileDialog=document.getElementById('h531-files');
 document.getElementById('h531-files-open').addEventListener('click',()=>fileDialog.showModal());
 document.getElementById('h531-files-close').addEventListener('click',()=>fileDialog.close());
 const filesRoot=document.getElementById('h531-file-inputs');
 // Quick test loader: one four-file selection can populate any or all decks.
 const quick=document.createElement('fieldset');
 const quickTitle=document.createElement('legend');quickTitle.textContent='Quick load — select four files once';
 const quickInput=document.createElement('input');quickInput.type='file';quickInput.multiple=true;quickInput.accept='audio/*,.wav,.aiff,.aif,.mp3,.m4a';
 const quickNote=document.createElement('p');quickNote.textContent='Names are optional. Files are assigned by recognized stem names, then selection order. Reuse the same four files across decks for handoff tests.';
 const quickButtons=document.createElement('div');
 quick.append(quickTitle,quickInput,quickNote,quickButtons);filesRoot.append(quick);
 function selectedQuickFiles(){
  const files=Array.from(quickInput.files);
  if(files.length!==4)throw Error('Choose exactly four audio files together.');
  const assigned={},remaining=[];
  const aliases={transients:/transient|drum|percuss|beat|kick|snare/i,flow:/flow|bass|low/i,tune:/tune|other|music|instrument|melod/i,voice:/voice|vocal|lead|sing/i};
  for(const file of files){const match=names.filter(name=>aliases[name].test(file.name));if(match.length===1&&!assigned[match[0]])assigned[match[0]]=file;else remaining.push(file);}
  for(const name of names)if(!assigned[name])assigned[name]=remaining.shift();
  return assigned;
 }
 async function quickLoadDeck(id,selected){
  if(!native.router.setSourceMode(id,'stems')&&native.router.getSourceMode(id)!=='stems')throw Error('Deck '+id+': eject before changing source');
  await native.router.loadStems(id,selected);
  const songId='quick-'+id+'-'+Date.now();
  d.data.songs.push({id:songId,title:'Test stems · Deck '+id,artist:'Local audio',bpm:120,key:'—',duration:'0:00',color:'#80baff'});
  state.decks[id-1].songId=songId;state.decks[id-1].position=0;
 }
 for(const target of [1,2,3,4,'all']){
  const button=document.createElement('button');button.type='button';button.textContent=target==='all'?'Load all 4 decks':'Load Deck '+target;
  button.addEventListener('click',async()=>{
   button.disabled=true;
   try{
    const selected=selectedQuickFiles(),targets=target==='all'?[1,2,3,4]:[target];
    for(const id of targets){status.textContent='Quick loading Deck '+id+' of '+targets.join(', ')+'…';await quickLoadDeck(id,selected);}
    syncAudio();render();status.textContent='Quick load complete: '+targets.map(id=>'D'+id).join(', ')+'. Raise Main and stems, then Play.';fileDialog.close();
   }catch(error){status.textContent='Quick load: '+error.message;console.error(error);}
   finally{button.disabled=false;}
  });quickButtons.append(button);
 }

 for(const id of [1,2,3,4]){
  const fieldset=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent='Deck '+id;fieldset.append(legend);
  const inputs={};
  for(const name of names){const label=document.createElement('label');label.textContent=name+' ';label.style.display='block';const input=document.createElement('input');input.type='file';input.accept='audio/*,.wav,.aiff,.aif,.mp3,.m4a';label.append(input);fieldset.append(label);inputs[name]=input;}
  const load=document.createElement('button');load.textContent='Load Deck '+id;load.type='button';
  load.addEventListener('click',async()=>{
   const selected=Object.fromEntries(names.map(name=>[name,inputs[name].files[0]]));
   if(names.some(name=>!selected[name])){status.textContent='Select all four stem files for Deck '+id;return;}
   try{
    status.textContent='Loading Deck '+id+'…';
    if(!native.router.setSourceMode(id,'stems')&&native.router.getSourceMode(id)!=='stems')throw Error('Eject deck before changing source');
    await native.router.loadStems(id,selected);
    const songId='local-'+id+'-'+Date.now();
    d.data.songs.push({id:songId,title:selected.transients.name.replace(/\.[^.]+$/,''),artist:'Local audio',bpm:120,key:'—',duration:'0:00',color:'#80baff'});
    state.decks[id-1].songId=songId;state.decks[id-1].position=0;
    syncAudio();render();status.textContent='Deck '+id+' loaded. Raise Main and a stem, then Play.';fileDialog.close();
   }catch(error){status.textContent='Load failed: '+error.message;console.error(error);}
  });fieldset.append(load);filesRoot.append(fieldset);
 }
 function syncAudio(){for(const deck of state.decks){const transport=native.router.getState(deck.id);deck.position=Number.isFinite(transport.position)?transport.position:0;}}
 function safe(action){try{const result=action();if(result&&typeof result.then==='function')result.then(()=>{syncAudio();render();}).catch(error=>{status.textContent=error.message;console.error(error);});else{syncAudio();render();}}catch(error){status.textContent=error.message;console.error(error);}}
 // Expose live musical values to the existing H5 visual components without copying them.
 state.decks.forEach(deck=>{
  deck.songId=null;
  Object.defineProperties(deck,{
   stems:{get:()=>audio.getLevels(deck.id).stems,configurable:true,enumerable:true},
   volume:{get:()=>appState.decks[deck.id-1].volume,configurable:true,enumerable:true},
   playing:{get:()=>native.router.getState(deck.id).isPlaying===true,configurable:true,enumerable:true},
   handoff:{get:()=>appState.participation.byDeck[deck.id].stemHandoff,configurable:true,enumerable:true}
  });
 });
 const announce=text=>{document.getElementById('h1-status').textContent=text+' · preview only (no audio effect)';};
 const actions={
  swap(id){if(d.h4Queue.swap(state,id))announce('Queued example swapped on D'+id);render();},
  partner(id,other){d.h5.setPartner(state,id,other);render();},
  wave(id,kind,value){d.h5.waveAction(state,id,kind,value);render();},
  select(id){state.editingDeckId=id;render();},
  page(id,page){d.compact.changePage(state,id,page);render();},
  level(id,index,value){safe(()=>index===null?audio.setMainVolume(id,value):audio.setStemLevel(id,index,value));},
  play(id){safe(()=>audio.togglePlayback(id));},
  toggle(id,key){const deck=d.compact.deck(state,id);if(key==='handoff'){safe(()=>native.handoff.setParticipation(id,!appState.participation.byDeck[id].stemHandoff));return;}m.setDeckControl(state,id,key,!deck[key]);if(key==='beatMatch'){deck.wave.nudge=0;deck.wave.pending=null;}announce(key+' preview only; no audio allocation');render();},
  performance(id,key,value,index){m.setPerformanceControl(state,id,key,value,index);render();},
  cue(id,kind,value){d.compact.cueAction(state,id,kind,value);announce('D'+id+' '+kind+' position preview');render();}
 };
 const cards=[1,2,3,4].map(id=>d.compact.createDeck(id,()=>state,actions));
 document.getElementById('h1-decks').append(...cards.map(c=>c.node));
 const columns=d.createColumnLibraries(cards,()=>state,render,announce);
 const header=d.compact.createHeader(()=>state,render,announce),tools=d.compact.createDesignTools();
 function render(){d.h51ReconcileViews(state);cards.forEach(card=>card.render());header.render();columns.render();}
 syncAudio();render();
 // Render actual native transport position; never advance a simulated clock.
 setInterval(()=>{syncAudio();render();},250);
 window.addEventListener('resize',()=>requestAnimationFrame(render));
 window.addEventListener('blur',()=>{for(const deck of state.decks){deck.compact.repeat=false;deck.wave.nudge=0;}render();});
 // Read-only snapshot / presentation test hooks, deliberately no production actions.
 d.h1={getSnapshot:()=>JSON.parse(JSON.stringify(state)),layout:tools.values,presets:tools.getPresets,render};
})();
