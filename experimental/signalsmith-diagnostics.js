// Opt-in, bounded diagnostics. Failures never propagate to playback.
function createSignalsmithDiagnostics(options = {}) {
  const sessions = new WeakMap();
  const captures = [];
  const lifecycle = [];
  const active = new Set();
  let enabled = false;
  let nextSession = 0;
  let nextCapture = 0;
  let message = 'Disabled';
  const createNode = options.createNode || (context => new AudioWorkletNode(context,
    'tuneflow-signalsmith-recorder', { numberOfInputs: 2, numberOfOutputs: 1,
      outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete' }));
  function event(current, type, details = {}) {
    const entry = sessions.get(current);
    if (!entry && (!enabled || !current?.context)) return;
    if (typeof type === 'object') { details = type; type = details.type || 'adapter-event'; }
    try {
      let outputTimestamp = null;
      try { outputTimestamp = current.context.getOutputTimestamp?.() || null; } catch (_) {}
      const record = { type, outputTimestamp, wallTimeMs: Date.now(),
        baseLatency: current.context.baseLatency ?? null, outputLatency: current.context.outputLatency ?? null, contextTime: current.context.currentTime,
        performanceTime: typeof performance !== 'undefined' ? performance.now() : null,
        contextState: current.context.state, ...details, contextId: current.contextId ?? null, sessionId: entry?.id ?? null };
      if (entry) entry.events.push(record);
      lifecycle.push(record);
      if (lifecycle.length > 1000) lifecycle.shift();
      if (entry && entry.events.length > 500) { entry.events.shift(); entry.eventsTruncated = true; }
    } catch (_) { /* Diagnostics must not affect playback. */ }
  }
  function action(current, type) {
    if (!enabled) return;
    lifecycle.push({ type, sessionId: sessions.get(current)?.id ?? null,
      wallTimeMs: Date.now(), performanceTime: typeof performance !== 'undefined' ? performance.now() : null,
      contextTime: current?.context.currentTime ?? null });
    if (lifecycle.length > 1000) lifecycle.shift();
  }
  function makeCapture(current, kind, command, scheduling = {}) {
    const entry = sessions.get(current);
    const result = { id: ++nextCapture, kind, sessionId: entry.id, complete: false,
      reason: 'capture pending; audio before the diagnostic tap is unobserved',
      sampleRate: current.context.sampleRate, scheduling, file: current.file,
      events: entry.events, lifecycle,
      coverage: {
        beforeTap: 'Unobserved: includes context creation/resume and processor initialization before tap-ready.',
        afterRetirement: 'Unobserved: no recorder survives context closure.',
        destination: 'Browser/system/device output is not captured; missing PCM does not mean silence.'
      }, command: { ...command, id: nextCapture } };
    captures.push(result);
    if (captures.length > 10) captures.shift();
    return result;
  }
  function snapshot(current, reason) {
    const entry = sessions.get(current);
    if (!entry || entry.closed || !enabled) return;
    event(current, reason + '-snapshot-requested');
    const result = makeCapture(current, 'pre-stop-checkpoint', {}, { reason });
    const stopFrame = Math.round(current.context.currentTime * current.context.sampleRate);
    result.exactStopSnapshot = false;
    if (entry.checkpoint) {
      const checkpoint = entry.checkpoint;
      accept(entry, { ...checkpoint, type: 'capture', id: result.id });
      result.checkpointAtStop = { stopRequestFrame: stopFrame,
        firstFrame: checkpoint.firstFrame, endFrame: checkpoint.endFrame,
        ageFrames: stopFrame - checkpoint.endFrame,
        ageSeconds: (stopFrame - checkpoint.endFrame) / checkpoint.sampleRate,
        receivedWallTimeMs: entry.checkpointReceivedAt,
        windowComplete: checkpoint.complete };
      result.reason = 'Pre-Stop checkpoint; not an exact Stop snapshot. ' + checkpoint.reason;
    } else {
      result.reason = 'Pre-Stop checkpoint unavailable: no periodic PCM delivered before Stop.';
      result.checkpointAtStop = { stopRequestFrame: stopFrame, ageFrames: null, ageSeconds: null };
    }
  }
  function begin(current) {
    if (!enabled || sessions.has(current)) return;
    const entry = { id: ++nextSession, events: [], node: null, closed: false, pending: null };
    sessions.set(current, entry);
    active.add(current);
    event(current, 'session-context-attached', { sampleRate: current.context.sampleRate,
      contextId: current.contextId ?? null, ownsContext: current.ownsContext ?? null });
    entry.loadCapture = makeCapture(current, 'load', { type: 'load' });
    entry.stateListener = () => {
      event(current, 'statechange');
      if (current.context.state === 'closed') current.context.removeEventListener?.('statechange', entry.stateListener);
    };
    current.context.addEventListener?.('statechange', entry.stateListener);
  }
  function accept(entry, data) {
    const capture = captures.find(item => item.id === data.id);
    if (!capture) return;
    Object.assign(capture, data);
    capture.coverage.intervalIsEnvelopeOnly = true;
    capture.coverage.validSampleRangesField = 'validRanges';
    capture.coverage.observedContextInterval = { start: data.firstFrame / data.sampleRate, end: data.endFrame / data.sampleRate };
    capture.coverage.unobservedContextInterval = { start: 0, end: data.firstFrame / data.sampleRate,
      reason: 'No internal samples before the first exported recorder frame.' };
    if (entry.pending === capture) entry.pending = null;
    message = capture.complete ? 'Capture complete' : 'Capture incomplete: ' + capture.reason;
  }
  function attach(current) {
    const entry = sessions.get(current);
    if (!entry || entry.closed) return;
    // No await in the playback path. Late initialization yields explicitly incomplete data.
    const timer = typeof setTimeout === 'function' ? setTimeout(() => {
      message = 'Recorder initialization timed out; playback remains available';
      close(current, message);
    }, 3000) : null;
    entry.timer = timer;
    Promise.resolve().then(() => current.context.audioWorklet.addModule(options.moduleUrl ||
      new URL('./experimental/signalsmith-recorder.js', document.baseURI).href)).then(() => {
      if (timer !== null) clearTimeout(timer);
      if (entry.closed || !enabled) return;
      const node = createNode(current.context);
      entry.node = node;
      node.port.onmessage = ({ data }) => {
        if (entry.closed) return;
        if (data.type === 'checkpoint') {
          entry.checkpoint = data;
          entry.checkpointReceivedAt = Date.now();
          node.port.postMessage({ type: 'checkpoint-ack' });
        } else if (data.type === 'timing') {
          event(current, data.event, { renderFrame: data.frame, renderContextTime: data.frame / data.sampleRate,
            observation: data.observation || 'Block-level observation; not an exact first nonzero sample.' });
        } else accept(entry, data);
      };
      node.onprocessorerror = () => { message = 'Recorder processor failed'; close(current, message); };
      current.node.connect(node, 0, 0);
      current.output.input.connect(node, 0, 1);
      node.connect(current.context.destination);
      event(current, 'diagnostic-tap-ready');
      node.port.postMessage(entry.loadCapture.command);
      if (entry.pending) node.port.postMessage(entry.pending.command);
      message = 'Recorder ready';
    }).catch(error => {
      if (timer !== null) clearTimeout(timer);
      message = 'Recorder unavailable: ' + error.message;
      close(current, message);
    });
  }
  function arm(current, details) {
    const entry = sessions.get(current);
    if (!entry || entry.closed || !enabled) return;
    if (entry.pending) { entry.pending.reason = 'superseded'; entry.pending.complete = false; }
    const rate = current.context.sampleRate;
    const capture = makeCapture(current, 'startup', { type: 'arm',
      startFrame: Math.max(0, Math.round((details.audioStartTime - 0.1) * rate)),
      endFrame: Math.round((details.audioStartTime + 0.5) * rate) }, details);
    entry.pending = capture;
    event(current, 'play-scheduled', details);
    if (entry.node) entry.node.port.postMessage(capture.command);
    message = 'Capturing startup';
  }
  function close(current, reason = 'session disposed') {
    const entry = sessions.get(current);
    if (!entry || entry.closed) return;
    entry.closed = true;
    if (entry.timer !== null && entry.timer !== undefined) clearTimeout(entry.timer);
    active.delete(current);
    event(current, 'recorder-closed', { reason });
    if (current.ownsContext === false) current.context.removeEventListener?.('statechange', entry.stateListener);
    for (const item of captures) {
      if (item.sessionId === entry.id && !item.channels) { item.complete = false; item.reason = item.kind === 'pre-stop-checkpoint' ? item.reason + ' Session disposed without waiting.' : reason + '; capture interrupted or delivery unavailable'; }
    }
    if (entry.node) {
      entry.node.onprocessorerror = null;
      // Cleanup each connection independently, including partially failed initialization.
      const cleanup = [
        () => entry.node.port.postMessage({ type: 'cancel', reason }),
        () => current.node?.disconnect(entry.node),
        () => current.output?.input.disconnect(entry.node),
        () => entry.node.disconnect(),
        () => entry.node.port.close()
      ];
      for (const operation of cleanup) {
        try { operation(); } catch (_) { /* Never delay Stop/Eject for capture data. */ }
      }
    }
    message = reason + (entry.pending ? '; incomplete capture labelled' : '');
  }
  function cancel(current, reason) {
    const entry = sessions.get(current);
    event(current, 'capture-cancelled', { reason });
    if (entry?.pending) {
      entry.pending.complete = false; entry.pending.reason = reason + '; capture interrupted';
      entry.node?.port.postMessage({ type: 'cancel', reason });
    }
  }
  function wav(capture) {
    const channels = capture.channels;
    if (!channels) return null;
    const frames = channels[0].length;
    const buffer = new ArrayBuffer(44 + frames * 16);
    const view = new DataView(buffer);
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
    view.setUint16(22, 4, true); view.setUint32(24, capture.sampleRate, true);
    view.setUint32(28, capture.sampleRate * 16, true); view.setUint16(32, 16, true); view.setUint16(34, 32, true);
    text(36, 'data'); view.setUint32(40, frames * 16, true);
    for (let i = 0; i < frames; i++) for (let c = 0; c < 4; c++) view.setFloat32(44 + (i * 4 + c) * 4, channels[c][i], true);
    return buffer;
  }
  return { begin, attach, event, action, arm, snapshot, close, cancel, wav,
    setEnabled(value) { enabled = !!value;
      if (!enabled) for (const current of Array.from(active)) close(current, 'diagnostics disabled');
      message = enabled ? 'Enabled for the next loaded session' : 'Disabled for new captures'; },
    get enabled() { return enabled; }, get message() { return message; }, get captures() { return captures; } };
}
const signalsmithDiagnostics = createSignalsmithDiagnostics();
