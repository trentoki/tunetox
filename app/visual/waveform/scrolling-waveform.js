import { frequencyPalette, frequencyColor } from './frequency-colors.js';
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
        context.fillStyle = frequencyColor(palette, energy.low[group], energy.mid[group], energy.high[group]);
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
