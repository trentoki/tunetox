// macOS runner: osascript -l JavaScript tests/run-tests.js (from the project folder).
ObjC.import('Foundation');
function read(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
const files = ['four-deck-stem-allocation.js', 'tests/four-deck-stem-allocation-tests.js', 'tests/bounded-ready-tests.js', 'tests/bounded-aiff-tests.js', 'experimental/bounded-wav-reader.js', 'experimental/bounded-wav-player.js', 'tests/bounded-wav-tests.js', 'tests/four-deck-stem-player-tests.js', 'experimental/stem-file-assignments.js', 'tests/stem-file-assignment-tests.js', 'stem-source-router.js', 'tests/stem-source-router-tests.js', 'experimental/four-stem-player.js', 'tests/four-stem-player-tests.js', 'tests/two-deck-stem-player-tests.js', 'experimental/stem-handoff-audio-bridge.js', 'tests/stem-handoff-audio-bridge-tests.js', 'participation.js', 'stem-state.js', 'two-deck-stem-handoff.js', 'app.js', 'development/metadata-demo.js', 'tests/metadata-model-tests.js', 'tests/participation-tests.js', 'tests/participation-defaults-tests.js', 'tests/stem-state-tests.js', 'tests/stem-authorization-tests.js', 'tests/stem-handoff-lifecycle-tests.js', 'tests/stem-handoff-integration-tests.js', 'tests/stem-volume-handoff-tests.js', 'tests/global-stem-handoff-tests.js', 'tests/two-deck-stem-handoff-tests.js', 'audio-engine.js', 'experimental/comparison-output.js', 'experimental/deck-one-transport.js',
  'experimental/signalsmith-transport.js', 'experimental/signalsmith-diagnostics.js', 'tests/signalsmith-diagnostics-tests.js', 'tests/signalsmith-recorder-anomaly-tests.js', 'tests/signalsmith-tests.js', 'tests/signalsmith-closure-tests.js', 'tests/signalsmith-context-lifecycle-tests.js', 'tests/signalsmith-startup-tests.js', 'tests/signalsmith-release-tests.js', 'tests/signalsmith-selection-tests.js', 'tests/signalsmith-loading-tests.js', 'tests/signalsmith-dsp-tests.js',
  'tests/audio-engine-tests.js', 'tests/experimental-tests.js'];
let source = files.map(read).join('\n');
source += `
(async () => {
  await runBoundedReadyTests();
  await runBoundedAiffTests();
  await runBoundedWavTests();
  runStemFileAssignmentTests();
  await runStemSourceRouterTests();
  await runFourDeckStemPlayerTests();
  await runFourStemPlayerTests();
  await runTwoDeckStemPlayerTests();
  runStemHandoffAudioBridgeTests();
  runApplicationStartupTests();
  runMetadataModelTests();
  runParticipationTests();
  runParticipationDefaultsTests();
  runStemStateTests();
  runStemAuthorizationTests();
  runStemHandoffLifecycleTests();
  runStemHandoffIntegrationTests();
  runStemVolumeHandoffTests();
  runGlobalStemHandoffTests();
  runTwoDeckStemHandoffTests();
  runFourDeckStemAllocationTests();
  let Recorder;
  const recorderClock = { frame: 0 };
  class RecorderBase { constructor() { this.port = {}; } }
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'clock',
    'with (clock) { ' + ${JSON.stringify(read('experimental/signalsmith-recorder.js').replaceAll('currentFrame', 'frame'))} + ' }')(
      RecorderBase, (name, value) => { Recorder = value; }, 48000, recorderClock);
  await runSignalsmithDiagnosticsTests(Recorder, recorderClock);
  await runSignalsmithRecorderAnomalyTests(Recorder, recorderClock);
  await runSignalsmithSelectionTests(${JSON.stringify(read('audio-controls.js'))});
  await runSignalsmithTests();
  await runSignalsmithClosureTests();
  await runSignalsmithContextLifecycleTests();
  await runSignalsmithStartupTests();
  await runSignalsmithReleaseTests();
  await runSignalsmithLoadingTests();
  await runSignalsmithDspTests(async () => {
    let time = 0;
    let Captured;
    let ready;
    const initialized = new Promise(resolve => { ready = resolve; });
    class WorkletStub {
      constructor() { this.port = { postMessage(message) { if (message[0] === 'ready') ready(); } }; }
    }
    const clock = { get currentTime() { return time; } };
    // Use synchronous compilation only in this harness so JXA needs no event loop.
    // The binary, wrapper processing, and DSP settings remain unchanged.
    const wasm = { RuntimeError: WebAssembly.RuntimeError,
      instantiate: (bytes, imports) => Promise.resolve({
        instance: new WebAssembly.Instance(new WebAssembly.Module(bytes), imports)
      }) };
    const load = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate',
      'clock', 'console', 'WebAssembly', 'with (clock) {\\n' +
      ${JSON.stringify(read('vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs').replace('export default _export;', ''))} + '\\n}');
    load(WorkletStub, (name, Processor) => { Captured = Processor; }, 48000, clock,
      { log: console.log, error: console.log, warn: console.log }, wasm);
    const processor = new Captured({ numberOfOutputs: 1, outputChannelCount: [2] });
    await initialized;
    return { processor, advance(seconds) { time += seconds; } };
  });

  let simulatedTime = 0;
  for (const sampleRate of [44100, 48000]) {
  let DeckProcessor;
  class AudioWorkletProcessor {
    constructor() { this.port = { postMessage() {}, onmessage: null }; }
  }
  function registerProcessor(name, constructor) {
    if (name === 'tuneflow-deck-one') DeckProcessor = constructor;
  }
  const create = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'clock',
    'const getTime = () => clock.time;\\n' +
    'return (function() {\\n' + ${JSON.stringify(read('vendor/soundtouchjs-2.1.1/soundtouch-processor.js'))} +
    '\\n' + ${JSON.stringify(read('experimental/deck-one-processor.js').replace(/^import .*;\n/m, '').replaceAll('currentTime', 'getTime()'))} +
    '\\n})();');
  const clock = { sampleRate, get time() { return simulatedTime; },
    advance(frames) { simulatedTime += frames / sampleRate; } };
  create(AudioWorkletProcessor, registerProcessor, sampleRate, clock);
  await runExperimentalTests(DeckProcessor, clock);
  console.log('Verified simulated sample rate: ' + sampleRate);
  }
})().catch(error => { console.log('EXPERIMENT FAILED: ' + error.message + ' ' + error.stack); throw error; });
`;
eval(source);
