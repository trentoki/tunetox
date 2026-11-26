import { summarizeScrollingWaveform } from '../app/audio/waveform/scrolling-waveform.js';
import { summarizeOverviewWaveform } from '../app/audio/waveform/overview-waveform.js';
import { createScrollingWaveform, createScrollingRenderer } from '../app/visual/waveform/scrolling-waveform.js';

export function checkWaveformDetail() {
  const assert = (value, message) => { if (!value) throw Error(message); };
  for (const rate of [8000, 44100, 48000]) {
    const size = Math.round(rate * .005), left = new Float32Array(size * 2 + 3), right = new Float32Array(left.length);
    left[size - 1] = 1; right[size - 1] = -1;
    left[size] = -.75; right[size] = .5; left[left.length - 1] = .9;
    const buffer = { sampleRate: rate, length: left.length, duration: left.length / rate,
      numberOfChannels: 2, getChannelData: i => i ? right : left };
    const detail = summarizeScrollingWaveform(buffer), overview = summarizeOverviewWaveform(buffer);
    assert(detail.maximum.length === 3 && detail.samplesPerGroup === size && Math.abs(detail.groupSeconds - .005) < 1 / rate,
      '5 ms grouping/partial final group failed');
    assert(detail.minimum[0] === -1 && detail.maximum[0] === 1 && detail.minimum[1] === -.75 && detail.maximum[1] === .5,
      'Signed boundary/channel transient was lost');
    assert(Math.abs(detail.rms[0] - Math.sqrt(1 / size)) < 1e-6 && Math.abs(detail.rms[2] - Math.sqrt(.9 ** 2 / 6)) < 1e-6,
      'RMS energy or partial-group denominator is incorrect');
    assert(overview.maximum.length === 360, 'Overview resolution changed');
  }

  const count = 60 * 60 * 200; // One-hour analysis data, without a giant PCM fixture.
  const detail = { minimum: new Float32Array(count), maximum: new Float32Array(count), rms: new Float32Array(count), groupSeconds: .005 };
  detail.maximum[100000] = 1; detail.minimum[100000] = -.5; detail.rms[100000] = .25;
  const surface = document.createElement('div');
  surface.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:160px;--accent:#ff5500';
  const canvas = createScrollingWaveform(); surface.append(canvas); document.body.append(surface);
  let rectangles = [], dimensions = [];
  const context = { clearRect() { rectangles = []; }, setTransform(...args) { dimensions = args; }, beginPath() {},
    rect(...args) { rectangles.push(args); }, fill() {} };
  canvas.getContext = () => context;
  const renderer = createScrollingRenderer(surface, canvas, () => {});
  try {
    renderer.draw(detail, 500);
    assert(rectangles.length <= 1604 && rectangles.length >= 1600, 'Renderer visited data outside the four-second window');
    const peak = rectangles.find(rect => Math.abs(rect[0] - 200) < .0001 && rect[3] > 60);
    assert(peak && Math.abs(peak[2] - .5) < .0001 && dimensions[0] === window.devicePixelRatio,
      'Transient center, fixed source scale or display-pixel density is incorrect');
    renderer.draw(detail, 500.5);
    const movedPeak = rectangles.find(rect => Math.abs(rect[0] - 150) < .0001 && rect[3] > 60);
    assert(movedPeak && movedPeak[2] === peak[2], 'Moving source position stretched the transient');
    assert(detail.minimum.byteLength + detail.maximum.byteLength + detail.rms.byteLength === 8640000,
      'Detailed summary storage is not linear at twelve bytes per group');
    renderer.draw(null, 0); assert(rectangles.length === 0, 'Unload retained waveform drawing');
  } finally { renderer.disconnect(); surface.remove(); }
}
