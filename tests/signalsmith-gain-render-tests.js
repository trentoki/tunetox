// Real browser AudioParam rendering, with a controlled transport acknowledgement.
document.getElementById('run').onclick = async () => {
  const results = document.getElementById('results');
  results.textContent = '';
  try {
    for (const ackTime of [0, 0.12, 0.122, 0.124, 0.2, 0.4]) {
      const sampleRate = 48000;
      const offline = new OfflineAudioContext(1, sampleRate * 0.6, sampleRate);
      const gain = offline.createGain();
      gain.connect(offline.destination);
      const constant = offline.createBuffer(1, sampleRate, sampleRate);
      constant.getChannelData(0).fill(1);
      const source = offline.createBufferSource();
      source.buffer = constant;
      source.connect(gain);
      source.start();
      let acknowledge;
      let scheduled;
      const requested = new Promise(resolve => { scheduled = resolve; });
      const context = { sampleRate, state: 'running',
        get currentTime() { return offline.currentTime; },
        resume: async () => {}, close: async () => {},
        decodeAudioData: async () => ({ duration: 0.1, numberOfChannels: 1,
          getChannelData: () => new Float32Array(4800) }) };
      const node = { connect() {}, disconnect() {}, port: { close() {} },
        addBuffers: async () => {}, latency: async () => 0.12,
        setUpdateInterval: async () => {}, schedule: () => new Promise(resolve => {
          acknowledge = resolve; scheduled();
        }) };
      const player = createSignalsmithPlayer({ moduleUrl: 'test-only', log() {}, releaseSeconds: 0,
        createContext: () => context, importLibrary: async () => ({ default: async () => node }),
        createOutput: () => ({ input: gain, level: gain.gain, disconnect() {}, read: () => ({}) }) });
      await player.loadFile(1, { name: 'constant PCM', arrayBuffer: async () => new ArrayBuffer(0) });
      const playing = player.play();
      await requested;
      let rendered;
      if (ackTime === 0) {
        acknowledge(); await playing;
        rendered = await offline.startRendering();
      } else {
        const suspended = offline.suspend(ackTime);
        const rendering = offline.startRendering();
        await suspended;
        acknowledge(); await playing;
        await offline.resume();
        rendered = await rendering;
      }
      const samples = rendered.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        const expected = time >= 0.34 ? 0 : 0.25 * Math.max(0, Math.min(1, (time - 0.12) / 0.004));
        if (Math.abs(samples[i] - expected) > 0.0001) {
          throw new Error('Ack ' + ackTime + ': unexpected gain at frame ' + i + ': ' + samples[i]);
        }
      }
      await player.eject();
      results.textContent += 'PASS acknowledgement at ' + ackTime + ' s\n';
    }
  } catch (error) {
    results.textContent += 'FAIL: ' + error.message + '\n';
    console.error(error);
  }
};

if (new URLSearchParams(location.search).has('run')) document.getElementById('run').click();
