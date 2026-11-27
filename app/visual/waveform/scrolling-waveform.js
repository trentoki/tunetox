import { getWaveformWindowSeconds, getWaveformColorMode } from '../../behavior/settings.js';
import { frequencyPalette, frequencyColor } from './frequency-colors.js';
// Source-time geometry is independent of BPM and Tempo. At any playback rate the
// same transient has the same width; only Audio's source position advances faster.

// Shared presentation geometry for rendering and cue lines. Expanded comparison
// preserves the normal axis length and playhead while revealing a longer canvas.
export function getScrollingGeometry(surface) {
  const vertical = document.documentElement.dataset.waveformOrientation === 'vertical';
  const visibleAxis = vertical ? surface.clientHeight : surface.clientWidth;
  const normalAxis = Number(surface.dataset.comparisonAxisLength) || visibleAxis;
  const playheadOffset = surface.dataset.comparisonPlayheadOffset === undefined
    ? normalAxis / 2 : Number(surface.dataset.comparisonPlayheadOffset);
  return {
    vertical, visibleAxis, playheadOffset,
    pixelsPerSecond: normalAxis / getWaveformWindowSeconds()
  };
}

// Shared paint edge for a source-centered playhead/cue line. Its thickness is
// subtracted before snapping, keeping the line center on the logical time axis.
export function pixelAlignedOffset(origin, offset, scale = window.devicePixelRatio || 1) {
  const thickness = Math.max(1, Math.round(scale)) / scale;
  return Math.round((origin + offset - thickness / 2) * scale) / scale - origin;
}

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
  let lastSummary, lastPosition, lastColor, lastEnergy, lastOrientation, lastWindowSeconds, lastColorMode;
  let palette, lastPixelAlignedTheme;
  const observer = new ResizeObserver(() => { scale = 0; resized(); });
  observer.observe(surface);

  function draw(summary, seconds, energy) {
    if (!surface.getClientRects().length) { lastSummary = null; lastPosition = null; return; }
    const colorMode = getWaveformColorMode();
    const windowSeconds = getWaveformWindowSeconds();
    const vertical = document.documentElement.dataset.waveformOrientation === 'vertical';
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
    const pixelAlignedTheme = document.documentElement.dataset.theme === 'waveform';
    if (dimensionsChanged || vertical !== lastOrientation || pixelAlignedTheme !== lastPixelAlignedTheme) {
      lastPixelAlignedTheme = pixelAlignedTheme;
      if (pixelAlignedTheme) {
        // Paint one solid row/column rather than two antialiased neighbors. The
        // authoritative source center and seek/cue calculations stay unchanged.
        const rect = surface.getBoundingClientRect();
        const origin = vertical ? rect.top + surface.clientTop : rect.left + surface.clientLeft;
        surface.style.setProperty('--waveform-playhead-position', pixelAlignedOffset(origin, (vertical ? rect.height : rect.width) / 2, scale) + 'px');
        surface.style.setProperty('--waveform-playhead-thickness', Math.max(1, Math.round(scale)) / scale + 'px');
      } else {
        surface.style.removeProperty('--waveform-playhead-position');
        surface.style.removeProperty('--waveform-playhead-thickness');
      }
    }
    if (!dimensionsChanged && summary === lastSummary && seconds === lastPosition && color === lastColor && energy === lastEnergy && vertical === lastOrientation && windowSeconds === lastWindowSeconds && colorMode === lastColorMode) return;
    if (color !== lastColor || colorMode !== lastColorMode) palette = frequencyPalette(color, colorMode);
    lastSummary = summary; lastPosition = seconds; lastColor = color; lastEnergy = energy; lastOrientation = vertical; lastWindowSeconds = windowSeconds; lastColorMode = colorMode;
    context.clearRect(0, 0, width, height);
    if (!summary) return;
    const { visibleAxis, playheadOffset, pixelsPerSecond } = getScrollingGeometry(surface);
    const start = seconds - playheadOffset / pixelsPerSecond;
    const first = Math.max(0, Math.floor(start / summary.groupSeconds));
    const end = Math.min(summary.maximum.length, Math.ceil((start + visibleAxis / pixelsPerSecond) / summary.groupSeconds));
    // Rotate only canvas coordinates; DOM controls, box and source scale stay shared.
    context.save();
    if (vertical) context.transform(0, 1, -1, 0, width, 0);
    const crossSize = vertical ? width : height;
    const barWidth = summary.groupSeconds * pixelsPerSecond;
    // Covering the deck padding must not increase waveform amplitude either.
    const amplitudeSize = Number(surface.dataset.comparisonCrossLength) || crossSize;
    const amplitude = amplitudeSize / 2 * .55;
    if (energy) {
      // Color uses source energy only; min/max/RMS geometry remains unchanged.
      // Three proportions are quantized to eighths for a small reusable palette.
      for (let group = first; group < end; group++) {
        context.fillStyle = frequencyColor(palette, energy.low[group], energy.mid[group], energy.high[group]);
        const x = (group * summary.groupSeconds - start) * pixelsPerSecond;
        context.globalAlpha = .75;
        context.fillRect(x, crossSize / 2 - summary.maximum[group] * amplitude, barWidth,
          Math.max(.5, (summary.maximum[group] - summary.minimum[group]) * amplitude));
        context.globalAlpha = 1;
        context.fillRect(x, crossSize / 2 - summary.rms[group] * amplitude, barWidth,
          Math.max(.5, 2 * summary.rms[group] * amplitude));
      }
      context.restore(); return;
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
        context.rect(x, crossSize / 2 - top, barWidth, Math.max(.5, top + bottom));
      }
      context.globalAlpha = body ? 1 : .75;
      context.fill();
    }
    context.globalAlpha = 1; context.restore();
  }
  return { draw, disconnect: () => observer.disconnect() };
}
