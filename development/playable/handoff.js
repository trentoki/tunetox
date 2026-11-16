// Real handoff host. All decisions use production state/actions, never UI allocation math.
let audio, mixer, actions, catalog, loadingDeck = null, outputSeen = false;
const decks = [1, 2].map(id => ({ id, metadata:null, message:'Ready', pending:false, command:0,
  main:0, levels:Object.fromEntries(prototypeStemNames.map(name => [name, id===1?1:0])) }));
const element = id => document.getElementById(id);
function player(deck) { return mixer?.getDeck(deck.id); }
function refresh(includeDiagnostics = false) {
  let retained = 0;
  const live = decks.some(d=>player(d)?.getState().isPlaying);
  const statePending = decks.some(d=>d.pending);
  if(actions)for(const deck of decks){
    const domain=appState.decks[deck.id-1];
    deck.main=domain.volume;deck.levels=domain.stems.allocatedLevels;
    for(const input of deck.gains.querySelectorAll('input')){
      const name=input.dataset.gain;input.value=name==='main'?deck.main:deck.levels[name];
      input.disabled=statePending || (name==='main' && live && document.body.dataset.liveMain!=='true');
      input.nextElementSibling.textContent=name==='main'?Math.round(deck.main*100)+'%':`req ${(domain.stems.requestedLevels[name]*100).toFixed(1)}% · alloc ${(deck.levels[name]*100).toFixed(1)}% · gain ${(deck.main*deck.levels[name]).toFixed(3)}`;
    }
    deck.handoff.textContent='Handoff '+(appState.stemSession.automaticHandoffEnabled && appState.participation.byDeck[deck.id].stemHandoff?'ON':'OFF');
    deck.handoff.disabled=statePending;
  }
  for (const deck of decks) {
    const state = player(deck)?.getState();
    deck.load.disabled = loadingDeck !== null || !!state?.loaded;
    deck.play.disabled = !state?.loaded || deck.pending;
    if(!actions)deck.handoff.disabled=true;
    deck.stop.disabled = !state?.loaded;
    deck.release.disabled = !state?.loaded || deck.pending;
    deck.play.textContent = state?.isPlaying ? 'Pause' : 'Play';
    deck.status.textContent = `${deck.message} · ${state?.position.toFixed(1) || 0} / ${state?.duration.toFixed(1) || 0} s`;
    if (state?.loaded) retained += decodedBytes(deck.metadata);
  }
  if (!includeDiagnostics) return;
  const diagnostics = mixer?.getDiagnostics(), meter = diagnostics?.outputMeter;
  if (meter?.peak > .0001) outputSeen = true;
  element('global').textContent = `AudioContext ${audio?.state || 'uncreated'} · destination peak ${meter?.peak?.toFixed(5) ?? '—'}, RMS ${meter?.rms?.toFixed(5) ?? '—'} · signal observed ${outputSeen}${meter?.peak>=.95?' · WARNING: little output headroom — lower stems':''}. Physical audibility is not measured.`;
  element('memory').textContent = `Estimated retained decoded PCM: ${(retained/1048576).toFixed(1)} MiB at ${audio?.sampleRate || '—'} Hz. Plus one sequential encoded download/decode and browser overhead. Loading is serialized; playing decks continue. Release unloads only that deck.`;
  element('allocation').textContent=JSON.stringify({sharing:appState.stemSession.nativeHandoff?.sharing, authorization:appState.stemSession.authorization.ceilingsByStem, membership:appState.stemSession.nativeHandoff?.members});
  element('diagnostics').textContent = JSON.stringify({automaticHandoffEnabled:appState.stemSession.automaticHandoffEnabled, matchingEnabled:false, actionDiagnostics:actions?.getDiagnostics(), lastActionError:actions?.getLastError()?.message, productionState:appState, loadingDeck, nativeAudio:diagnostics,
    browserHeap:performance.memory ? {usedBytes:performance.memory.usedJSHeapSize,limitBytes:performance.memory.jsHeapSizeLimit,note:'Chrome JS heap only; not total audio/process memory'} : 'Unavailable; PCM estimate only',
    decks:decks.map(deck=>({id:deck.id,metadata:deck.metadata,message:deck.message}))},null,2);
}
function decodedBytes(metadata) {
  return metadata ? prototypeStemNames.reduce((sum,name)=>sum+metadata.stems[name].frames*metadata.stems[name].channels*4*audio.sampleRate/metadata.stems[name].sampleRate,0) : 0;
}
function ensureAudio() {
  if (!audio) {
    audio = new AudioContext(); mixer = createNativeStemMixer(()=>audio);
    for(const id of [1,2,3,4])createParticipationActions(appState).set(id,'stemHandoff',false);
    actions=createNativeStemHandoffActions(appState,mixer,()=>{
      for(const deck of decks)if(loadingDeck!==deck.id)deck.message=player(deck)?.getState().isPlaying?'Playing':'Ready';
      refresh();
    });actions.synchronizeAudio();
  }
  return audio.resume(); // Must be called before the first await inside the user's tap.
}
async function load(deck) {
  if (loadingDeck !== null || player(deck)?.getState().loaded) return;
  loadingDeck = deck.id; deck.message = 'Preparing';
  try {
    const resumed = ensureAudio(); refresh(); await resumed;
    if (!catalog) {
      const response = await fetch('/two-deck-manifest.json',{cache:'no-store'});
      if (!response.ok) throw new Error('Manifest HTTP '+response.status);
      catalog = await response.json();
    }
    const metadata = catalog.decks[deck.id], stems = prototypeStemNames.map(name=>metadata.stems[name]);
    if (!stems.every(stem=>stem.format==='IEEE float32' && [1,2].includes(stem.channels) && Number.isInteger(stem.frames) && stem.frames>0 && [44100,48000].includes(stem.sampleRate) && stem.frames===stems[0].frames && stem.sampleRate===stems[0].sampleRate)) throw new Error('Invalid/unaligned stem metadata');
    if (!(metadata.mainCeiling>0 && metadata.mainCeiling<=.5)) throw new Error('Invalid main ceiling');
    deck.metadata = metadata; // Handoff needs the production 0..1 domain; the manual fixture ceiling is not used here.
    let count = 0;
    const files = Object.fromEntries(prototypeStemNames.map(name=>[name,{name:name+'.wav',async arrayBuffer() {
      deck.message = `Downloading ${++count}/4: ${name}`; refresh();
      const response = await fetch(metadata.stems[name].url,{cache:'no-store'});
      if (!response.ok) throw new Error(name+': HTTP '+response.status);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength!==metadata.stems[name].encodedBytes) throw new Error(name+': size mismatch');
      deck.message = `Decoding ${count}/4: ${name}`; refresh(); return bytes;
    }}]));
    await player(deck).loadFiles(files);
    // Loading never raises gains or authorization.
    gainControls(deck); deck.message='Loaded — press Play';
  } catch(error) { deck.message='LOAD ERROR: '+error.message; player(deck)?.eject(); }
  finally { loadingDeck=null; refresh(); }
}
function gainControls(deck) {
  deck.gains.replaceChildren();
  for (const name of ['main',...prototypeStemNames]) {
    const label=document.createElement('label'), text=document.createElement('span'), input=document.createElement('input'), value=document.createElement('output');
    text.textContent=name; input.type='range'; input.min=0; input.max=1; input.step='.01';
    input.value=name==='main'?deck.main:deck.levels[name]; input.dataset.gain=name;
    input.setAttribute('aria-label',`Deck ${deck.id} ${name}`);
    value.textContent=Math.round(Number(input.value)*100)+'%';
    input.addEventListener('input',()=>{
      try {
        const next=Number(input.value);
        if(name==='main'){actions.setMainVolume(deck.id,next,'main-'+performance.now());}
        else{actions.setStemLevel(deck.id,name,next,'stem-'+performance.now());}
        value.textContent=Math.round(next*100)+'%';
      } catch(error){deck.message=error.message;}
      refresh();
    });
    label.append(text,input,value);deck.gains.append(label);
  }
}
for(const deck of decks){
  const section=document.createElement('section');section.id='deck-'+deck.id;
  const title=document.createElement('h2');title.textContent=`Deck ${deck.id} — ${deck.id===1?'Tase T - Hypnotic':'Cut Me Loose'}`;section.append(title);
  for(const [name,title] of [['load','Load Song'],['play','Play'],['stop','Stop'],['release','Release'],['handoff','Handoff OFF']]){
    const button=document.createElement('button');button.textContent=title;button.dataset.action=name;deck[name]=button;section.append(button);
  }
  deck.status=document.createElement('p');deck.status.className='status';deck.status.setAttribute('aria-live','polite');section.append(deck.status);
  deck.gains=document.createElement('div');section.append(deck.gains);element('decks').append(section);
  deck.load.addEventListener('click',()=>load(deck));
  deck.play.addEventListener('click',async()=>{
    if(deck.pending)return;deck.pending=true;const command=++deck.command;
    try{
      if(player(deck).getState().isPlaying){player(deck).pause();deck.message='Paused';}
      else{const resumed=ensureAudio();refresh();await resumed;if(command!==deck.command)return;await actions.play(deck.id);if(command===deck.command)deck.message='Playing';}
    }catch(error){deck.message='PLAY ERROR: '+error.message;}
    finally{deck.pending=false;refresh();}
  });
  deck.handoff.addEventListener('click',()=>{
    try{
      const enabled=appState.stemSession.automaticHandoffEnabled && appState.participation.byDeck[deck.id].stemHandoff;
      if(!enabled && !appState.stemSession.automaticHandoffEnabled){
        // Freeze retained flags for inspection. An explicit re-enable selects only
        // this deck, rather than unexpectedly reactivating every prior participant.
        for(const id of [1,2,3,4])actions.setParticipation(id,id===deck.id);
        actions.setEnabled(true);
      }else actions.setParticipation(deck.id,!enabled);
    }catch(error){deck.message='HANDOFF ERROR: '+error.message;}refresh();
  });
  deck.stop.addEventListener('click',()=>{++deck.command;player(deck).stop();deck.message='Stopped';refresh();});
  deck.release.addEventListener('click',()=>{player(deck).eject();deck.gains.replaceChildren();deck.message='Released';refresh();});
}
element('freeze').addEventListener('click',()=>{try{actions?.setEnabled(false);}catch(error){decks[0].message=error.message;}refresh();});
window.addEventListener('pagehide',()=>{actions?.dispose();void mixer?.close();});
setInterval(()=>refresh(true),250);refresh(true);
