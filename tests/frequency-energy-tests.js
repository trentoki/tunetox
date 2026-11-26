import { analyzeFrequencyEnergy } from '../app/audio/analysis/frequency-energy.js';
import { summarizeScrollingWaveform } from '../app/audio/waveform/scrolling-waveform.js';
import { frequencyPalette, createScrollingWaveform, createScrollingRenderer } from '../app/visual/waveform/scrolling-waveform.js';

export async function checkFrequencyEnergy() {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const fixture = (rate, frequencies, stereo = false) => {
    const samples = new Float32Array(rate);
    for (let i = 0; i < samples.length; i++) for (const frequency of frequencies)
      samples[i] += .3 * Math.sin(2 * Math.PI * frequency * i / rate);
    return { sampleRate: rate, length: samples.length, duration: 1, numberOfChannels: stereo ? 2 : 1,
      getChannelData: channel => channel ? samples.map(value => -value) : samples };
  };
  const average = values => values.slice(20).reduce((sum, value) => sum + value, 0) / (values.length - 20);
  for (const rate of [44100, 48000]) for (const [frequency, band] of [[80, 'low'], [1000, 'mid'], [10000, 'high']]) {
    const buffer = fixture(rate, [frequency], true), grid = summarizeScrollingWaveform(buffer);
    const energy = await analyzeFrequencyEnergy(buffer, grid);
    assert(energy.low.length === grid.rms.length && energy.groupSeconds === grid.groupSeconds && energy.samplesPerGroup === grid.samplesPerGroup,
      'Frequency energy is not aligned to waveform source samples');
    const powers = ['low', 'mid', 'high'].map(name => average(energy[name]));
    assert(average(energy[band]) > .035 && powers.filter(value => value < average(energy[band]) / 30).length === 2,
      `${rate} Hz: isolated ${frequency} Hz was not separated into ${band}`);
  }
  for (const frequency of [200, 4000]) {
    const buffer = fixture(48000, [frequency]), energy = await analyzeFrequencyEnergy(buffer, summarizeScrollingWaveform(buffer));
    const pair = frequency === 200 ? ['low', 'mid'] : ['mid', 'high'];
    assert(Math.abs(average(energy[pair[0]]) / average(energy[pair[1]]) - 1) < .02, 'Crossover is not balanced');
  }
  const buffer = fixture(8000, []), grid = summarizeScrollingWaveform(buffer);
  const silence = await analyzeFrequencyEnergy(buffer, grid);
  assert(['low', 'mid', 'high'].every(name => silence[name].every(v => v === 0)), 'Silence contains energy');
  const mixed = fixture(48000, [80, 1000, 10000]), energy = await analyzeFrequencyEnergy(mixed, summarizeScrollingWaveform(mixed));
  assert(['low', 'mid', 'high'].every(name => average(energy[name]) > .035), 'Mixed frequencies lost a band');
  const cancelled = new AbortController(); cancelled.abort();
  let aborted = false;
  try { await analyzeFrequencyEnergy(mixed, summarizeScrollingWaveform(mixed), cancelled.signal); }
  catch (error) { aborted = error.name === 'AbortError'; }
  assert(aborted, 'Cancelled analysis was published');
  const pending = new AbortController(), longSamples = new Float32Array(48000 * 10);
  const longBuffer = { sampleRate: 48000, length: longSamples.length, duration: 10,
    numberOfChannels: 1, getChannelData: () => longSamples };
  const scheduledAbort = setTimeout(() => pending.abort(), 0);
  aborted = false;
  try { await analyzeFrequencyEnergy(longBuffer, summarizeScrollingWaveform(longBuffer), pending.signal); }
  catch (error) { aborted = error.name === 'AbortError'; }
  finally { clearTimeout(scheduledAbort); }
  assert(aborted, 'Analysis failed to yield/cancel during preparation');
  const palette = frequencyPalette('#ff0000');
  assert(palette[72] === 'rgb(255,0,0)' && palette[8] === 'rgb(128,255,0)' && palette[0] === 'rgb(0,255,255)',
    'Low/mid/high hue rotations changed');
  const surface = document.createElement('div'), canvas = createScrollingWaveform();
  surface.style.cssText = 'position:fixed;left:-10000px;width:400px;height:160px;--accent:#ff0000';
  surface.append(canvas); document.body.append(surface);
  let rectangles = 0; const colors = new Set();
  const context = { setTransform() {}, clearRect() {}, fillRect() { rectangles++; colors.add(this.fillStyle); } };
  canvas.getContext = () => context;
  const renderer = createScrollingRenderer(surface, canvas, () => {});
  try {
    renderer.draw(summarizeScrollingWaveform(mixed), .5, energy);
    assert(rectangles === energy.low.length * 2 && colors.size > 0, 'Colored renderer lost waveform groups');
    assert(energy.low.byteLength * 3 === Math.ceil(48000 / 240) * 12,
      'Frequency storage is not twelve bytes per group');
  } finally { renderer.disconnect(); surface.remove(); }
}
