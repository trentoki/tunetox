// Gain automation contract tests; real Safari listening is a separate acceptance check.
async function runSignalsmithStartupTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pump = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  function fixture(rampSeconds, duration = 2, diagnostics) {
    let time = 0;
    let clockStep = 0;
    let defer = false;
    const nodes = [];
    const outputs = [];
    const contexts = [];
    const factory = async () => {
      const node = { port: { close() {} }, connect() {}, disconnect() {},
        addBuffers: async () => 2, latency: async () => 0.12, setUpdateInterval: async () => {},
        commands: [], pending: [],
        schedule(command) {
          this.commands.push(command);
          if (!defer) return Promise.resolve(command);
          return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
        } };
      nodes.push(node);
      return node;
    };
    const player = createSignalsmithPlayer({ releaseSeconds: 0, moduleUrl: 'local.mjs', log() {}, diagnostics,
      ...(rampSeconds === undefined ? {} : { startupRampSeconds: rampSeconds }),
      createContext: () => {
        const context = { sampleRate: 48000, state: 'running', get currentTime() { const value = time; time += clockStep; return value; },
          resume: async () => {}, close: async () => { context.state = 'closed'; },
          decodeAudioData: async () => ({ duration, numberOfChannels: 1,
            getChannelData: () => new Float32Array(96000) }) };
        contexts.push(context); return context;
      },
      importLibrary: async () => ({ default: factory }),
      createOutput: () => {
        const level = { value: 0.25, events: [],
          cancelScheduledValues(t) { this.events = this.events.filter(event => event.time < t); },
          setValueAtTime(value, t) { this.events.push({ kind: 'set', value, time: t }); },
          linearRampToValueAtTime(value, t) { this.events.push({ kind: 'ramp', value, time: t }); } };
        const output = { input: {}, level, disconnect() {}, read: () => ({ outputPeak: 0, outputRms: 0 }) };
        outputs.push(output); return output;
      } });
    return { player, nodes, outputs, contexts,
      file: { name: 'tone.wav', arrayBuffer: async () => new ArrayBuffer(4) },
      defer: value => { defer = value; }, time: value => { time = value; }, advanceOnRead: value => { clockStep = value; } };
  }
  for (const ackTime of [0, 0.12, 0.122, 0.124, 0.2, 3]) {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.defer(true); const playing = f.player.play(); await pump();
    const command = f.nodes[0].commands[0];
    const gain = f.outputs[0].level;
    check(command.input === 0 && near(command.output, 0.12), 'Startup must keep source zero and existing scheduled start');
    check(gain.events.some(e => e.kind === 'set' && e.value === 0 && near(e.time, command.output)),
      'Gain must be zero at intended start before acknowledgement');
    check(gain.events.some(e => e.kind === 'ramp' && e.value === 0.25 && near(e.time, command.output + 0.004)),
      '4 ms ramp must be scheduled before acknowledgement');
    const opening = JSON.stringify(gain.events);
    f.time(ackTime); f.nodes[0].pending[0].resolve(); await playing;
    if (ackTime < 2.24) {
      check(JSON.stringify(gain.events) === opening,
        'Acknowledgement must leave every startup event untouched');
      check(gain.events[gain.events.length - 1].value === 0 && near(gain.events[gain.events.length - 1].time, 2.24),
        'Completion cutoff must retain endpoint plus DSP latency');
    } else {
      check(gain.value === 0 && !gain.events.some(e => e.time >= ackTime && e.value > 0),
        'An acknowledgement after completion must never reopen output');
    }
    f.defer(false); await f.player.eject();
  }
  {
    const f = fixture(0.003); await f.player.loadFile(1, f.file); await f.player.play();
    check(f.outputs[0].level.events.some(e => e.kind === 'ramp' && near(e.time, 0.123)),
      'Ramp duration must be configurable');
    f.time(0.5); await f.player.pause();
    const saved = f.player.getState().savedSourcePosition;
    check(f.outputs[0].level.value === 0, 'Pause must remain muted');
    await f.player.play();
    const resumed = f.nodes[0].commands[f.nodes[0].commands.length - 1];
    check(near(resumed.input, saved) && near(resumed.output, 0.62), 'Pause resume must preserve saved position and scheduled start');
    check(f.outputs[0].level.events.some(e => e.kind === 'ramp' && near(e.time, 0.623)),
      'Pause resume must use the same startup envelope');
    await f.player.stop(); await f.player.play();
    const restarted = f.nodes[1].commands[0];
    check(restarted.input === 0 && near(restarted.output, 0.62), 'Stop restart must rewind without added ramp delay');
    check(f.outputs[1].level.events.some(e => e.kind === 'ramp' && near(e.time, 0.623)),
      'Fresh processor must receive the ramp');
    await f.player.eject();
  }
  for (const cancel of ['stop', 'eject']) {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.defer(true); const stalePlay = f.player.play(); await pump();
    const oldNode = f.nodes[0]; const oldGain = f.outputs[0].level;
    await f.player[cancel]();
    check(oldGain.value === 0 && !oldGain.events.some(e => e.kind === 'ramp'), 'Cancellation must remove queued opening automation');
    f.defer(false);
    if (cancel === 'eject') await f.player.loadFile(1, f.file);
    await f.player.play();
    const newerEvents = JSON.stringify(f.outputs[1].level.events);
    oldNode.pending[0].resolve(); await stalePlay;
    check(JSON.stringify(f.outputs[1].level.events) === newerEvents && f.player.getState().isPlaying,
      'Stale acknowledgement must not modify newer session automation');
    await f.player.eject();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.defer(true); const stale = f.player.play(); await pump();
    f.defer(false); await f.player.pause(); await f.player.play();
    const events = JSON.stringify(f.outputs[0].level.events);
    f.nodes[0].pending[0].reject(new Error('late superseded failure')); await stale;
    check(f.contexts[0].state === 'running' && f.player.getState().isPlaying &&
      JSON.stringify(f.outputs[0].level.events) === events,
      'Superseded Play failure must not mute/dispose a newer request in the same session');
    await f.player.eject();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file); await f.player.play();
    const gain = f.outputs[0].level;
    const opening = JSON.stringify(gain.events.filter(e => e.time <= 0.124));
    f.time(0.121);
    check(f.player.setTempo(1, 100, 80), 'Tempo change must be accepted');
    check(!gain.events.some(e => near(e.time, 2.24)), 'Old completion cutoff must be removed');
    check(JSON.stringify(gain.events.filter(e => e.time <= 0.124)) === opening,
      'Tempo change during startup must preserve original opening events');
    f.time(0.122); f.player.setComparisonLevel(0.1);
    check(gain.events.some(e => e.kind === 'ramp' && near(e.time, 0.124) && near(e.value, 0.1)),
      'Explicit trim must reach the new target at the original ramp endpoint');
    f.time(0.3); f.player.setComparisonLevel(0);
    check(gain.events.some(e => e.kind === 'set' && near(e.time, 0.3) && e.value === 0),
      'Zero trim after startup must remain supported');
    check(gain.events.some(e => e.time > 1 && e.value === 0), 'Trim must restore completion cutoff');
    await f.player.eject();
  }
  {
    const f = fixture(0.004, 0.0001); await f.player.loadFile(1, f.file);
    f.defer(true); const play = f.player.play(); await pump();
    const gain = f.outputs[0].level;
    const opening = JSON.stringify(gain.events);
    f.time(0.122); f.advanceOnRead(0.0002);
    f.nodes[0].pending[0].resolve(); await play;
    check(JSON.stringify(gain.events) === opening,
      'Advancing context clock and short PCM must not reconstruct the ramp');
    check(near(gain.events[gain.events.length - 1].time, 0.2401), 'Short clip must retain its cutoff');
    await f.player.eject();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.defer(true); const stale = f.player.play(); await pump();
    f.defer(false); await f.player.pause(); await f.player.play();
    const gain = f.outputs[0].level;
    const events = JSON.stringify(gain.events);
    f.nodes[0].pending[0].resolve(); await stale;
    check(JSON.stringify(gain.events) === events,
      'Superseded successful acknowledgement must not alter reused-session automation');
    await f.player.eject();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file);
    f.defer(true); const play = f.player.play(); await pump();
    f.time(0.122); f.player.setComparisonLevel(0.1);
    const gain = f.outputs[0].level;
    const events = JSON.stringify(gain.events);
    check(gain.events.some(e => e.kind === 'ramp' && near(e.value, 0.1)),
      'Trim during a pending acknowledgement must adjust output');
    check(gain.events.some(e => near(e.time, 2.24) && e.value === 0),
      'Pending-acknowledgement trim must restore the completion cutoff');
    f.nodes[0].pending[0].resolve(); await play;
    check(JSON.stringify(gain.events) === events, 'Acknowledgement must preserve explicit trim automation');
    await f.player.eject();
  }
  {
    const fail = () => { throw new Error('diagnostic failure'); };
    const f = fixture(undefined, 2, { begin: fail, attach: fail, event: fail, arm: fail, close: fail, cancel: fail });
    check(await f.player.loadFile(1, f.file), 'Diagnostic failures must not prevent loading');
    await f.player.play(); check(f.player.getState().isPlaying, 'Diagnostic failures must not prevent playback');
    await f.player.pause(); await f.player.play(); await f.player.stop(); await f.player.eject();
    check(!f.player.getState().loaded, 'Diagnostic failures must not prevent transport cleanup');
  }
  console.log('Signalsmith startup ramp, delayed acknowledgement, restart/resume, and cancellation tests passed');
}
