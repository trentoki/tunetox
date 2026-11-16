(() => {
  const element = id => document.getElementById(id);
  const plot = element('plot'), context = plot.getContext('2d');
  let channels = [], sampleRate = 0, result = null, worker = null, generation = 0;
  const number = id => Number(element(id).value);
  function analyze() {
    if (worker) worker.terminate();
    element('status').textContent = 'Analyzing…';
    worker = new Worker('worker.js');
    worker.onmessage = ({ data }) => {
      if (data.error) { element('status').textContent = data.error; return; }
      result = data.result;
      element('status').textContent = `${channels.length} channels · ${sampleRate} Hz decoded · ${result.times.length} windows · actual window ${(result.windowFrames / sampleRate * 1000).toFixed(4)} ms`;
      draw();
    };
    worker.onerror = () => { element('status').textContent = 'Analysis worker failed. Reload and retry.'; };
    worker.postMessage({ channels, sampleRate, windowMs: number('resolution') });
  }
  element('file').onchange = async () => {
    const token = ++generation, file = element('file').files[0];
    if (worker) worker.terminate();
    channels = []; result = null; element('controls').disabled = true;
    context.clearRect(0, 0, plot.width, plot.height); element('readout').textContent = '';
    if (!file) return;
    let decoder;
    try {
      if (!file.size || file.size > 32 * 1024 * 1024) throw new Error('Choose a nonempty file up to 32 MiB.');
      element('status').textContent = 'Decoding locally…';
      // Offline context has no hardware output and creates no playback nodes.
      decoder = new OfflineAudioContext(1, 1, 48000);
      const buffer = await decoder.decodeAudioData(await file.arrayBuffer());
      if (token !== generation) return;
      if (buffer.duration > 120 || buffer.numberOfChannels > 8) throw new Error('Use at most 120 seconds and 8 channels.');
      sampleRate = buffer.sampleRate;
      channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
      element('span').value = buffer.duration; element('start').value = 0; element('inspect').value = 0;
      element('controls').disabled = false; analyze();
    } catch (error) { if (token === generation) element('status').textContent = `Cannot analyze: ${error.message}`; }
  };
  function view() {
    const span = Math.max(1 / sampleRate, Math.min(result.duration, number('span') || result.duration));
    const start = Math.max(0, Math.min(result.duration - span, number('start') || 0));
    return { span, start, multiplier: number('tempo') };
  }
  function draw() {
    if (!result) return;
    const { span, start, multiplier } = view();
    element('tempoValue').textContent = `${multiplier.toFixed(2)}×`;
    plot.width = Math.max(320, Math.round(plot.clientWidth));
    const width = plot.width, left = 65, right = width - 15, available = right - left;
    context.clearRect(0, 0, width, 600); context.font = '12px system-ui';
    const labels = ['Decoded waveform (all channels)', 'RMS amplitude', 'Positive onset strength'];
    const colors = ['#91bcff', '#7be0ce', '#ffca7a'];
    for (let row = 0; row < 3; row++) {
      const top = row * 190 + 30, bottom = top + 130;
      context.fillStyle = colors[row]; context.fillText(labels[row], left, top - 12);
      context.fillText('1', 30, top + 5); context.fillText(row ? '0' : '−1', 25, bottom);
      context.strokeStyle = '#405263'; context.strokeRect(left, top, available, 130);
      for (let tick = 0; tick <= 4; tick++) {
        const x = left + available * tick / 4;
        context.fillText(((start + span * tick / 4) / multiplier).toFixed(4) + 's', Math.min(x, right - 65), bottom + 20);
      }
      context.strokeStyle = colors[row]; context.beginPath();
      // Pixel min/max aggregation retains brief peaks when zoomed out.
      for (let pixel = 0; pixel < available; pixel++) {
        const a = start + span * pixel / available, b = start + span * (pixel + 1) / available;
        let low = Infinity, high = -Infinity;
        if (row === 0) {
          const first = Math.floor(a * sampleRate), end = Math.min(result.length, Math.max(first + 1, Math.ceil(b * sampleRate)));
          for (const channel of channels) for (let i = first; i < end; i++) { low = Math.min(low, channel[i]); high = Math.max(high, channel[i]); }
        } else {
          const values = row === 1 ? result.rms : result.onset;
          const first = Math.floor(a * sampleRate / result.windowFrames);
          const end = Math.min(values.length, Math.max(first + 1, Math.ceil(b * sampleRate / result.windowFrames)));
          for (let i = first; i < end; i++) { low = Math.min(low, values[i]); high = Math.max(high, values[i]); }
        }
        const y = value => row ? bottom - Math.min(1, value) * 130 : top + 65 - Math.max(-1, Math.min(1, value)) * 65;
        context.moveTo(left + pixel, y(low)); context.lineTo(left + pixel, y(high) - .5);
      }
      context.stroke();
    }
    const time = Math.max(0, Math.min(result.duration - 1 / sampleRate, number('inspect') || 0));
    const bin = Math.min(result.rms.length - 1, Math.floor(time * sampleRate / result.windowFrames));
    const end = Math.min(result.duration, (bin + 1) * result.windowFrames / sampleRate);
    const scaled = EnvelopeAnalysis.scaleTimes([result.times[bin], end], multiplier);
    const x = left + (time - start) / span * available;
    if (x >= left && x <= right) { context.strokeStyle = '#ffffff'; context.beginPath(); context.moveTo(x, 25); context.lineTo(x, 540); context.stroke(); }
    const frame = Math.min(result.length - 1, Math.floor(time * sampleRate));
    element('readout').textContent = `Source window: ${result.times[bin].toFixed(6)}–${end.toFixed(6)} s\nVisual window: ${scaled[0].toFixed(6)}–${scaled[1].toFixed(6)} s at ${multiplier.toFixed(2)}×\nRMS: ${result.rms[bin].toFixed(6)} · positive onset: ${result.onset[bin].toFixed(6)}\nPCM at ${ (frame / sampleRate).toFixed(6)} s: ${channels.map(channel => channel[frame].toFixed(6)).join(', ')}\nAxis labels show visual time. Source span/start/inspection remain in original seconds. Values above ±1 are clipped only in the plot.`;
  }
  element('resolution').onchange = analyze;
  for (const id of ['tempo', 'span', 'start', 'inspect']) element(id).oninput = draw;
  element('fit').onclick = () => { if (result) { element('span').value = result.duration; element('start').value = 0; draw(); } };
  plot.onclick = event => {
    if (!result) return;
    const { start, span } = view(), box = plot.getBoundingClientRect();
    element('inspect').value = start + Math.max(0, Math.min(1, (event.clientX - box.left - 65) / (plot.width - 80))) * span;
    draw();
  };
  window.addEventListener('resize', draw);
  window.addEventListener('pagehide', () => { if (worker) worker.terminate(); });
})();
