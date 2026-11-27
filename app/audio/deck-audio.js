import { analyzeFrequencyEnergy } from "./analysis/frequency-energy.js";
import { summarizeOverviewWaveform } from "./waveform/overview-waveform.js";
import { summarizeScrollingWaveform } from "./waveform/scrolling-waveform.js";
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

function findSongPosition(deckPlaybackInfo, instant = context.currentTime) {
  const playbackReferencePoint = deckPlaybackInfo.playbackReferencePoint;
  const songPosition = deckPlaybackInfo.playing && playbackReferencePoint
    ? playbackReferencePoint.songPosition + Math.max(0, instant - playbackReferencePoint.instant) * playbackReferencePoint.rate : deckPlaybackInfo.songPosition;
  return Math.max(0, Math.min(deckPlaybackInfo.duration, songPosition));
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
  deckPlaybackInfo.songPosition = findSongPosition(deckPlaybackInfo);
  deckPlaybackInfo.playing = false;
  deckPlaybackInfo.error = error;
  ++deckPlaybackInfo.latestDeckActionNumber;
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
  const playbackReferencePoint = deckPlaybackInfo.playbackReferencePoint;
  // Retain the baseline's DSP-tail allowance; the position display is a planned
  // source coordinate, not proof of the exact sample currently at the speakers.
  deckPlaybackInfo.cutoff = playbackReferencePoint.instant + (deckPlaybackInfo.duration - playbackReferencePoint.songPosition) / playbackReferencePoint.rate + deckPlaybackInfo.latency;
  deckPlaybackInfo.gate.gain.setValueAtTime(0, deckPlaybackInfo.cutoff);
}

function startClock(deckPlaybackInfo) {
  stopClock(deckPlaybackInfo);
  deckPlaybackInfo.timer = setInterval(() => {
    if (!deckPlaybackInfo.playing) return;
    if (context.currentTime >= deckPlaybackInfo.cutoff) {
      deckPlaybackInfo.songPosition = deckPlaybackInfo.duration;
      deckPlaybackInfo.playing = false;
      deckPlaybackInfo.ended = true;
      mute(deckPlaybackInfo);
      stopClock(deckPlaybackInfo);
      const node = deckPlaybackInfo.node;
      const action = deckPlaybackInfo.latestDeckActionNumber;
      void timeLimitOrCancel(node.schedule({ active: false }), deckPlaybackInfo.thisSongLoadingCanBeStopped?.signal, "Audio end")
        .catch(error => {
          // A later paused seek still uses this node, but supersedes this stop.
          if (deckPlaybackInfo.node === node && deckPlaybackInfo.latestDeckActionNumber === action && !deckPlaybackInfo.playing)
            fail(deckPlaybackInfo, error);
        });
      notify(deckPlaybackInfo, "ended");
    }
    notify(deckPlaybackInfo, "timeupdate");
  }, 50);
}

export function buildAudio() {
  context ??= new AudioContext();
  const deckAudio = new EventTarget();
  const mainVolumeGain = context.createGain();
  mainVolumeGain.gain.value = 0;
  mainVolumeGain.connect(context.destination);
  const gate = context.createGain();
  gate.gain.value = 0;
  gate.connect(mainVolumeGain);
  const deckPlaybackInfo = { deckAudio, gate, node: null, thisSongLoadingCanBeStopped: null, latestReplaceOrRemoveNumber: 0, latestDeckActionNumber: 0, latestTempoOrPitchChangeNumber: 0,
    replacementLoadingCanBeStopped: null,
    loading: false, playing: false, ended: false, error: null, duration: 0, waveformPeaks: null, scrollingWaveform: null, frequencyEnergy: null,
    songPosition: 0, playbackReferencePoint: null, rate: 1, pitch: 0, latency: 0, url: "", timer: null, cutoff: null };
  deckAudioStates.set(deckAudio, deckPlaybackInfo);
  mainVolumes.set(deckAudio, { gain: mainVolumeGain, ramp: { from: 0, to: 0, start: 0, end: 0 } });
  // Compatibility is limited to read-only media-style information and events.
  // Transport commands are the exported Audio functions, not fake HTML methods.
  Object.defineProperties(deckAudio, {
    currentTime: { get: () => findSongPosition(deckPlaybackInfo) },
    duration: { get: () => deckPlaybackInfo.duration },
    paused: { get: () => !deckPlaybackInfo.playing },
    ended: { get: () => deckPlaybackInfo.ended },
    readyState: { get: () => deckPlaybackInfo.node && !deckPlaybackInfo.loading ? 2 : 0 },
    src: { get: () => deckPlaybackInfo.url },
    error: { get: () => deckPlaybackInfo.error },
    waveformPeaks: { get: () => deckPlaybackInfo.waveformPeaks },
    scrollingWaveform: { get: () => deckPlaybackInfo.scrollingWaveform },
    frequencyEnergy: { get: () => deckPlaybackInfo.frequencyEnergy }
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

export async function loadAudio(deckAudio, song, { preservePlayback = false } = {}) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  deckPlaybackInfo.replacementLoadingCanBeStopped?.abort();
  // A new load supersedes an earlier loading attempt on this deck.
  if (!preservePlayback && deckPlaybackInfo.thisSongLoadingCanBeStopped) {
    deckPlaybackInfo.thisSongLoadingCanBeStopped.abort();
  }
  // Save a way for a later load to stop this loading attempt.
  const thisSongLoadingCanBeStopped = new AbortController();
  const signal = thisSongLoadingCanBeStopped.signal;
  deckPlaybackInfo.replacementLoadingCanBeStopped = thisSongLoadingCanBeStopped;
  if (!preservePlayback) deckPlaybackInfo.thisSongLoadingCanBeStopped = thisSongLoadingCanBeStopped;
  const latestReplaceOrRemoveNumber = ++deckPlaybackInfo.latestReplaceOrRemoveNumber;
  if (!preservePlayback) {
    ++deckPlaybackInfo.latestDeckActionNumber;
    deckPlaybackInfo.songPosition = findSongPosition(deckPlaybackInfo);
    deckPlaybackInfo.playing = false;
    deckPlaybackInfo.loading = true;
    deckPlaybackInfo.error = null;
    mute(deckPlaybackInfo);
    stopClock(deckPlaybackInfo);
  }
  let newSongAudioProcessor;
  try {
    if (!globalThis.isSecureContext || !context.audioWorklet) {
      throw new Error("Signalsmith requires HTTPS or localhost. Plain HTTP on an iPad LAN address is not supported.");
    }
    // Resume immediately in the Load gesture, before file reading or module import.
    await timeLimitOrCancel(context.resume(), signal, "Audio context resume");
    if (context.state !== "running") throw new Error("Audio context did not resume. Tap Load again.");
    if (!preservePlayback && deckPlaybackInfo.node) await timeLimitOrCancel(deckPlaybackInfo.node.schedule({ active: false, input: deckPlaybackInfo.songPosition }), signal, "Previous song pause");
    const response = await timeLimitOrCancel(fetch(song.url, { signal }), signal, "Audio file read", 30000);
    if (!response.ok) throw new Error("Audio file could not be read.");
    const bytes = await timeLimitOrCancel(response.arrayBuffer(), signal, "Audio file read", 30000);
    const decodedSongAudio = await timeLimitOrCancel(context.decodeAudioData(bytes), signal, "Audio decode", 60000);
    if (decodedSongAudio.numberOfChannels < 1 || decodedSongAudio.numberOfChannels > 2) throw new Error("Load a mono or stereo audio file.");
    signalsmithLoadingPromise ??= import(signalsmithLibraryURL).catch(error => { signalsmithLoadingPromise = null; throw error; });
    const { default: createSignalsmithProcessor } = await timeLimitOrCancel(signalsmithLoadingPromise, signal, "Signalsmith import");
    createSignalsmithProcessor.moduleUrl = signalsmithLibraryURL;
    const creating = createSignalsmithProcessor(context);
    // If cancelled/timed out before ready, dispose the late result too.
    let accepted = false;
    creating.then(node => { if (signal.aborted || latestReplaceOrRemoveNumber !== deckPlaybackInfo.latestReplaceOrRemoveNumber) void disposeNode(node); }, () => {});
    try {
      newSongAudioProcessor = await timeLimitOrCancel(creating, signal, "Signalsmith preparation", 20000);
      accepted = true;
    } finally {
      if (!accepted) creating.then(node => void disposeNode(node), () => {});
    }
    newSongAudioProcessor.onprocessorerror = () => {
      const error = new Error("Signalsmith processor failed. Reload the song.");
      if (deckPlaybackInfo.node === newSongAudioProcessor) fail(deckPlaybackInfo, error);
      else if (latestReplaceOrRemoveNumber === deckPlaybackInfo.latestReplaceOrRemoveNumber) thisSongLoadingCanBeStopped.abort();
    };
    const channels = Array.from({ length: decodedSongAudio.numberOfChannels }, (_, i) => new Float32Array(decodedSongAudio.getChannelData(i)));
    await timeLimitOrCancel(newSongAudioProcessor.addBuffers(channels, channels.map(channel => channel.buffer)), signal, "Signalsmith buffers");
    const latency = await timeLimitOrCancel(newSongAudioProcessor.latency(), signal, "Signalsmith latency");
    if (!Number.isFinite(latency) || latency < 0) throw new Error("Invalid Signalsmith latency.");
    const waveformPeaks = summarizeOverviewWaveform(decodedSongAudio);
    const scrollingWaveform = summarizeScrollingWaveform(decodedSongAudio);
    const frequencyEnergy = await analyzeFrequencyEnergy(decodedSongAudio, scrollingWaveform, signal);
    if (signal.aborted || latestReplaceOrRemoveNumber !== deckPlaybackInfo.latestReplaceOrRemoveNumber) throw new DOMException("Superseded load", "AbortError");
    const previousSongAudioProcessor = deckPlaybackInfo.node;
    newSongAudioProcessor.connect(deckPlaybackInfo.gate);
    if (preservePlayback) {
      // The old transport runs throughout decode/preparation. Mute only at the
      // accepted replacement boundary; failed candidates leave it untouched.
      deckPlaybackInfo.thisSongLoadingCanBeStopped?.abort();
      ++deckPlaybackInfo.latestDeckActionNumber;
      deckPlaybackInfo.playing = false;
      mute(deckPlaybackInfo);
      stopClock(deckPlaybackInfo);
      deckPlaybackInfo.thisSongLoadingCanBeStopped = thisSongLoadingCanBeStopped;
      deckPlaybackInfo.error = null;
    }
    deckPlaybackInfo.node = newSongAudioProcessor;
    deckPlaybackInfo.duration = decodedSongAudio.duration;
    deckPlaybackInfo.waveformPeaks = waveformPeaks;
    deckPlaybackInfo.scrollingWaveform = scrollingWaveform;
    deckPlaybackInfo.frequencyEnergy = frequencyEnergy;
    deckPlaybackInfo.latency = latency;
    deckPlaybackInfo.songPosition = 0;
    deckPlaybackInfo.playbackReferencePoint = null;
    deckPlaybackInfo.ended = false;
    deckPlaybackInfo.url = song.url;
    deckPlaybackInfo.loading = false;
    notify(deckPlaybackInfo, "loadedmetadata");
    notify(deckPlaybackInfo, "durationchange");
    // Cleanup acknowledgement must not delay the replacement's Play. Disconnect
    // the outgoing node now; its bounded buffer/port disposal finishes separately.
    if (preservePlayback) {
      previousSongAudioProcessor?.disconnect();
      void disposeNode(previousSongAudioProcessor);
    } else await disposeNode(previousSongAudioProcessor);
    if (signal.aborted || latestReplaceOrRemoveNumber !== deckPlaybackInfo.latestReplaceOrRemoveNumber) throw new DOMException("Superseded load", "AbortError");
  } catch (error) {
    if (newSongAudioProcessor && newSongAudioProcessor !== deckPlaybackInfo.node) await disposeNode(newSongAudioProcessor);
    if (latestReplaceOrRemoveNumber === deckPlaybackInfo.latestReplaceOrRemoveNumber) {
      thisSongLoadingCanBeStopped.abort();
      deckPlaybackInfo.loading = false;
      if (!preservePlayback || deckPlaybackInfo.node === newSongAudioProcessor) fail(deckPlaybackInfo, error);
    }
    throw error;
  } finally {
    if (deckPlaybackInfo.replacementLoadingCanBeStopped === thisSongLoadingCanBeStopped)
      deckPlaybackInfo.replacementLoadingCanBeStopped = null;
  }
}

export async function startAudio(deckAudio) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  if (!deckPlaybackInfo.node || deckPlaybackInfo.loading) throw new Error("Load a song before pressing Play.");
  if (deckPlaybackInfo.error) throw deckPlaybackInfo.error;
  const latestDeckActionNumber = ++deckPlaybackInfo.latestDeckActionNumber;
  try {
    await timeLimitOrCancel(context.resume(), deckPlaybackInfo.thisSongLoadingCanBeStopped.signal, "Audio context resume");
    if (latestDeckActionNumber !== deckPlaybackInfo.latestDeckActionNumber) throw new DOMException("Superseded Play", "AbortError");
    if (context.state !== "running") throw new Error("Audio context did not resume. Tap Play again.");
    if (deckPlaybackInfo.songPosition >= deckPlaybackInfo.duration) deckPlaybackInfo.songPosition = 0;
    const when = context.currentTime + deckPlaybackInfo.latency;
    // schedule() sends its command immediately; its reply is only an acknowledgement.
    // Commit the matching clock and gate before waiting, so a delayed reply cannot
    // discard the opening audio. Later tempo commands now see this active playback reference point.
    const scheduled = deckPlaybackInfo.node.schedule({ active: true, input: deckPlaybackInfo.songPosition, output: when,
      rate: deckPlaybackInfo.rate, semitones: deckPlaybackInfo.pitch });
    deckPlaybackInfo.playbackReferencePoint = { instant: when, songPosition: deckPlaybackInfo.songPosition, rate: deckPlaybackInfo.rate };
    deckPlaybackInfo.playing = true;
    deckPlaybackInfo.ended = false;
    mute(deckPlaybackInfo);
    deckPlaybackInfo.gate.gain.setValueAtTime(0, when);
    deckPlaybackInfo.gate.gain.linearRampToValueAtTime(1, when + transportRampSeconds);
    scheduleEnd(deckPlaybackInfo);
    startClock(deckPlaybackInfo);
    await timeLimitOrCancel(scheduled, deckPlaybackInfo.thisSongLoadingCanBeStopped.signal, "Signalsmith Play");
    if (latestDeckActionNumber !== deckPlaybackInfo.latestDeckActionNumber) throw new DOMException("Superseded Play", "AbortError");
  } catch (error) {
    if (latestDeckActionNumber === deckPlaybackInfo.latestDeckActionNumber) {
      deckPlaybackInfo.songPosition = findSongPosition(deckPlaybackInfo);
      deckPlaybackInfo.playing = false;
      mute(deckPlaybackInfo);
      stopClock(deckPlaybackInfo);
    }
    throw error;
  }
}

export async function pauseAudio(deckAudio) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  ++deckPlaybackInfo.latestDeckActionNumber;
  const now = context.currentTime;
  deckPlaybackInfo.songPosition = findSongPosition(deckPlaybackInfo);
  deckPlaybackInfo.playing = false;
  stopClock(deckPlaybackInfo);
  mute(deckPlaybackInfo);
  if (deckPlaybackInfo.node) {
    const stopped = deckPlaybackInfo.node.schedule({ active: false, input: deckPlaybackInfo.songPosition, output: now, semitones: deckPlaybackInfo.pitch });
    if (context.state === "running") await timeLimitOrCancel(stopped, deckPlaybackInfo.thisSongLoadingCanBeStopped.signal, "Signalsmith Pause");
  }
  notify(deckPlaybackInfo, "timeupdate");
}

export async function seekAudio(deckAudio, seconds) {
  if (!Number.isFinite(seconds)) throw new RangeError("Seek position must be finite source seconds.");
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  if (!deckPlaybackInfo.node || deckPlaybackInfo.loading) throw new Error("Load a song before seeking.");
  const wasPlaying = deckPlaybackInfo.playing;
  const latestReplaceOrRemoveNumber = deckPlaybackInfo.latestReplaceOrRemoveNumber;
  const paused = pauseAudio(deckAudio);
  const latestDeckActionNumber = deckPlaybackInfo.latestDeckActionNumber;
  await paused;
  if (latestReplaceOrRemoveNumber !== deckPlaybackInfo.latestReplaceOrRemoveNumber || latestDeckActionNumber !== deckPlaybackInfo.latestDeckActionNumber) throw new DOMException("Superseded seek", "AbortError");
  deckPlaybackInfo.songPosition = Math.max(0, Math.min(deckPlaybackInfo.duration, seconds));
  deckPlaybackInfo.ended = false;
  if (wasPlaying && deckPlaybackInfo.songPosition < deckPlaybackInfo.duration) await startAudio(deckAudio);
  notify(deckPlaybackInfo, "timeupdate");
}

// Schedule on the same node; never reload buffers for a slider movement. Source
// time is continuous at the old-rate/new-rate boundary. The DSP response has latency.
async function changeTempoOrPitch(deckAudio, value, pitch) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  // Slider requests share a transport action number, so only their latest reply may
  // fail that action. A newer Pause/Play also makes an older request's failure irrelevant.
  const latestTempoOrPitchChangeNumber = ++deckPlaybackInfo.latestTempoOrPitchChangeNumber;
  const latestDeckActionNumber = deckPlaybackInfo.latestDeckActionNumber;
  if (pitch) deckPlaybackInfo.pitch = value;
  else deckPlaybackInfo.rate = value;
  if (!deckPlaybackInfo.playing) return;
  const when = Math.max(context.currentTime, deckPlaybackInfo.playbackReferencePoint.instant);
  const songPosition = findSongPosition(deckPlaybackInfo, when);
  deckPlaybackInfo.playbackReferencePoint = { instant: when, songPosition, rate: deckPlaybackInfo.rate };
  scheduleEnd(deckPlaybackInfo);
  const node = deckPlaybackInfo.node;
  const latestReplaceOrRemoveNumber = deckPlaybackInfo.latestReplaceOrRemoveNumber, signal = deckPlaybackInfo.thisSongLoadingCanBeStopped.signal;
  try {
    await timeLimitOrCancel(node.schedule({ active: true, input: songPosition, output: when,
      rate: deckPlaybackInfo.rate, semitones: deckPlaybackInfo.pitch }), signal, "Signalsmith tempo/pitch");
  } catch (error) {
    if (deckPlaybackInfo.node === node && deckPlaybackInfo.latestReplaceOrRemoveNumber === latestReplaceOrRemoveNumber && deckPlaybackInfo.latestDeckActionNumber === latestDeckActionNumber &&
      deckPlaybackInfo.latestTempoOrPitchChangeNumber === latestTempoOrPitchChangeNumber && !signal.aborted) fail(deckPlaybackInfo, error);
    throw error;
  }
}

// Effective rate includes a temporary Behavior nudge: established .5–2 times
// a .5–1.5 multiplier. This uses the same pitch-preserving node and clock path.
export function setAudioPlaybackRate(deckAudio, rate) {
  // Tempo ranges from 0.5 to 2 times the original speed.
  // Nudging can decrease or increase that tempo by up to 50%.
  // Minimum combined rate: 0.5 × 0.5 = 0.25.
  // Maximum combined rate: 2 × 1.5 = 3.
  requireRange(rate, 0.25, 3, "Effective playback rate");
  return changeTempoOrPitch(deckAudio, rate, false);
}

export function setAudioTempo(deckAudio, rate) {
  requireRange(rate, 0.5, 2, "Tempo ratio");
  return changeTempoOrPitch(deckAudio, rate, false);
}

export function setAudioPitch(deckAudio, semitones) {
  if (!Number.isFinite(semitones)) throw new RangeError("Pitch must be finite semitones.");
  return changeTempoOrPitch(deckAudio, semitones, true);
}

export async function ejectAudio(deckAudio) {
  const deckPlaybackInfo = deckAudioStates.get(deckAudio);
  deckPlaybackInfo.replacementLoadingCanBeStopped?.abort();
  deckPlaybackInfo.thisSongLoadingCanBeStopped?.abort();
  ++deckPlaybackInfo.latestReplaceOrRemoveNumber;
  ++deckPlaybackInfo.latestDeckActionNumber;
  mute(deckPlaybackInfo);
  stopClock(deckPlaybackInfo);
  const node = deckPlaybackInfo.node;
  deckPlaybackInfo.node = null;
  deckPlaybackInfo.songPosition = deckPlaybackInfo.duration = 0;
  deckPlaybackInfo.waveformPeaks = null;
  deckPlaybackInfo.scrollingWaveform = null;
  deckPlaybackInfo.frequencyEnergy = null;
  deckPlaybackInfo.playbackReferencePoint = null;
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
