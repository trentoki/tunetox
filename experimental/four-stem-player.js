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
  async function startPlayback(prepareStart = null) {
    if (closed || loading || !buffers || session) return false;
    const audio = getContext(), token = ++command;
    await audio.resume();
    if (token !== command || closed || loading || session || !buffers) return false;
    if (audio.state !== 'running') throw new Error('AudioContext is not running. Click Play again.');
    const plan = prepareStart ? prepareStart(audio) : null;
    if (position >= buffers.transients.duration) position = 0;
    const current = { paths: {}, startedAt: 0, remaining: 4 };
    try {
      for (const name of prototypeStemNames) {
        const source = audio.createBufferSource();
        current.paths[name] = { source, gain: null, ramp: null };
        const gain = audio.createGain();
        current.paths[name].gain = gain;
        source.buffer = buffers[name];
        gain.gain.setValueAtTime(plan ? plan.target.levels[name] : levels[name], audio.currentTime);
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
      current.volume.gain.gain.setValueAtTime(plan ? plan.target.mainVolume : mainVolume, audio.currentTime);
      current.transport.gain.setValueAtTime(plan ? 0 : 1, audio.currentTime);
      for (const path of Object.values(current.paths)) path.gain.connect(current.volume.gain);
      current.volume.gain.connect(current.transport);
      current.transport.connect(audio.destination);
      // One future render quantum gives all four native starts the same clock boundary.
      current.startedAt = plan ? plan.when : audio.currentTime + 128 / audio.sampleRate;
      for (const path of Object.values(current.paths)) path.source.start(current.startedAt, position);
      if (plan) {
        // All source.start calls succeeded before touching another deck's automation.
        // Reject an expired reservation while the new transport is still gated silent.
        if (audio.currentTime >= plan.when) throw new Error('Coordinated start deadline missed. Retry Play.');
        plan.schedule();
        if (audio.currentTime >= plan.when) throw new Error('Coordinated scheduling deadline missed. Retry Play.');
        current.transport.gain.setValueAtTime(0, plan.when);
        current.transport.gain.linearRampToValueAtTime(1, plan.when + smoothingSeconds);
        for (const name of prototypeStemNames) levels[name] = plan.target.levels[name];
        mainVolume = plan.target.mainVolume;
      }
      current.transportLevel = 1;
      current.transportRamp = plan ? { start: plan.when, end: plan.when + smoothingSeconds, from: 0, target: 1 } : null;
      current.coordinated = !!plan;
      session = current;
      return true;
    } catch (error) { disconnect(current); throw error; }
  }
  function play() { return startPlayback(); }
  function getGainSettledTime() {
    if (!session) return 0;
    return Math.max(session.startedAt + (session.coordinated ? smoothingSeconds : 0), session.volume.ramp?.end || 0,
      ...prototypeStemNames.map(name => session.paths[name].ramp?.end || 0));
  }
  function envelopeValue(ramp, fallback, time) {
    if (!ramp) return fallback;
    if (time >= ramp.end) return ramp.target;
    return ramp.from + (ramp.target - ramp.from) * Math.max(0, (time - ramp.start) / (ramp.end - ramp.start));
  }
  function prepareRetarget(target, when) {
    if (!session) return null;
    if (target.mainVolume !== mainVolume || (session.volume.ramp && session.volume.ramp.end > when)) {
      throw new Error('Coordinated retarget requires a settled, unchanged main volume.');
    }
    const transport = envelopeValue(session.transportRamp, session.transportLevel, when);
    const from = {};
    for (const name of prototypeStemNames) {
      from[name] = transport * envelopeValue(session.paths[name].ramp, levels[name], when);
    }
    return { from, volume: mainVolume, session };
  }
  function applyRetarget(target, when, prepared) {
    if (!prepared) {
      for (const name of prototypeStemNames) levels[name] = target.levels[name];
      mainVolume = target.mainVolume;
      return;
    }
    if (session !== prepared.session) throw new Error('Coordinated session changed.');
    const transport = envelopeValue(session.transportRamp, session.transportLevel, when);
    const parameter = session.transport.gain;
    parameter.cancelScheduledValues(when);
    if (session.transportRamp && when > session.transportRamp.start && when < session.transportRamp.end) {
      parameter.linearRampToValueAtTime(transport, when);
    }
    parameter.setValueAtTime(1, when);
    session.transportRamp = null; session.transportLevel = 1;
    for (const name of prototypeStemNames) {
      rampGain(session.paths[name], levels[name], target.levels[name], when, prepared.from[name]);
      levels[name] = target.levels[name];
    }
  }
  function setStemLevel(name, value, when) {
    if (options.guardGainWrite) options.guardGainWrite();
    if (closed) throw new Error('Player is closed.');
    if (!prototypeStemNames.includes(name) || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Expected a known stem and a finite level from 0 to 1.');
    }
    const path = session?.paths[name];
    if (path) rampGain(path, levels[name], value, when);
    levels[name] = value;
  }
  function rampGain(path, previousTarget, value, when = context.currentTime, effectiveFrom) {
    const now = when, ramp = path.ramp;
    const from = ramp ? (now >= ramp.end ? ramp.target :
      ramp.from + (ramp.target - ramp.from) * Math.max(0, (now - ramp.start) / (ramp.end - ramp.start))) : previousTarget;
    const parameter = path.gain.gain;
    parameter.cancelScheduledValues(now);
    // For future batch times, retain the unfinished segment whose endpoint was cancelled.
    // A setValue alone would replace that segment with a hold followed by a step.
    if (ramp && now > ramp.start && now < ramp.end) parameter.linearRampToValueAtTime(from, now);
    const anchor = effectiveFrom === undefined ? from : effectiveFrom;
    parameter.setValueAtTime(anchor, now);
    parameter.linearRampToValueAtTime(value, now + smoothingSeconds);
    path.ramp = { start: now, end: now + smoothingSeconds, from: anchor, target: value };
  }
  function setMainVolume(value, when) {
    if (options.guardGainWrite) options.guardGainWrite();
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
    startCoordinated: startPlayback, getGainSettledTime,
    prepareRetarget, applyRetarget, getStartTime: () => session?.startedAt || 0,
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
  let protectedScheduling = false, writingSnapshot = false;
  function guardGainWrite() {
    if (protectedScheduling && !writingSnapshot) throw new Error('Use a coordinated mixer snapshot for gain changes.');
  }
  const decks = Object.freeze(deckIds.map(() => createFourStemPlayer(sharedContext, { ownsContext: false, guardGainWrite })));
  function getDeck(id) {
    if (!deckIds.includes(id)) throw new Error('Deck is not owned by this native mixer.');
    return decks[deckIds.indexOf(id)];
  }
  function validateGainSnapshot(snapshot) {
    if (closed) throw new Error('Native stem mixer is closed.');
    // Validate the entire batch before scheduling any AudioParam changes.
    for (const id of deckIds) {
      const target = snapshot[id];
      if (!target || getDeck(id).getState().closed) throw new Error('Gain target/deck unavailable.');
      for (const value of [target.mainVolume, ...prototypeStemNames.map(name => target.levels?.[name])]) {
        if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid gain snapshot.');
      }
    }
  }
  function applyGainSnapshot(snapshot, scheduledTime) {
    validateGainSnapshot(snapshot);
    // A shared future boundary keeps the whole batch ahead of rendering. No context is
    // created by state changes; initial targets are retained until explicit Load/Play.
    const when = scheduledTime === undefined ? (context ? context.currentTime + 128 / context.sampleRate : undefined) : scheduledTime;
    if (protectedScheduling && !writingSnapshot) return retargetSnapshot(snapshot, when);
    for (const id of deckIds) {
      const deck = getDeck(id), previous = deck.getState(), target = snapshot[id];
      for (const name of prototypeStemNames) {
        if (previous.levels[name] !== target.levels[name]) deck.setStemLevel(name, target.levels[name], when);
      }
      if (previous.mainVolume !== target.mainVolume) deck.setMainVolume(target.mainVolume, when);
    }
    return when ?? null;
  }
  function retargetSnapshot(snapshot, requestedTime) {
    const now = context.currentTime;
    if (!Number.isFinite(requestedTime) || requestedTime < now) throw new Error('Invalid coordinated scheduling time.');
    // A source not yet started must stay silent until its scheduled start boundary.
    const when = Math.max(requestedTime, ...deckIds.map(id => getDeck(id).getStartTime()));
    const prepared = Object.fromEntries(deckIds.map(id => [id, getDeck(id).prepareRetarget(snapshot[id], when)]));
    for (const name of prototypeStemNames) {
      let initial = 0, final = 0;
      for (const id of deckIds) if (prepared[id]) {
        initial += prepared[id].volume * prepared[id].from[name];
        final += snapshot[id].mainVolume * snapshot[id].levels[name];
      }
      if (initial > 1 + 1e-12 || final > 1 + 1e-12) throw new Error('Coordinated retarget exceeds stem capacity.');
    }
    try {
      for (const id of deckIds) getDeck(id).applyRetarget(snapshot[id], when, prepared[id]);
      if (context.currentTime >= when) throw new Error('Coordinated retarget deadline missed. Retry.');
    } catch (error) {
      // Native AudioParam operations are not transactional. Fail closed rather than
      // leave an unknown partial batch audible. No domain membership is committed here.
      for (const id of deckIds) getDeck(id).pause();
      throw error;
    }
    return when;
  }
  let coordinatedStartPending = false;
  async function startCoordinated(id, snapshot) {
    if (coordinatedStartPending) throw new Error('Another coordinated start is pending. Retry Play.');
    validateGainSnapshot(snapshot);
    // Own a validated copy across audio.resume(); caller mutations cannot alter the plan.
    const targets = Object.fromEntries(deckIds.map(deckId => [deckId, {
      mainVolume: snapshot[deckId].mainVolume, levels: { ...snapshot[deckId].levels }
    }]));
    const joining = getDeck(id);
    coordinatedStartPending = true;
    try {
      const started = await joining.startCoordinated(audio => {
        validateGainSnapshot(targets);
        const playing = deckIds.filter(deckId => deckId !== id && getDeck(deckId).getState().isPlaying);
        for (const deckId of playing) {
          if (targets[deckId].mainVolume !== getDeck(deckId).getState().mainVolume) {
            throw new Error('Coordinated start requires unchanged existing main volumes.');
          }
        }
        for (const name of prototypeStemNames) {
          const previous = playing.reduce((sum, deckId) => {
            const state = getDeck(deckId).getState();
            return sum + state.mainVolume * state.levels[name];
          }, 0);
          const next = [...playing, id].reduce((sum, deckId) =>
            sum + targets[deckId].mainVolume * targets[deckId].levels[name], 0);
          if (previous > 1 + 1e-12 || next > 1 + 1e-12) throw new Error('Coordinated start exceeds stem capacity.');
        }
        // Wait for existing envelopes, then linearly interpolate effective gains.
        // With fixed main volumes the sum is a convex combination of capped endpoints.
        const when = Math.max(audio.currentTime + 0.020,
          ...playing.map(deckId => getDeck(deckId).getGainSettledTime() + 128 / audio.sampleRate));
        return { when, target: targets[id], schedule() {
          const others = { ...targets };
          // The joining graph already has its target coefficients and a 0 -> 1 transport.
          // Keep its stored coefficients untouched until the player commits success.
          others[id] = { mainVolume: joining.getState().mainVolume, levels: joining.getState().levels };
          writingSnapshot = true;
          try { applyGainSnapshot(others, when); }
          catch (error) { for (const deckId of deckIds) getDeck(deckId).pause(); throw error; }
          finally { writingSnapshot = false; }
        } };
      });
      if (started) protectedScheduling = true;
      return started;
    } finally { coordinatedStartPending = false; }
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
  return Object.freeze({ deckIds, getDeck, applyGainSnapshot, startCoordinated, close });
}

// Compatibility entry point for the standalone two-deck fixture and its tests.
function createTwoDeckStemPlayer(createContext = () => new AudioContext()) {
  return createNativeStemMixer(createContext, [1, 2]);
}
