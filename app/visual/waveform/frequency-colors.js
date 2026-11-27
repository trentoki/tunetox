// Rotate HSL hue while preserving the accent saturation/lightness. Resolve CSS
// color syntax once per accent change, never once per group or animation frame.
export function frequencyPalette(accent, mode = 'hues') {
  const probe = document.createElement('canvas').getContext('2d');
  probe.fillStyle = accent; probe.fillRect(0, 0, 1, 1);
  const rgb = Array.from(probe.getImageData(0, 0, 1, 1).data).slice(0, 3).map(v => v / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min, lightness = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  let hue = 0;
  if (delta) hue = 60 * (max === rgb[0] ? ((rgb[1] - rgb[2]) / delta + 6) % 6 :
    max === rgb[1] ? (rgb[2] - rgb[0]) / delta + 2 : (rgb[0] - rgb[1]) / delta + 4);
  let colors;
  if (mode === 'shades') {
    // Keep neutral accents neutral; otherwise concentrate the deck hue in bass.
    const richSaturation = delta ? Math.max(.75, saturation) : 0;
    const richLightness = Math.max(.35, Math.min(.5, lightness));
    probe.fillStyle = `hsl(${hue} ${richSaturation * 100}% ${richLightness * 100}%)`;
    probe.fillRect(0, 0, 1, 1);
    const rich = probe.getImageData(0, 0, 1, 1).data;
    colors = [0, .5, .95].map(white => [0, 1, 2].map(channel =>
      Math.round(rich[channel] * (1 - white) + 255 * white)));
  } else colors = [0, 90, 180].map(rotation => {
    probe.fillStyle = `hsl(${hue + rotation} ${saturation * 100}% ${lightness * 100}%)`;
    probe.fillRect(0, 0, 1, 1);
    return probe.getImageData(0, 0, 1, 1).data;
  });
  const palette = [];
  for (let low = 0; low <= 8; low++) for (let mid = 0; mid <= 8 - low; mid++) {
    const high = 8 - low - mid;
    palette[low * 9 + mid] = `rgb(${[0, 1, 2].map(c =>
      Math.round((colors[0][c] * low + colors[1][c] * mid + colors[2][c] * high) / 8)).join(',')})`;
  }
  return palette;
}

// Both waveform views use the same energy fractions, silence fallback and palette.
export function frequencyColor(palette, lowEnergy, midEnergy, highEnergy) {
  const total = lowEnergy + midEnergy + highEnergy;
  const low = total > 1e-20 ? Math.round(8 * lowEnergy / total) : 8;
  const mid = total > 1e-20 ? Math.min(8 - low, Math.round(8 * midEnergy / total)) : 0;
  return palette[low * 9 + mid];
}
