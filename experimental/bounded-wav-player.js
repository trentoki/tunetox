// Standalone native chunk experiment. Transport, shared timeline and PCM readiness are distinct.
function createBoundedWavPlayer(options = {}) {
  const createContext = options.createContext || (() => new AudioContext());
  const nowMs = options.nowMs || (() => performance.now());
  const readFrames = options.readFrames || readPcmWavFrames;
  const startTimer = options.setTimer || (callback => setInterval(callback, 25));
  const stopTimer = options.clearTimer || clearInterval;
  let context = null, tracks = null, closed = false, loading = false;
  let transport = 'stopped', starting = false, generation = 0, command = 0;
  let savedFrame = 0, anchorFrame = 0, anchorTime = 0, timer = null;
  let work = null, readyWork = null, tickWork = null, windowSeconds = 2, leadSeconds = options.schedulingLeadSeconds ?? .01;
  if (![.01, .05].includes(leadSeconds)) throw new Error('Scheduling lead must be 10 or 50 ms.');
  let error = '', underruns = 0, peakPcmBytes = 0, inFlightReadBytes = 0;
  let preparationMs = 0, lastPreparation = null, lastStartup = null;
  const totals = { readMs: 0, conversionMs: 0, bufferMs: 0, readCount: 0 };
  const paths = Object.fromEntries(streamingStemNames.map(name => [name, {
    level: 1, enabled: name !== 'voice', epoch: 0, next: 0, chunks: [], gain: null,
    opening: true, ramp: null, activationRequestedMs: 0, lastActivation: null
  }]));
  const playing = () => transport === 'playing';
  function getContext() {
    if (closed) throw new Error('Player closed.');
    if (!context) context = createContext();
    return context;
  }
  function frameAt(time) {
    if (!tracks) return 0;
    const source = playing() ? anchorFrame + Math.max(0, Math.floor((time - anchorTime) * context.sampleRate)) : savedFrame;
    return Math.min(tracks.transients.frames, source);
  }
  const frame = () => frameAt(context?.currentTime || 0);
  const chunkEnd = chunk => chunk.start + chunk.frames;
  const pcmBytes = () => Object.values(paths).reduce((total, path) => total +
    path.chunks.reduce((sum, chunk) => sum + chunk.frames * chunk.channels * 4, 0), 0);
  function disconnect(chunk) {
    if (!chunk.node) return;
    chunk.node.onended = null;
    try { chunk.node.stop(); } catch (_) { /* Already ended. */ }
    chunk.node.disconnect(); chunk.node = null;
  }
  function retire(path, keepFrame = null) {
    const keep = keepFrame === null ? null : path.chunks.find(chunk => chunk.start <= keepFrame && keepFrame < chunkEnd(chunk));
    for (const chunk of path.chunks) disconnect(chunk);
    path.chunks = keep ? [keep] : [];
    if (keep) { keep.when = null; keep.playFrame = null; keep.playFrames = null; }
    path.next = keep ? chunkEnd(keep) : keepFrame ?? 0;
    path.opening = true; path.ramp = null;
    if (path.gain) {
      path.gain.gain.cancelScheduledValues(context.currentTime);
      path.gain.gain.setValueAtTime(0, context.currentTime);
    }
  }
  function isReady() {
    return !!tracks && !loading && !closed && !playing() && savedFrame < tracks.transients.frames &&
      Object.values(paths).every(path => !path.enabled || path.chunks.some(chunk => chunk.start <= savedFrame && savedFrame < chunkEnd(chunk)));
  }
  // Single preparation queue bounds simultaneous payload reads, including stale operations.
  function enqueue(task) {
    const pending = (work || Promise.resolve()).catch(() => {}).then(task);
    work = pending;
    const clear = () => { if (work === pending) work = null; };
    pending.then(clear, clear);
    return pending;
  }
  async function prepareChunk(name, token) {
    const path = paths[name], epoch = path.epoch, wav = tracks[name], start = path.next;
    const count = Math.min(Math.round(wav.rate / 4), wav.frames - start);
    if (count <= 0) return false;
    const began = nowMs(), timing = {};
    inFlightReadBytes = count * wav.align;
    let channels;
    try { channels = await readFrames(wav, start, count, timing, nowMs); }
    catch (reason) { if (token !== generation || epoch !== path.epoch || closed) return false; throw reason; }
    finally { inFlightReadBytes = 0; }
    if (token !== generation || epoch !== path.epoch || !path.enabled || closed) return false;
    const bufferStarted = nowMs(), buffer = context.createBuffer(wav.channels, count, wav.rate);
    channels.forEach((data, channel) => buffer.copyToChannel(data, channel));
    const bufferMs = nowMs() - bufferStarted;
    preparationMs = nowMs() - began;
    lastPreparation = { stem: name, sourceFrame: start, frames: count, readMs: timing.readMs ?? null,
      conversionMs: timing.conversionMs ?? null, bufferMs, totalMs: preparationMs };
    totals.readMs += timing.readMs || 0; totals.conversionMs += timing.conversionMs || 0;
    totals.bufferMs += bufferMs; totals.readCount++;
    peakPcmBytes = Math.max(peakPcmBytes, pcmBytes() + count * wav.channels * 8);
    path.chunks.push({ start, frames: count, channels: wav.channels, buffer, node: null, when: null });
    path.next = start + count;
    return true;
  }
  function whenReady() {
    if (closed || !tracks || loading || playing()) return Promise.resolve(false);
    if (isReady()) return Promise.resolve(true);
    const token = generation;
    // Repeated callers share this generation's preparation instead of duplicating reads.
    if (readyWork?.token === token) return readyWork.promise;
    const promise = enqueue(async () => {
      if (token !== generation || closed || playing() || loading) return false;
      for (const name of streamingStemNames) {
        const path = paths[name];
        if (!path.enabled || path.chunks.some(chunk => chunk.start <= savedFrame && savedFrame < chunkEnd(chunk))) continue;
        path.next = savedFrame;
        await prepareChunk(name, token);
        if (token !== generation || closed || playing()) return false;
      }
      return isReady();
    });
    readyWork = { token, promise };
    promise.then(() => { if (readyWork?.promise === promise) readyWork = null; }, () => { if (readyWork?.promise === promise) readyWork = null; });
    return promise;
  }
  function prepareInBackground() {
    const token = generation;
    void whenReady().catch(reason => { if (!closed && token === generation) error = reason.message; });
  }
  function halt(targetFrame, state, prepare = true) {
    transport = state; starting = false; loading = false; generation++; command++; readyWork = null;
    savedFrame = targetFrame;
    for (const path of Object.values(paths)) retire(path, path.enabled ? targetFrame : null);
    if (timer !== null) { stopTimer(timer); timer = null; }
    if (prepare && !loading && tracks && !closed) prepareInBackground();
  }
  function pause() { halt(frame(), 'paused'); }
  function stop() { halt(0, 'stopped'); }
  async function loadFiles(files) {
    for (const name of streamingStemNames) if (!files?.[name]?.slice) throw new Error('Select supported audio for ' + name);
    const audio = getContext(), resume = audio.resume();
    halt(0, 'stopped', false);
    for (const path of Object.values(paths)) retire(path);
    const token = generation; loading = true; error = '';
    try {
      await resume;
      const candidate = {};
      for (const name of streamingStemNames) {
        candidate[name] = await inspectBoundedAudioFile(files[name]);
        if (token !== generation || closed) return false;
      }
      for (const name of streamingStemNames) {
        if (candidate[name].rate !== audio.sampleRate || candidate[name].frames !== candidate.transients.frames)
          throw new Error('Stems require identical frame counts and the AudioContext rate (' + audio.sampleRate + ' Hz). No resampling.');
      }
      tracks = candidate;
      for (const path of Object.values(paths)) if (!path.gain) {
        path.gain = audio.createGain(); path.gain.gain.value = 0; path.gain.connect(audio.destination);
      }
      return true;
    } finally {
      if (token === generation) { loading = false; prepareInBackground(); }
    }
  }
  function prune(path) {
    path.chunks = path.chunks.filter(chunk => {
      if (chunk.when === null || chunk.when + chunk.playFrames / context.sampleRate > context.currentTime) return true;
      disconnect(chunk); return false;
    });
  }
  function schedule(path, chunk, exactStart = false) {
    let start = Math.max(chunk.start, anchorFrame);
    const intendedWhen = anchorTime + (start - anchorFrame) / context.sampleRate;
    if (!exactStart && (path.opening || intendedWhen < context.currentTime)) {
      // Preparation may have taken time: trim to the source frame at the NEW scheduled onset.
      start = Math.max(start, frameAt(context.currentTime + leadSeconds));
      if (!path.opening && intendedWhen < context.currentTime) underruns++;
    }
    if (start >= chunkEnd(chunk)) {
      underruns++;
      path.chunks = path.chunks.filter(candidate => candidate !== chunk);
      path.next = frameAt(context.currentTime + leadSeconds); path.opening = true;
      return false;
    }
    const when = anchorTime + (start - anchorFrame) / context.sampleRate;
    const node = context.createBufferSource(); chunk.node = node;
    chunk.when = when; chunk.playFrame = start; chunk.playFrames = chunkEnd(chunk) - start;
    node.buffer = chunk.buffer; node.connect(path.gain);
    if (path.opening) {
      path.lastActivation = { preparationMs: nowMs() - path.activationRequestedMs, sourceFrame: start,
        contextTime: when, schedulingLeadMs: (when - context.currentTime) * 1000, fadeSeconds: .01 };
      path.gain.gain.cancelScheduledValues(context.currentTime);
      path.gain.gain.setValueAtTime(0, when); path.gain.gain.linearRampToValueAtTime(path.level, when + .01);
      path.ramp = { from: 0, target: path.level, start: when, end: when + .01 }; path.opening = false;
    }
    node.start(when, (start - chunk.start) / context.sampleRate, chunk.playFrames / context.sampleRate);
    return true;
  }
  async function fill(token) {
    for (const name of streamingStemNames) {
      const path = paths[name]; if (!path.enabled) continue;
      prune(path);
      let attempts = 0;
      while (token === generation && path.enabled && path.next < tracks[name].frames && attempts++ < windowSeconds * 4 + 2) {
        const held = path.chunks.reduce((sum, chunk) => sum + chunk.frames, 0);
        const count = Math.min(Math.round(context.sampleRate / 4), tracks[name].frames - path.next);
        if (held + count > Math.round(windowSeconds * context.sampleRate)) break;
        if (path.next < frame()) {
          underruns++; retire(path); path.next = frameAt(context.currentTime + leadSeconds);
        }
        if (!await prepareChunk(name, token)) break;
        if (!schedule(path, path.chunks[path.chunks.length - 1])) break;
      }
    }
  }
  function tick() {
    if (tickWork) return tickWork;
    const pending = pump(); tickWork = pending;
    const clear = () => { if (tickWork === pending) tickWork = null; };
    pending.then(clear, clear); return pending;
  }
  async function pump() {
    if (!playing()) return;
    if (work) { await work.catch(() => {}); if (!playing()) return; }
    if (frame() >= tracks.transients.frames) { halt(tracks.transients.frames, 'stopped', false); return; }
    const token = generation;
    await enqueue(() => token === generation && playing() ? fill(token) : undefined).catch(reason => {
      if (token === generation) { error = reason.message; halt(frame(), 'paused', false); }
    });
  }
  async function play() {
    if (closed || loading || playing() || starting || !tracks) return false;
    const began = nowMs(), audio = getContext(), resume = audio.resume(), request = ++command;
    starting = true;
    if (savedFrame >= tracks.transients.frames) { savedFrame = 0; generation++; for (const path of Object.values(paths)) retire(path); }
    const wasReady = isReady(), before = { ...totals }, selectedFrame = savedFrame;
    try {
      await resume;
      if (request !== command || closed) return false;
      if (audio.state !== 'running') throw new Error('AudioContext not running. Click Play again.');
      const resumeMs = nowMs() - began, preparationStarted = nowMs();
      if (!await whenReady() || request !== command || closed) return false;
      const preparationWaitMs = nowMs() - preparationStarted, schedulingStarted = nowMs();
      anchorFrame = selectedFrame; anchorTime = audio.currentTime + leadSeconds; transport = 'playing';
      for (const path of Object.values(paths)) if (path.enabled) {
        path.activationRequestedMs = began;
        schedule(path, path.chunks.find(chunk => chunk.start <= selectedFrame && selectedFrame < chunkEnd(chunk)), true);
      }
      const scheduledMs = nowMs();
      lastStartup = { resumeMs, preparationWaitMs, schedulingWorkMs: scheduledMs - schedulingStarted, readyAtCommand: wasReady, sourceFrame: selectedFrame, commandWorkMs: scheduledMs - began,
        predictedCommandToOnsetMs: scheduledMs - began + (anchorTime - audio.currentTime) * 1000,
        scheduledContextTime: anchorTime, schedulingLeadMs: leadSeconds * 1000,
        readMs: totals.readMs - before.readMs, conversionMs: totals.conversionMs - before.conversionMs,
        bufferMs: totals.bufferMs - before.bufferMs, payloadReads: totals.readCount - before.readCount,
        actualAudibleLatencyMs: null, contextState: audio.state };
      timer = startTimer(() => { void tick(); });
      return true;
    } catch (reason) {
      if (request === command) { error = reason.message; halt(savedFrame, 'paused', false); for (const path of Object.values(paths)) retire(path); }
      throw reason;
    } finally { if (request === command) starting = false; }
  }
  async function seek(seconds) {
    if (!tracks || !Number.isFinite(seconds) || seconds < 0 || seconds > tracks.transients.frames / context.sampleRate) throw new Error('Invalid seek position.');
    const wasPlaying = playing(), target = Math.round(seconds * context.sampleRate);
    halt(target, wasPlaying ? 'playing' : 'paused', false);
    if (!wasPlaying) return whenReady();
    // A playing seek changes the shared timeline immediately, independent of PCM readiness.
    anchorFrame = target; anchorTime = context.currentTime + leadSeconds;
    for (const path of Object.values(paths)) path.activationRequestedMs = nowMs();
    const token = generation;
    try { await enqueue(async () => {
      if (token !== generation) return;
      for (const path of Object.values(paths)) for (const chunk of path.chunks) schedule(path, chunk);
      await fill(token);
    }); } catch (reason) {
      if (token === generation) { error = reason.message; halt(frame(), 'paused', false); }
      throw reason;
    }
    if (token === generation) timer = startTimer(() => { void tick(); });
  }
  function setWindow(seconds) {
    if (playing() || starting) throw new Error('Stop before changing window.');
    if (![1,2,5].includes(seconds)) throw new Error('Window must be 1, 2 or 5 seconds.');
    windowSeconds = seconds;
  }
  function setSchedulingLead(seconds) {
    if (playing() || starting || ![.01,.05].includes(seconds)) throw new Error('Stop and select a 10 or 50 ms scheduling lead.');
    leadSeconds = seconds;
  }
  function setEnabled(name, enabled) {
    const path = paths[name];
    if (!path || typeof enabled !== 'boolean' || closed) throw new Error('Invalid stem activation.');
    if (path.enabled === enabled) return;
    path.enabled = enabled; path.epoch++; path.activationRequestedMs = nowMs(); retire(path);
    path.next = frame();
    if (playing()) void tick(); else { generation++; readyWork = null; prepareInBackground(); }
  }
  function setLevel(name, value) {
    const path = paths[name];
    if (!path || !Number.isFinite(value) || value < 0 || value > 1 || closed) throw new Error('Invalid gain.');
    if (path.gain && playing() && path.enabled && !path.opening) {
      const now = context.currentTime, ramp = path.ramp;
      const from = ramp ? (now >= ramp.end ? ramp.target : ramp.from + (ramp.target - ramp.from) * Math.max(0, (now - ramp.start) / (ramp.end - ramp.start))) : path.level;
      const start = ramp && now < ramp.start ? ramp.start : now;
      path.gain.gain.cancelScheduledValues(now); path.gain.gain.setValueAtTime(from, now);
      if (start > now) path.gain.gain.setValueAtTime(from, start);
      path.gain.gain.linearRampToValueAtTime(value, start + .01);
      path.ramp = { from, target: value, start, end: start + .01 };
    }
    path.level = value;
  }
  async function close() {
    if (closed) return;
    halt(frame(), 'stopped', false); closed = true; loading = false; tracks = null;
    for (const path of Object.values(paths)) { retire(path); path.gain?.disconnect(); path.gain = null; }
    if (context && context.state !== 'closed') await context.close();
  }
  return Object.freeze({ loadFiles, play, pause, stop, seek, setWindow, setSchedulingLead, setEnabled, setLevel, close, tick, whenReady,
    getState() {
      const sampleRate = context?.sampleRate || 0, position = sampleRate ? frame() / sampleRate : 0;
      return { loaded: !!tracks, loading, playing: playing(), transport, starting, preparing: !!work,
        ready: isReady(), closed, windowSeconds, sampleRate, schedulingLeadMs: leadSeconds * 1000,
        position, timeline: { sourceFrame: frame(), anchorFrame, anchorContextTime: anchorTime, running: playing() }, duration: tracks ? tracks.transients.frames / sampleRate : 0,
        applicationPcmBytes: pcmBytes(), peakPcmBytes, inFlightReadBytes,
        capacityPcmBytes: tracks ? Object.values(tracks).reduce((sum, wav) => sum + windowSeconds * wav.rate * wav.channels * 4, 0) : 0,
        preparationMs, lastPreparation, preparationTotals: { ...totals }, lastStartup, underruns, error,
        formats: tracks ? Object.fromEntries(Object.entries(tracks).map(([name,wav]) => [name, {
          file: wav.file.name || 'Selected file', container: wav.container, compression: wav.compression || null,
          littleEndian: wav.littleEndian, tag: wav.tag, encoding: wav.encoding === 3 ? 'IEEE float' : 'integer PCM',
          bits: wav.bits, validBits: wav.validBits, channels: wav.channels, rate: wav.rate, frames: wav.frames }])) : null,
        stems: Object.fromEntries(Object.entries(paths).map(([name,path]) => [name, {
          enabled: path.enabled, level: path.level, position, lastActivation: path.lastActivation,
          queuedFrames: path.chunks.reduce((sum, chunk) => sum + chunk.frames, 0),
          occupancySeconds: path.chunks.reduce((sum, chunk) => sum + (chunk.when === null ?
            Math.max(0, chunkEnd(chunk) - savedFrame) / sampleRate : Math.max(0, chunk.when + chunk.playFrames / sampleRate - Math.max(context.currentTime, chunk.when))), 0)
        }])) };
    }
  });
}
