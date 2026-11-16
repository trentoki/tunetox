document.getElementById('run').onclick = async () => {
  const output = document.getElementById('results');
  let worker;
  try {
    output.textContent = runEnvelopeAnalysisTests();
    const bytes = new ArrayBuffer(44 + 480 * 2), view = new DataView(bytes);
    const text = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 48000, true); view.setUint32(28, 96000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, 960, true);
    for (let i = 240; i < 480; i++) view.setInt16(44 + i * 2, 16384, true);
    const decoded = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(bytes);
    worker = new Worker('../experimental/envelope-lab/worker.js');
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker timeout')), 10000);
      worker.onmessage = event => { clearTimeout(timer); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result); };
      worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
      worker.postMessage({ channels: [decoded.getChannelData(0)], sampleRate: decoded.sampleRate, windowMs: 5 });
    });
    if (result.rms.length !== 2 || Math.abs(result.rms[1] - .5) > 1e-6 || Math.abs(result.onset[1] - .5) > 1e-6 || result.times[1] !== .005) throw new Error('Decoded worker result mismatch');
    output.textContent += '\nPASS: real WAV decoding and worker round trip; no audio output.';
  } catch (error) { output.textContent += '\nFAIL: ' + error.message; }
  finally { if (worker) worker.terminate(); }
};
