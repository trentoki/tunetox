function runEnvelopeAnalysisTests() {
  let count = 0;
  function check(condition, message) { if (!condition) throw new Error(message); count++; }
  function near(a, b) { return Math.abs(a - b) < 1e-10; }
  function rejects(fn) { let failed = false; try { fn(); } catch (_) { failed = true; } check(failed, 'Invalid input accepted'); }
  const analyze = EnvelopeAnalysis.analyze;
  const pulse = analyze([Float32Array.from([0, 0, 1, 1, .5, .5, 0])], 1000, 1);
  check(pulse.rms.join() === '0,0,1,1,0.5,0.5,0', 'RMS retains attack and decay');
  check(pulse.onset.join() === '0,0,1,0,0,0,0', 'Positive change excludes decay');
  check(pulse.times.every((t, i) => near(t, i / 1000)), 'Sample-aligned start timestamps');
  check(analyze([new Float32Array(11)], 1000, 5).rms.every(v => v === 0), 'Silence');
  const stereo = analyze([new Float32Array(11).fill(1), new Float32Array(11).fill(-1)], 1000, 5);
  check(stereo.rms.every(v => v === 1), 'Stereo energy cannot phase-cancel; partial bin uses actual count');
  check(stereo.times.length === 3 && near(stereo.times[2], .01), 'Partial final window retained');
  check(stereo.onset.every(v => v === 0), 'Constant amplitude and first-bin convention');
  check(near(analyze([Float32Array.from([0, 1, 0, 1, 0])], 1000, 5).rms[0], Math.sqrt(2 / 5)), 'RMS is root mean square');
  for (const rate of [44100, 48000]) for (const ms of [1, 5, 10, 20]) {
    const result = analyze([new Float32Array(rate + 1)], rate, ms);
    check(result.windowFrames === Math.round(rate * ms / 1000), 'Resolution rounds to samples');
    check(result.times.length === Math.ceil((rate + 1) / result.windowFrames), 'Window count');
    check(result.times.every((t, i) => near(t, i * result.windowFrames / rate)), 'No timestamp drift');
  }
  const original = pulse.times.slice();
  for (const multiplier of [.5, 1, 1.37, 2]) {
    const scaled = EnvelopeAnalysis.scaleTimes(pulse.times, multiplier);
    check(scaled.every((t, i) => near(t, original[i] / multiplier)), 'Tempo time mapping');
    check(pulse.times.every((t, i) => t === original[i]) && pulse.rms[2] === 1, 'Scaling preserves source time and amplitude');
  }
  for (const ms of [0, 2, NaN, 21]) rejects(() => analyze([new Float32Array(10)], 1000, ms));
  for (const rate of [0, Infinity, NaN]) rejects(() => analyze([new Float32Array(10)], rate, 1));
  rejects(() => analyze([], 1000, 1));
  rejects(() => analyze([new Float32Array(0)], 1000, 1));
  rejects(() => analyze([Float32Array.from([NaN])], 1000, 1));
  rejects(() => analyze([new Float32Array(2), new Float32Array(1)], 1000, 1));
  rejects(() => analyze([new Float32Array(120001)], 1000, 1));
  for (const multiplier of [0, .49, 2.01, NaN, Infinity]) rejects(() => EnvelopeAnalysis.scaleTimes(original, multiplier));
  return `${count} envelope assertions passed`;
}
