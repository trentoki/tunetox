document.getElementById('run').onclick = async () => {
  const button = document.getElementById('run'), results = document.getElementById('results');
  button.disabled = true; results.textContent = 'Running…';
  let context;
  const nodes = [], outputs = [];
  let contextCreations = 0;

  const createOutput = audioContext => {
    const output = createComparisonOutput(audioContext);
    const disconnect = output.disconnect;
    output.disconnect = () => { output.disconnected = true; disconnect(); };
    outputs.push(output); return output;
  };
  const player = createSignalsmithPlayer({ persistentContext: true,
    createContext: () => { ++contextCreations; context = new AudioContext(); return context; },
    importLibrary: async () => {
      const factory = (await import('../vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs')).default;
      factory.moduleUrl = new URL('../vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs', document.baseURI).href;
      return { default: async audioContext => {
      const node = await factory(audioContext);
      const disconnect = node.disconnect.bind(node);
      node.disconnect = (...args) => { node.retired = true; return disconnect(...args); };
      const closePort = node.port.close.bind(node.port);
      node.port.close = () => { node.portClosed = true; return closePort(); };
      nodes.push(node); return node;
    } }; }, createOutput });
  // Generated source uses the adapter's normal decode path.
  const rate = 48000, frames = rate * 2;
  const bytes = new ArrayBuffer(44 + frames * 2), view = new DataView(bytes);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, 1000 * Math.sin(2 * Math.PI * 440 * i / rate), true);
  const file = new File([bytes], 'persistent-context-test.wav');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (value, message) => { if (!value) throw new Error(message); };
  async function waitForRetirement() {
    const deadline = performance.now() + 2000;
    while (player.getState().releasePending || player.getState().closureBlocked) {
      if (performance.now() >= deadline) throw new Error('Session retirement did not complete');
      await wait(4); // Poll state; elapsed wall time is not proof of rendered release.
    }
  }
  try {
    // No await precedes Load: its context creation/resume remains in this click handler.
    await player.loadFile(1, file);
    const identity = context;
    for (let i = 0; i < 10; i++) {
      await player.play(); await wait(180);
      await player.eject(); await waitForRetirement();
      check(context === identity && context.state === 'running' && contextCreations === 1, 'Context identity/state changed');
      check(nodes.every(node => node.retired && node.portClosed) && outputs.every(output => output.disconnected), 'Session graph was not retired');
      check(player.getState().position === 0, 'Eject must reset source coordinate');
      if (i < 9) await player.loadFile(1, file);
    }
    check(new Set(nodes).size === 10, 'Expected a new processor per session');
    await player.setPersistentContext(false);
    check(context.state === 'closed', 'Disable must close persistent context');
    results.textContent = 'PASS 10 sessions: one context, 10 fresh processors, output cleanup, source reset, and explicit context closure';
  } catch (error) { results.textContent = 'FAIL: ' + error.message; console.error(error); }
  finally { await player.shutdown().catch(console.error); button.disabled = false; }
};
if (new URLSearchParams(location.search).has('run')) document.getElementById('run').click();
