// Buffered Signalsmith transport. Visual/Behavior retain the same persistent
// EventTarget per deck; source-time getters/events replace native media clocks.
// See specs/controls-settings.md for timeline, cancellation and latency limits.
let context;
let libraryPromise;
const transports = new WeakMap();
const mainGains = new WeakMap();
const disposedNodes = new WeakSet();
const volumeRampSeconds = 0.015;
const transportRampSeconds = 0.004;
const moduleURL = new URL("../../vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs", import.meta.url).href;

function requireRange(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + " must be a number from " + min + " to " + max + ".");
  }
}

// Bound browser/worklet waits. Abandoned work may still finish; callers must
// check cancellation and dispose late nodes rather than committing stale loads.
async function waitFor(work, signal, label, milliseconds = 15000) {
  let timer, abort;
  try {
    return await Promise.race([work, new Promise((resolve, reject) => {
      abort = () => reject(new DOMException("Audio operation superseded.", "AbortError"));
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => reject(new Error(label + " timed out. Reload the song and retry.")), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function notify(state, type) {
  state.player.dispatchEvent(new Event(type));
}

function sourcePosition(state, time = context.currentTime) {
  const segment = state.segment;
  const position = state.playing && segment
    ? segment.position + Math.max(0, time - segment.time) * segment.rate : state.position;
  return Math.max(0, Math.min(state.duration, position));
}

function mute(state) {
  state.gate.gain.cancelScheduledValues(context.currentTime);
  state.gate.gain.setValueAtTime(0, context.currentTime);
  state.cutoff = null;
}

function stopClock(state) {
  clearInterval(state.timer);
  state.timer = null;
}

function fail(state, error) {
  state.position = sourcePosition(state);
  state.playing = false;
  state.error = error;
  ++state.action;
  mute(state);
  stopClock(state);
  notify(state, "error");
}

async function disposeNode(node) {
  if (!node || disposedNodes.has(node)) return;
  disposedNodes.add(node);
  node.onprocessorerror = null;
  try {
    // Free sample storage before closing the port, when the context is running.
    await waitFor(Promise.all([node.schedule({ active: false }), node.dropBuffers()]), null, "Audio cleanup", 2000);
  } catch {
    // Disconnection is still required after a failed processor or suspended clock.
    // This does not establish native/WASM memory reclamation on every browser.
  } finally {
    node.disconnect();
    node.port.onmessage = null;
    node.port.close();
  }
}

function scheduleEnd(state) {
  const now = context.currentTime;
  if (state.cutoff !== null) state.gate.gain.cancelScheduledValues(Math.max(now, state.cutoff));
  const segment = state.segment;
  // Retain the baseline's DSP-tail allowance; the position display is a planned
  // source coordinate, not proof of the exact sample currently at the speakers.
  state.cutoff = segment.time + (state.duration - segment.position) / segment.rate + state.latency;
  state.gate.gain.setValueAtTime(0, state.cutoff);
}

function startClock(state) {
  stopClock(state);
  state.timer = setInterval(() => {
    if (!state.playing) return;
    if (context.currentTime >= state.cutoff) {
      state.position = state.duration;
      state.playing = false;
      state.ended = true;
      mute(state);
      stopClock(state);
      const node = state.node;
      void waitFor(node.schedule({ active: false }), state.controller?.signal, "Audio end")
        .catch(error => { if (state.node === node && !state.playing) fail(state, error); });
      notify(state, "ended");
    }
    notify(state, "timeupdate");
  }, 50);
}

export function buildAudio() {
  context ??= new AudioContext();
  const player = new EventTarget();
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const gate = context.createGain();
  gate.gain.value = 0;
  gate.connect(gain);
  const state = { player, gate, node: null, controller: null, generation: 0, action: 0, processing: 0,
    loading: false, playing: false, ended: false, error: null, duration: 0,
    position: 0, segment: null, rate: 1, pitch: 0, latency: 0, url: "", timer: null, cutoff: null };
  transports.set(player, state);
  mainGains.set(player, { gain, ramp: { from: 0, to: 0, start: 0, end: 0 } });
  // Compatibility is limited to read-only media-style information and events.
  // Transport commands are the exported Audio functions, not fake HTML methods.
  Object.defineProperties(player, {
    currentTime: { get: () => sourcePosition(state) },
    duration: { get: () => state.duration },
    paused: { get: () => !state.playing },
    ended: { get: () => state.ended },
    readyState: { get: () => state.node && !state.loading ? 2 : 0 },
    src: { get: () => state.url },
    error: { get: () => state.error }
  });
  return player;
}

export function setAudioMainVolume(player, value) {
  requireRange(value, 0, 1, "Main volume");
  const path = mainGains.get(player), now = context.currentTime, previous = path.ramp;
  const fraction = previous.end > previous.start
    ? Math.max(0, Math.min(1, (now - previous.start) / (previous.end - previous.start))) : 1;
  const from = previous.from + (previous.to - previous.from) * fraction;
  path.gain.gain.cancelScheduledValues(now);
  path.gain.gain.setValueAtTime(from, now);
  path.gain.gain.linearRampToValueAtTime(value, now + volumeRampSeconds);
  path.ramp = { from, to: value, start: now, end: now + volumeRampSeconds };
}

export async function loadAudio(player, song) {
  const state = transports.get(player);
  state.controller?.abort();
  const controller = new AbortController(), signal = controller.signal;
  state.controller = controller;
  const generation = ++state.generation;
  ++state.action;
  state.position = sourcePosition(state);
  state.playing = false;
  state.loading = true;
  state.error = null;
  mute(state);
  stopClock(state);
  let candidate;
  try {
    if (!globalThis.isSecureContext || !context.audioWorklet) {
      throw new Error("Signalsmith requires HTTPS or localhost. Plain HTTP on an iPad LAN address is not supported.");
    }
    // Resume immediately in the Load gesture, before file reading or module import.
    await waitFor(context.resume(), signal, "Audio context resume");
    if (context.state !== "running") throw new Error("Audio context did not resume. Tap Load again.");
    if (state.node) await waitFor(state.node.schedule({ active: false, input: state.position }), signal, "Previous song pause");
    const response = await waitFor(fetch(song.url, { signal }), signal, "Audio file read", 30000);
    if (!response.ok) throw new Error("Audio file could not be read.");
    const bytes = await waitFor(response.arrayBuffer(), signal, "Audio file read", 30000);
    const decoded = await waitFor(context.decodeAudioData(bytes), signal, "Audio decode", 60000);
    if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) throw new Error("Load a mono or stereo audio file.");
    libraryPromise ??= import(moduleURL).catch(error => { libraryPromise = null; throw error; });
    const { default: factory } = await waitFor(libraryPromise, signal, "Signalsmith import");
    factory.moduleUrl = moduleURL;
    const creating = factory(context);
    // If cancelled/timed out before ready, dispose the late result too.
    let accepted = false;
    creating.then(node => { if (signal.aborted || generation !== state.generation) void disposeNode(node); }, () => {});
    try {
      candidate = await waitFor(creating, signal, "Signalsmith preparation", 20000);
      accepted = true;
    } finally {
      if (!accepted) creating.then(node => void disposeNode(node), () => {});
    }
    candidate.onprocessorerror = () => {
      const error = new Error("Signalsmith processor failed. Reload the song.");
      if (generation !== state.generation) return;
      if (state.node === candidate) fail(state, error);
      else controller.abort();
    };
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => new Float32Array(decoded.getChannelData(i)));
    await waitFor(candidate.addBuffers(channels, channels.map(channel => channel.buffer)), signal, "Signalsmith buffers");
    const latency = await waitFor(candidate.latency(), signal, "Signalsmith latency");
    if (!Number.isFinite(latency) || latency < 0) throw new Error("Invalid Signalsmith latency.");
    if (signal.aborted || generation !== state.generation) throw new DOMException("Superseded load", "AbortError");
    const old = state.node;
    candidate.connect(state.gate);
    state.node = candidate;
    state.duration = decoded.duration;
    state.latency = latency;
    state.position = 0;
    state.segment = null;
    state.ended = false;
    state.url = song.url;
    state.loading = false;
    notify(state, "loadedmetadata");
    notify(state, "durationchange");
    await disposeNode(old);
    if (signal.aborted || generation !== state.generation) throw new DOMException("Superseded load", "AbortError");
  } catch (error) {
    if (candidate && candidate !== state.node) await disposeNode(candidate);
    if (generation === state.generation) {
      controller.abort();
      state.loading = false;
      fail(state, error);
    }
    throw error;
  }
}

export async function startAudio(player) {
  const state = transports.get(player);
  if (!state.node || state.loading) throw new Error("Load a song before pressing Play.");
  if (state.error) throw state.error;
  const action = ++state.action;
  try {
    await waitFor(context.resume(), state.controller.signal, "Audio context resume");
    if (action !== state.action) throw new DOMException("Superseded Play", "AbortError");
    if (context.state !== "running") throw new Error("Audio context did not resume. Tap Play again.");
    if (state.position >= state.duration) state.position = 0;
    const when = context.currentTime + state.latency;
    // schedule() sends its command immediately; its reply is only an acknowledgement.
    // Commit the matching clock and gate before waiting, so a delayed reply cannot
    // discard the opening audio. Later tempo commands now see this active segment.
    const scheduled = state.node.schedule({ active: true, input: state.position, output: when,
      rate: state.rate, semitones: state.pitch });
    state.segment = { time: when, position: state.position, rate: state.rate };
    state.playing = true;
    state.ended = false;
    mute(state);
    state.gate.gain.setValueAtTime(0, when);
    state.gate.gain.linearRampToValueAtTime(1, when + transportRampSeconds);
    scheduleEnd(state);
    startClock(state);
    await waitFor(scheduled, state.controller.signal, "Signalsmith Play");
    if (action !== state.action) throw new DOMException("Superseded Play", "AbortError");
  } catch (error) {
    if (action === state.action) {
      state.position = sourcePosition(state);
      state.playing = false;
      mute(state);
      stopClock(state);
    }
    throw error;
  }
}

export async function pauseAudio(player) {
  const state = transports.get(player);
  ++state.action;
  const now = context.currentTime;
  state.position = sourcePosition(state);
  state.playing = false;
  stopClock(state);
  mute(state);
  if (state.node) {
    const stopped = state.node.schedule({ active: false, input: state.position, output: now, semitones: state.pitch });
    if (context.state === "running") await waitFor(stopped, state.controller.signal, "Signalsmith Pause");
  }
  notify(state, "timeupdate");
}

export async function seekAudio(player, seconds) {
  if (!Number.isFinite(seconds)) throw new RangeError("Seek position must be finite source seconds.");
  const state = transports.get(player);
  if (!state.node || state.loading) throw new Error("Load a song before seeking.");
  const wasPlaying = state.playing;
  const generation = state.generation;
  const paused = pauseAudio(player);
  const action = state.action;
  await paused;
  if (generation !== state.generation || action !== state.action) throw new DOMException("Superseded seek", "AbortError");
  state.position = Math.max(0, Math.min(state.duration, seconds));
  state.ended = false;
  if (wasPlaying && state.position < state.duration) await startAudio(player);
  notify(state, "timeupdate");
}

// Schedule on the same node; never reload buffers for a slider movement. Source
// time is continuous at the old/new-rate boundary. The DSP response has latency.
async function changeProcessing(player, value, pitch) {
  const state = transports.get(player);
  // Slider requests share a transport action, so only their latest reply may
  // fail that action. A newer Pause/Play also makes an old failure irrelevant.
  const processing = ++state.processing;
  const action = state.action;
  if (pitch) state.pitch = value;
  else state.rate = value;
  if (!state.playing) return;
  const when = Math.max(context.currentTime, state.segment.time);
  const position = sourcePosition(state, when);
  state.segment = { time: when, position, rate: state.rate };
  scheduleEnd(state);
  const node = state.node;
  const generation = state.generation, signal = state.controller.signal;
  try {
    await waitFor(node.schedule({ active: true, input: position, output: when,
      rate: state.rate, semitones: state.pitch }), signal, "Signalsmith tempo/pitch");
  } catch (error) {
    if (state.node === node && state.generation === generation && state.action === action &&
      state.processing === processing && !signal.aborted) fail(state, error);
    throw error;
  }
}

export function setAudioTempo(player, rate) {
  requireRange(rate, 0.5, 2, "Tempo ratio");
  return changeProcessing(player, rate, false);
}

export function setAudioPitch(player, semitones) {
  if (!Number.isFinite(semitones)) throw new RangeError("Pitch must be finite semitones.");
  return changeProcessing(player, semitones, true);
}

export async function ejectAudio(player) {
  const state = transports.get(player);
  state.controller?.abort();
  ++state.generation;
  ++state.action;
  mute(state);
  stopClock(state);
  const node = state.node;
  state.node = null;
  state.position = state.duration = 0;
  state.segment = null;
  state.playing = state.loading = state.ended = false;
  state.error = null;
  state.url = "";
  notify(state, "emptied");
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
