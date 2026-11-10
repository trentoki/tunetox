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

// Diagnostic taps only. Stereo is measured independently to avoid mono cancellation.
function createNativeOutputMeter(audio) {
  if (typeof audio.createAnalyser !== 'function' || typeof audio.createChannelSplitter !== 'function') return null;
  const input = audio.createAnalyser(), splitter = audio.createChannelSplitter(2);
  const channels = [], samples = new Float32Array(2048);
  input.fftSize = 2048;
  try {
    input.connect(splitter);
    for (let channel = 0; channel < 2; channel++) {
      const analyser = audio.createAnalyser(); analyser.fftSize = 2048;
      splitter.connect(analyser, channel); channels.push(analyser);
    }
  } catch (error) { input.disconnect(); splitter.disconnect(); channels.forEach(node=>node.disconnect()); throw error; }
  function read() {
    const values = channels.map(analyser => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0, peak = 0;
      for (const value of samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
      return Object.freeze({ rms: Math.sqrt(sum / samples.length), peak });
    });
    return Object.freeze({ available:true, contextTime:audio.currentTime, frames:samples.length,
      left:values[0], right:values[1], peak:Math.max(...values.map(value=>value.peak)),
      rms:Math.sqrt(values.reduce((sum,value)=>sum+value.rms*value.rms,0)/2) });
  }
  return { input, read, disconnect() { input.disconnect(); splitter.disconnect(); channels.forEach(node=>node.disconnect()); } };
}

// Two bounded observations during a diagnostic tone, retained after its context closes.
function createNativeProbeSampler(read, publish, timers = {}) {
  const schedule=timers.setTimer || (typeof setTimeout==='function'?setTimeout:null);
  const cancel=timers.clearTimer || (typeof clearTimeout==='function'?clearTimeout:()=>{});
  const pending=[], samples=[];let stopped=false;
  if(schedule)for(const delayMs of [150,500])pending.push(schedule(()=>{
    if(stopped)return;
    let observation;
    try{observation=Object.freeze({delayMs,...read()});}
    catch(error){observation=Object.freeze({delayMs,measurementError:error.message});}
    samples.push(observation);publish(Object.freeze([...samples]));
  },delayMs));
  return { available:!!schedule, stop(){stopped=true;pending.forEach(cancel);} };
}
function getNativePageAudioState() {
  const browser=typeof navigator==='undefined'?null:navigator;
  return Object.freeze({
    userActivationActive:browser?.userActivation?.isActive ?? null,
    userActivationHasBeenActive:browser?.userActivation?.hasBeenActive ?? null,
    audioSessionType:browser?.audioSession?.type ?? null,
    audioSessionState:browser?.audioSession?.state ?? null,
    mediaPlaybackState:browser?.mediaSession?.playbackState ?? null,
    visibilityState:typeof document==='undefined'?null:document.visibilityState
  });
}

function createNativeDiagnosticTone(audio, destination, onEnded) {
  const duration=0.75, frames=Math.floor(audio.sampleRate*duration);
  const buffer=audio.createBuffer(1,frames,audio.sampleRate), pcm=buffer.getChannelData(0);
  for(let frame=0;frame<frames;frame++) pcm[frame]=0.05*Math.sin(2*Math.PI*440*frame/audio.sampleRate);
  const source=audio.createBufferSource(), gain=audio.createGain();
  try {
    source.buffer=buffer;source.connect(gain);gain.connect(destination);
    const start=audio.currentTime+128/audio.sampleRate;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+0.005);
    gain.gain.setValueAtTime(1,start+duration-0.005);gain.gain.linearRampToValueAtTime(0,start+duration);
    source.onended=onEnded;source.start(start);source.stop(start+duration);
    return {source,gain,start,duration};
  } catch(error) {
    source.onended=null;try{source.stop();}catch(_){}
    source.disconnect();gain.disconnect();throw error;
  }
}

function createFourStemPlayer(createContext = () => new AudioContext(), options = {}) {
  let context = null, buffers = null, loading = false, closed = false;
  let loadVersion = 0, command = 0, session = null, position = 0;
  const levels = Object.fromEntries(prototypeStemNames.map(name => [name, 1]));
  const smoothingSeconds = 0.010;
  let mainVolume = 1;
  let lastPlayError = null;
  let meterError = null;
  const listeners = new Set();
  function notify(type) { for (const listener of listeners) listener(type); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
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
    for (const meter of Object.values(current.meters || {})) meter?.disconnect();
    current.connectedToDestination = false;
    current.volume?.gain.disconnect();
    current.transport?.disconnect();
  }
  function pause() {
    ++command;
    position = getPosition();
    const old = session; session = null;
    disconnect(old);
    notify('pause');
  }
  function stop() { pause(); position = 0; }
  function eject() {
    ++loadVersion;
    stop(); buffers = null; loading = false; notify('eject');
  }
  async function loadFiles(files) {
    if (options.guardStart) options.guardStart();
    // Resume from the explicit Load gesture, before asynchronous reads/decodes (Safari).
    for (const name of prototypeStemNames) {
      if (!files || !files[name] || typeof files[name].arrayBuffer !== 'function') {
        throw new Error('Select a local file for ' + name + '.');
      }
    }
    const audio = getContext();
    const resumed = audio.resume();
    const version = ++loadVersion;
    stop(); loading = true; notify('replacement');
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
          throw new Error(name + (files[name].name ? ' (' + files[name].name + ')' : '') + ': could not read/decode audio. ' + error.message);
        }
        if (version !== loadVersion || closed) return false;
      }
      try { validateStemBuffers(candidate); }
      catch (error) {
        const details = prototypeStemNames.map(name => {
          const buffer = candidate[name];
          return name + (files[name].name ? ' (' + files[name].name + ')' : '') + ': ' +
            buffer.length + ' frames, ' + buffer.sampleRate + ' Hz, ' + buffer.numberOfChannels + ' channels';
        }).join('; ');
        throw new Error('Decoded stem validation failed. ' + error.message + ' Decoded files: ' + details);
      }
      buffers = candidate; position = 0;
      return true;
    } finally { if (version === loadVersion) loading = false; }
  }
  async function startPlayback(prepareStart = null) {
    try {
      const result = await startPlaybackAttempt(prepareStart);
      if (result) lastPlayError = null;
      return result;
    } catch (error) {
      lastPlayError = Object.freeze({ name: error.name, message: error.message,
        contextState: context?.state || 'uncreated', contextTime: context?.currentTime ?? null });
      throw error;
    }
  }
  async function startPlaybackAttempt(prepareStart) {
    if (options.guardStart) options.guardStart();
    if (closed || loading || !buffers || session) return false;
    const audio = getContext(), token = ++command;
    await audio.resume();
    if (options.guardStart) options.guardStart();
    if (token !== command || closed || loading || session || !buffers) return false;
    if (audio.state !== 'running') throw new Error('AudioContext is not running. Click Play again.');
    const plan = prepareStart ? prepareStart(audio) : null;
    if (position >= buffers.transients.duration) position = 0;
    const current = { paths: {}, startedAt: 0, remaining: 4, startedSources: 0, connectedToDestination: false };
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
            position = buffers.transients.duration; session = null; disconnect(current); notify('ended');
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
      current.transport.connect(options.getOutputNode ? options.getOutputNode() : audio.destination);
      current.connectedToDestination = true;
      // One future render quantum gives all four native starts the same clock boundary.
      current.startedAt = plan ? plan.when : audio.currentTime + 128 / audio.sampleRate;
      for (const path of Object.values(current.paths)) {
        path.source.start(current.startedAt, position);
        current.startedSources++;
      }
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
      // Install diagnostic side branches only after deadline-sensitive scheduling succeeds.
      // Measurement failure must never change playback or bypass scheduler protection.
      current.meters = {};
      meterError = null;
      try {
        const taps = { main:current.volume.gain, transport:current.transport };
        for (const name of prototypeStemNames) {
          taps[name + 'Source'] = current.paths[name].source;
          taps[name + 'StemGain'] = current.paths[name].gain;
        }
        for (const [name,node] of Object.entries(taps)) {
          const meter = createNativeOutputMeter(audio);
          if (meter) { current.meters[name] = meter; node.connect(meter.input); }
        }
      } catch (error) { meterError = error.message; }
      notify('started');
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
  // On-demand snapshot only: no resume, automation, graph writes or continuous sampling.
  function getDiagnostics() {
    const time = context?.currentTime ?? null, sourcePosition = getPosition();
    const transport = session ? envelopeValue(session.transportRamp, session.transportLevel, time) : 0;
    const volume = session ? envelopeValue(session.volume.ramp, mainVolume, time) : mainVolume;
    const stems = Object.fromEntries(prototypeStemNames.map(name => {
      const buffer = buffers?.[name], path = session?.paths[name];
      const level = path ? envelopeValue(path.ramp, levels[name], time) : levels[name];
      // Inspect at most 256 frames/channel around the current source position.
      // A zero window is not proof that the entire recording is silent.
      let sampledPcmPeak = null;
      if (buffer && typeof buffer.getChannelData === 'function') {
        sampledPcmPeak = 0;
        const first = Math.max(0, Math.min(buffer.length - 1, Math.floor(sourcePosition * buffer.sampleRate)));
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const pcm = buffer.getChannelData(channel);
          for (let frame = first; frame < Math.min(first + 256, buffer.length); frame++) {
            sampledPcmPeak = Math.max(sampledPcmPeak, Math.abs(pcm[frame]));
          }
        }
      }
      return [name, Object.freeze({
        decoded: !!buffer, frames: buffer?.length ?? null, sampleRate: buffer?.sampleRate ?? null,
        channels: buffer?.numberOfChannels ?? null, sampledPcmPeak,
        targetLevel: levels[name], modeledLevel: level,
        reportedAudioParamValue: path?.gain.gain.value ?? null,
        modeledEffectiveGain: session ? level * volume * transport : 0
      })];
    }));
    return Object.freeze({
      contextState: context?.state || 'uncreated', contextTime: time,
      contextSampleRate: context?.sampleRate ?? null,
      baseLatency: context?.baseLatency ?? null, outputLatency: context?.outputLatency ?? null,
      destinationChannels: context?.destination?.channelCount ?? null,
      loaded: !!buffers, loading, isPlaying: !!session, position: sourcePosition,
      duration: buffers?.transients.duration || 0,
      scheduledStartTime: session?.startedAt ?? null, sourceStartCalls: session?.startedSources || 0,
      sourcesRemaining: session?.remaining || 0,
      sourceClockReachedStart: !!session && time >= session.startedAt,
      // Bookkeeping of successful connect calls, not native graph or hardware introspection.
      connectedToDestination: !!session?.connectedToDestination,
      connectionEvidence: 'successful connect calls; hardware output is not measured',
      mainVolumeTarget: mainVolume, modeledMainVolume: volume, modeledTransport: transport,
      reportedMainAudioParamValue: session?.volume.gain.gain.value ?? null,
      reportedTransportAudioParamValue: session?.transport.gain.value ?? null,
      stems: Object.freeze(stems), lastPlayError, meterError,
      liveMeters: Object.freeze(Object.fromEntries(Object.entries(session?.meters || {}).map(([name,meter]) =>
        [name, meter.read()])))
    });
  }
  return Object.freeze({ loadFiles, play, pause, stop, eject, close, setStemLevel, setMainVolume, subscribe,
    startCoordinated: startPlayback, getGainSettledTime, getDiagnostics,
    prepareRetarget, applyRetarget, getStartTime: () => session?.startedAt || 0,
    getState: () => ({ loaded: !!buffers, loading, closed, isPlaying: !!session,
      position: getPosition(), duration: buffers?.transients.duration || 0,
      levels: { ...levels }, mainVolume, contextState: context?.state || 'uncreated', smoothingSeconds }) });
}

// One owner for a fixed set of native decks; per-deck players retire only their own graphs.
function createNativeStemMixer(createContext = () => new AudioContext(), ids = [1, 2, 3, 4], createTemporaryContext = () => new AudioContext()) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isInteger(id) || id < 1 || id > 4)) throw new Error('Expected distinct deck IDs from 1 to 4.');
  const deckIds = Object.freeze([...ids]);
  let context = null, closed = false, closing = null;
  let outputMeter = null, outputMeterError = null;
  let contextAtCreation = null, lastContextStateChange = null;
  let tone = null, toneStarting = false, lastTone = null;
  let temporaryProbe = null, lastFreshTone = null;
  function contextDetails(audio = context) {
    if (!audio) return null;
    const destination = audio.destination;
    return Object.freeze({ state:audio.state, currentTime:audio.currentTime, sampleRate:audio.sampleRate,
      baseLatency:audio.baseLatency ?? null, outputLatency:audio.outputLatency ?? null,
      sinkId: typeof audio.sinkId === 'string' ? audio.sinkId : null,
      destination:Object.freeze({ channelCount:destination.channelCount ?? null,
        maxChannelCount:destination.maxChannelCount ?? null,
        channelCountMode:destination.channelCountMode ?? null,
        channelInterpretation:destination.channelInterpretation ?? null }) });
  }
  function guardStart() {
    if (tone || toneStarting || temporaryProbe) throw new Error('An output diagnostic tone is active. Retry Play after it ends.');
  }
  let lastSchedulingFailure = null;
  function failClosed(error, operation, when) {
    const playingDeckIds = deckIds.filter(id => getDeck(id).getState().isPlaying);
    lastSchedulingFailure = Object.freeze({
      sequence: (lastSchedulingFailure?.sequence || 0) + 1,
      kind: 'native-scheduling-failure', operation, message: error.message, errorName: error.name,
      scheduledTime: when, observedTime: context?.currentTime ?? null,
      playingDeckIds: Object.freeze(playingDeckIds)
    });
    // This diagnostic is written only after native scheduling has begun, never for
    // preflight user-gesture rejection. Keep the existing fail-closed protection.
    for (const id of deckIds) getDeck(id).pause();
  }
  function sharedContext() {
    if (closed) throw new Error('Native stem mixer is closed.');
    if (!context) {
      context = createContext();
      contextAtCreation = contextDetails();
      context.addEventListener?.('statechange', () => { lastContextStateChange = contextDetails(); });
      try {
        outputMeter = createNativeOutputMeter(context);
        if (outputMeter) outputMeter.input.connect(context.destination);
      } catch (error) {
        outputMeter?.disconnect(); outputMeter = null; outputMeterError = error.message;
      }
    }
    return context;
  }
  function outputNode() { return outputMeter ? outputMeter.input : context.destination; }
  let protectedScheduling = false, writingSnapshot = false;
  function guardGainWrite() {
    if (protectedScheduling && !writingSnapshot) throw new Error('Use a coordinated mixer snapshot for gain changes.');
  }
  const decks = Object.freeze(deckIds.map(() => createFourStemPlayer(sharedContext, { ownsContext: false, guardGainWrite, guardStart, getOutputNode: outputNode })));
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
    const playing = deckIds.filter(id => getDeck(id).getState().isPlaying);
    const audibleTargetsChanged = playing.some(id => {
      const previous = getDeck(id).getState(), target = snapshot[id];
      return previous.mainVolume !== target.mainVolume ||
        prototypeStemNames.some(name => previous.levels[name] !== target.levels[name]);
    });
    if (!audibleTargetsChanged) {
      // Preparation-only snapshots must not restart/normalize another deck's envelopes.
      // Keep full target validation and the audible cap; store only silent coefficients.
      for (const name of prototypeStemNames) {
        const total = playing.reduce((sum,id) => sum + snapshot[id].mainVolume * snapshot[id].levels[name],0);
        if (total > 1 + 1e-12) throw new Error('Coordinated retarget exceeds stem capacity.');
      }
      for (const id of deckIds) if (!playing.includes(id)) getDeck(id).applyRetarget(snapshot[id],when,null);
      return when;
    }
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
      failClosed(error, 'retarget', when);
      throw error;
    }
    return when;
  }
  let coordinatedStartPending = false;
  async function startCoordinated(id, snapshot) {
    guardStart();
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
          catch (error) { failClosed(error, 'start', when); throw error; }
          finally { writingSnapshot = false; }
        } };
      });
      if (started) protectedScheduling = true;
      return started;
    } finally { coordinatedStartPending = false; }
  }
  function retireTone() {
    if (!tone) return;
    const old = tone; tone = null;
    old.sampler?.stop();
    old.source.onended = null;
    try { old.source.stop(); } catch (_) {}
    old.source.disconnect(); old.gain.disconnect();
  }
  async function playDiagnosticTone() {
    if (closed || !context) throw new Error('Load stems first to create the actual shared context.');
    guardStart();
    if (coordinatedStartPending || decks.some(deck => {
      const state = deck.getState(); return state.isPlaying || state.loading;
    })) throw new Error('Pause all native decks and finish loading before testing shared output.');
    toneStarting = true;
    const beforeResume = contextDetails();
    const entryPageState=getNativePageAudioState();
    try {
      // Resume the existing context in this explicit click; never create a replacement.
      await context.resume();
      if (closed || context.state !== 'running') throw new Error('Shared diagnostic context is not running.');
      tone = createNativeDiagnosticTone(context, outputNode(), retireTone);
      const {start,duration}=tone;
      lastTone = Object.freeze({ started:true, frequency:440, amplitude:0.05, duration,
        startedAt:start, beforeResume, afterResume:contextDetails(), route:'existing shared output node',
        entryPageState, pageState:getNativePageAudioState(), observations:Object.freeze([]) });
      tone.sampler=createNativeProbeSampler(
        ()=>({context:contextDetails(),outputMeter:outputMeter?.read() ?? null,pageState:getNativePageAudioState()}),
        observations=>{lastTone=Object.freeze({...lastTone,observations});});
      lastTone=Object.freeze({...lastTone,timedObservationAvailable:tone.sampler.available});
      return lastTone;
    } catch (error) {
      retireTone();
      lastTone = Object.freeze({ started:false, error:error.message, beforeResume, afterResume:contextDetails() });
      throw error;
    } finally { toneStarting = false; }
  }
  function requireIdleProbe() {
    if (closed || !context) throw new Error('Load stems first so both contexts can be compared.');
    guardStart();
    if (coordinatedStartPending || decks.some(deck => {
      const state=deck.getState();return state.isPlaying || state.loading;
    })) throw new Error('Pause all native decks and finish loading before testing fresh output.');
  }
  function retireTemporaryProbe(probe) {
    if (probe.closing) return probe.closing;
    probe.sampler?.stop();
    if(probe.tone) {
      probe.tone.source.onended=null;
      try{probe.tone.source.stop();}catch(_){}
      probe.tone.source.disconnect();probe.tone.gain.disconnect();
    }
    probe.meter?.disconnect();
    probe.closing=Promise.resolve().then(()=>probe.audio.close()).then(()=>{
      lastFreshTone=Object.freeze({...lastFreshTone, temporaryContextClosed:true});
      if(temporaryProbe===probe)temporaryProbe=null;
    },error=>{
      lastFreshTone=Object.freeze({...lastFreshTone, closeError:error.message, temporaryContextClosed:false});
      if(temporaryProbe===probe)temporaryProbe=null;
    });
    return probe.closing;
  }
  async function playFreshDiagnosticTone() {
    requireIdleProbe();
    // A new default context is created/resumed only by this explicit diagnostic action.
    const audio=createTemporaryContext(),probe={audio,tone:null,meter:null,closing:null};
    temporaryProbe=probe;
    const atCreation=contextDetails(audio);
    const entryPageState=getNativePageAudioState();
    try {
      await audio.resume();
      if (closed || temporaryProbe!==probe) throw new Error('Fresh output test cancelled.');
      if(audio.state!=='running')throw new Error('Fresh diagnostic context is not running.');
      const afterResume=contextDetails(audio);
      probe.meter=createNativeOutputMeter(audio);
      if(probe.meter)probe.meter.input.connect(audio.destination);
      probe.tone=createNativeDiagnosticTone(audio,probe.meter?probe.meter.input:audio.destination,
        ()=>{void retireTemporaryProbe(probe);});
      lastFreshTone=Object.freeze({started:true, frequency:440, amplitude:0.05,
        duration:probe.tone.duration, startedAt:probe.tone.start, atCreation, afterResume,
        productionContext:contextDetails(), temporaryContextClosed:false,
        entryPageState, pageState:getNativePageAudioState(), observations:Object.freeze([])});
      probe.sampler=createNativeProbeSampler(
        ()=>({context:contextDetails(audio),outputMeter:probe.meter?.read() ?? null,pageState:getNativePageAudioState()}),
        observations=>{lastFreshTone=Object.freeze({...lastFreshTone,observations});});
      lastFreshTone=Object.freeze({...lastFreshTone,timedObservationAvailable:probe.sampler.available});
      return lastFreshTone;
    } catch(error) {
      lastFreshTone=Object.freeze({started:false,error:error.message,atCreation,productionContext:contextDetails()});
      await retireTemporaryProbe(probe);throw error;
    }
  }
  function close() {
    if (closing) return closing;
    closed = true;
    retireTone();
    const temporaryClose=temporaryProbe?retireTemporaryProbe(temporaryProbe):Promise.resolve();
    // Each close invalidates pending work synchronously before closing the shared context.
    closing = Promise.all([...decks.map(deck => deck.close()),temporaryClose]).then(async () => {
      outputMeter?.disconnect();
      if (context && context.state !== 'closed') await context.close();
    });
    return closing;
  }
  return Object.freeze({ deckIds, getDeck, applyGainSnapshot, startCoordinated, close, playDiagnosticTone, playFreshDiagnosticTone,
    getLastSchedulingFailure: () => lastSchedulingFailure,
    getDiagnostics: () => Object.freeze({
      contextState: context?.state || 'uncreated', contextTime: context?.currentTime ?? null,
      contextAtCreation, contextNow:contextDetails(), lastContextStateChange, pageState:getNativePageAudioState(),
      diagnosticToneActive:!!tone || toneStarting, lastDiagnosticTone:lastTone,
      freshDiagnosticToneActive:!!temporaryProbe,lastFreshDiagnosticTone:lastFreshTone,
      freshOutputMeter:temporaryProbe?.meter?.read() ?? null,
      protectedScheduling, coordinatedStartPending, lastSchedulingFailure,
      outputMeter: outputMeter ? outputMeter.read() : Object.freeze({available:false, error:outputMeterError}),
      outputRoute: outputMeter ? 'deck transport -> shared analyser -> destination' : 'deck transport -> destination',
      decks: Object.freeze(Object.fromEntries(deckIds.map(id => [id, getDeck(id).getDiagnostics()])))
    }) });
}

// Compatibility entry point for the standalone two-deck fixture and its tests.
function createTwoDeckStemPlayer(createContext = () => new AudioContext()) {
  return createNativeStemMixer(createContext, [1, 2]);
}
