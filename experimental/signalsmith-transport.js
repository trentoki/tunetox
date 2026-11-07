// The official DSP/wrapper is imported unchanged. No metadata, cues, or sync calls.
function createSignalsmithPlayer(options = {}) {
  const moduleUrl = options.moduleUrl || new URL(
    './vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs', document.baseURI).href;
  const createContext = options.createContext || (rate => new AudioContext(rate ? { sampleRate: rate } : undefined));
  const importLibrary = options.importLibrary || (() => import(moduleUrl));
  const createOutput = options.createOutput || createComparisonOutput;
  // Experimental startup smoothing; adjust to 0.003 or 0.005 for listening comparisons.
  const startupRampSeconds = options.startupRampSeconds ?? 0.004;
  if (!Number.isFinite(startupRampSeconds) || startupRampSeconds < 0) {
    throw new Error('Signalsmith startupRampSeconds must be finite and nonnegative.');
  }
  const diagnostics = options.diagnostics ||
    (typeof signalsmithDiagnostics !== 'undefined' ? signalsmithDiagnostics : null);
  function capture(method, current, details) {
    try { diagnostics?.[method](current, details); }
    catch (_) { /* Diagnostic failures must never prevent playback. */ }
  }
  let persistentContextMode = options.persistentContext === true;
  let retainedContext = null;
  let retainedOwner = null;
  let shutDown = false;
  let changingContextMode = false;
  let contextCount = 0;
  let sessionCount = 0;
  const closeTasks = new Set();
  // Experimental release; 0 restores immediate Pause/Stop muting.
  const releaseSeconds = options.releaseSeconds ?? 0.005;
  if (!Number.isFinite(releaseSeconds) || releaseSeconds < 0) throw new Error('Invalid Signalsmith releaseSeconds');
  let releasing = null;
  let libraryPromise = null;
  let session = null;
  let pcm = null;
  let duration = 0;
  let sourceSampleRate = null;
  let fileName = '';
  let loading = false;
  let busy = false;
  let playing = false;
  let savedPosition = 0;
  let originalBpm = null;
  let targetBpm = null;
  let playbackRate = 1;
  let comparisonLevel = 0.25;
  let generation = 0;
  let action = 0;
  let errorMessage = '';
  let segments = [];
  // Temporary B2.6 lifecycle experiment: false restores nonblocking replacement.
  const serializeContextClosure = options.serializeContextClosure ?? true;
  const closing = new Set();
  const closureFailures = new Map();
  function closureStatus() {
    if (!serializeContextClosure) return '';
    if (closureFailures.size) return Array.from(closureFailures.values())[0];
    return closing.size ? 'Signalsmith context is still closing. Load/Play unavailable; click again after closure completes.' : '';
  }
  function requireClosureComplete() {
    if (releasing) throw new Error('Signalsmith release is finishing. Click again when ready.');
    if (shutDown) throw new Error('Signalsmith engine is shut down. Reload to start again.');
    if (changingContextMode) throw new Error('Signalsmith context mode is changing. Click again when closure completes.');
    const message = closureStatus();
    if (message) throw new Error(message);
  }
  const preparing = new Set();
  const nowMs = options.now || (() => Date.now());
  const setTimer = options.setTimer || (typeof setTimeout === 'function' ? setTimeout : null);
  const clearTimer = options.clearTimer || (typeof clearTimeout === 'function' ? clearTimeout : () => {});
  const limits = { resume: 15000, read: 30000, decode: 60000, import: 15000,
    ready: 20000, buffers: 15000, latency: 10000, updates: 10000,
    schedule: 10000, close: 5000, ...options.timeouts };
  const log = options.log || (record => console.log('[TuneFlow Signalsmith]', JSON.stringify(record)));
  let diagnostic = null;

  function browserActivation() {
    const activation = typeof navigator !== 'undefined' ? navigator.userActivation : null;
    return { userActivationSupported: !!activation,
      userActivationActive: activation ? activation.isActive : null,
      userActivationHasBeenActive: activation ? activation.hasBeenActive : null };
  }

  function report(current, stage, event, details = {}) {
    const record = { attempt: current.id, stage, event,
      elapsedMs: nowMs() - current.started, wallTimeMs: Date.now(),
      contextTime: current.context ? current.context.currentTime : null,
      performanceTimeMs: typeof performance !== 'undefined' ? performance.now() : null, contextState: current.context ? current.context.state : 'not-created',
      contextId: current.contextId ?? null, sessionId: current.sessionId ?? null,
      persistentContext: persistentContextMode, ...current.file, ...browserActivation(), ...details };
    if (current.id === generation) diagnostic = record;
    capture('event', current, record);
    log(record);
  }

  async function waitFor(current, stage, operation) {
    current.stage = stage;
    report(current, stage, 'start');
    let timer;
    try {
      // Invoke now so resume() stays in the original user gesture.
      const work = Promise.resolve(current.disposed ? undefined : operation());
      const deadline = new Promise((resolve, reject) => {
        if (setTimer) timer = setTimer(() => reject(new Error(
          'Signalsmith ' + stage + ' timed out after ' + limits[stage] / 1000 +
          ' seconds. Browser work may still be pending; its result will be ignored.')), limits[stage]);
      });
      const value = await Promise.race([work, current.cancelled, current.failed, deadline]);
      report(current, stage, current.disposed ? 'abandoned' : 'complete');
      return value;
    } catch (error) {
      report(current, stage, 'error', { message: error.message });
      throw new Error('Signalsmith ' + stage + ': ' + error.message);
    } finally { if (timer !== undefined) clearTimer(timer); }
  }

  function clamp(value) { return Math.max(0, Math.min(duration, value)); }

  // This is our scheduled source-coordinate estimate, not a DSP-consumption counter.
  function sourceAt(time) {
    let result = savedPosition;
    for (const segment of segments) {
      if (time < segment.time) break;
      result = segment.source + (segment.active ? (time - segment.time) * segment.rate : 0);
    }
    return clamp(result);
  }

  function mute(current) {
    if (!current.output) return;
    const muteTime = current.context.currentTime;
    current.output.level.cancelScheduledValues(muteTime);
    current.output.level.value = 0;
    capture('event', current, { type: 'gain-mute', cancelFrom: muteTime, value: 0 });
    current.startupRamp = null;
    current.completionCutoff = null;
  }

  function dispose(current) {
    if (!current || current.disposed) return Promise.resolve();
    current.disposed = true;
    capture('close', current, 'session disposed');
    current.cancel();
    preparing.delete(current);
    // Every cleanup runs even if another step fails. Retained contexts have a separate owner.
    const cleanup = [
      () => mute(current),
      () => { if (current.node) current.node.onprocessorerror = null; },
      () => current.node?.disconnect(),
      () => { if (current.node) current.node.port.onmessage = null; },
      () => current.node?.port.close(),
      () => current.output?.disconnect()
    ];
    for (const operation of cleanup) {
      try { operation(); }
      catch (error) { report(current, 'close', 'disconnect-error', { message: error.message }); }
    }
    if (!current.ownsContext) {
      report(current, 'session-dispose', 'complete', { contextRetained: true });
      return Promise.resolve();
    }
    return closeContext(current);
  }

  function closeContext(current) {
    let timer;
    let rawClose;
    try {
      capture('event', current, { type: 'context-close-requested' });
      rawClose = Promise.resolve(current.context.close());
    }
    catch (error) { rawClose = Promise.reject(error); }
    closing.add(rawClose);
    rawClose.then(() => {
      closing.delete(rawClose);
      closureFailures.delete(rawClose);
      report(current, 'close', 'complete', { outcome: 'resolved' });
    }, error => {
      closing.delete(rawClose);
      const message = 'Signalsmith context closure failed: ' + (error.message || String(error)) + '. Reload the page before trying again.';
      closureFailures.set(rawClose, message);
      report(current, 'close', 'error', { outcome: 'rejected', message });
    });
    const deadline = new Promise(resolve => {
      if (setTimer) timer = setTimer(() => {
        closureFailures.set(rawClose, 'Signalsmith context closure timed out. Browser closure is still pending; Load/Play remain unavailable.');
        report(current, 'close', 'still-pending', { message: 'UI released; browser context closure is not confirmed.' });
        resolve();
      }, limits.close);
    });
    const task = Promise.race([rawClose.catch(() => {}), deadline]).finally(() => {
      if (timer !== undefined) clearTimer(timer);
      closeTasks.delete(task);
    });
    closeTasks.add(task);
    return task;
  }

  async function prepare(current, channels) {
    if (!libraryPromise) {
      const pendingImport = Promise.resolve().then(importLibrary);
      libraryPromise = pendingImport;
      pendingImport.catch(() => { if (libraryPromise === pendingImport) libraryPromise = null; });
    }
    const thisImport = libraryPromise;
    let module;
    try { module = await waitFor(current, 'import', () => thisImport); }
    catch (error) { if (libraryPromise === thisImport) libraryPromise = null; throw error; }
    if (current.disposed) return false;
    if (current.context.state !== 'running') throw new Error('Signalsmith ready: context is ' + current.context.state);
    const factory = module.default;
    factory.moduleUrl = moduleUrl; // Register the same local self-contained module.
    capture('event', current, { type: 'signalsmith-processor-creation-requested' });
    const pendingNode = factory(current.context); // Keep default channel configuration.
    pendingNode.then(lateNode => {
      if (current.disposed) { lateNode.disconnect(); lateNode.port.close(); }
    }, () => {});
    const node = await waitFor(current, 'ready', () => pendingNode);
    if (!node) return false;
    current.node = node;
    capture('event', current, { type: 'signalsmith-processor-created', observation: 'upstream factory ready; constructor ran earlier' });
    if (current.disposed) { node.disconnect(); node.port.close(); return false; }
    current.output = createOutput(current.context);
    mute(current);
    node.connect(current.output.input);
    capture('attach', current);
    node.onprocessorerror = () => {
      if (current.disposed) return;
      const error = new Error('Signalsmith processor failed during ' + current.stage + '. Eject and reload.');
      current.failure = error;
      current.fail(error);
      report(current, current.stage, 'processor-error', { message: error.message });
      if (session === current) { errorMessage = error.message; playing = false; }
      mute(current);
    };
    // Transfer copies: retain original PCM for Stop/restart and source-coordinate analysis.
    const copies = channels.map(channel => new Float32Array(channel));
    await waitFor(current, 'buffers', () => node.addBuffers(copies, copies.map(channel => channel.buffer)));
    if (current.disposed) return false;
    current.dspLatency = await waitFor(current, 'latency', () => node.latency());
    if (current.disposed) return false;
    if (!Number.isFinite(current.dspLatency) || current.dspLatency < 0) {
      throw new Error('Signalsmith returned an invalid DSP latency.');
    }
    await waitFor(current, 'updates', () => node.setUpdateInterval(0.05, value => {
      if (!current.disposed) current.reportedInput = value;
    }));
    if (current.failure) throw current.failure;
    return !current.disposed;
  }

  function newSession(file = {}) {
    requireClosureComplete();
    const current = { id: generation, started: nowMs(), file, context: null,
      node: null, output: null, dspLatency: 0, reportedInput: null, disposed: false, stage: 'context' };
    report(current, 'context', 'start', { requestedSampleRate: sourceSampleRate });
    current.ownsContext = !persistentContextMode;
    current.sessionId = ++sessionCount;
    const reusedContext = persistentContextMode && !!retainedContext;
    if (persistentContextMode && retainedContext) {
      if (retainedContext.state === 'closed') throw new Error('Retained Signalsmith context unexpectedly closed. Disable the experiment or reload.');
      current.context = retainedContext;
      current.contextId = retainedOwner.contextId;
    } else {
      current.context = createContext(sourceSampleRate);
      current.contextId = ++contextCount;
      if (persistentContextMode) {
        retainedContext = current.context;
        // Owner holds no processor/output/PCM references after individual sessions retire.
        retainedOwner = { id: generation, started: nowMs(), file: {}, context: retainedContext,
          contextId: current.contextId, sessionId: null };
      }
    }
    capture('begin', current);
    current.cancelled = new Promise(resolve => { current.cancel = resolve; });
    current.failed = new Promise((resolve, reject) => { current.fail = reject; });
    current.failed.catch(() => {});
    preparing.add(current);
    report(current, 'context', 'complete', { actualSampleRate: current.context.sampleRate,
      reused: reusedContext });
    return current;
  }

  async function loadFile(deckId, file) {
    requireClosureComplete();
    if (busy) return false;
    const version = ++generation;
    ++action;
    for (const previous of Array.from(preparing)) void dispose(previous);
    loading = true;
    errorMessage = '';
    let candidate = null;
    const loadStarted = nowMs();
    try {
      candidate = newSession({ fileName: file.name, fileBytes: file.size ?? null, fileType: file.type || 'unspecified' });
      await waitFor(candidate, 'resume', () => candidate.context.resume());
      if (!candidate.disposed && candidate.context.state !== 'running') throw new Error('Signalsmith resume: context is ' + candidate.context.state);
      if (candidate.disposed) return false;
      const bytes = await waitFor(candidate, 'read', () => file.arrayBuffer());
      if (candidate.disposed) return false;
      const decoded = await waitFor(candidate, 'decode', () => candidate.context.decodeAudioData(bytes));
      if (candidate.disposed || version !== generation) return false;
      if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) {
        throw new Error('Signalsmith comparison supports mono or stereo files.');
      }
      report(candidate, 'decode', 'metadata', { channels: decoded.numberOfChannels,
        decodedSampleRate: decoded.sampleRate, durationSeconds: decoded.duration, frames: decoded.length });
      report(candidate, 'pcm-copy', 'start');
      const channels = [];
      for (let index = 0; index < decoded.numberOfChannels; index++) {
        channels.push(new Float32Array(decoded.getChannelData(index)));
      }
      report(candidate, 'pcm-copy', 'complete', { pcmBytes: channels.reduce((sum, channel) => sum + channel.byteLength, 0) });
      if (!await prepare(candidate, channels) || version !== generation) return false;
      // A load already in progress must not dispose a session midway through its release.
      if (releasing) await releasing.done;
      if (candidate.disposed || version !== generation) return false;
      if (candidate.failure) throw candidate.failure;
      if (session) void dispose(session);
      session = candidate;
      preparing.delete(candidate);
      pcm = channels;
      duration = decoded.duration;
      sourceSampleRate = candidate.context.sampleRate;
      fileName = file.name;
      originalBpm = null;
      targetBpm = null;
      playbackRate = 1;
      savedPosition = 0;
      playing = false;
      segments = [];
      errorMessage = '';
      report(candidate, 'ready', 'committed');
      return true;
    } catch (error) {
      if (version !== generation || (candidate && candidate.disposed)) return false;
      if (version === generation) errorMessage = error.message;
      if (!candidate) {
        diagnostic = { attempt: version, stage: 'context', event: 'error', elapsedMs: nowMs() - loadStarted,
          contextState: 'not-created', fileName: file.name, fileBytes: file.size ?? null, fileType: file.type || 'unspecified', message: error.message };
        log(diagnostic);
      }
      throw error;
    } finally {
      if (version === generation) loading = false;
      if (session !== candidate) void dispose(candidate);
    }
  }

  function openOutput(current, when) {
    mute(current);
    const gain = current.output.level;
    gain.setValueAtTime(0, current.context.currentTime);
    gain.setValueAtTime(0, when);
    const end = when + startupRampSeconds;
    current.startupRamp = { time: when, value: 0, end, target: comparisonLevel };
    if (startupRampSeconds === 0) gain.setValueAtTime(comparisonLevel, when);
    else gain.linearRampToValueAtTime(comparisonLevel, end);
    report(current, 'startup-gain', 'scheduled', { audioStartTime: when,
      rampEndTime: end, rampSeconds: startupRampSeconds, targetLevel: comparisonLevel });
  }

  function planCompletion() {
    if (!session || !playing) return;
    const current = session;
    const last = segments[segments.length - 1];
    scheduleCompletion(current, last.time + (duration - last.source) / last.rate);
  }

  function scheduleCompletion(current, endTime) {
    const now = current.context.currentTime;
    current.endTime = endTime;
    const cutoff = current.endTime + current.dspLatency;
    if (cutoff <= now) {
      // An acknowledgement may arrive after the entire scheduled playback interval.
      mute(current);
      return;
    }
    const previous = current.completionCutoff;
    if (previous === cutoff) return;
    if (previous !== null && previous !== undefined) {
      // Only remove the old cutoff, never the opening envelope.
      current.output.level.cancelScheduledValues(Math.max(now, previous));
    }
    capture('event', current, { type: 'completion-cutoff', cutoff, replacedCutoff: previous ?? null });
    current.output.level.setValueAtTime(0, cutoff);
    current.completionCutoff = cutoff;
  }

  function updateOutputLevel() {
    const current = session;
    const now = current.context.currentTime;
    if (now >= current.endTime + current.dspLatency) {
      mute(current);
      return;
    }
    capture('event', current, { type: 'comparison-trim', target: comparisonLevel });
    const gain = current.output.level;
    const ramp = current.startupRamp;
    gain.cancelScheduledValues(now);
    if (ramp && now < ramp.end) {
      // Only an explicit trim change reshapes the remaining startup envelope.
      const fraction = Math.max(0, Math.min(1, (now - ramp.time) / (ramp.end - ramp.time)));
      const value = ramp.value + (ramp.target - ramp.value) * fraction;
      const start = Math.max(now, ramp.time);
      gain.setValueAtTime(value, now);
      if (start > now) gain.setValueAtTime(value, start);
      gain.linearRampToValueAtTime(comparisonLevel, ramp.end);
      current.startupRamp = { time: start, value, end: ramp.end, target: comparisonLevel };
    } else {
      gain.setValueAtTime(comparisonLevel, now);
      current.startupRamp = null;
    }
    capture('event', current, { type: 'gain-trim-automation', cancelFrom: now,
      ramp: current.startupRamp ? { ...current.startupRamp } : null, targetLevel: comparisonLevel });
    // Explicit trim changes own level automation; completion must then be restored.
    current.completionCutoff = null;
    scheduleCompletion(current, current.endTime);
  }

  async function play() {
    requireClosureComplete();
    if (!pcm || loading || busy || playing || (session && session.failure)) return;
    const version = generation;
    const request = ++action;
    busy = true;
    let current = session;
    try {
      if (!current) {
        current = newSession();
        session = current;
        await waitFor(current, 'resume', () => current.context.resume());
        if (!await prepare(current, pcm)) return;
        preparing.delete(current);
      } else await waitFor(current, 'resume', () => current.context.resume());
      if (version !== generation || request !== action || current.disposed) return;
      if (current.context.state !== 'running') throw new Error('Safari did not resume Signalsmith audio.');
      if (savedPosition >= duration) savedPosition = 0;
      const when = current.context.currentTime + current.dspLatency;
      capture('arm', current, { audioStartTime: when, rampEndTime: when + startupRampSeconds,
        rampSeconds: startupRampSeconds, targetLevel: comparisonLevel, sourceCoordinate: savedPosition,
        playbackRate, dspLatency: current.dspLatency, fileName, duration, contextsClosing: closing.size });
      current.pendingStart = { time: when, source: savedPosition, rate: playbackRate };
      openOutput(current, when);
      scheduleCompletion(current, when + (duration - savedPosition) / playbackRate);
      await waitFor(current, 'schedule', () => current.node.schedule({ active: true, input: savedPosition,
        output: when, rate: playbackRate, semitones: 0 }));
      capture('event', current, { type: 'play-acknowledged', request, stale:
        version !== generation || request !== action || current.disposed });
      if (version !== generation || request !== action || current.disposed) return;
      segments.push({ time: when, source: savedPosition, rate: playbackRate, active: true });
      current.pendingStart = null;
      playing = true;
      current.startDeadline = nowMs() + limits.resume;
      planCompletion();
    } catch (error) {
      if (version !== generation || request !== action || (current && current.disposed)) return;
      if (current && session === current) { session = null; void dispose(current); }
      throw error;
    } finally { if (request === action) busy = false; }
  }

  function beginRelease(current, kind, bookmark) {
    const now = current.context.currentTime;
    const release = { current, kind, bookmark, command: action, end: now + releaseSeconds,
      deadline: nowMs() + 750, observedClock: null, timer: null };
    release.done = new Promise(resolve => { release.resolve = resolve; });
    releasing = release;
    try {
      const gain = current.output.level;
      const ramp = current.startupRamp;
      const from = ramp && now < ramp.end
        ? ramp.value + (ramp.target - ramp.value) * Math.max(0, Math.min(1, (now - ramp.time) / (ramp.end - ramp.time)))
        : (Number.isFinite(gain.value) ? gain.value : comparisonLevel);
      if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
      else gain.cancelScheduledValues(now);
      // Anchor the release explicitly so its ramp cannot start at an older automation event.
      gain.setValueAtTime(from, now);
      gain.linearRampToValueAtTime(0, release.end);
      current.startupRamp = null;
      current.completionCutoff = null;
      report(current, 'release', 'scheduled', { kind, start: now, end: release.end, bookmark });
    } catch (error) { finishRelease(release, error.message); return release.done; }
    function poll() {
      if (releasing !== release) return;
      const clock = current.context.currentTime;
      if (current.context.state !== 'running') { finishRelease(release, 'Audio context stopped during release.'); return; }
      // Observe a further clock advance after the block containing the endpoint.
      if (release.observedClock !== null && clock > release.observedClock) { finishRelease(release); return; }
      if (clock > release.end && release.observedClock === null) release.observedClock = clock;
      if (nowMs() >= release.deadline || !setTimer) { finishRelease(release, 'Release render confirmation timed out.'); return; }
      release.timer = setTimer(poll, 4);
    }
    poll();
    return release.done;
  }

  function finishRelease(release, failure = '') {
    if (releasing !== release) return;
    if (release.timer !== null) clearTimer(release.timer);
    const current = release.current;
    try {
      mute(current);
      if (failure) {
        if (release.kind === 'pause' && session === current && release.command === action) {
          const pending = current.pendingStart;
          savedPosition = pending ? clamp(pending.source + Math.max(0, current.context.currentTime - pending.time) * pending.rate) : sourceAt(current.context.currentTime);
        }
        errorMessage = failure + ' Output muted; release completion was not verified.';
        report(current, 'release', 'abandoned', { message: errorMessage });
      } else report(current, 'release', 'render-confirmed', { end: release.end });
      if (!failure && release.kind === 'pause' && release.command === action && session === current && !current.disposed) {
        // Only now deactivate DSP; stopping it earlier could interrupt the audible tail.
        current.pendingStart = null;
        segments.push({ time: release.end, source: release.bookmark, rate: playbackRate, active: false });
        waitFor(current, 'schedule', () => current.node.schedule({ active: false, input: release.bookmark,
          output: current.context.currentTime, semitones: 0 })).catch(error => {
          if (session === current && action === release.command) {
            errorMessage = error.message; session = null; void dispose(current);
          }
        });
      } else {
        if (session === current) session = null;
        void dispose(current);
      }
    } catch (error) {
      errorMessage = 'Signalsmith release cleanup failed: ' + error.message;
      if (session === current) session = null;
      void dispose(current);
    } finally {
      releasing = null;
      release.resolve();
    }
  }

  async function pause() {
    if (releasing) return releasing.done;
    const wasBusy = busy;
    ++action;
    busy = false;
    if (!session || (!playing && !wasBusy)) return;
    const current = session;
    const now = current.context.currentTime;
    const canRelease = releaseSeconds > 0 && (playing || (wasBusy && current.pendingStart)) && current.output && current.context.state === 'running';
    const bookmarkTime = now + (canRelease ? releaseSeconds : 0);
    savedPosition = canRelease && wasBusy && current.pendingStart
      ? clamp(current.pendingStart.source + Math.max(0, bookmarkTime - current.pendingStart.time) * current.pendingStart.rate)
      : sourceAt(bookmarkTime);
    playing = false;
    if (canRelease) return beginRelease(current, 'pause', savedPosition);
    capture('cancel', current, 'pause');
    mute(current); // Do not wait for the DSP tail to become silent.
    segments.push({ time: now, source: savedPosition, rate: playbackRate, active: false });
    await waitFor(current, 'schedule', () => current.node.schedule({ active: false, input: savedPosition, output: now, semitones: 0 }));
  }

  async function stop() {
    const wasPlaying = playing || (busy && session && session.pendingStart);
    capture('action', session, 'stop-requested');
    if (session) {
      report(session, 'stop', 'requested');
      capture('snapshot', session, 'stop');
    }
    ++generation;
    ++action;
    busy = false;
    loading = false;
    playing = false;
    savedPosition = 0;
    segments = [];
    const old = session;
    session = null;
    if (releasing) {
      releasing.kind = 'stop';
      releasing.command = action;
    } else if (old && wasPlaying && releaseSeconds > 0 && old.output && old.context.state === 'running') {
      void beginRelease(old, 'stop', 0);
    } else void dispose(old);
    for (const candidate of Array.from(preparing)) void dispose(candidate);
  }

  async function eject() {
    capture('action', session, 'eject-requested');
    if (session) report(session, 'eject', 'requested');
    const stopped = stop();
    pcm = null;
    duration = 0;
    fileName = '';
    sourceSampleRate = null;
    loading = false;
    originalBpm = null;
    targetBpm = null;
    playbackRate = 1;
    errorMessage = '';
    libraryPromise = null; // Same URL; no cache-busting or duplicate registration on an existing context.
    diagnostic = null;
    await stopped;
  }

  async function releaseRetainedContext() {
    if (retainedOwner) {
      const owner = retainedOwner;
      retainedContext = null;
      retainedOwner = null;
      void closeContext(owner);
    }
    await Promise.all(Array.from(closeTasks));
    if (closing.size || closureFailures.size) {
      throw new Error(Array.from(closureFailures.values())[0] || 'Signalsmith context closure is still pending.');
    }
  }

  async function setPersistentContext(enabled) {
    requireClosureComplete();
    enabled = !!enabled;
    if (enabled === persistentContextMode) return true;
    if (pcm || loading || busy || session || preparing.size) throw new Error('Eject before changing Signalsmith context mode.');
    changingContextMode = true;
    try {
      await releaseRetainedContext();
      persistentContextMode = enabled;
      return true;
    } finally { changingContextMode = false; }
  }

  async function shutdown() {
    shutDown = true;
    await eject();
    if (releasing) await releasing.done;
    await releaseRetainedContext();
  }

  function setTempo(deckId, original, target) {
    const rate = calculatePlaybackRate(original, target);
    if (!pcm || loading || busy || releasing || (session && session.failure) || rate === null || rate < 0.8 || rate > 1.2) return false;
    if (session && playing) {
      const now = session.context.currentTime;
      const when = now; // Immediate library scheduling; audible response is latency-dependent.
      const position = sourceAt(when);
      const current = session;
      waitFor(current, 'schedule', () => current.node.schedule({ active: true, rate, input: position, output: when, semitones: 0 })).catch(error => {
        if (session === current) { errorMessage = error.message; mute(current); playing = false; }
      });
      // Replace unexecuted future changes just as the library schedule API does.
      segments = segments.filter(segment => segment.time < when);
      segments.push({ time: when, source: position, rate, active: true });
    }
    originalBpm = original;
    targetBpm = target;
    playbackRate = rate;
    planCompletion();
    return true;
  }

  function setComparisonLevel(value) {
    if (!Number.isFinite(value) || value < 0 || value > 0.25) return false;
    comparisonLevel = value;
    if (!releasing && (playing || (busy && session && session.startupRamp))) updateOutputLevel();
    return true;
  }

  function getState() {
    const current = session;
    if (current && playing && segments.length && current.context.currentTime < segments[0].time &&
        nowMs() >= current.startDeadline) {
      errorMessage = 'Signalsmith startup timed out: the audio clock did not reach the scheduled start. Eject and retry.';
      report(current, 'startup', 'error', { message: errorMessage });
      playing = false;
      session = null;
      void dispose(current);
    }
    const latency = current ? (current.context.baseLatency || 0) + (current.context.outputLatency || 0) : 0;
    if (current && playing && current.context.currentTime >= current.endTime + current.dspLatency) {
      playing = false;
      savedPosition = duration;
      segments = [];
      mute(current);
      session = null;
      void dispose(current);
    }
    const now = current ? current.context.currentTime : 0;
    const position = playing ? sourceAt(now - latency) : savedPosition;
    const starting = current && playing && segments.length && now < segments[0].time;
    return { loaded: pcm !== null, loading: loading || busy || !!starting || !!releasing, isPlaying: playing,
      releasePending: !!releasing, releaseSeconds,
      persistentContext: persistentContextMode, contextId: current ? current.contextId : retainedOwner?.contextId ?? null,
      engineShutDown: shutDown, changingContextMode,
      fileName, duration, originalBpm, targetBpm, playbackRate, position, comparisonLevel,
      // Source extent and reported read-ahead are known values, not audible-position guarantees.
      sourceSampleRate, sourceDuration: duration, savedSourcePosition: savedPosition,
      libraryInputPosition: current ? current.reportedInput : null,
      sourcePosition: null, processedPosition: null, renderedPosition: null,
      estimatedAudiblePosition: position, estimatedOutputLatency: latency,
      dspLatency: current ? current.dspLatency : null,
      bufferedFrames: null, underruns: null, contextsClosing: closing.size,
      closureBlocked: !!closureStatus() || changingContextMode || shutDown,
      closureStatus: shutDown ? 'Signalsmith engine shut down. Reload to restart.' : changingContextMode ? 'Changing Signalsmith context mode; waiting for closure.' : closureStatus(),
      diagnostic, error: errorMessage || closureStatus(), ...(current && current.output ? current.output.read() : { outputPeak: 0, outputRms: 0 }) };
  }

  return { loadFile, play, pause, stop, eject, setTempo, setComparisonLevel, getState, setPersistentContext, shutdown };
}
