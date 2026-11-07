// Deterministic deadlines; these reproduce failures, not real browser decoder performance.
async function runSignalsmithLoadingTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pump = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
  function fixture(serializeContextClosure = true) {
    let time = 0;
    let nextTimer = 0;
    let hold = '';
    let constructorError = false;
    let resumeThrow = false;
    let lateFactory;
    const never = new Promise(() => {});
    const timers = new Map();
    const records = [];
    const contexts = [];
    const nodes = [];
    const stage = (name, result) => hold === name ? never : Promise.resolve(result);
    const factory = () => {
      const node = { port: { close() { this.closed = true; } }, connect() {},
        disconnect() { this.disconnected = true; },
        addBuffers: () => stage('buffers', 1), latency: () => stage('latency', 0.12),
        setUpdateInterval: () => stage('updates'), schedule: () => stage('schedule') };
      nodes.push(node);
      if (hold === 'ready') return new Promise(resolve => { lateFactory = () => resolve(node); });
      return Promise.resolve(node);
    };
    const player = createSignalsmithPlayer({ releaseSeconds: 0, moduleUrl: 'fixed-local-module.mjs', serializeContextClosure,
      now: () => time, log: record => records.push(record),
      setTimer: (callback, delay) => { timers.set(++nextTimer, { callback, due: time + delay }); return nextTimer; },
      clearTimer: id => timers.delete(id),
      createContext: () => {
        if (constructorError) throw new Error('constructor failed');
        const context = { sampleRate: 48000, state: 'running', currentTime: 0,
          resume() { this.resumeCalled = true; if (resumeThrow) throw new Error('resume threw'); return stage('resume'); },
          close() { if (hold !== 'close') this.state = 'closed'; return stage('close'); },
          decodeAudioData: () => stage('decode', { duration: 1, numberOfChannels: 1,
            sampleRate: 48000, length: 48000, getChannelData: () => new Float32Array(48000) }) };
        contexts.push(context);
        return context;
      },
      importLibrary: () => stage('import', { default: factory }),
      createOutput: () => ({ input: {}, level: { value: 0.25, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
        disconnect() {}, read: () => ({ outputPeak: 0, outputRms: 0 }) }) });
    const file = { name: 'diagnostic.aiff', type: 'audio/aiff', size: 123456,
      arrayBuffer: () => stage('read', new ArrayBuffer(8)) };
    return { player, file, records, contexts, nodes, timers,
      hold: value => { hold = value; }, constructorError: value => { constructorError = value; },
      resumeThrow: value => { resumeThrow = value; }, lateFactory: () => lateFactory(),
      advance(ms) { time += ms; for (const [id, timer] of Array.from(timers)) {
        if (timer.due <= time) { timers.delete(id); timer.callback(); }
      } } };
  }
  {
    const f = fixture();
    const loading = f.player.loadFile(1, f.file);
    check(f.contexts.length === 1 && f.contexts[0].resumeCalled,
      'Context construction and resume must occur before loader returns its promise');
    check(!f.records.some(record => record.stage === 'read'), 'File read must wait for resume');
    await loading;
    check(f.records.some(record => typeof record.userActivationSupported === 'boolean'),
      'Activation availability must be logged explicitly');
    await f.player.eject();
  }
  for (const name of ['resume', 'read', 'decode', 'import', 'ready', 'buffers', 'latency', 'updates']) {
    const f = fixture();
    f.hold(name);
    let failure;
    const failed = f.player.loadFile(1, f.file).catch(error => { failure = error; });
    await pump();
    check(f.player.getState().loading, name + ' must be observably pending');
    f.advance(61000); await pump(); await failed;
    check(failure && failure.message.includes(name), name + ' timeout must identify its stage');
    check(!f.player.getState().loading, name + ' timeout must release UI loading');
    check(f.records.some(record => record.stage === name && record.event === 'error'), 'Timeout must be logged');
    if (name === 'ready') { f.lateFactory(); await pump(); check(f.nodes[0].port.closed, 'Late factory node must be discarded'); }
    f.hold('');
    await f.player.eject();
    check(await f.player.loadFile(1, f.file), name + ' must permit a new load after Eject');
    check(!f.player.getState().loading && f.player.getState().loaded, 'Fresh file must become ready');
    check(f.records.some(record => record.fileBytes === 123456 && record.contextState === 'running'),
      'Diagnostics must include file and context characteristics');
    await f.player.eject(); await pump();
    check(f.timers.size === 0, 'Settled stages must release all deadline timers');
  }
  for (const kind of ['constructor', 'resume']) {
    const f = fixture();
    if (kind === 'constructor') f.constructorError(true); else f.resumeThrow(true);
    let rejected = false;
    try { await f.player.loadFile(1, f.file); } catch (error) { rejected = true; }
    check(rejected && !f.player.getState().loading, 'Synchronous ' + kind + ' failure must release loading');
    f.constructorError(false); f.resumeThrow(false);
    await f.player.eject();
    check(await f.player.loadFile(1, f.file), 'Recover from synchronous ' + kind + ' failure');
    await f.player.eject();
  }
  {
    const f = fixture(); f.hold('buffers');
    let failure;
    const loading = f.player.loadFile(1, f.file).catch(error => { failure = error; });
    await pump(); f.nodes[0].onprocessorerror(); await pump(); await loading;
    check(failure && failure.message.includes('processor failed'), 'Candidate processor error must reject outstanding buffer wait');
    check(!f.player.getState().loading, 'Candidate processor error must restore controls');
    f.hold(''); await f.player.eject();
    check(await f.player.loadFile(1, f.file), 'Processor failure must allow fresh initialization');
    await f.player.eject();
  }
  {
    const f = fixture(false); f.hold('read');
    const loading = f.player.loadFile(1, f.file);
    await pump(); f.hold('close');
    await f.player.eject(); await loading;
    check(!f.player.getState().loading && !f.player.getState().loaded, 'Stalled close must not hold UI state');
    check(f.player.getState().contextsClosing === 1, 'Stalled browser closure must remain visible, not claimed cancelled');
    f.advance(5001); await pump();
    check(f.records.some(record => record.event === 'still-pending'), 'Unconfirmed cleanup must be logged');
    f.hold(''); check(await f.player.loadFile(1, f.file), 'Stalled old close must not block a new file');
    await f.player.eject();
  }
  {
    const f = fixture(); f.hold('import');
    const old = f.player.loadFile(1, f.file); await pump();
    await f.player.eject(); await old;
    f.hold(''); check(await f.player.loadFile(1, f.file), 'Eject must release adapter cache of abandoned imports');
    await f.player.eject();
  }
  {
    const f = fixture(); check(await f.player.loadFile(1, f.file), 'Load before Play failure');
    f.hold('schedule'); let failure;
    const playing = f.player.play().catch(error => { failure = error; }); await pump();
    f.advance(10001); await pump(); await playing;
    check(failure && !f.player.getState().loading, 'Schedule timeout must clear busy state');
    await f.player.eject();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file); await f.player.play();
    f.advance(15001);
    check(!f.player.getState().loading && f.player.getState().error.includes('clock'),
      'A frozen graph clock during startup must not lock transport indefinitely');
    await f.player.eject();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.hold('read'); let rejected = false;
    const replacement = f.player.loadFile(1, f.file).catch(() => { rejected = true; });
    await pump(); f.advance(30001); await pump(); await replacement;
    check(rejected && f.player.getState().loaded && !f.player.getState().loading,
      'Failed replacement must retain previous ready audio');
    f.hold(''); await f.player.play();
    check(f.player.getState().isPlaying, 'Replacement error must not block previous file playback');
    await f.player.eject();
  }
  console.log('Signalsmith loading deadlines, candidate errors, cancellation, and recovery tests passed');
}
