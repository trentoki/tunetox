import { estimateV40Bpm } from './v40-bpm.js';

// One transferred PCM recording per worker. No playback objects or durable data.
self.onmessage = ({ data }) => {
  try {
    const { channels, sampleRate } = data;
    const buffer = { sampleRate, length: channels[0].length, numberOfChannels: channels.length, getChannelData: index => channels[index] };
    const bpm = estimateV40Bpm(buffer);
    if (bpm === null) throw new Error('V40 could not find a reliable beat pattern.');
    self.postMessage({ bpm });
  } catch (error) { self.postMessage({ error: error.message }); }
};
