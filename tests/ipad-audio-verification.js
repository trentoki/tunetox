// Manual fixture only: the production mixer owns every playback node and routing gain.
function createVerificationWav(sampleRate) {
  const frames = sampleRate * 4, bytes = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(bytes);
  function text(at, value) { [...value].forEach((letter, index) => view.setUint8(at + index, letter.charCodeAt(0))); }
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame++) {
    const fade = Math.min(1, frame / (sampleRate * .01), (frames - 1 - frame) / (sampleRate * .01));
    view.setInt16(44 + frame * 2, Math.round(.025 * 32767 * fade * Math.sin(2 * Math.PI * 440 * frame / sampleRate)), true);
  }
  return bytes;
}

const ui = Object.fromEntries(['play','stop','replay','status','checks','meters','heard','silent','physical','diagnostics'].map(id => [id, document.getElementById(id)]));
let audio, mixer, busy = false, version = 0, observed = {}, lastSignal = null, lastError = null;
let entryState = null, started = false;
const stageNames = [...prototypeStemNames.flatMap(name => [name + 'Source', name + 'StemGain']), 'main', 'transport', 'destinationInput'];
function snapshot() {
  const nativeAudio = mixer?.getDiagnostics() || null;
  const stages = { ...nativeAudio?.decks[1].liveMeters, destinationInput: nativeAudio?.outputMeter };
  for (const name of stageNames) {
    const meter = stages[name];
    if (meter?.available && meter.peak > .001) observed[name] = true;
  }
  if (stages.destinationInput?.peak > .001) lastSignal = nativeAudio;
  ui.meters.replaceChildren(...stageNames.map(name => {
    const row = document.createElement('tr');
    for (const value of [name, stages[name]?.rms?.toFixed(5) ?? '—', stages[name]?.peak?.toFixed(5) ?? '—']) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    return row;
  }));
  const state = mixer?.getDeck(1).getState();
  ui.status.textContent = `AudioContext: ${audio?.state || 'uncreated'} · clock: ${audio?.currentTime.toFixed(3) || '—'} · ${busy ? 'Preparing' : state?.isPlaying ? 'Playing' : 'Stopped / ready'}${lastError ? ' · ERROR: ' + lastError : ''}`;
  const missing = stageNames.filter(name => !observed[name]);
  ui.checks.textContent = !started ? 'Programmatic checks: awaiting test.' : missing.length ? `Programmatic signal evidence incomplete: ${missing.join(', ')}. Inspect diagnostics; this is not proof of physical silence.` : 'PASS — signal measured at every stage, including destination input. Physical audibility still requires your confirmation.';
  ui.diagnostics.textContent = JSON.stringify({ fixture:'Phase1A-v1', entryState, lastError, observedStages:observed, physicalConfirmation:ui.physical.textContent, current:nativeAudio, lastNonzeroDestination:lastSignal, userAgent:navigator.userAgent }, null, 2);
}
async function play() {
  if (busy) return;
  const command = ++version; busy = true; lastError = null; observed = {}; lastSignal = null; started = true;
  ui.physical.textContent = 'Physical audibility: NOT CONFIRMED for this playback.';
  try {
    entryState = getNativePageAudioState();
    // Invoke resume synchronously inside the click handler, before any file/decode await.
    if (!audio) {
      audio = new AudioContext();
      mixer = createNativeStemMixer(() => audio);
      audio.addEventListener('statechange', snapshot);
    }
    const resumed = audio.resume();
    mixer.getDeck(1).stop();
    ui.stop.disabled = false; ui.play.disabled = true; ui.replay.disabled = true;
    await resumed;
    if (command !== version) return;
    if (audio.state !== 'running') throw new Error('Context is not running. Press Replay from a direct tap.');
    if (!mixer.getDeck(1).getState().loaded) {
      const bytes = createVerificationWav(audio.sampleRate);
      await mixer.getDeck(1).loadFiles(Object.fromEntries(prototypeStemNames.map(name => [name, new File([bytes], name + '.wav', {type:'audio/wav'})])));
    }
    if (command !== version) return;
    const targets = Object.fromEntries(mixer.deckIds.map(id => [id, {mainVolume:1, levels:Object.fromEntries(prototypeStemNames.map(name => [name, id === 1 ? .5 : 0]))}]));
    await mixer.startCoordinated(1, targets);
    if (command !== version) mixer.getDeck(1).stop();
    ui.heard.disabled = false; ui.silent.disabled = false;
  } catch (error) { lastError = error.message; }
  finally { busy = false; ui.play.disabled = false; ui.replay.disabled = !audio; snapshot(); }
}
ui.play.addEventListener('click', play); ui.replay.addEventListener('click', play);
ui.stop.addEventListener('click', () => { ++version; mixer?.getDeck(1).stop(); snapshot(); });
ui.heard.addEventListener('click', () => { ui.physical.textContent = 'User reports: tone physically audible. This is a manual confirmation.'; snapshot(); });
ui.silent.addEventListener('click', () => { ui.physical.textContent = 'User reports: no audible tone. Inspect retained diagnostics; do not infer engine failure from this alone.'; snapshot(); });
setInterval(snapshot, 100);
window.addEventListener('pagehide', () => { ++version; void mixer?.close(); });
snapshot();
