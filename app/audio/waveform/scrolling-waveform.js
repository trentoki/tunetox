// Analysis only: retain signed extrema across every channel so a brief transient
// cannot disappear in averaging. No PCM copies, playback changes or normalization.
// Storage is three Float32 values per ~5 ms group (about 144 kB per minute).
export function summarizeScrollingWaveform(audioBuffer) {
  const samplesPerGroup = Math.max(1, Math.round(audioBuffer.sampleRate * .005));
  const count = Math.ceil(audioBuffer.length / samplesPerGroup);
  const minimum = new Float32Array(count), maximum = new Float32Array(count), rms = new Float32Array(count);
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, i) => audioBuffer.getChannelData(i));
  for (let group = 0; group < count; group++) {
    const start = group * samplesPerGroup, end = Math.min(start + samplesPerGroup, audioBuffer.length);
    let low = 0, high = 0, energy = 0;
    for (const channel of channels) for (let sample = start; sample < end; sample++) {
      const value = channel[sample];
      low = Math.min(low, value); high = Math.max(high, value); energy += value * value;
    }
    minimum[group] = low; maximum[group] = high;
    rms[group] = Math.sqrt(energy / ((end - start) * channels.length));
  }
  return { minimum, maximum, rms, groupSeconds: samplesPerGroup / audioBuffer.sampleRate,
    samplesPerGroup, sampleRate: audioBuffer.sampleRate, duration: audioBuffer.duration };
}
