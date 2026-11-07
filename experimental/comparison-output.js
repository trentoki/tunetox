// Identical -12 dB headroom and sampled meters for the two experimental paths.
// This is a comparison level, not automatic loudness normalization or a limiter.
function createComparisonOutput(context) {
  const gain = context.createGain();
  const analyser = context.createAnalyser();
  gain.gain.value = 0.25;
  analyser.fftSize = 2048;
  gain.connect(analyser);
  analyser.connect(context.destination);
  const samples = new Float32Array(analyser.fftSize);
  return {
    input: gain,
    level: gain.gain,
    read() {
      analyser.getFloatTimeDomainData(samples);
      let peak = 0;
      let energy = 0;
      for (const value of samples) {
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
      }
      return { outputPeak: peak, outputRms: Math.sqrt(energy / samples.length) };
    },
    disconnect() { gain.disconnect(); analyser.disconnect(); }
  };
}
