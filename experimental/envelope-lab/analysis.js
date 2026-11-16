/* Isolated research arithmetic. No production imports or audio side effects. */
const EnvelopeAnalysis = (() => {
  const resolutions = [1, 5, 10, 20];
  function analyze(channels, sampleRate, windowMs) {
    if (!Number.isFinite(sampleRate) || sampleRate < 1000 || sampleRate > 192000 ||
        !resolutions.includes(windowMs) || !Array.isArray(channels) || !channels.length || channels.length > 8) {
      throw new Error('Invalid sample rate, channels, or resolution.');
    }
    const length = channels[0].length;
    if (!length || length / sampleRate > 120 || channels.some(channel => channel.length !== length)) {
      throw new Error('Use equal-length channels containing at most 120 seconds.');
    }
    const windowFrames = Math.max(1, Math.round(sampleRate * windowMs / 1000));
    const count = Math.ceil(length / windowFrames);
    const times = new Float64Array(count), rms = new Float64Array(count), onset = new Float64Array(count);
    for (let bin = 0; bin < count; bin++) {
      const start = bin * windowFrames, end = Math.min(length, start + windowFrames);
      let energy = 0;
      for (const channel of channels) {
        for (let frame = start; frame < end; frame++) {
          const value = channel[frame];
          if (!Number.isFinite(value)) throw new Error('PCM contains non-finite samples.');
          energy += value * value;
        }
      }
      times[bin] = start / sampleRate;
      rms[bin] = Math.sqrt(energy / ((end - start) * channels.length));
      // First bin has no measured predecessor: no inferred onset at file start.
      onset[bin] = bin ? Math.max(0, rms[bin] - rms[bin - 1]) : 0;
    }
    return { times, rms, onset, windowFrames, windowMs, sampleRate, length, duration: length / sampleRate };
  }
  function scaleTimes(times, multiplier) {
    if (!Number.isFinite(multiplier) || multiplier < 0.5 || multiplier > 2) throw new Error('Tempo must be 0.5–2×.');
    return Float64Array.from(times, time => time / multiplier);
  }
  return { analyze, scaleTimes, resolutions };
})();
