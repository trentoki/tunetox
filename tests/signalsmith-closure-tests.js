// Controlled browser closure promises: no replacement, automatic retry, or timer-based release.
async function runSignalsmithClosureTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pump = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  function fixture() {
    const contexts = [], records = [], timers = new Map();
    let nextTimer = 0;
    const player = createSignalsmithPlayer({ releaseSeconds: 0, moduleUrl: 'local-closure-test',
      log: record => records.push(record),
      setTimer: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
      clearTimer: id => timers.delete(id),
      createContext: () => {
        const context = { currentTime: 0, sampleRate: 48000, state: 'running', resumes: 0,
          resume() { ++this.resumes; return Promise.resolve(); },
          close() {
            return new Promise((resolve, reject) => {
              this.resolveClose = () => { this.state = 'closed'; resolve(); };
              this.rejectClose = reject;
            });
          },
          decodeAudioData: async () => ({ duration: 2, numberOfChannels: 1,
            getChannelData: () => new Float32Array(96000) }) };
        contexts.push(context); return context;
      },
      importLibrary: async () => ({ default: async () => ({ connect() {}, disconnect() {}, port: { close() {} },
        addBuffers: async () => {}, latency: async () => 0.12, setUpdateInterval: async () => {}, schedule: async () => {} }) }),
      createOutput: () => ({ input: {}, level: { value: 0.25, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
        disconnect() {}, read: () => ({}) }) });
    return { player, contexts, records, timers, file: { name: 'same.wav', arrayBuffer: async () => new ArrayBuffer(0) } };
  }
  async function mustBlock(operation) {
    let error;
    try { await operation(); } catch (caught) { error = caught; }
    check(error && /closing|closure/.test(error.message), 'Pending/failed closure must reject the action explicitly');
  }
  for (const outcome of ['resolved', 'rejected', 'timeout']) {
    const f = fixture(); await f.player.loadFile(1, f.file); await f.player.play();
    const resumes = f.contexts[0].resumes;
    await f.player.stop();
    check(!f.player.getState().loading && f.player.getState().closureBlocked, 'Stop must stay responsive while closure blocks replacement');
    await mustBlock(() => f.player.play());
    await mustBlock(() => f.player.loadFile(1, f.file));
    check(f.contexts.length === 1 && f.contexts[0].resumes === resumes, 'Blocked requests must not create OR resume contexts');
    if (outcome === 'rejected') {
      f.contexts[0].rejectClose(new Error('device closure failed')); await pump();
      await f.player.eject();
      check(f.player.getState().closureStatus.includes('device closure failed'), 'Eject must not erase closure failure');
      await mustBlock(() => f.player.loadFile(1, f.file));
      check(f.contexts.length === 1, 'Rejected closure must not permit replacement');
    } else {
      if (outcome === 'timeout') {
        for (const timer of Array.from(f.timers.values())) if (timer.delay === 5000) timer.callback();
        await pump();
        check(f.player.getState().closureStatus.includes('timed out') && f.player.getState().contextsClosing === 1,
          'Deadline must report failure without pretending browser closure finished');
        await f.player.eject();
        await mustBlock(() => f.player.loadFile(1, f.file));
      }
      f.contexts[0].resolveClose(); await pump();
      check(!f.player.getState().closureBlocked && f.contexts.length === 1, 'Actual resolution must release guard without queued playback');
      if (outcome === 'resolved') {
        const freshClick = f.player.play();
        check(f.contexts.length === 2 && f.contexts[1].resumes === 1, 'Fresh Play must synchronously create/resume after closure');
        await freshClick;
      } else {
        const freshClick = f.player.loadFile(1, f.file);
        check(f.contexts.length === 2 && f.contexts[1].resumes === 1, 'Fresh Load must preserve synchronous user activation');
        await freshClick;
      }
      await f.player.eject(); f.contexts[1].resolveClose(); await pump();
    }
    check(f.records.some(r => r.stage === 'stop' && r.event === 'requested' && typeof r.wallTimeMs === 'number'), 'Stop needs diagnostic timestamps');
    check(f.records.some(r => r.stage === 'close' && r.outcome === (outcome === 'rejected' ? 'rejected' : 'resolved')), 'Actual closure result must be logged');
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.contexts[0].close = () => { throw new Error('close threw'); };
    await f.player.eject(); await pump();
    check(f.player.getState().closureStatus.includes('close threw'), 'Synchronous close failure must stay explicit');
    await mustBlock(() => f.player.loadFile(1, f.file));
    check(f.contexts.length === 1, 'Synchronous closure failure must block new contexts');
  }
  console.log('Signalsmith closure serialization, fresh-click recovery, rejection, and timeout tests passed');
}
