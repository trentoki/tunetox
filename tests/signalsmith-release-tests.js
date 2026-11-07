async function runSignalsmithReleaseTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const near = (a, b) => Math.abs(a - b) < 1e-8;
  const pump = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  function fixture(nativeHold = false) {
    let clock = 0, wall = 0, id = 0, holdDecode = false, finishDecode, holdSchedule = false, finishSchedule;
    const timers = new Map(), nodes = [], outputs = [], contexts = [];
    const player = createSignalsmithPlayer({ moduleUrl: 'release-test', log() {}, persistentContext: true,
      now: () => wall,
      setTimer(callback, delay) { timers.set(++id, { callback, due: wall + delay }); return id; },
      clearTimer: key => timers.delete(key),
      createContext: () => {
        const context = { sampleRate: 48000, state: 'running', get currentTime() { return clock; },
          resume: async () => {}, close: async () => { context.state = 'closed'; },
          decodeAudioData: async () => {
            if (holdDecode) await new Promise(resolve => { finishDecode = resolve; });
            return { duration: 10, numberOfChannels: 1, getChannelData: () => new Float32Array(480000) };
          } };
        contexts.push(context); return context;
      },
      importLibrary: async () => ({ default: async () => {
        const node = { port: { close() { this.closed = true; } }, connect() {}, disconnect() { this.disconnected = true; },
          addBuffers: async () => {}, latency: async () => 0.12, setUpdateInterval: async () => {},
          commands: [], async schedule(command) { this.commands.push(command);
            if (holdSchedule && command.active) await new Promise(resolve => { finishSchedule = resolve; }); } };
        nodes.push(node); return node;
      } }),
      createOutput: () => {
        const gain = { value: 0.25, events: [], cancelScheduledValues(t) { this.events.push({ type: 'cancel', t }); },
          setValueAtTime(value, t) { this.events.push({ type: 'set', value, t }); },
          linearRampToValueAtTime(value, t) { this.events.push({ type: 'ramp', value, t }); } };
        if (nativeHold) gain.cancelAndHoldAtTime = t => gain.events.push({ type: 'hold', t });
        const output = { input: {}, level: gain, disconnect() { this.disconnected = true; }, read: () => ({}) };
        outputs.push(output); return output;
      } });
    return { player, nodes, outputs, contexts, file: { name: 'release.wav', arrayBuffer: async () => new ArrayBuffer(0) },
      holdSchedule() { holdSchedule = true; }, finishSchedule() { holdSchedule = false; finishSchedule(); },
      holdDecode() { holdDecode = true; }, finishDecode() { holdDecode = false; finishDecode(); },
      pendingCallbacks: () => Array.from(timers.values()).map(timer => timer.callback),
      tick(time, ms = 4) { clock = time; wall += ms; for (const [key, timer] of Array.from(timers)) {
        if (timer.due <= wall) { timers.delete(key); timer.callback(); }
      } } };
  }
  for (const nativeHold of [false, true]) {
    const f = fixture(nativeHold); await f.player.loadFile(1, f.file);
    f.player.setTempo(1, 100, 120); await f.player.play();
    f.tick(0.122);
    const paused = f.player.pause();
    const gain = f.outputs[0].level;
    check(gain.events.some(e => e.type === 'ramp' && e.value === 0 && near(e.t, 0.127)), 'Release must last 5 ms on audio clock');
    check(nativeHold ? gain.events.some(e => e.type === 'hold' && near(e.t, 0.122)) :
      gain.events.some(e => e.type === 'set' && near(e.value, 0.125) && near(e.t, 0.122)),
      'Release must hold actual gain including the interrupted startup ramp');
    check(gain.events.some(e => e.type === 'set' && near(e.value, 0.125) && near(e.t, 0.122)),
      'Both native hold and fallback must anchor the release at the command time');
    check(near(f.player.getState().savedSourcePosition, (0.127 - 0.12) * 1.2), 'Pause bookmark must use release end times actual rate');
    f.tick(0.126); check(f.player.getState().releasePending && f.nodes[0].commands.length === 1, 'Do not deactivate before release endpoint');
    let blocked = false; try { await f.player.play(); } catch (_) { blocked = true; }
    check(blocked, 'Pause -> Play must not reopen output while retiring the fade');
    f.tick(0.128); check(f.player.getState().releasePending, 'First endpoint observation alone must not retire the graph');
    f.tick(0.131); await paused;
    check(!f.nodes[0].disconnected && f.nodes[0].commands[1].active === false, 'Pause must preserve node and deactivate only after render confirmation');
    const saved = f.player.getState().savedSourcePosition;
    await f.player.play();
    check(near(f.nodes[0].commands[2].input, saved), 'Resume must not replay the release tail');
    f.tick(0.6); await f.player.stop();
    check(f.player.getState().position === 0 && !f.nodes[0].disconnected, 'Stop must reset state immediately but preserve release graph');
    await f.player.stop();
    const staleCallbacks = f.pendingCallbacks();
    f.tick(0.606); f.tick(0.609);
    check(f.nodes[0].disconnected && f.nodes[0].port.closed && f.outputs[0].disconnected, 'Stop must clean up after the unchanged deadline');
    await f.player.play(); check(f.nodes[1].commands[0].input === 0, 'Stop -> Play must use fresh processor at zero');
    const newerAutomation = JSON.stringify(f.outputs[1].level.events);
    staleCallbacks.forEach(callback => callback());
    check(JSON.stringify(f.outputs[1].level.events) === newerAutomation && !f.nodes[1].disconnected,
      'Stale release callbacks must not mute or dispose a newer session');
    f.tick(1); await f.player.eject();
    blocked = false; try { await f.player.loadFile(1, f.file); } catch (_) { blocked = true; }
    check(blocked && !f.player.getState().loaded, 'Eject -> Load must not overlap the retiring tail');
    f.tick(1.006); f.tick(1.009); await f.player.loadFile(1, f.file);
    check(f.contexts.length === 1 && !f.nodes[2].disconnected, 'Persistent context and newer session must survive old cleanup');
    await f.player.shutdown();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file); await f.player.play(); f.tick(1);
    const pausing = f.player.pause(); await f.player.stop();
    f.tick(1.006); f.tick(1.009); await pausing;
    check(f.nodes[0].disconnected && f.player.getState().position === 0, 'Stop must escalate Pause without retaining or re-bookmarking it');
    await f.player.play();
    f.tick(2); const interrupted = f.player.pause(); f.contexts[0].state = 'interrupted'; f.tick(2, 4); await interrupted;
    check(!f.player.getState().releasePending && f.player.getState().error.includes('not verified'), 'Interrupted context must release controls without claiming rendered success');
    f.contexts[0].state = 'running'; await f.player.play(); f.tick(3);
    await f.player.stop(); f.tick(3, 751);
    check(!f.player.getState().releasePending && f.player.getState().error.includes('timed out'), 'Frozen clock must not indefinitely block controls');
    await f.player.shutdown();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file); await f.player.play(); f.tick(1);
    await f.player.stop();
    f.outputs[0].level.cancelScheduledValues = () => { throw new Error('gain cleanup failed'); };
    f.tick(1.006); f.tick(1.009);
    check(!f.player.getState().releasePending && f.nodes[0].disconnected && f.nodes[0].port.closed,
      'Failed gain cleanup must not block controls or skip processor/port cleanup');
    await f.player.shutdown();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file); await f.player.play(); f.tick(1);
    f.holdDecode(); const replacement = f.player.loadFile(1, f.file); await pump();
    const paused = f.player.pause(); f.finishDecode(); await pump();
    check(!f.nodes[0].disconnected && f.player.getState().releasePending,
      'In-flight Load must not retire the original session before its release renders');
    f.tick(1.006); f.tick(1.009); await paused; await replacement;
    check(f.nodes[0].disconnected && !f.nodes[1].disconnected && f.player.getState().position === 0,
      'Replacement may commit safely after release completion');
    await f.player.shutdown();
  }
  {
    const f = fixture(); await f.player.loadFile(1, f.file); f.holdSchedule();
    const pendingPlay = f.player.play(); await pump(); f.tick(0.2);
    const paused = f.player.pause();
    check(near(f.player.getState().savedSourcePosition, 0.205 - 0.12),
      'Delayed playback acknowledgement must not lose the release-end source mapping');
    f.tick(0.206); f.tick(0.209); await paused;
    f.finishSchedule(); await pendingPlay;
    await f.player.play();
    check(near(f.nodes[0].commands[f.nodes[0].commands.length - 1].input, 0.085),
      'Stale Play acknowledgement must not overwrite release-end bookmark');
    f.tick(1); await f.player.eject(); f.tick(1.006); f.tick(1.009); await f.player.shutdown();
  }
  console.log('Signalsmith 5 ms release timing, rate-aware bookmarks, rapid commands, interruption, timeout, and cleanup tests passed');
}
