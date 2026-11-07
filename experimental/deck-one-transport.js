// Deck 1 only. No appState, musical matching, cueing, or synchronization calls.
function createPitchPreservingPlayer(options = {}) {
  const createContext = options.createContext || (() => new AudioContext());
  const createNode = options.createNode || (context => new AudioWorkletNode(context,
    'tuneflow-deck-one', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }));
  const processorUrl = options.processorUrl || './experimental/deck-one-processor.js';
  const createOutput = options.createOutput || createComparisonOutput;
  let output = null;
  let comparisonLevel = 0.25;
  let context = null;
  let registration = null;
  let node = null;
  let nextId = 0;
  let version = 0;
  const pending = new Map();
  let history = [];
  let snapshot = { sourcePosition: 0, processedPosition: 0, renderedPosition: 0,
    bufferedFrames: 0, underruns: 0, playing: false, finished: false };
  let fileName = '';
  let duration = 0;
  let loaded = false;
  let loading = false;
  let originalBpm = null;
  let targetBpm = null;
  let playbackRate = 1;
  let failure = '';

  function getContext() {
    if (!context) context = createContext();
    return context;
  }

  async function initialize() {
    const audioContext = getContext();
    if (!audioContext.audioWorklet) throw new Error('Use a local server and a Safari version with AudioWorklet support.');
    if (!registration) {
      registration = audioContext.audioWorklet.addModule(processorUrl).catch(error => {
        registration = null;
        throw error;
      });
    }
    await registration;
  }

  function connectNode() {
    if (node) return;
    const currentNode = createNode(context);
    node = currentNode;
    node.port.onmessage = event => {
      if (node !== currentNode) return;
      const message = event.data;
      snapshot = message;
      history.push(...message.timeline);
      const cutoff = context.currentTime - 4;
      history = history.filter(block => block.time + block.duration >= cutoff);
      if (message.id !== undefined && pending.has(message.id)) {
        pending.get(message.id).resolve(message);
        pending.delete(message.id);
      }
    };
    node.onprocessorerror = () => {
      failure = 'Experimental processor failed. Eject and reload the file.';
      snapshot.playing = false;
      for (const request of pending.values()) request.reject(new Error(failure));
      pending.clear();
      currentNode.disconnect();
    };
    output = createOutput(context);
    output.level.value = comparisonLevel;
    node.connect(output.input);
  }

  function send(type, data = {}, transfers = []) {
    if (!node) return Promise.resolve();
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try { node.port.postMessage({ ...data, type, id }, transfers); }
      catch (error) { pending.delete(id); reject(error); }
    });
  }

  function disconnectNode() {
    if (!node) return;
    // Disconnect immediately; a pending disposal cannot make stale output audible.
    node.disconnect();
    if (output) { output.disconnect(); output = null; }
    node.port.postMessage({ type: 'dispose' });
    node.port.onmessage = null;
    node.port.close();
    node = null;
    for (const request of pending.values()) request.resolve();
    pending.clear();
  }

  async function loadFile(deckId, file) {
    const requestVersion = ++version;
    loading = true;
    try {
      // Wake the context during the file-picker user event; loading never starts playback.
      const audioContext = getContext();
      const resumed = audioContext.resume();
      await Promise.all([initialize(), resumed]);
      if (audioContext.state !== 'running') throw new Error('Safari did not allow audio initialization. Select the file again.');
      const buffer = await getContext().decodeAudioData(await file.arrayBuffer());
      if (requestVersion !== version) return false;
      if (buffer.numberOfChannels > 2) throw new Error('Experiment supports mono and stereo files only.');
      // Keep the original decoded source timeline, at the context sample rate.
      const channels = [];
      for (let index = 0; index < buffer.numberOfChannels; index++) {
        channels.push(new Float32Array(buffer.getChannelData(index)));
      }
      disconnectNode();
      history = [];
      connectNode();
      await send('load', { channels }, channels.map(channel => channel.buffer));
      if (requestVersion !== version) return false;
      fileName = file.name;
      duration = buffer.duration;
      loaded = true;
      originalBpm = null;
      targetBpm = null;
      playbackRate = 1;
      failure = '';
      return true;
    } finally {
      if (requestVersion === version) loading = false;
    }
  }

  async function play() {
    if (!loaded || loading || failure) return;
    const requestVersion = version;
    // Resume synchronously from the click handler before awaiting any other operation.
    await context.resume();
    if (requestVersion !== version || !loaded || loading) return;
    if (context.state !== 'running') throw new Error('Safari could not resume audio. Press Play again.');
    if (snapshot.finished) history = [];
    await send('play');
  }

  async function pause() {
    ++version;
    // Freeze the worklet itself, including all queued output and overlap history.
    await send('pause');
  }

  async function stop() {
    ++version;
    await send('stop');
    history = [];
  }

  function eject() {
    ++version;
    disconnectNode();
    loaded = false;
    loading = false;
    fileName = '';
    duration = 0;
    originalBpm = null;
    targetBpm = null;
    playbackRate = 1;
    history = [];
    failure = '';
    snapshot = { sourcePosition: 0, processedPosition: 0, renderedPosition: 0,
      bufferedFrames: 0, underruns: 0, playing: false, finished: false };
  }

  function setTempo(deckId, original, target) {
    const rate = calculatePlaybackRate(original, target);
    if (!loaded || loading || failure || rate === null || rate < 0.8 || rate > 1.2) return false;
    // Port messages are applied between render callbacks. Existing output drains first.
    node.port.postMessage({ type: 'tempo', rate });
    originalBpm = original;
    targetBpm = target;
    playbackRate = rate;
    return true;
  }

  function setComparisonLevel(value) {
    if (!Number.isFinite(value) || value < 0 || value > 0.25) return false;
    comparisonLevel = value;
    if (output) output.level.value = value;
    return true;
  }

  function getState() {
    const latency = context ? (context.baseLatency || 0) + (context.outputLatency || 0) : 0;
    const outputTime = context ? context.currentTime - latency : 0;
    const block = history.find(entry => outputTime >= entry.time && outputTime < entry.time + entry.duration);
    let audible = snapshot.renderedPosition;
    if (block) {
      audible = block.start + (block.end - block.start) * (outputTime - block.time) / block.duration;
    } else if (history.length && outputTime < history[0].time) {
      audible = history[0].start;
    }
    return { fileName, duration, loaded, loading, originalBpm, targetBpm, playbackRate,
      isPlaying: snapshot.playing, position: audible, comparisonLevel,
      sourcePosition: snapshot.sourcePosition, processedPosition: snapshot.processedPosition,
      renderedPosition: snapshot.renderedPosition, estimatedAudiblePosition: audible,
      estimatedOutputLatency: latency, bufferedFrames: snapshot.bufferedFrames,
      underruns: snapshot.underruns, error: failure,
      ...(output ? output.read() : { outputPeak: 0, outputRms: 0 }) };
  }

  return { loadFile, play, pause, stop, eject, setTempo, setComparisonLevel, getState };
}

// All normal calls still use the original engine. Only empty Deck 1 may switch modes.
function createDeckOneExperimentRouter(normalEngine, experimental = createPitchPreservingPlayer(),
  signalsmith = null) {
  let mode = 'normal';
  const selected = deckId => {
    if (deckId !== 1 || mode === 'normal') return normalEngine;
    return mode === 'signalsmith' ? signalsmith : experimental;
  };
  const router = {};
  for (const operation of ['loadFile', 'play', 'pause', 'stop', 'eject', 'setTempo', 'getState']) {
    router[operation] = (deckId, ...args) => selected(deckId)[operation](deckId, ...args);
  }
  router.setComparisonLevel = value => mode !== 'normal' && selected(1).setComparisonLevel(value);
  router.getMode = () => mode;
  router.isPitchPreserving = () => mode !== 'normal';
  router.setMode = next => {
    if (!['normal', 'soundtouch', 'signalsmith'].includes(next)) return false;
    if (next === 'signalsmith' && !signalsmith) return false;
    const state = selected(1).getState(1);
    if (state.loaded || state.loading) return false;
    mode = next;
    return true;
  };
  // Preserve the existing test/API entry point for the SoundTouch prototype.
  router.setPitchPreserving = enabled => router.setMode(enabled ? 'soundtouch' : 'normal');
  return router;
}
