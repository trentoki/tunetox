import { V40_DETECTOR_ID } from './v40-bpm.js';
export { V40_DETECTOR_ID };

// Decode one library source independently of deck AudioContexts and waveform data.
// Native decode cannot be cancelled: finish/discard it before the queue starts
// another song. Worker termination cancels CPU analysis. No decoded cache remains.
export async function analyzeLibraryAudio(source, signal) {
  const cancelled = () => { if (signal?.aborted) throw new DOMException('Analysis cancelled.', 'AbortError'); };
  cancelled();
  const bytes = await source.arrayBuffer(); cancelled();
  const Decoder = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Decoder) throw new Error('Offline audio decoding is unavailable in this browser.');
  const decoder = new Decoder(1, 1, 44100);
  const buffer = await decoder.decodeAudioData(bytes); cancelled();
  const sampleRate = buffer.sampleRate, duration = buffer.duration;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice());
  const worker = new Worker(new URL('./library-analysis-worker.js', import.meta.url), { type: 'module' });
  try {
    const bpm = await new Promise((resolve, reject) => {
      const abort = () => { worker.terminate(); reject(new DOMException('Analysis cancelled.', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once: true });
      const finish = (error, value) => { signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
      worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.bpm);
      worker.onerror = event => finish(new Error(event.message || 'Analysis worker failed.'));
      if (signal?.aborted) { abort(); return; }
      worker.postMessage({ channels, sampleRate }, channels.map(channel => channel.buffer));
    });
    return { detectorId: V40_DETECTOR_ID, bpm, sampleRate, duration };
  } finally { worker.terminate(); }
}
