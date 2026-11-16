// Manual test host: one native mixer, no participation allocator or matching adapter.
let audio, mixer, catalog, loadingDeck = null, outputSeen = false;
const decks = [1, 2].map(id => ({ id, metadata:null, message:'Ready', pending:false, command:0,
  main:.075, levels:Object.fromEntries(prototypeStemNames.map(name => [name,.5])) }));
const element = id => document.getElementById(id);
function player(deck) { return mixer?.getDeck(deck.id); }
function refresh() {
  let retained = 0;
  for (const deck of decks) {
    const state = player(deck)?.getState();
    deck.load.disabled = loadingDeck !== null || !!state?.loaded;
    deck.play.disabled = !state?.loaded || deck.pending;
    deck.stop.disabled = !state?.loaded;
    deck.release.disabled = !state?.loaded || deck.pending;
    deck.play.textContent = state?.isPlaying ? 'Pause' : 'Play';
    deck.status.textContent = `${deck.message} · ${state?.position.toFixed(1) || 0} / ${state?.duration.toFixed(1) || 0} s`;
    if (state?.loaded) retained += decodedBytes(deck.metadata);
  }
  const diagnostics = mixer?.getDiagnostics(), meter = diagnostics?.outputMeter;
  if (meter?.peak > .0001) outputSeen = true;
  element('global').textContent = `AudioContext ${audio?.state || 'uncreated'} · destination peak ${meter?.peak?.toFixed(5) ?? '—'}, RMS ${meter?.rms?.toFixed(5) ?? '—'} · signal observed ${outputSeen}. Physical audibility is not measured.`;
  element('memory').textContent = `Estimated retained decoded PCM: ${(retained/1048576).toFixed(1)} MiB at ${audio?.sampleRate || '—'} Hz. Plus one sequential encoded download/decode and browser overhead. Loading is serialized; playing decks continue. Release unloads only that deck.`;
  element('diagnostics').textContent = JSON.stringify({manualMixing:true, automaticHandoffEnabled:false, matchingEnabled:false, loadingDeck, nativeAudio:diagnostics,
    browserHeap:performance.memory ? {usedBytes:performance.memory.usedJSHeapSize,limitBytes:performance.memory.jsHeapSizeLimit,note:'Chrome JS heap only; not total audio/process memory'} : 'Unavailable; PCM estimate only',
    decks:decks.map(deck=>({id:deck.id,metadata:deck.metadata,message:deck.message}))},null,2);
}
function decodedBytes(metadata) {
  return metadata ? prototypeStemNames.reduce((sum,name)=>sum+metadata.stems[name].frames*metadata.stems[name].channels*4*audio.sampleRate/metadata.stems[name].sampleRate,0) : 0;
}
function ensureAudio() {
  if (!audio) { audio = new AudioContext(); mixer = createNativeStemMixer(()=>audio); }
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
    deck.metadata = metadata; deck.main = Math.min(deck.main,metadata.mainCeiling);
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
    player(deck).setMainVolume(deck.main);
    for (const name of prototypeStemNames) player(deck).setStemLevel(name,deck.levels[name]);
    gainControls(deck); deck.message='Loaded — press Play';
  } catch(error) { deck.message='LOAD ERROR: '+error.message; player(deck)?.eject(); }
  finally { loadingDeck=null; refresh(); }
}
function gainControls(deck) {
  deck.gains.replaceChildren();
  for (const name of ['main',...prototypeStemNames]) {
    const label=document.createElement('label'), text=document.createElement('span'), input=document.createElement('input'), value=document.createElement('output');
    text.textContent=name; input.type='range'; input.min=0; input.max=name==='main'?deck.metadata.mainCeiling:1; input.step='.001';
    input.value=name==='main'?deck.main:deck.levels[name]; input.dataset.gain=name;
    input.setAttribute('aria-label',`Deck ${deck.id} ${name}`);
    value.textContent=Math.round(Number(input.value)*100)+'%';
    input.addEventListener('input',()=>{
      try {
        const next=Number(input.value);
        if(name==='main'){player(deck).setMainVolume(next);deck.main=next;}
        else{player(deck).setStemLevel(name,next);deck.levels[name]=next;}
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
  for(const [name,title] of [['load','Load Song'],['play','Play'],['stop','Stop'],['release','Release']]){
    const button=document.createElement('button');button.textContent=title;button.dataset.action=name;deck[name]=button;section.append(button);
  }
  deck.status=document.createElement('p');deck.status.className='status';deck.status.setAttribute('aria-live','polite');section.append(deck.status);
  deck.gains=document.createElement('div');section.append(deck.gains);element('decks').append(section);
  deck.load.addEventListener('click',()=>load(deck));
  deck.play.addEventListener('click',async()=>{
    if(deck.pending)return;deck.pending=true;const command=++deck.command;
    try{
      if(player(deck).getState().isPlaying){player(deck).pause();deck.message='Paused';}
      else{const resumed=ensureAudio();refresh();await resumed;if(command!==deck.command)return;await player(deck).play();if(command===deck.command)deck.message='Playing';}
    }catch(error){deck.message='PLAY ERROR: '+error.message;}
    finally{deck.pending=false;refresh();}
  });
  deck.stop.addEventListener('click',()=>{++deck.command;player(deck).stop();deck.message='Stopped';refresh();});
  deck.release.addEventListener('click',()=>{player(deck).eject();deck.gains.replaceChildren();deck.message='Released';refresh();});
}
window.addEventListener('pagehide',()=>{void mixer?.close();});
setInterval(refresh,250);refresh();
