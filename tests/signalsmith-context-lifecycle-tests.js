async function runSignalsmithContextLifecycleTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pump = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  const contexts = [], nodes = [], outputs = [], diagnosticClosures = [];
  let holdFactory = false, finishFactory, holdClose = false, finishClose;
  const factory = async context => {
    const node = { context, connected: false, commands: [],
      port: { close() { this.closed = true; } },
      connect() { this.connected = true; }, disconnect() { this.connected = false; },
      addBuffers: async () => {}, latency: async () => 0.12, setUpdateInterval: async () => {},
      async schedule(command) { this.commands.push(command); } };
    nodes.push(node);
    if (holdFactory) await new Promise(resolve => { finishFactory = resolve; });
    return node;
  };
  const player = createSignalsmithPlayer({ releaseSeconds: 0, moduleUrl: 'local-retained-test', log() {}, persistentContext: true,
    diagnostics: { close(current) { diagnosticClosures.push(current); } },
    createContext: () => {
      const context = { sampleRate: 48000, state: 'running', currentTime: 0, closeCalls: 0, resumeCalls: 0,
        resume() { ++this.resumeCalls; return Promise.resolve(); },
        close() {
          ++this.closeCalls;
          if (holdClose) return new Promise(resolve => { finishClose = () => { this.state = 'closed'; resolve(); }; });
          this.state = 'closed'; return Promise.resolve();
        }, decodeAudioData: async () => ({ duration: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(96000) }) };
      contexts.push(context); return context;
    }, importLibrary: async () => ({ default: factory }),
    createOutput: () => {
      const output = { input: {}, level: { value: 0.25, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
        disconnect() { this.disconnected = true; }, read: () => ({}) };
      outputs.push(output); return output;
    } });
  const file = { name: 'repeat.wav', arrayBuffer: async () => new ArrayBuffer(8) };
  check(contexts.length === 0, 'Opt-in alone must not allocate a context');
  const loading = player.loadFile(1, file);
  check(contexts.length === 1 && contexts[0].resumeCalls === 1, 'First Load must create/resume synchronously in the gesture');
  await loading;
  for (let repeat = 0; repeat < 20; repeat++) {
    await player.play();
    const node = nodes[nodes.length - 1];
    check(node.commands[0].input === 0 && node.commands[0].rate === 1 && node.commands[0].semitones === 0,
      'Fresh processor must start at source zero with unchanged rate/pitch');
    if (repeat === 0) {
      contexts[0].currentTime += 0.6;
      await player.pause(); const bookmark = player.getState().savedSourcePosition;
      await player.play();
      check(nodes.length === 1 && node.commands[node.commands.length - 1].input === bookmark, 'Pause/resume must retain the session and coordinate');
    }
    if (repeat % 2) { await player.eject(); await player.loadFile(1, file); }
    else await player.stop();
    check(!node.connected && node.port.closed, 'Every retired processor must disconnect and close its port');
    check(contexts.length === 1 && contexts[0].closeCalls === 0 && contexts[0].state === 'running',
      'Stop/Eject/Load must retain context identity without closing or suspending it');
  }
  await player.eject();
  check(new Set(nodes).size === nodes.length && nodes.every(node => node.context === contexts[0]), 'Each session must use a distinct processor on the one context');
  check(outputs.every(output => output.disconnected) && diagnosticClosures.length >= nodes.length, 'Session output/diagnostic cleanup must run repeatedly');
  holdFactory = true;
  const cancelled = player.loadFile(1, file); await pump();
  await player.eject(); await cancelled;
  finishFactory(); await pump();
  check(nodes[nodes.length - 1].port.closed && !nodes[nodes.length - 1].connected, 'Late nodes from cancelled preparation must retire');
  holdFactory = false;
  holdClose = true;
  const disabling = player.setPersistentContext(false); await pump();
  check(player.getState().closureBlocked && contexts[0].closeCalls === 1, 'Disabling must close the owner exactly once and block replacement until closure');
  let blocked = false;
  try { await player.loadFile(1, file); } catch (_) { blocked = true; }
  check(blocked && contexts.length === 1, 'No new context during experiment shutdown');
  finishClose(); await disabling;
  check(!player.getState().persistentContext && contexts[0].state === 'closed', 'Disabling must restore default mode after actual closure');
  holdClose = false;
  await player.loadFile(1, file); await player.stop();
  check(contexts.length === 2 && contexts[1].closeCalls === 1, 'Control mode must recreate/close normally');
  await player.eject();
  await player.setPersistentContext(true);
  await player.loadFile(1, file); await player.play();
  await player.shutdown();
  check(contexts.length === 3 && contexts[2].closeCalls === 1 && player.getState().engineShutDown,
    'Full engine shutdown must retire processor and close retained owner');
  await player.shutdown();
  check(contexts[2].closeCalls === 1, 'Shutdown must be idempotent');
  blocked = false; try { await player.loadFile(1, file); } catch (_) { blocked = true; }
  check(blocked, 'A shut-down engine must not silently allocate another context');
  // OFF -> ON may not bypass a still-closing control context.
  {
    let resolveOldClose;
    let allocations = 0;
    const history = [];
    const switching = createSignalsmithPlayer({ releaseSeconds: 0, moduleUrl: 'mode-switch-test', log: record => history.push(record),
      importLibrary: async () => ({ default: factory }),
      createOutput: () => ({ input: {}, level: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, disconnect() {}, read: () => ({}) }),
      createContext: () => {
        const context = { state: 'running', sampleRate: 48000, currentTime: 0, resume: async () => {},
          close() { return new Promise(resolve => { resolveOldClose = () => { this.state = 'closed'; resolve(); }; }); },
          decodeAudioData: async () => ({ duration: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(96000) }) };
        ++allocations; return context;
      } });
    await switching.loadFile(1, file); await switching.play();
    const oldNode = nodes[nodes.length - 1];
    await switching.eject();
    let prevented = false;
    try { await switching.setPersistentContext(true); } catch (_) { prevented = true; }
    check(prevented && allocations === 1 && !oldNode.connected && oldNode.port.closed,
      'Enabling persistence must not retain an audible session or bypass pending control-context closure');
    resolveOldClose(); await pump();
    await switching.setPersistentContext(true);
    check(allocations === 1, 'Enabling after closure must wait for a fresh Load gesture');
    await switching.loadFile(1, file);
    check(allocations === 2 && history.filter(record => record.stage === 'close' && record.outcome === 'resolved').length === 1,
      'The first persistent Load after control mode must use a fresh context following resolved closure');
    const shutting = switching.shutdown(); await pump(); resolveOldClose(); await shutting;
  }
  console.log('Persistent Signalsmith context identity, processor replacement, repeated cleanup, cancellation, disable, and shutdown tests passed');
}
