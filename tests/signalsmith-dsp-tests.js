// Executes the unchanged published wrapper + embedded WASM with a simulated worklet clock.
async function runSignalsmithDspTests(harnessFactory) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  for (const rate of [0.8, 1, 1.2]) {
    const harness = await harnessFactory();
    const sampleRate = 48000;
    const tone = new Float32Array(sampleRate * 3);
    for (let index = 0; index < tone.length; index++) tone[index] = 0.2 * Math.sin(2 * Math.PI * 440 * index / sampleRate);
    const processor = harness.processor;
    let request = 0;
    const command = (name, ...args) => processor.port.onmessage({ data: [++request, name, ...args] });
    command('addBuffers', [tone]);
    command('schedule', { active: true, input: 0, output: 0, rate, semitones: 0 });
    const samples = [];
    for (let block = 0; block < 650; block++) {
      const output = [[new Float32Array(128), new Float32Array(128)]];
      processor.process([[]], output);
      samples.push(...output[0][0]);
      harness.advance(128 / sampleRate);
    }
    let crossings = 0;
    let peak = 0;
    for (let index = 24001; index < 72000; index++) {
      if (samples[index - 1] <= 0 && samples[index] > 0) crossings++;
      peak = Math.max(peak, Math.abs(samples[index]));
    }
    check(Math.abs(crossings - 440) <= 4, 'Published Signalsmith WASM must preserve sine pitch at ' + rate);
    check(peak > 0.05 && peak * 0.25 < 1, 'Generated test audio must be present and have headroom at comparison gain');
    command('stop');
    let residual = 0;
    for (let block = 0; block < 150; block++) {
      const output = [[new Float32Array(128), new Float32Array(128)]];
      processor.process([[]], output);
      harness.advance(128 / sampleRate);
      if (block >= 130) for (const value of output[0][0]) residual = Math.max(residual, Math.abs(value));
    }
    check(residual < 0.0001, 'Unchanged wrapper must drain stopped audio to silence');
    command('dropBuffers');
    check(processor.audioBuffers.length === 0, 'Published dropBuffers must release source arrays');
  }
  console.log('Unchanged Signalsmith wrapper/WASM pitch, headroom, residual, and buffer-release tests passed');
}
