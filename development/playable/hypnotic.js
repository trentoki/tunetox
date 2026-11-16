// Test host only. Audio nodes, decoding, timeline and gain ramps belong to the existing engine.
const element = id => document.getElementById(id);
let mixer, player, audio, metadata, loading = false, message = 'Ready.', outputSeen = false;
const levels = Object.fromEntries(prototypeStemNames.map(name => [name, .5]));
let main = .15;
function refresh() {
  const state = player?.getState();
  element('load').disabled = loading || !!state?.loaded;
  element('play').disabled = loading || !state?.loaded;
  element('stop').disabled = loading || !state?.loaded;
  element('play').textContent = state?.isPlaying ? 'Pause' : 'Play';
  element('status').textContent = `${message} · AudioContext: ${audio?.state || 'uncreated'} · ${state?.position.toFixed(1) || 0} / ${state?.duration.toFixed(1) || 0} s`;
  const nativeAudio = mixer?.getDiagnostics();
  const meter = nativeAudio?.outputMeter;
  if (meter?.peak > .0001) outputSeen = true;
  element('signal').textContent = `Destination input: peak ${meter?.peak?.toFixed(5) ?? '—'}, RMS ${meter?.rms?.toFixed(5) ?? '—'}. Signal observed: ${outputSeen}. Speaker audibility is not measured.`;
  element('diagnostics').textContent = JSON.stringify({ metadata, nativeAudio }, null, 2);
}
function controls() {
  const host = element('gains'); host.replaceChildren();
  for (const name of ['main', ...prototypeStemNames]) {
    const label = document.createElement('label'), text = document.createElement('span');
    text.textContent = name === 'main' ? 'Main' : name;
    const input = document.createElement('input'), value = document.createElement('output');
    input.type = 'range'; input.min = 0; input.max = name === 'main' ? metadata.mainCeiling : 1;
    input.step = '.001'; input.value = name === 'main' ? main : levels[name]; input.setAttribute('aria-label', name + ' volume');
    value.textContent = Math.round(Number(input.value) * 100) + '%';
    input.addEventListener('input', () => {
      const next = Number(input.value);
      try {
        if (name === 'main') { player.setMainVolume(next); main = next; }
        else { player.setStemLevel(name, next); levels[name] = next; }
        value.textContent = Math.round(next * 100) + '%';
      } catch (error) { message = error.message; }
      refresh();
    });
    label.append(text, input, value); host.append(label);
  }
}
element('load').addEventListener('click', async () => {
  if (loading || player?.getState().loaded) return;
  loading = true; message = 'Preparing audio';
  try {
    // Resume before the first await, in the explicit Load gesture (Safari).
    if (!audio) { audio = new AudioContext(); mixer = createNativeStemMixer(() => audio); player = mixer.getDeck(1); }
    const resumed = audio.resume(); refresh(); await resumed;
    const response = await fetch('/manifest.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Manifest HTTP ' + response.status);
    metadata = await response.json();
    const stems = prototypeStemNames.map(name => metadata.stems[name]);
    if (!stems.every(stem => stem.format === 'IEEE float32' && [1,2].includes(stem.channels) && stem.frames > 0 && stem.sampleRate === stems[0].sampleRate && stem.frames === stems[0].frames)) throw new Error('Invalid or unaligned stem metadata');
    if (!(metadata.mainCeiling > 0 && metadata.mainCeiling <= .5)) throw new Error('Invalid safe gain ceiling');
    main = Math.min(main, metadata.mainCeiling);
    const decoded = stems.reduce((sum, stem) => sum + stem.frames * stem.channels * 4 * audio.sampleRate / stem.sampleRate, 0);
    element('memory').textContent = `Estimated retained decoded PCM: ${(decoded / 1048576).toFixed(1)} MiB at ${audio.sampleRate} Hz, plus browser/temporary overhead. Four stems: ${stems[0].duration.toFixed(3)} s. Main ceiling ${(metadata.mainCeiling * 100).toFixed(1)}% keeps a conservative peak bound below 0.8 at full stem levels. Equal duration verified; supplied export alignment assumed.`;
    // The engine calls these sequentially. No File/Blob copies or full-song JS cache.
    let count = 0;
    const files = Object.fromEntries(prototypeStemNames.map(name => [name, {name:name + '.wav', async arrayBuffer() {
      message = `Downloading ${++count}/4: ${name} (then decoding)`; refresh();
      const result = await fetch(metadata.stems[name].url, {cache:'no-store'});
      if (!result.ok) throw new Error(name + ': HTTP ' + result.status);
      const bytes = await result.arrayBuffer();
      if (bytes.byteLength !== metadata.stems[name].encodedBytes) throw new Error(name + ': file size changed');
      message = `Decoding ${count}/4: ${name}`; refresh(); return bytes;
    }}]));
    await player.loadFiles(files);
    player.setMainVolume(main);
    for (const name of prototypeStemNames) player.setStemLevel(name, levels[name]);
    controls(); message = 'Loaded — press Play. All four stems use the same start time and offset.';
  } catch (error) { message = 'LOAD ERROR: ' + error.message; player?.eject(); }
  finally { loading = false; refresh(); }
});
element('play').addEventListener('click', async () => {
  try {
    if (player.getState().isPlaying) { player.pause(); message = 'Paused'; }
    else { await player.play(); message = 'Playing'; }
  } catch (error) { message = 'PLAY ERROR: ' + error.message; }
  refresh();
});
element('stop').addEventListener('click', () => { player.stop(); message = 'Stopped — position reset'; refresh(); });
window.addEventListener('pagehide', () => { void mixer?.close(); });
setInterval(refresh, 250); refresh();
