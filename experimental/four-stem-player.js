// Isolated native playback. No application state, stretching or handoff integration.
const prototypeStemNames = Object.freeze(['transients', 'flow', 'tune', 'voice']);

function validateStemBuffers(buffers) {
  const reference = buffers.transients;
  for (const name of prototypeStemNames) {
    const buffer = buffers[name];
    if (!buffer || !Number.isInteger(buffer.length) || buffer.length <= 0 ||
        !Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0 ||
        ![1, 2].includes(buffer.numberOfChannels)) {
      throw new Error(name + ': expected nonempty mono or stereo audio.');
    }
    if (buffer.length !== reference.length || buffer.sampleRate !== reference.sampleRate) {
      throw new Error(name + ': stems must have identical decoded frame counts and sample rates. Export aligned files; no trimming is performed.');
    }
  }
}

function createFourStemPlayer(createContext = () => new AudioContext(), options = {}) {
  let context = null, buffers = null, loading = false, closed = false;
  let loadVersion = 0, command = 0, session = null, position = 0;
  const levels = Object.fromEntries(prototypeStemNames.map(name => [name, 1]));
  const smoothingSeconds = 0.010;
  let mainVolume = 1;
  const getContext = () => {
    if (closed) throw new Error('Player is closed. Reload the page to create another.');
    if (!context) context = createContext();
    return context;
  };
  function getPosition() {
    return session ? Math.min(buffers.transients.duration,
      position + Math.max(0, context.currentTime - session.startedAt)) : position;
  }
  function disconnect(current) {
    if (!current) return;
    for (const path of Object.values(current.paths)) {
      path.source.onended = null;
      try { path.source.stop(); } catch (_) { /* Already ended or not started. */ }
      path.source.disconnect();
      if (path.gain) path.gain.disconnect();
    }
    current.volume?.gain.disconnect();
    current.transport?.disconnect();
  }
  function pause() {
    ++command;
    position = getPosition();
    const old = session; session = null;
    disconnect(old);
  }
  function stop() { pause(); position = 0; }
  function eject() {
    ++loadVersion;
    stop(); buffers = null; loading = false;
  }
  async function loadFiles(files) {
    // Resume from the explicit Load gesture, before asynchronous reads/decodes (Safari).
    for (const name of prototypeStemNames) {
      if (!files || !files[name] || typeof files[name].arrayBuffer !== 'function') {
        throw new Error('Select a local file for ' + name + '.');
      }
    }
    const audio = getContext();
    const resumed = audio.resume();
    const version = ++loadVersion;
    stop(); loading = true;
    try {
      await resumed;
      if (version !== loadVersion || closed) return false;
      if (audio.state !== 'running') throw new Error('AudioContext is not running. Click Load again.');
      const candidate = {};
      // Decode sequentially to avoid four simultaneous encoded-file allocations.
      for (const name of prototypeStemNames) {
        try {
          const bytes = await files[name].arrayBuffer();
          if (version !== loadVersion || closed) return false;
          candidate[name] = await audio.decodeAudioData(bytes);
        } catch (error) {
          if (version !== loadVersion || closed) return false;
          throw new Error(name + ': could not decode audio. ' + error.message);
        }
        if (version !== loadVersion || closed) return false;
      }
      validateStemBuffers(candidate);
      buffers = candidate; position = 0;
      return true;
    } finally { if (version === loadVersion) loading = false; }
  }
  async function play() {
    if (closed || loading || !buffers || session) return false;
    const audio = getContext(), token = ++command;
    await audio.resume();
    if (token !== command || closed || loading || session || !buffers) return false;
    if (audio.state !== 'running') throw new Error('AudioContext is not running. Click Play again.');
    if (position >= buffers.transients.duration) position = 0;
    const current = { paths: {}, startedAt: 0, remaining: 4 };
    try {
      for (const name of prototypeStemNames) {
        const source = audio.createBufferSource();
        current.paths[name] = { source, gain: null, ramp: null };
        const gain = audio.createGain();
        current.paths[name].gain = gain;
        source.buffer = buffers[name];
        gain.gain.setValueAtTime(levels[name], audio.currentTime);
        source.connect(gain);
        source.onended = () => {
          if (session !== current) return;
          if (--current.remaining === 0) {
            position = buffers.transients.duration; session = null; disconnect(current);
          }
        };
      }
      // Transport gating is separate from musical stem and main-volume gains.
      current.volume = { gain: audio.createGain(), ramp: null };
      current.transport = audio.createGain();
      current.volume.gain.gain.setValueAtTime(mainVolume, audio.currentTime);
      current.transport.gain.setValueAtTime(1, audio.currentTime);
      for (const path of Object.values(current.paths)) path.gain.connect(current.volume.gain);
      current.volume.gain.connect(current.transport);
      current.transport.connect(audio.destination);
      // One future render quantum gives all four native starts the same clock boundary.
      current.startedAt = audio.currentTime + 128 / audio.sampleRate;
      for (const path of Object.values(current.paths)) path.source.start(current.startedAt, position);
      session = current;
      return true;
    } catch (error) { disconnect(current); throw error; }
  }
  function setStemLevel(name, value, when) {
    if (closed) throw new Error('Player is closed.');
    if (!prototypeStemNames.includes(name) || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Expected a known stem and a finite level from 0 to 1.');
    }
    const path = session?.paths[name];
    if (path) rampGain(path, levels[name], value, when);
    levels[name] = value;
  }
  function rampGain(path, previousTarget, value, when = context.currentTime) {
    const now = when, ramp = path.ramp;
    const from = ramp ? (now >= ramp.end ? ramp.target :
      ramp.from + (ramp.target - ramp.from) * Math.max(0, (now - ramp.start) / (ramp.end - ramp.start))) : previousTarget;
    const parameter = path.gain.gain;
    parameter.cancelScheduledValues(now);
    // For future batch times, retain the unfinished segment whose endpoint was cancelled.
    // A setValue alone would replace that segment with a hold followed by a step.
    if (ramp && now > ramp.start && now < ramp.end) parameter.linearRampToValueAtTime(from, now);
    parameter.setValueAtTime(from, now);
    parameter.linearRampToValueAtTime(value, now + smoothingSeconds);
    path.ramp = { start: now, end: now + smoothingSeconds, from, target: value };
  }
  function setMainVolume(value, when) {
    if (closed || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('Expected an open player and volume from 0 to 1.');
    if (session) rampGain(session.volume, mainVolume, value, when);
    mainVolume = value;
  }
  async function close() {
    if (closed) return;
    eject(); closed = true;
    if (options.ownsContext !== false && context && context.state !== 'closed') await context.close();
  }
  return Object.freeze({ loadFiles, play, pause, stop, eject, close, setStemLevel, setMainVolume,
    getState: () => ({ loaded: !!buffers, loading, closed, isPlaying: !!session,
      position: getPosition(), duration: buffers?.transients.duration || 0,
      levels: { ...levels }, mainVolume, contextState: context?.state || 'uncreated', smoothingSeconds }) });
}

// One owner for a fixed set of native decks; per-deck players retire only their own graphs.
function createNativeStemMixer(createContext = () => new AudioContext(), ids = [1, 2, 3, 4]) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isInteger(id) || id < 1 || id > 4)) throw new Error('Expected distinct deck IDs from 1 to 4.');
  const deckIds = Object.freeze([...ids]);
  let context = null, closed = false, closing = null;
  function sharedContext() {
    if (closed) throw new Error('Native stem mixer is closed.');
    if (!context) context = createContext();
    return context;
  }
  const decks = Object.freeze(deckIds.map(() => createFourStemPlayer(sharedContext, { ownsContext: false })));
  function getDeck(id) {
    if (!deckIds.includes(id)) throw new Error('Deck is not owned by this native mixer.');
    return decks[deckIds.indexOf(id)];
  }
  function applyGainSnapshot(snapshot) {
    if (closed) throw new Error('Native stem mixer is closed.');
    // Validate the entire batch before scheduling any AudioParam changes.
    for (const id of deckIds) {
      const target = snapshot[id];
      if (!target || getDeck(id).getState().closed) throw new Error('Gain target/deck unavailable.');
      for (const value of [target.mainVolume, ...prototypeStemNames.map(name => target.levels?.[name])]) {
        if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid gain snapshot.');
      }
    }
    // A shared future boundary keeps the whole batch ahead of rendering. No context is
    // created by state changes; initial targets are retained until explicit Load/Play.
    const when = context ? context.currentTime + 128 / context.sampleRate : undefined;
    for (const id of deckIds) {
      const deck = getDeck(id), previous = deck.getState(), target = snapshot[id];
      for (const name of prototypeStemNames) {
        if (previous.levels[name] !== target.levels[name]) deck.setStemLevel(name, target.levels[name], when);
      }
      if (previous.mainVolume !== target.mainVolume) deck.setMainVolume(target.mainVolume, when);
    }
    return when ?? null;
  }
  function close() {
    if (closing) return closing;
    closed = true;
    // Each close invalidates pending work synchronously before closing the shared context.
    closing = Promise.all(decks.map(deck => deck.close())).then(async () => {
      if (context && context.state !== 'closed') await context.close();
    });
    return closing;
  }
  return Object.freeze({ deckIds, getDeck, applyGainSnapshot, close });
}

// Compatibility entry point for the standalone two-deck fixture and its tests.
function createTwoDeckStemPlayer(createContext = () => new AudioContext()) {
  return createNativeStemMixer(createContext, [1, 2]);
}
