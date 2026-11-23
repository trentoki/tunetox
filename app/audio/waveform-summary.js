// Visual-only full-song peak summary. Never changes the audio used for playback.
// Each column covers an equal interval of source samples across the whole song.
export function summarizeWaveform(audioBuffer, columns = 360) {
  const count = Math.max(1, Math.floor(columns));
  const peaks = new Float32Array(count);
  const channels = Array.from({ length: audioBuffer.numberOfChannels },
    (_, index) => audioBuffer.getChannelData(index));
  for (let column = 0; column < count; column++) {
    const start = Math.floor(column * audioBuffer.length / count);
    const end = Math.max(start + 1, Math.floor((column + 1) * audioBuffer.length / count));
    let peak = 0;
    for (const channel of channels) {
      for (let sample = start; sample < Math.min(end, channel.length); sample++) {
        peak = Math.max(peak, Math.abs(channel[sample]));
      }
    }
    peaks[column] = Math.min(1, peak);
  }
  return peaks;
}
