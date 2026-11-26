// Read-only source analysis; never connected to the playback graph. Fourth-order
// Linkwitz-Riley bands have gradual crossovers, not brick-wall frequency bins.
// Each result is mean-square sample energy, aligned to the supplied waveform grid.
function createFilter(sampleRate, frequency, highpass) {
  const w = 2 * Math.PI * Math.min(frequency, sampleRate * .499) / sampleRate;
  const cosine = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2, denominator = 1 + alpha;
  const b0 = (1 + (highpass ? cosine : -cosine)) / 2 / denominator;
  const b1 = (highpass ? -2 : 2) * b0, b2 = b0;
  const a1 = -2 * cosine / denominator, a2 = (1 - alpha) / denominator;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return value => {
    const output = b0 * value + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = value; y2 = y1; y1 = output;
    return output;
  };
}

function createBand(sampleRate, edges) {
  const filters = edges.flatMap(([frequency, highpass]) =>
    [createFilter(sampleRate, frequency, highpass), createFilter(sampleRate, frequency, highpass)]);
  return value => { for (const filter of filters) value = filter(value); return value; };
}

// Async preparation yields between chunks so other decks/UI can continue. Filter
// histories persist across groups; cancellation discards the unpublished result.
// No PCM copies retained. Consumers (including future BPM analysis) share arrays.
export async function analyzeFrequencyEnergy(buffer, grid, signal) {
  const { samplesPerGroup, groupSeconds } = grid;
  const count = Math.ceil(buffer.length / samplesPerGroup);
  const low = new Float32Array(count), mid = new Float32Array(count), high = new Float32Array(count);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => ({
    samples: buffer.getChannelData(channel),
    low: createBand(buffer.sampleRate, [[200, false]]),
    mid: createBand(buffer.sampleRate, [[200, true], [4000, false]]),
    high: buffer.sampleRate > 8000 ? createBand(buffer.sampleRate, [[4000, true]]) : () => 0
  }));
  let lastYield = performance.now();
  for (let group = 0; group < count; group++) {
    if (signal?.aborted) throw new DOMException('Superseded analysis', 'AbortError');
    const start = group * samplesPerGroup, end = Math.min(buffer.length, start + samplesPerGroup);
    let lowSum = 0, midSum = 0, highSum = 0;
    for (const channel of channels) for (let i = start; i < end; i++) {
      const value = channel.samples[i];
      const l = channel.low(value), m = channel.mid(value), h = channel.high(value);
      lowSum += l * l; midSum += m * m; highSum += h * h;
    }
    const denominator = (end - start) * channels.length;
    low[group] = lowSum / denominator; mid[group] = midSum / denominator; high[group] = highSum / denominator;
    if (group % 64 === 0 && performance.now() - lastYield > 12) {
      await new Promise(resolve => setTimeout(resolve, 0)); lastYield = performance.now();
    }
  }
  return { low, mid, high, samplesPerGroup, groupSeconds, sampleRate: buffer.sampleRate,
    duration: buffer.duration, units: 'mean-square', crossoverHz: [200, 4000] };
}

// Aggregate existing mean-square groups onto the overview's original sample
// boundaries. Weight partial overlaps/final groups by sample count, not by color.
// No decoding or filtering occurs here; the source energy arrays remain untouched.
export function summarizeFrequencyEnergy(energy, columns) {
  const count = Math.max(1, Math.floor(columns));
  const low = new Float32Array(count), mid = new Float32Array(count), high = new Float32Array(count);
  const length = Math.round(energy.duration * energy.sampleRate), size = energy.samplesPerGroup;
  for (let column = 0; column < count; column++) {
    const start = Math.floor(column * length / count);
    const end = Math.min(length, Math.max(start + 1, Math.floor((column + 1) * length / count)));
    let lowSum = 0, midSum = 0, highSum = 0;
    for (let group = Math.floor(start / size); group < Math.ceil(end / size); group++) {
      const overlap = Math.min(end, (group + 1) * size) - Math.max(start, group * size);
      lowSum += energy.low[group] * overlap;
      midSum += energy.mid[group] * overlap;
      highSum += energy.high[group] * overlap;
    }
    const samples = Math.max(1, end - start);
    low[column] = lowSum / samples; mid[column] = midSum / samples; high[column] = highSum / samples;
  }
  return { low, mid, high };
}
