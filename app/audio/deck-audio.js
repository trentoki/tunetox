// Buffered Signalsmith transport. Visual/Behavior retain the same persistent
// EventTarget per deck; source-time getters/events replace native media clocks.
// See specs/controls-settings.md for timeline, cancellation and latency limits.
let context;
let signalsmithLoadingPromise;
const deckAudioStates = new WeakMap();
const mainVolumes = new WeakMap();
const disposedAudioNodes = new WeakSet();
const volumeRampSeconds = 0.015;
const transportRampSeconds = 0.004;
const signalsmithLibraryURL = new URL("../../vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs", import.meta.url).href;

function requireRange(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + " must be a number from " + min + " to " + max + ".");
  }
}

// Bound browser/worklet waits. Abandoned work may still finish; callers must
// check cancellation and dispose late nodes rather than committing stale loads.
async function timeLimitOrCancel(audioOperation, cancellationSignal, operationName, milliseconds = 15000) {
  let timer, abort;
  try {
    return await Promise.race([audioOperation, new Promise((resolve, reject) => {
      abort = () => reject(new DOMException("Audio operation superseded.", "AbortError"));
      if (cancellationSignal?.aborted) { abort(); return; }
      cancellationSignal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => reject(new Error(operationName + " timed out. Reload the song and retry.")), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
    cancellationSignal?.removeEventListener("abort", abort);
  }
}

function notify(deckPlaybackInfo, type) {
  deckPlaybackInfo.deckAudio.dispatchEvent(new Event(type));
}

function sourcePosition(deckPlaybackInfo, time = context.currentTime) {
  const segment = deckPlaybackInfo.segment;
  const position = deckPlaybackInfo.playing && segment
    ? segment.position + Math.max(0, time - segment.time) * segment.rate : deckPlaybackInfo.position;
  return Math.max(0, Math.min(deckPlaybackInfo.duration, position));
}

function mute(deckPlaybackInfo) {
  deckPlaybackInfo.gate.gain.cancelScheduledValues(context.currentTime);
  deckPlaybackInfo.gate.gain.setValueAtTime(0, context.currentTime);
  deckPlaybackInfo.cutoff = null;
}

function stopClock(deckPlaybackInfo) {
  clearInterval(deckPlaybackInfo.timer);
  deckPlaybackInfo.timer = null;
}

function fail(deckPlaybackInfo, error) {
  deckPlaybackInfo.position = sourcePosition(deckPlaybackInfo);
  deckPlaybackInfo.playing = false;
  deckPlaybackInfo.error = error;
  ++deckPlaybackInfo.action;
  mute(deckPlaybackInfo);
  stopClock(deckPlaybackInfo);
  notify(deckPlaybackInfo, "error");
}

async function disposeNode(node) {
  if (!node || disposedAudioNodes.has(node)) return;
  disposedAudioNodes.add(node);
  node.onprocessorerror = null;
  try {
    // Free sample storage before closing the port, when the context is running.
    await timeLimitOrCancel(Promise.all([node.schedule({ active: false }), node.dropBuffers()]), null, "Audio cleanup", 2000);
  } catch {
    // Disconnection is still required after a failed processor or suspended clock.
    // This does not establish native/WASM memory reclamation on every browser.
  } finally {
    node.disconnect();
    node.port.onmessage = null;
    node.port.close();
  }
}

function scheduleEnd(deckPlaybackInfo) {
  const now = context.currentTime;
  if (deckPlaybackInfo.cutoff !== null) deckPlaybackInfo.gate.gain.cancelScheduledValues(Math.max(now, deckPlaybackInfo.cutoff));
  const segment = deckPlaybackInfo.segment;
  // Retain the baseline's DSP-tail allowance; the position display is a planned
  // source coordinate, not proof of the exact sample currently at the speakers.
  deckPlaybackInfo.cutoff = segment.time + (deckPlaybackInfo.duration - segment.position) / segment.rate + deckPlaybackInfo.latency;
  deckPlaybackInfo.gate.gain.setValueAtTime(0, deckPlaybackInfo.cutoff);
}

function startClock(deckPlaybackInfo) {
  stopClock(deckPlaybackInfo);
  deckPlaybackInfo.timer = setInterval(() => {
    if (!deckPlaybackInfo.playing) return;
    if (context.currentTime >= deckPlaybackInfo.cutoff) {
      deckPlaybackInfo.position = deckPlaybackInfo.duration;
      deckPlaybackInfo.playing = false;
      deckPlaybackInfo.ended = true;
      mute(deckPlaybackInfo);
      stopClock(deckPlaybackInfo);
      const node = deckPlaybackInfo.node;
      void timeLimitOrCancel(node.schedule({ active: false }), deckPlaybackInfo.controller?.signal, "Audio end")
        .catch(error => { if (deckPlaybackInfo.node === node && !deckPlaybackInfo.playing) fail(deckPlaybackInfo, error); });
      notify(deckPlaybackInfo, "ended");
    }
    notify(deckPlaybackInfo, "timeupdate");
  }, 50);
}

export function buildAudio() {
  context ??= new AudioContext();
  const deckAudio = new EventTarget();
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const gate = context.createGain();
  gate.gain.value = 0;
  gate.connect(gain);
  const deckPlaybackInfo = { deckAudio, gate, node: null, controller: null, generation: 0, action: 0, processing: 0,
    loading: false, playing: false, ended: false, error: null, duration: 0,
    position: 0, segment: null, rate: 1, pitch: 0, latency: 0, url: "", timer: null, cutoff: null };
  deckAudioStates.set(deckAudio, deckPlaybackInfo);
  mainVolumes.set(deckAudio, { gain, ramp: { from: 0, to: 0, start: 0, end: 0 } });
  // Compatibility is limited to read-only media-style information and events.
  // Transport commands are the exported Audio functions, not fake HTML methods.
  Object.defineProperties(deckAudio, {
    currentTime: { get: () => sourcePosition(deckPlaybackInfo) },
    duration: { get: () => deckPlaybackInfo.duration },
    paused: { get: () => !deckPlaybackInfo.playing },
    ended: { get: () => deckPlaybackInfo.ended },
    readyState: { get: () => deckPlaybackInfo.node && !deckPlaybackInfo.loading ? 2 : 0 },
    src: { get: () => deckPlaybackInfo.url },
    error: { get: () => deckPlaybackInfo.error }
  });
  return deckAudio;
}

export function setAudioMainVolume(deckAudio, value) {
  requireRange(value, 0, 1, "Main volume");
  const path = mainVolumes.get(deckAudio), now = context.currentTime, previous = path.ramp;
  const fraction = previous.end > previous.start
    ? Math.max(0, Math.min(1, (now - previous.start) / (previous.end - previous.start))) : 1;
  const from = previous.from + (previous.to - previous.from) * fraction;
  path.gain.gain.cancelScheduledValues(now);
  path.gain.gain.setValueAtTime(from, now);
  path.gain.gain.linearRampToValueAtTime(value, now + volumeRampSeconds);
  path.ramp = { from, to: value, start: now, end: now + volumeRampSeconds };
}

export async function loadAudio(deckAudio, song) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  deckPlaybackInfo.controller?.abort();
  const controller = new AbortController(), signal = controller.signal;
  deckPlaybackInfo.controller = controller;
  const generation = ++deckPlaybackInfo.generation;
  ++deckPlaybackInfo.action;
  deckPlaybackInfo.position = sourcePosition(deckPlaybackInfo);
  deckPlaybackInfo.playing = false;
  deckPlaybackInfo.loading = true;
  deckPlaybackInfo.error = null;
  mute(deckPlaybackInfo);
  stopClock(deckPlaybackInfo);
  let candidate;
  try {
    if (!globalThis.isSecureContext || !context.audioWorklet) {
      throw new Error("Signalsmith requires HTTPS or localhost. Plain HTTP on an iPad LAN address is not supported.");
    }
    // Resume immediately in the Load gesture, before file reading or module import.
    await timeLimitOrCancel(context.resume(), signal, "Audio context resume");
    if (context.deckPlaybackInfo !== "running") throw new Error("Audio context did not resume. Tap Load again.");
    if (deckPlaybackInfo.node) await timeLimitOrCancel(deckPlaybackInfo.node.schedule({ active: false, input: deckPlaybackInfo.position }), signal, "Previous song pause");
    const response = await timeLimitOrCancel(fetch(song.url, { signal }), signal, "Audio file read", 30000);
    if (!response.ok) throw new Error("Audio file could not be read.");
    const bytes = await timeLimitOrCancel(response.arrayBuffer(), signal, "Audio file read", 30000);
    const decoded = await timeLimitOrCancel(context.decodeAudioData(bytes), signal, "Audio decode", 60000);
    if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) throw new Error("Load a mono or stereo audio file.");
    signalsmithLoadingPromise ??= import(signalsmithLibraryURL).catch(error => { signalsmithLoadingPromise = null; throw error; });
    const { default: factory } = await timeLimitOrCancel(signalsmithLoadingPromise, signal, "Signalsmith import");
    factory.moduleUrl = signalsmithLibraryURL;
    const creating = factory(context);
    // If cancelled/timed out before ready, dispose the late result too.
    let accepted = false;
    creating.then(node => { if (signal.aborted || generation !== deckPlaybackInfo.generation) void disposeNode(node); }, () => {});
    try {
      candidate = await timeLimitOrCancel(creating, signal, "Signalsmith preparation", 20000);
      accepted = true;
    } finally {
      if (!accepted) creating.then(node => void disposeNode(node), () => {});
    }
    candidate.onprocessorerror = () => {
      const error = new Error("Signalsmith processor failed. Reload the song.");
      if (generation !== deckPlaybackInfo.generation) return;
      if (deckPlaybackInfo.node === candidate) fail(deckPlaybackInfo, error);
      else controller.abort();
    };
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => new Float32Array(decoded.getChannelData(i)));
    await timeLimitOrCancel(candidate.addBuffers(channels, channels.map(channel => channel.buffer)), signal, "Signalsmith buffers");
    const latency = await timeLimitOrCancel(candidate.latency(), signal, "Signalsmith latency");
    if (!Number.isFinite(latency) || latency < 0) throw new Error("Invalid Signalsmith latency.");
    if (signal.aborted || generation !== deckPlaybackInfo.generation) throw new DOMException("Superseded load", "AbortError");
    const old = deckPlaybackInfo.node;
    candidate.connect(deckPlaybackInfo.gate);
    deckPlaybackInfo.node = candidate;
    deckPlaybackInfo.duration = decoded.duration;
    deckPlaybackInfo.latency = latency;
    deckPlaybackInfo.position = 0;
    deckPlaybackInfo.segment = null;
    deckPlaybackInfo.ended = false;
    deckPlaybackInfo.url = song.url;
    deckPlaybackInfo.loading = false;
    notify(deckPlaybackInfo, "loadedmetadata");
    notify(deckPlaybackInfo, "durationchange");
    await disposeNode(old);
    if (signal.aborted || generation !== deckPlaybackInfo.generation) throw new DOMException("Superseded load", "AbortError");
  } catch (error) {
    if (candidate && candidate !== deckPlaybackInfo.node) await disposeNode(candidate);
    if (generation === deckPlaybackInfo.generation) {
      controller.abort();
      deckPlaybackInfo.loading = false;
      fail(deckPlaybackInfo, error);
    }
    throw error;
  }
}

export async function startAudio(deckAudio) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  if (!deckPlaybackInfo.node || deckPlaybackInfo.loading) throw new Error("Load a song before pressing Play.");
  if (deckPlaybackInfo.error) throw deckPlaybackInfo.error;
  const action = ++deckPlaybackInfo.action;
  try {
    await timeLimitOrCancel(context.resume(), deckPlaybackInfo.controller.signal, "Audio context resume");
    if (action !== deckPlaybackInfo.action) throw new DOMException("Superseded Play", "AbortError");
    if (context.deckPlaybackInfo !== "running") throw new Error("Audio context did not resume. Tap Play again.");
    if (deckPlaybackInfo.position >= deckPlaybackInfo.duration) deckPlaybackInfo.position = 0;
    const when = context.currentTime + deckPlaybackInfo.latency;
    // schedule() sends its command immediately; its reply is only an acknowledgement.
    // Commit the matching clock and gate before waiting, so a delayed reply cannot
    // discard the opening audio. Later tempo commands now see this active segment.
    const scheduled = deckPlaybackInfo.node.schedule({ active: true, input: deckPlaybackInfo.position, output: when,
      rate: deckPlaybackInfo.rate, semitones: deckPlaybackInfo.pitch });
    deckPlaybackInfo.segment = { time: when, position: deckPlaybackInfo.position, rate: deckPlaybackInfo.rate };
    deckPlaybackInfo.playing = true;
    deckPlaybackInfo.ended = false;
    mute(deckPlaybackInfo);
    deckPlaybackInfo.gate.gain.setValueAtTime(0, when);
    deckPlaybackInfo.gate.gain.linearRampToValueAtTime(1, when + transportRampSeconds);
    scheduleEnd(deckPlaybackInfo);
    startClock(deckPlaybackInfo);
    await timeLimitOrCancel(scheduled, deckPlaybackInfo.controller.signal, "Signalsmith Play");
    if (action !== deckPlaybackInfo.action) throw new DOMException("Superseded Play", "AbortError");
  } catch (error) {
    if (action === deckPlaybackInfo.action) {
      deckPlaybackInfo.position = sourcePosition(deckPlaybackInfo);
      deckPlaybackInfo.playing = false;
      mute(deckPlaybackInfo);
      stopClock(deckPlaybackInfo);
    }
    throw error;
  }
}

export async function pauseAudio(deckAudio) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  ++deckPlaybackInfo.action;
  const now = context.currentTime;
  deckPlaybackInfo.position = sourcePosition(deckPlaybackInfo);
  deckPlaybackInfo.playing = false;
  stopClock(deckPlaybackInfo);
  mute(deckPlaybackInfo);
  if (deckPlaybackInfo.node) {
    const stopped = deckPlaybackInfo.node.schedule({ active: false, input: deckPlaybackInfo.position, output: now, semitones: deckPlaybackInfo.pitch });
    if (context.deckPlaybackInfo === "running") await timeLimitOrCancel(stopped, deckPlaybackInfo.controller.signal, "Signalsmith Pause");
  }
  notify(deckPlaybackInfo, "timeupdate");
}

export async function seekAudio(deckAudio, seconds) {
  if (!Number.isFinite(seconds)) throw new RangeError("Seek position must be finite source seconds.");
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  if (!deckPlaybackInfo.node || deckPlaybackInfo.loading) throw new Error("Load a song before seeking.");
  const wasPlaying = deckPlaybackInfo.playing;
  const generation = deckPlaybackInfo.generation;
  const paused = pauseAudio(deckAudio);
  const action = deckPlaybackInfo.action;
  await paused;
  if (generation !== deckPlaybackInfo.generation || action !== deckPlaybackInfo.action) throw new DOMException("Superseded seek", "AbortError");
  deckPlaybackInfo.position = Math.max(0, Math.min(deckPlaybackInfo.duration, seconds));
  deckPlaybackInfo.ended = false;
  if (wasPlaying && deckPlaybackInfo.position < deckPlaybackInfo.duration) await startAudio(deckAudio);
  notify(deckPlaybackInfo, "timeupdate");
}

// Schedule on the same node; never reload buffers for a slider movement. Source
// time is continuous at the old/new-rate boundary. The DSP response has latency.
async function changeProcessing(deckAudio, value, pitch) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  // Slider requests share a transport action, so only their latest reply may
  // fail that action. A newer Pause/Play also makes an old failure irrelevant.
  const processing = ++deckPlaybackInfo.processing;
  const action = deckPlaybackInfo.action;
  if (pitch) deckPlaybackInfo.pitch = value;
  else deckPlaybackInfo.rate = value;
  if (!deckPlaybackInfo.playing) return;
  const when = Math.max(context.currentTime, deckPlaybackInfo.segment.time);
  const position = sourcePosition(deckPlaybackInfo, when);
  deckPlaybackInfo.segment = { time: when, position, rate: deckPlaybackInfo.rate };
  scheduleEnd(deckPlaybackInfo);
  const node = deckPlaybackInfo.node;
  const generation = deckPlaybackInfo.generation, signal = deckPlaybackInfo.controller.signal;
  try {
    await timeLimitOrCancel(node.schedule({ active: true, input: position, output: when,
      rate: deckPlaybackInfo.rate, semitones: deckPlaybackInfo.pitch }), signal, "Signalsmith tempo/pitch");
  } catch (error) {
    if (deckPlaybackInfo.node === node && deckPlaybackInfo.generation === generation && deckPlaybackInfo.action === action &&
      deckPlaybackInfo.processing === processing && !signal.aborted) fail(deckPlaybackInfo, error);
    throw error;
  }
}

export function setAudioTempo(deckAudio, rate) {
  requireRange(rate, 0.5, 2, "Tempo ratio");
  return changeProcessing(deckAudio, rate, false);
}

export function setAudioPitch(deckAudio, semitones) {
  if (!Number.isFinite(semitones)) throw new RangeError("Pitch must be finite semitones.");
  return changeProcessing(deckAudio, semitones, true);
}

export async function ejectAudio(deckAudio) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  deckPlaybackInfo.controller?.abort();
  ++deckPlaybackInfo.generation;
  ++deckPlaybackInfo.action;
  mute(deckPlaybackInfo);
  stopClock(deckPlaybackInfo);
  const node = deckPlaybackInfo.node;
  deckPlaybackInfo.node = null;
  deckPlaybackInfo.position = deckPlaybackInfo.duration = 0;
  deckPlaybackInfo.segment = null;
  deckPlaybackInfo.playing = deckPlaybackInfo.loading = deckPlaybackInfo.ended = false;
  deckPlaybackInfo.error = null;
  deckPlaybackInfo.url = "";
  notify(deckPlaybackInfo, "emptied");
  await disposeNode(node);
}

// Local audio files are never modified or uploaded. Retain every loaded/queued URL.
export function createAudioFileURLs() {
  const objectURLs = new Set();
  return {
    create(file) {
      const url = URL.createObjectURL(file);
      objectURLs.add(url);
      return url;
    },
    releaseUnused(retainedURLs) {
      const retained = new Set(retainedURLs);
      for (const url of objectURLs) {
        if (!retained.has(url)) {
          URL.revokeObjectURL(url);
          objectURLs.delete(url);
        }
      }
    }
  };
}
