document.getElementById('run').onclick = async () => {
  const results = document.getElementById('results');
  results.textContent = 'Running…';
  try {
    const rate = 48000;
    const context = new OfflineAudioContext(2, rate * 0.7, rate);
    await context.audioWorklet.addModule('../experimental/signalsmith-recorder.js');
    const recorder = new AudioWorkletNode(context, 'tuneflow-signalsmith-recorder', {
      numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1],
      channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete'
    });
    const gain = context.createGain();
    const buffer = context.createBuffer(2, rate, rate);
    buffer.getChannelData(0).fill(0.5); buffer.getChannelData(1).fill(-0.25);
    const source = context.createBufferSource(); source.buffer = buffer;
    source.connect(gain); gain.connect(context.destination);
    source.connect(recorder, 0, 0); gain.connect(recorder, 0, 1);
    recorder.connect(context.destination);
    gain.gain.setValueAtTime(0, 0); gain.gain.setValueAtTime(0, 0.12);
    gain.gain.linearRampToValueAtTime(0.25, 0.124);
    let timer;
    let checkpoint;
    const timing = [];
    const captured = new Promise((resolve, reject) => {
      const messages = [];
      recorder.port.onmessage = event => {
        if (event.data.type === 'checkpoint') { checkpoint = event.data; recorder.port.postMessage({ type: 'checkpoint-ack' }); }
        if (event.data.type === 'timing') timing.push(event.data);
        if (event.data.type !== 'capture') return;
        messages.push(event.data);
        if (messages.length === 2) { clearTimeout(timer); resolve(messages); }
      };
      timer = setTimeout(() => reject(new Error('Recorder report timed out')), 10000);
    });
    recorder.port.postMessage({ type: 'load', id: 2 });
    recorder.port.postMessage({ type: 'arm', id: 1, startFrame: 960, endFrame: 29760 });
    source.start();
    const rendered = await context.startRendering();
    const messages = await captured;
    const capture = messages.find(message => message.id === 1);
    const load = messages.find(message => message.id === 2);
    if (!load.complete || load.firstFrame !== 0 || load.endFrame !== 24000) throw new Error('Load window missed earliest available frames');
    for (let i = 0; i < 24000; i++) {
      if (Math.abs(load.channels[0][i] - 0.5) > 1e-6 ||
          Math.abs(load.channels[2][i] - rendered.getChannelData(0)[i]) > 1e-6) throw new Error('Load PCM alignment mismatch');
    }
    if (!capture.complete || capture.firstFrame !== 960 || capture.endFrame !== 29760) throw new Error('Incomplete or misaligned capture');
    for (let i = 0; i < capture.channels[0].length; i++) {
      const frame = capture.firstFrame + i;
      const envelope = 0.25 * Math.max(0, Math.min(1, (frame / rate - 0.12) / 0.004));
      for (let c = 0; c < 2; c++) {
        const value = c === 0 ? 0.5 : -0.25;
        if (Math.abs(capture.channels[c][i] - value) > 1e-6 ||
            Math.abs(capture.channels[c + 2][i] - value * envelope) > 1e-5 ||
            Math.abs(rendered.getChannelData(c)[frame] - value * envelope) > 1e-5) throw new Error('Channel alignment, gain, or silent-branch mismatch at ' + frame);
      }
    }
    for (let i = 1; i < capture.blocks.length; i++) {
      if (capture.blocks[i].frame !== capture.blocks[i - 1].frame + capture.blocks[i - 1].length) throw new Error('Render-block gap');
    }
    if (!checkpoint || checkpoint.endFrame - checkpoint.firstFrame !== 4800 || !checkpoint.complete) throw new Error('Periodic checkpoint invalid');
    if (!timing.some(message => message.event === 'first-observed-processor-output') ||
        !timing.some(message => message.event === 'diagnostic-tap-first-render-block')) throw new Error('First-output timing missing');
    recorder.disconnect(); recorder.port.close();
    results.textContent = 'PASS simultaneous earliest Load and startup windows, real AudioWorklet alignment, stereo PCM, 4 ms gain envelope, block boundaries, periodic checkpoints, first-output timing, and unchanged audible output';
  } catch (error) { results.textContent = 'FAIL: ' + error.message; console.error(error); }
};
if (new URLSearchParams(location.search).has('run')) document.getElementById('run').click();
