// Adapter contract checks with controlled context/node acknowledgements, no speakers.
async function runSignalsmithTests() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const metadata = JSON.stringify(appState);
  let time = 0;
  let failDecode = false;
  let holdResume = null;
  let pendingFactory = null;
  const contexts = [];
  const nodes = [];
  const outputs = [];
  const pcm = new Float32Array(48000 * 2);
  const createContext = () => {
    const context = { sampleRate: 48000, state: 'running', baseLatency: 0.01, outputLatency: 0.02,
      get currentTime() { return time; },
      resume() { return holdResume || Promise.resolve(); },
      close() { this.state = 'closed'; return Promise.resolve(); },
      async decodeAudioData() {
        if (failDecode) throw new Error('decode failed');
        return { duration: 2, numberOfChannels: 1, getChannelData: () => pcm };
      }
    };
    contexts.push(context);
    return context;
  };
  const createOutput = () => {
    const output = { input: {}, read: () => ({ outputPeak: 0.05, outputRms: 0.02 }),
      level: { value: 0.25, events: [],
        linearRampToValueAtTime(value, t) { this.events.push({ value, time: t, ramp: true }); }, cancelScheduledValues(t) { this.events = this.events.filter(e => e.time < t); },
        setValueAtTime(value, t) { this.events.push({ value, time: t }); } },
      disconnect() { this.disconnected = true; }
    };
    outputs.push(output);
    return output;
  };
  const factory = async () => {
    if (pendingFactory) await pendingFactory;
    const node = { commands: [], connected: false,
      port: { onmessage: null, close() { this.closed = true; } },
      connect() { this.connected = true; }, disconnect() { this.connected = false; },
      async addBuffers(channels) { this.channels = channels; return 2; },
      async latency() { return 0.12; },
      async setUpdateInterval(interval, callback) { this.callback = callback; },
      async schedule(command) { this.commands.push(command); return command; }
    };
    nodes.push(node);
    return node;
  };
  const player = createSignalsmithPlayer({ releaseSeconds: 0, log: () => {}, moduleUrl: 'local-test.mjs', createContext,
    importLibrary: async () => ({ default: factory }), createOutput });
  const file = { name: 'local.wav', arrayBuffer: async () => new ArrayBuffer(8) };
  await player.play();
  check(contexts.length === 0, 'Empty playback must not allocate a context');
  check(await player.loadFile(1, file), 'Signalsmith must load PCM');
  check(factory.moduleUrl === 'local-test.mjs', 'Worklet must use local module URL');
  check(!player.getState().isPlaying && outputs[0].level.value === 0, 'Loading must remain muted');
  check(player.getState().processedPosition === null && player.getState().bufferedFrames === null,
    'Unavailable DSP measurements must remain unavailable');
  check(nodes[0].channels[0] !== pcm, 'Transferred audio must preserve original PCM');
  check(!player.setTempo(1, 0, 120) && !player.setTempo(1, 120, 145), 'Reject invalid/out-of-range tempos');
  check(player.setComparisonLevel(0.2) && !player.setComparisonLevel(0.5), 'Comparison trim must only attenuate within headroom');
  check(player.getState().comparisonLevel === 0.2, 'Applied comparison trim must be visible');
  check(player.setTempo(1, 120, 96), 'Accept 0.8×');
  await player.play();
  check(nodes[0].commands[0].semitones === 0 && nodes[0].commands[0].rate === 0.8,
    'Play must retain original pitch and applied tempo');
  time += 0.62;
  const before = player.getState();
  check(Math.abs(before.position - 0.376) < 1e-6, 'Audible estimate must include source rate, start lead, and device latency');
  nodes[0].callback(1.5); // Read-ahead must NOT become the pause bookmark.
  await player.pause();
  const bookmark = player.getState().savedSourcePosition;
  check(Math.abs(bookmark - 0.4) < 1e-6 && bookmark !== 1.5, 'Pause bookmark must use scheduled source coordinates');
  check(outputs[0].level.value === 0, 'Pause must mute residual DSP output');
  time += 1;
  check(player.getState().position === bookmark, 'Paused source coordinate must remain fixed');
  check(player.setTempo(1, 120, 144), 'Allow paused tempo changes');
  await player.play();
  const resumed = nodes[0].commands[nodes[0].commands.length - 1];
  check(resumed.input === bookmark && resumed.rate === 1.2, 'Resume must schedule saved source position');
  time += 0.3;
  const position = player.getState().position;
  check(player.setTempo(1, 120, 120), 'Allow live tempo changes');
  check(nodes.length === 1 && player.getState().isPlaying, 'Live changes must not recreate processor');
  check(Math.abs(player.getState().position - position) < 0.01, 'No large timeline jump on tempo change');
  await player.stop();
  check(contexts[0].state === 'closed' && nodes[0].port.closed && !nodes[0].connected,
    'Stop must close the context and messaging, releasing DSP state');
  check(player.getState().loaded && player.getState().position === 0, 'Stop must rewind and retain source PCM');
  await player.play();
  check(contexts.length === 2 && nodes[1].commands[0].input === 0, 'Play after Stop must use fresh DSP from source zero');
  time += 3;
  check(!player.getState().isPlaying && player.getState().position === 2,
    'Natural completion must finish at source duration');
  check(contexts[1].state === 'closed', 'Natural completion must release context resources');
  await Promise.resolve(); // Natural completion's close promise must settle before a fresh click.
  await player.play();
  check(nodes[2].commands[0].input === 0, 'Play after completion must restart');
  failDecode = true;
  try { await player.loadFile(1, file); throw new Error('expected rejection'); }
  catch (error) { check(error.message.includes('decode failed'), 'Decode errors must propagate'); }
  check(player.getState().loaded && player.getState().isPlaying, 'Failed replacement must retain old audio');
  failDecode = false;
  for (let repeat = 0; repeat < 3; repeat++) {
    await player.loadFile(1, file);
    check(player.getState().playbackRate === 1 && !player.getState().isPlaying, 'Replacement must reset paused at unity');
  }
  let finishResume;
  holdResume = new Promise(resolve => { finishResume = resolve; });
  const pendingPlay = player.play();
  await player.eject();
  finishResume();
  await pendingPlay;
  check(!player.getState().loaded && !player.getState().isPlaying, 'Eject must cancel pending Play');
  holdResume = null;
  let finishRead;
  const lateLoad = player.loadFile(1, { name: 'late.wav', arrayBuffer: () =>
    new Promise(resolve => { finishRead = resolve; }) });
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await player.eject();
  check(await lateLoad === false, 'Eject must cancel even an unfinished file read');
  finishRead(new ArrayBuffer(8));
  let finishFactory;
  pendingFactory = new Promise(resolve => { finishFactory = resolve; });
  const initializing = player.loadFile(1, file);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await player.eject();
  check(await initializing === false, 'Eject must cancel unfinished worklet initialization');
  finishFactory();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  check(nodes.every(node => !node.connected && node.port.closed), 'Late nodes must be disconnected and closed');
  check(contexts.every(context => context.state === 'closed'), 'Repeated loading/ejecting must leave no live contexts');
  check(JSON.stringify(appState) === metadata, 'Signalsmith must not change musical metadata or synchronization');

  const normal = { getState: () => ({ loaded: false, loading: false }) };
  const st = { getState: () => ({ loaded: false, loading: false }) };
  const router = createDeckOneExperimentRouter(normal, st, player);
  check(router.setMode('signalsmith') && router.getMode() === 'signalsmith', 'Three-way selector must choose Signalsmith');
  check(router.getState(2).loaded === false, 'Deck 2 must still route to normal engine');
  check(router.setMode('soundtouch') && router.setMode('normal') && !router.setMode('unknown'), 'Mode values must be validated');
  console.log('Signalsmith adapter, cancellation, completion, and cleanup tests passed');
}
