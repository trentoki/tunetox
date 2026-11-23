// Visual-only full-song summary; source audio and playback gain are untouched.
// Every column uses the same amplitude scale and covers the same time interval.
export function summarizeWaveform(audioBuffer, columns = 360) {
  const count = Math.max(1, Math.floor(columns));
  const minimum = new Float32Array(count);
  const maximum = new Float32Array(count);
  const rms = new Float32Array(count);
  const channels = Array.from({ length: audioBuffer.numberOfChannels },
    (_, index) => audioBuffer.getChannelData(index));
  for (let column = 0; column < count; column++) {
    const start = Math.floor(column * audioBuffer.length / count);
    const end = Math.min(audioBuffer.length, Math.max(start + 1, Math.floor((column + 1) * audioBuffer.length / count)));
    let low = 0, high = 0, energy = 0, samples = 0;
    for (const channel of channels) {
      for (let sample = start; sample < end; sample++) {
        const value = channel[sample];
        low = Math.min(low, value);
        high = Math.max(high, value);
        energy += value * value;
        samples++;
      }
    }
    minimum[column] = low;
    maximum[column] = high;
    rms[column] = samples ? Math.sqrt(energy / samples) : 0;
  }
  return { minimum, maximum, rms };
}
