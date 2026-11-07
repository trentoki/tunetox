// Runs the actual vendored DSP with a simulated AudioWorklet clock (no speakers).
async function runExperimentalTests(Processor, clock) {
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }
  const originalMetadata = JSON.stringify(appState);
  const pcm = new Float32Array(clock.sampleRate * 2);
  for (let frame = 0; frame < pcm.length; frame++) {
    pcm[frame] = 0.2 * Math.sin(2 * Math.PI * 440 * frame / clock.sampleRate);
  }
  function makeProcessor() {
    const processor = new Processor();
    processor.command({ type: 'load', channels: [pcm] });
    return processor;
  }
  function render(processor) {
    const output = [[new Float32Array(128), new Float32Array(128)]];
    processor.process([], output);
    clock.advance(128);
    return output[0][0];
  }

  for (const rate of [0.8, 1, 1.2]) {
    const processor = makeProcessor();
    processor.command({ type: 'tempo', rate });
    processor.command({ type: 'play' });
    const samples = [];
    let blocks = 0;
    while (processor.playing && blocks++ < 1400) {
      samples.push(...render(processor));
      check(processor.readFrame <= pcm.length, 'Read cursor must stay on original source timeline');
      check(processor.processedFrame <= processor.readFrame, 'Consumed cursor cannot lead PCM reads');
      check(processor.renderedFrame <= processor.processedFrame, 'Rendered mapping must not lead consumption');
    }
    check(processor.finished, 'Finite files must finish, including buffered final windows');
    const duration = samples.length / clock.sampleRate;
    check(Math.abs(duration - 2 / rate) < 0.04, 'Stretched duration must follow tempo within window tolerance');
    // Measure pitch away from boundaries, not just parameter values.
    const start = Math.floor(clock.sampleRate * 0.2);
    const end = Math.floor(clock.sampleRate * 1.2);
    let crossings = 0;
    for (let index = start + 1; index < end; index++) {
      if (samples[index - 1] <= 0 && samples[index] > 0) crossings++;
    }
    check(Math.abs(crossings - 440) <= 3, 'Actual DSP must preserve a 440 Hz sine at each tempo');
    check(processor.underruns === 0, 'Pull transport must fill all simulated render blocks');
    check(render(processor).every(value => value === 0), 'Natural end must output silence');
    processor.command({ type: 'play' });
    check(processor.readFrame === 0 && processor.playing, 'Play after end must restart');
  }

  const paused = makeProcessor();
  const reference = makeProcessor();
  for (const processor of [paused, reference]) processor.command({ type: 'play' });
  for (let block = 0; block < 30; block++) { render(paused); render(reference); }
  paused.command({ type: 'pause' });
  const saved = [paused.readFrame, paused.processedFrame, paused.renderedFrame,
    paused.stretch.outputBuffer.frameCount].join(',');
  for (let block = 0; block < 10; block++) {
    check(render(paused).every(value => value === 0), 'Pause must produce silence');
  }
  check(saved === [paused.readFrame, paused.processedFrame, paused.renderedFrame,
    paused.stretch.outputBuffer.frameCount].join(','), 'Pause must freeze all cursor and FIFO state');
  paused.command({ type: 'play' });
  for (let block = 0; block < 20; block++) {
    const expected = render(reference);
    check(render(paused).every((value, index) => value === expected[index]),
      'Resuming must retain the exact queued DSP output in the simulated clock');
  }
  const sameStretch = paused.stretch;
  paused.command({ type: 'tempo', rate: 1.1 });
  check(paused.stretch === sameStretch && paused.playing, 'Tempo changes must not recreate DSP or stop playback');
  paused.command({ type: 'tempo', rate: 1.21 });
  check(paused.rate === 1.1, 'Processor must reject out-of-range tempo');
  paused.command({ type: 'stop' });
  check(paused.readFrame === 0 && paused.renderedFrame === 0 && !paused.playing &&
    paused.stretch.outputBuffer.frameCount === 0, 'Stop must discard buffered audio and rewind');
  check(render(paused).every(value => value === 0), 'Stopped processor must not emit stale audio');
  check(paused.rate === 1.1, 'Stop must retain configured experimental tempo');
  paused.command({ type: 'dispose' });
  check(paused.channels === null && paused.length === 0 && paused.disposed,
    'Eject disposal must release source PCM');

  // Adapter tests wire messages to the real processor while injecting a browser clock.
  let activeProcessor;
  let disconnected = 0;
  let holdResume = null;
  const context = {
    state: 'running', baseLatency: 0.01, outputLatency: 0.02,
    get currentTime() { return clock.time; },
    audioWorklet: { addModule: () => Promise.resolve() },
    resume: () => holdResume || Promise.resolve(),
    decodeAudioData: async data => {
      if (data.invalid) throw new Error('Bad audio');
      return { numberOfChannels: 1, duration: 2, getChannelData: () => pcm };
    }
  };
  const player = createPitchPreservingPlayer({
    createContext: () => context,
    createOutput: () => ({ input: {}, level: { value: 0.25 }, read: () => ({ outputPeak: 0, outputRms: 0 }), disconnect() {} }),
    createNode: () => {
      activeProcessor = new Processor();
      const current = activeProcessor;
      const port = {
        onmessage: null,
        postMessage(message) {
          Promise.resolve().then(() => current.command(message));
        },
        close() {}
      };
      current.port.postMessage = message => {
        if (port.onmessage) port.onmessage({ data: message });
      };
      return { port, connect() {}, disconnect() { disconnected++; } };
    }
  });
  const file = { name: 'test.wav', arrayBuffer: async () => ({}) };
  check(await player.loadFile(1, file), 'Adapter must load source PCM');
  check(!player.getState().isPlaying, 'Loading must not autoplay');
  check(!player.setTempo(1, 120, 145) && !player.setTempo(1, 0, 120), 'Adapter must reject invalid and excessive ratios');
  check(player.setTempo(1, 120, 132), 'Adapter must accept valid BPM ratios');
  await player.play();
  for (let block = 0; block < 40; block++) render(activeProcessor);
  const state = player.getState();
  check(state.sourcePosition >= state.processedPosition &&
    state.processedPosition >= state.renderedPosition &&
    state.renderedPosition >= state.estimatedAudiblePosition,
    'Adapter must distinguish read, consumed, rendered, and latency-adjusted cursors');
  check(state.estimatedOutputLatency === 0.03, 'Browser latency must enter the audible estimate');
  await player.pause();
  const position = player.getState().renderedPosition;
  for (let block = 0; block < 10; block++) render(activeProcessor);
  check(player.getState().renderedPosition === position, 'Adapter pause must freeze rendered position');
  await player.play();
  check(player.getState().isPlaying, 'Adapter resume must preserve the transport');
  await player.stop();
  check(player.getState().sourcePosition === 0 && player.getState().position === 0,
    'Adapter Stop must reset cursor history');
  try {
    await player.loadFile(1, { name: 'bad', arrayBuffer: async () => ({ invalid: true }) });
    throw new Error('Expected bad audio rejection');
  } catch (error) { check(error.message === 'Bad audio', 'Invalid audio must reject safely'); }
  check(player.getState().loaded && player.getState().fileName === 'test.wav', 'Failed replacement must retain audio');
  let resume;
  holdResume = new Promise(resolve => { resume = resolve; });
  const pendingPlay = player.play();
  player.eject();
  resume();
  await pendingPlay;
  check(!player.getState().loaded && !player.getState().isPlaying && disconnected > 0,
    'Eject must silence, release, and cancel a pending Play');
  holdResume = null;
  let finishRead;
  const pendingLoad = player.loadFile(1, { name: 'late', arrayBuffer: () =>
    new Promise(resolve => { finishRead = resolve; }) });
  // Give initialize/decode setup time to reach the controlled file read.
  for (let count = 0; count < 12; count++) await Promise.resolve();
  player.eject();
  finishRead({});
  check(await pendingLoad === false && !player.getState().loaded, 'Late decoding must not undo Eject');

  // Normal mode retains its original range and other decks never route to DSP.
  const normal = createAudioEngine();
  const router = createDeckOneExperimentRouter(normal, player);
  check(router.setPitchPreserving(true), 'Empty Deck 1 must allow experimental selection');
  await player.loadFile(1, file);
  check(!router.setPitchPreserving(false), 'Loaded Deck 1 must reject a mode switch');
  for (const id of [2, 3, 4]) check(router.getState(id).loaded === false, 'Other decks must still use normal engine');
  router.eject(1);
  check(router.setPitchPreserving(false), 'Empty Deck 1 must return to normal mode');
  check(calculatePlaybackRate(120, 240) === 2, 'Normal rate calculation must not inherit experimental limits');
  check(JSON.stringify(appState) === originalMetadata, 'Experiment must not modify musical or synchronization state');
  console.log('Experimental transport and real SoundTouch DSP tests passed');
}
