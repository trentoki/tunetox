// Source-time geometry is independent of BPM and Tempo. At any playback rate the
// same transient has the same width; only Audio's source position advances faster.
export const SCROLLING_WINDOW_SECONDS = 4;

export function createScrollingWaveform() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

// A renderer owns canvas dimensions/draw caches, never a playback position/clock.
// draw() receives the authoritative source seconds (or the shared seek preview).
export function createScrollingRenderer(surface, canvas, resized) {
  const context = canvas.getContext('2d');
  let width = 0, height = 0, scale = 0;
  let lastSummary, lastPosition, lastColor, lastEnergy;
  let palette;
  const observer = new ResizeObserver(() => { scale = 0; resized(); });
  observer.observe(surface);

  function draw(summary, seconds, energy) {
    if (!surface.getClientRects().length) { lastSummary = null; lastPosition = null; return; }
    const nextWidth = surface.clientWidth, nextHeight = surface.clientHeight;
    const nextScale = window.devicePixelRatio || 1;
    if (!nextWidth || !nextHeight) return;
    const color = getComputedStyle(surface).getPropertyValue('--accent').trim() || '#5ce0dc';
    const dimensionsChanged = width !== nextWidth || height !== nextHeight || scale !== nextScale;
    if (dimensionsChanged) {
      width = nextWidth; height = nextHeight; scale = nextScale;
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    }
    if (!dimensionsChanged && summary === lastSummary && seconds === lastPosition && color === lastColor && energy === lastEnergy) return;
    if (color !== lastColor) palette = frequencyPalette(color);
    lastSummary = summary; lastPosition = seconds; lastColor = color; lastEnergy = energy;
    context.clearRect(0, 0, width, height);
    if (!summary) return;
    const start = seconds - SCROLLING_WINDOW_SECONDS / 2;
    const first = Math.max(0, Math.floor(start / summary.groupSeconds));
    const end = Math.min(summary.maximum.length, Math.ceil((start + SCROLLING_WINDOW_SECONDS) / summary.groupSeconds));
    const pixelsPerSecond = width / SCROLLING_WINDOW_SECONDS;
    const barWidth = summary.groupSeconds * pixelsPerSecond;
    const amplitude = height / 2 * .55;
    if (energy) {
      // Color uses source energy only; min/max/RMS geometry remains unchanged.
      // Three proportions are quantized to eighths for a small reusable palette.
      for (let group = first; group < end; group++) {
        const total = energy.low[group] + energy.mid[group] + energy.high[group];
        const low = total > 1e-20 ? Math.round(8 * energy.low[group] / total) : 8;
        const mid = total > 1e-20 ? Math.min(8 - low, Math.round(8 * energy.mid[group] / total)) : 0;
        context.fillStyle = palette[low * 9 + mid];
        const x = (group * summary.groupSeconds - start) * pixelsPerSecond;
        context.globalAlpha = .75;
        context.fillRect(x, height / 2 - summary.maximum[group] * amplitude, barWidth,
          Math.max(.5, (summary.maximum[group] - summary.minimum[group]) * amplitude));
        context.globalAlpha = 1;
        context.fillRect(x, height / 2 - summary.rms[group] * amplitude, barWidth,
          Math.max(.5, 2 * summary.rms[group] * amplitude));
      }
      return;
    }
    context.fillStyle = color;
    // Only visible groups are visited, regardless of total recording duration.
    // Two batched paths avoid per-bar DOM creation, allocation or fill commands.
    for (let body = 0; body < 2; body++) {
      context.beginPath();
      for (let group = first; group < end; group++) {
        const x = (group * summary.groupSeconds - start) * pixelsPerSecond;
        const top = body ? summary.rms[group] * amplitude : summary.maximum[group] * amplitude;
        const bottom = body ? top : -summary.minimum[group] * amplitude;
        context.rect(x, height / 2 - top, barWidth, Math.max(.5, top + bottom));
      }
      context.globalAlpha = body ? 1 : .75;
      context.fill();
    }
    context.globalAlpha = 1;
  }
  return { draw, disconnect: () => observer.disconnect() };
}

// Rotate HSL hue while preserving the accent saturation/lightness. Resolve CSS
// color syntax once per accent change, never once per group or animation frame.
export function frequencyPalette(accent) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.fillStyle = accent; probe.fillRect(0, 0, 1, 1);
  const rgb = Array.from(probe.getImageData(0, 0, 1, 1).data).slice(0, 3).map(v => v / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min, lightness = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  let hue = 0;
  if (delta) hue = 60 * (max === rgb[0] ? ((rgb[1] - rgb[2]) / delta + 6) % 6 :
    max === rgb[1] ? (rgb[2] - rgb[0]) / delta + 2 : (rgb[0] - rgb[1]) / delta + 4);
  const colors = [0, 90, 180].map(rotation => {
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
