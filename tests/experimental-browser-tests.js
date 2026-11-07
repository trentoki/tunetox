// Real browser integration checks. Requires a user click and a local HTTP server.
document.getElementById('run').addEventListener('click', async () => {
  const button = document.getElementById('run');
  const result = document.getElementById('result');
  button.disabled = true;
  result.textContent = 'Running…';
  const context = new AudioContext();
  const resumed = context.resume();
  const player = createPitchPreservingPlayer({ createContext: () => context,
    processorUrl: '../experimental/deck-one-processor.js' });
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  function check(condition, message) { if (!condition) throw new Error(message); }

  // Poll observed progress; a wall-clock delay alone does not prove audio has rendered.
  async function waitForStartupProgress(audioClockAtPlayRequest) {
    const timeoutMs = 5000;
    const pollIntervalMs = 20;
    const started = performance.now();
    while (true) {
      const state = player.getState();
      const elapsedMs = performance.now() - started;
      if (elapsedMs >= timeoutMs || state.error || context.state === 'closed') {
        const details = {
          positionMeaning: 'SoundTouch reported rendered position',
          timeoutMs, elapsedMs, contextState: context.state,
          audioClockAtPlayRequest, audioClockNow: context.currentTime,
          audioClockAdvancedSeconds: context.currentTime - audioClockAtPlayRequest,
          scheduledStartTime: null,
          scheduledStartMeaning: 'Immediate play command; exact scheduled render time is not exposed',
          baseLatency: context.baseLatency ?? null,
          outputLatency: context.outputLatency ?? null,
          dspLatency: state.dspLatency ?? null,
          reportedPosition: state.renderedPosition,
          isPlaying: state.isPlaying, loading: state.loading,
          sourcePosition: state.sourcePosition, processedPosition: state.processedPosition,
          libraryInputPosition: state.libraryInputPosition ?? null,
          bufferedFrames: state.bufferedFrames, underruns: state.underruns,
          error: state.error || null, lastDiagnosticError: null
        };
        const reason = elapsedMs >= timeoutMs ? 'timed out' : 'failed';
        throw new Error('Startup progress ' + reason + ': ' + JSON.stringify(details));
      }
      if (state.isPlaying && state.renderedPosition > 0) return;
      await wait(pollIntervalMs);
    }
  }
  try {
    await resumed;
    // Build a local 3-second, 440 Hz, mono PCM WAV without downloading test assets.
    const rate = 48000;
    const frames = rate * 3;
    const data = new ArrayBuffer(44 + frames * 2);
    const view = new DataView(data);
    function text(offset, value) {
      for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
    }
    text(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, frames * 2, true);
    for (let frame = 0; frame < frames; frame++) {
      view.setInt16(44 + frame * 2, 2500 * Math.sin(2 * Math.PI * 440 * frame / rate), true);
    }
    await player.loadFile(1, new File([data], 'generated-tone.wav', { type: 'audio/wav' }));
    check(!player.getState().isPlaying, 'Loading should not autoplay');
    check(player.setTempo(1, 120, 96), '0.8× should be accepted');
    const audioClockAtPlayRequest = context.currentTime;
    await player.play();
    await waitForStartupProgress(audioClockAtPlayRequest);
    check(player.getState().isPlaying && player.getState().renderedPosition > 0, 'Real processor should advance');
    check(player.setTempo(1, 120, 144), '1.2× should be accepted while playing');
    await player.pause();
    const paused = player.getState();
    await wait(120);
    check(player.getState().renderedPosition === paused.renderedPosition, 'Pause should freeze the rendered cursor');
    check(player.getState().sourcePosition === paused.sourcePosition, 'Pause should freeze source reads');
    await player.play();
    await wait(120);
    check(player.getState().renderedPosition > paused.renderedPosition, 'Resume should advance from saved DSP state');
    check(!player.setTempo(1, 120, 145), 'Experimental upper limit should be enforced');
    await player.stop();
    check(player.getState().position === 0, 'Stop should rewind');
    await player.play();
    await wait(100);
    player.eject();
    await wait(100);
    check(!player.getState().loaded && player.getState().position === 0, 'Eject should empty and reset the transport');
    result.textContent = 'Real AudioWorklet module loading and transport smoke test passed.\n' +
      'Pitch quality, hardware timing, and clicks still require listening checks.';
  } catch (error) {
    result.textContent = 'FAILED: ' + error.message;
    console.error(error);
  } finally {
    player.eject();
    await context.close();
    button.disabled = false;
  }
});
