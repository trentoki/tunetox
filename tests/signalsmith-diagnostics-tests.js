async function runSignalsmithDiagnosticsTests(Recorder, clock) {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const processor = new Recorder();
  const results = [];
  processor.port.postMessage = data => { if (data.type === 'capture') results.push(data); };
  const start = 4800;
  processor.port.onmessage({ data: { type: 'arm', id: 1, startFrame: 0, endFrame: 28800 } });
  for (let frame = 0; frame < 28800; frame += 128) {
    clock.frame = frame;
    const before = new Float32Array(128).fill(0.5);
    const after = Float32Array.from(before, (_, i) => 0.5 * 0.25 * Math.max(0, Math.min(1, (frame + i - start) / 192)));
    const out = new Float32Array(128).fill(1);
    processor.process([[before, before], [after, after]], [[out]]);
    check(out.every(value => value === 0), 'Recorder output must remain silent');
  }
  const captured = results[0];
  check(captured.complete && captured.firstFrame === 0 && captured.endFrame === 28800, 'Capture window must align');
  check(captured.blocks.every((b, i) => b.frame === i * 128), 'Render boundaries must remain indexed');
  for (let i = 0; i < 28800; i++) {
    check(near(captured.channels[0][i], 0.5), 'Pre-gain PCM changed');
    check(near(captured.channels[2][i], 0.125 * Math.max(0, Math.min(1, (i - start) / 192))), 'Gain envelope capture mismatch');
  }
  processor.port.onmessage({ data: { type: 'arm', id: 2, startFrame: 28000, endFrame: 50000 } });
  processor.port.onmessage({ data: { type: 'cancel', reason: 'pause' } });
  check(!results[1].complete && results[1].reason === 'pause', 'Cancellation must be incomplete');
  processor.port.onmessage({ data: { type: 'arm', id: 3, startFrame: -100, endFrame: 100 } });
  check(!results[2].complete, 'Unavailable pre-roll must be incomplete');
  for (let frame = 28800; frame < 160000; frame += 128) {
    clock.frame = frame;
    processor.process([[], []], [[new Float32Array(128)]]);
  }
  check(processor.pcm[0].length === 96000 && processor.blocks.length <= 751, 'Recorder storage must stay bounded');

  // A Load window starts at the earliest recorder frame, without any Play request.
  const loadProcessor = new Recorder();
  const loadResults = [];
  loadProcessor.port.postMessage = data => { if (data.type === 'capture') loadResults.push(data); };
  loadProcessor.port.onmessage({ data: { type: 'load', id: 20 } });
  for (let frame = 24000; frame < 48128; frame += 128) {
    clock.frame = frame;
    loadProcessor.process([[new Float32Array(128).fill(0.4), new Float32Array(128)], [new Float32Array(128), new Float32Array(128)]], [[new Float32Array(128)]]);
  }
  check(loadResults[0].complete && loadResults[0].firstFrame === 24000 && loadResults[0].endFrame === 48000,
    'Load-only export must start at the first available block and last 500 ms');
  check(near(loadResults[0].channels[0][0], 0.4) && loadResults[0].channels[2][0] === 0,
    'Load-only capture must retain distinct pre/post-gain PCM');
  loadProcessor.port.onmessage({ data: { type: 'snapshot', id: 21 } });
  check(!loadResults[1].complete && loadResults[1].channels[0].length === 4800,
    'Stop snapshot must return last 100 ms as explicitly best effort');
  const mixed = new Recorder(); const mixedResults = [];
  mixed.port.postMessage = data => { if (data.type === 'capture') mixedResults.push(data); };
  mixed.port.onmessage({ data: { type: 'load', id: 22 } });
  mixed.port.onmessage({ data: { type: 'arm', id: 23, startFrame: 24000, endFrame: 52800 } });
  for (let frame = 24000; frame < 52864; frame += 128) {
    clock.frame = frame;
    mixed.process([[new Float32Array(128), new Float32Array(128)], [new Float32Array(128), new Float32Array(128)]], [[new Float32Array(128)]]);
  }
  check(mixedResults.length === 2 && mixedResults.every(result => result.complete),
    'Load and startup windows must coexist without overwriting each other');
  const nodes = [];
  const calls = [];
  const diagnostics = createSignalsmithDiagnostics({ moduleUrl: 'local-test', createNode: () => {
    const node = { port: { postMessage(data) { calls.push(data.type); }, close() { calls.push('port-close'); } },
      connect() {}, disconnect() { calls.push('disconnect'); } };
    nodes.push(node); return node;
  } });
  const current = { file: { fileName: 'test' }, context: { sampleRate: 48000, currentTime: 0,
    state: 'running', destination: {}, audioWorklet: { addModule: async () => {} } },
    node: { connect() {}, disconnect() { calls.push('source-detach'); } },
    output: { input: { connect() {}, disconnect() { calls.push('gain-detach'); } } } };
  const pump = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  diagnostics.begin(current); diagnostics.attach(current); await pump();
  check(nodes.length === 0, 'Disabled diagnostics must not initialize a recorder');
  diagnostics.setEnabled(true); diagnostics.begin(current); diagnostics.attach(current); await pump();
  check(diagnostics.captures[0].kind === 'load' && calls.includes('load'), 'Load must create an export without Play');
  diagnostics.event(current, 'adapter-event', { stage: 'resume', event: 'complete' });
  nodes[0].port.onmessage({ data: { type: 'capture', id: diagnostics.captures[0].id,
    firstFrame: 12000, endFrame: 36000, sampleRate: 48000, complete: true, reason: '',
    channels: Array.from({ length: 4 }, () => new Float32Array(24000)), blocks: [] } });
  check(diagnostics.captures[0].coverage.unobservedContextInterval.end === 0.25,
    'Pre-tap coverage gap must have explicit context coordinates');
  const cached = { type: 'checkpoint', firstFrame: 12000, endFrame: 16800, sampleRate: 48000,
    channels: Array.from({ length: 4 }, () => new Float32Array(4800)), blocks: [], complete: true, reason: '',
    validRanges: Array.from({ length: 4 }, () => [{ startFrame: 12000, endFrame: 16800 }]) };
  nodes[0].port.onmessage({ data: cached });
  current.context.currentTime = 0.4;
  diagnostics.snapshot(current, 'stop');
  check(!calls.includes('snapshot') && diagnostics.captures.some(c => c.kind === 'pre-stop-checkpoint'),
    'Stop must use cached pre-Stop data without an asynchronous request');
  const preStop = diagnostics.captures.find(c => c.kind === 'pre-stop-checkpoint');
  check(preStop.channels === cached.channels && preStop.checkpointAtStop.ageFrames === 2400 &&
    near(preStop.checkpointAtStop.ageSeconds, 0.05) && preStop.exactStopSnapshot === false,
    'Cached pre-Stop PCM must have exact frame age and cannot claim an exact Stop sample');

  diagnostics.arm(current, { audioStartTime: 0.12 });
  check(calls.includes('arm'), 'Capture must arm the branch');
  diagnostics.cancel(current, 'pause');
  check(!diagnostics.captures.find(c => c.kind === 'startup').complete, 'Pending capture must be visibly incomplete');
  diagnostics.event(current, 'adapter-event', { stage: 'close', event: 'complete', outcome: 'resolved' });
  diagnostics.action(null, 'eject-requested');
  diagnostics.setEnabled(false);
  check(calls.includes('gain-detach') && calls.includes('source-detach') && calls.includes('port-close'), 'Disable must clean up both taps and port');
  check(preStop.channels[0].length === 4800 && preStop.kind === 'pre-stop-checkpoint',
    'Cached PCM must survive diagnostic closure without waiting for a port response');
  check(diagnostics.captures.filter(c => c.kind === 'pre-stop-checkpoint').length === 1,
    'Periodic checkpoints must not create unbounded export entries');
  const failed = { ...current, context: { ...current.context, audioWorklet: { addModule: async () => { throw new Error('test failure'); } } } };
  diagnostics.setEnabled(true); diagnostics.begin(failed); diagnostics.attach(failed); await pump();
  const nextLoad = diagnostics.captures[diagnostics.captures.length - 1];
  check(nextLoad.lifecycle.some(e => e.sessionId !== nextLoad.sessionId && e.stage === 'close' && e.outcome === 'resolved'),
    'New Load metadata must retain previous-session closure timestamps');
  check(nextLoad.lifecycle.some(e => e.type === 'eject-requested' && e.sessionId === null),
    'Eject without an active session must remain in cross-session history');
  check(!nextLoad.complete && nextLoad.reason.includes('interrupted'), 'Failed Load diagnostics must retain an incomplete export entry');
  check(diagnostics.message.includes('test failure'), 'Recorder failure must be contained');
  let resolveModule;
  const stalled = { ...current, context: { ...current.context,
    audioWorklet: { addModule: () => new Promise(resolve => { resolveModule = resolve; }) } } };
  diagnostics.begin(stalled); diagnostics.attach(stalled); await pump();
  diagnostics.arm(stalled, { audioStartTime: 0.12 });
  const nodeCount = nodes.length;
  diagnostics.snapshot(stalled, 'stop');
  check(diagnostics.captures[diagnostics.captures.length - 1].checkpointAtStop.ageFrames === null,
    'Unavailable checkpoints must not invent an age or silent PCM');
  diagnostics.close(stalled, 'eject');
  check(diagnostics.captures[diagnostics.captures.length - 1].reason.includes('unavailable'),
    'Stalled initialization must not block cancellation');
  resolveModule(); await pump();
  check(nodes.length === nodeCount, 'Late diagnostic initialization must not attach to a closed session');
  const listeners = new Set();
  const retained = { ...current, ownsContext: false,
    context: { ...current.context, addEventListener(type, listener) { listeners.add(listener); },
      removeEventListener(type, listener) { listeners.delete(listener); } } };
  diagnostics.begin(retained);
  check(listeners.size === 1, 'Retained session must attach a diagnostic listener');
  diagnostics.close(retained, 'session retired');
  check(listeners.size === 0, 'Retiring a persistent session must remove its state listener without waiting for context closure');
  const bytes = diagnostics.wav(captured);
  check(new DataView(bytes).getUint16(20, true) === 3 && new DataView(bytes).getUint16(22, true) === 4, 'Export must use four-channel float PCM');
  console.log('Signalsmith diagnostics alignment, envelope capture, bounds, cancellation, cleanup, and failure tests passed');
}
