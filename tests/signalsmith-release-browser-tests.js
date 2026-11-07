document.getElementById('run').onclick = async () => {
  const results = document.getElementById('results'); results.textContent = '';
  try {
    for (const pauseTime of [0.122, 0.2]) {
      const rate = 48000, offline = new OfflineAudioContext(1, rate * 0.4, rate);
      const gain = offline.createGain(); gain.connect(offline.destination);
      const source = offline.createBufferSource(); source.buffer = offline.createBuffer(1, rate, rate);
      source.buffer.getChannelData(0).fill(1); source.connect(gain); source.start();
      let clock = 0, nextTimer = 0;
      const timers = new Map();
      const context = { state: 'running', sampleRate: rate, get currentTime() { return clock; },
        resume: async () => {}, close: async () => {},
        decodeAudioData: async () => ({ duration: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(rate * 2) }) };
      const node = { connect() {}, disconnect() {}, port: { close() {} },
        addBuffers: async () => {}, latency: async () => 0.12, setUpdateInterval: async () => {}, schedule: async () => {} };
      const player = createSignalsmithPlayer({ moduleUrl: 'test', log() {},
        createContext: () => context, importLibrary: async () => ({ default: async () => node }),
        createOutput: () => ({ input: gain, level: {
          // The adapter clock is controlled before offline rendering; expose its corresponding gain.
          get value() { return 0.25 * Math.max(0, Math.min(1, (clock - 0.12) / 0.004)); },
          set value(value) { gain.gain.value = value; },
          cancelAndHoldAtTime: time => gain.gain.cancelAndHoldAtTime(time),
          cancelScheduledValues: time => gain.gain.cancelScheduledValues(time),
          setValueAtTime: (value, time) => gain.gain.setValueAtTime(value, time),
          linearRampToValueAtTime: (value, time) => gain.gain.linearRampToValueAtTime(value, time)
        }, disconnect() {}, read: () => ({}) }),
        setTimer(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
        clearTimer: id => timers.delete(id) });
      await player.loadFile(1, { name: 'constant', arrayBuffer: async () => new ArrayBuffer(0) });
      await player.play(); clock = pauseTime;
      const paused = player.pause();
      const rendered = (await offline.startRendering()).getChannelData(0);
      const from = 0.25 * Math.min(1, (pauseTime - 0.12) / 0.004);
      for (let frame = 0; frame < rendered.length; frame++) {
        const time = frame / rate;
        const expected = time < pauseTime ? 0.25 * Math.max(0, Math.min(1, (time - 0.12) / 0.004)) :
          from * Math.max(0, 1 - (time - pauseTime) / 0.005);
        if (Math.abs(rendered[frame] - expected) > 1e-5) throw new Error('Gain mismatch at ' + time + ' for pause ' + pauseTime);
      }
      // Explicitly advance the simulated cleanup clock; native envelope was checked above.
      for (const time of [pauseTime + 0.006, pauseTime + 0.009]) {
        clock = time;
        for (const timer of Array.from(timers.values())) if (timer.delay === 4) timer.callback();
      }
      await paused; await player.shutdown();
      results.textContent += 'PASS rendered 5 ms release at ' + pauseTime + ' s\n';
    }
  } catch (error) { results.textContent += 'FAIL: ' + error.message; console.error(error); }
};
if (new URLSearchParams(location.search).has('run')) document.getElementById('run').click();
