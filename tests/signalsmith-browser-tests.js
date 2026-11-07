// Real browser integration checks. Requires a user click and a local HTTP server.
document.getElementById('run').addEventListener('click', async () => {
  const button = document.getElementById('run');
  const result = document.getElementById('result');
  button.disabled = true;
  result.textContent = 'Running…';
  const context = new AudioContext();
  const resumed = context.resume();
  const observedContexts = [];
  const observedOutputs = [];
  let scheduledStartTime = null;
  let lastDiagnosticError = null;
  const player = createSignalsmithPlayer({
    // Observe existing diagnostics without changing processor or transport behavior.
    log(record) {
      if (record.stage === 'startup-gain' && record.event === 'scheduled') {
        scheduledStartTime = record.audioStartTime;
      }
      if (record.event === 'error') lastDiagnosticError = record;
      console.info('Signalsmith smoke test:', record);
    },
    moduleUrl: new URL('../vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs', document.baseURI).href,
    createContext: () => {
      const next = observedContexts.length === 0 ? context : new AudioContext();
      observedContexts.push(next);
      return next;
    },
    createOutput: audioContext => {
      const output = createComparisonOutput(audioContext);
      observedOutputs.push(output);
      return output;
    }
  });
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  function check(condition, message) { if (!condition) throw new Error(message); }
  async function waitForRetirement() {
    const deadline = performance.now() + 2000;
    while (player.getState().releasePending || player.getState().closureBlocked) {
      if (performance.now() >= deadline) throw new Error('Session retirement did not complete');
      await wait(4); // Poll state; elapsed wall time is not proof of rendered release.
    }
  }

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
          positionMeaning: 'Signalsmith estimated audible position (not verified processor output)',
          timeoutMs, elapsedMs, contextState: context.state,
          audioClockAtPlayRequest, audioClockNow: context.currentTime,
          audioClockAdvancedSeconds: context.currentTime - audioClockAtPlayRequest,
          scheduledStartTime: scheduledStartTime,
          scheduledStartMeaning: 'Observed startup-gain diagnostic audioStartTime',
          baseLatency: context.baseLatency ?? null,
          outputLatency: context.outputLatency ?? null,
          dspLatency: state.dspLatency ?? null,
          reportedPosition: state.estimatedAudiblePosition,
          isPlaying: state.isPlaying, loading: state.loading,
          sourcePosition: state.sourcePosition, processedPosition: state.processedPosition,
          libraryInputPosition: state.libraryInputPosition ?? null,
          bufferedFrames: state.bufferedFrames, underruns: state.underruns,
          error: state.error || null, lastDiagnosticError: lastDiagnosticError
        };
        const reason = elapsedMs >= timeoutMs ? 'timed out' : 'failed';
        throw new Error('Startup progress ' + reason + ': ' + JSON.stringify(details));
      }
      if (state.isPlaying && state.estimatedAudiblePosition > 0) return;
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
    check(player.getState().isPlaying && player.getState().estimatedAudiblePosition > 0, 'Estimated audible timeline should advance (not verified processor output)');
    check(player.getState().outputPeak < 1, 'Generated tone must not clip at comparison gain');
    check(player.setTempo(1, 120, 144), '1.2× should be accepted while playing');
    await player.pause();
    const paused = player.getState();
    await wait(120);
    check(player.getState().estimatedAudiblePosition === paused.estimatedAudiblePosition, 'Pause should freeze the rendered cursor');
    check(player.getState().processedPosition === null, 'Unexposed DSP position must stay unavailable');
    check(observedOutputs[0].read().outputPeak < 0.001, 'Muted Pause must remove residual output');
    await player.play();
    await wait(300);
    check(player.getState().estimatedAudiblePosition > paused.estimatedAudiblePosition, 'Resume should advance the estimated audible timeline from the saved bookmark');
    check(!player.setTempo(1, 120, 145), 'Experimental upper limit should be enforced');
    await player.stop(); await waitForRetirement();
    check(player.getState().position === 0, 'Stop should rewind');
    check(observedContexts[0].state === 'closed', 'Stop must close its DSP context');
    await player.play();
    await wait(100);
    await player.eject(); await waitForRetirement();
    await wait(100);
    check(!player.getState().loaded && player.getState().position === 0, 'Eject should empty and reset the transport');
    check(observedContexts.every(item => item.state === 'closed'), 'Eject must close all experimental contexts');
    await player.loadFile(1, new File([data], 'repeat-tone.wav', { type: 'audio/wav' }));
    await player.play();
    await wait(3500);
    check(!player.getState().isPlaying && player.getState().position === 3, 'Natural completion must reach source duration');
    await player.eject(); await waitForRetirement();
    result.textContent = 'Signalsmith local WASM/AudioWorklet transport smoke test passed.\n' +
      'Position progress is a scheduled audible-position estimate, not verified DSP output.\n' +
      'Pitch quality, hardware timing, and clicks still require listening checks.';
  } catch (error) {
    result.textContent = 'FAILED: ' + error.message;
    console.error(error);
  } finally {
    await player.eject(); await waitForRetirement();
    if (context.state !== 'closed') await context.close();
    button.disabled = false;
  }
});
