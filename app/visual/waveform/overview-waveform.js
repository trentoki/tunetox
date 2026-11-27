import { summarizeFrequencyEnergy } from '../../audio/analysis/frequency-energy.js';
import { frequencyPalette, frequencyColor } from './frequency-colors.js';

// Cache source-derived column energy; recoloring never repeats aggregation.
const columnEnergy = new WeakMap();

export function createOverviewWaveform() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 360 160");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

export function drawOverviewWaveform(svg, summary, energy, accent, colorMode = 'hues') {
  svg.replaceChildren();
  if (!summary) return;
  const { minimum, maximum, rms } = summary;
  let bands;
  if (energy) {
    let cached = columnEnergy.get(energy);
    if (!cached || cached.low.length !== maximum.length) {
      cached = summarizeFrequencyEnergy(energy, maximum.length);
      columnEnergy.set(energy, cached);
    }
    bands = cached;
  }
  const palette = bands ? frequencyPalette(accent || '#5ce0dc', colorMode) : null;
  const width = 360 / maximum.length;
  // Fixed visual gain: no per-section normalization, and no change to sound.
  const visualGain = 0.55;
  for (let index = 0; index < maximum.length; index++) {
    const x = index * width;
    const top = 80 - maximum[index] * 80 * visualGain;
    const bottom = 80 - minimum[index] * 80 * visualGain;
    const peak = document.createElementNS(svg.namespaceURI, "rect");
    peak.setAttribute("x", String(x));
    peak.setAttribute("y", String(top));
    peak.setAttribute("width", String(width));
    peak.setAttribute("height", String(Math.max(0.5, bottom - top)));
    peak.setAttribute("opacity", "0.75");
    svg.append(peak);
    // RMS body makes sustained loudness easier to distinguish from brief peaks.
    const bodyHeight = rms[index] * 80 * visualGain;
    const body = document.createElementNS(svg.namespaceURI, "rect");
    body.setAttribute("x", String(x));
    body.setAttribute("y", String(80 - bodyHeight));
    body.setAttribute("width", String(width));
    body.setAttribute("height", String(Math.max(0.5, bodyHeight * 2)));
    svg.append(body);
    if (bands) {
      const color = frequencyColor(palette, bands.low[index], bands.mid[index], bands.high[index]);
      peak.setAttribute('fill', color); body.setAttribute('fill', color);
    }
  }
}

