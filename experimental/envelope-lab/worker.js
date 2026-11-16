importScripts('analysis.js');
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: EnvelopeAnalysis.analyze(data.channels, data.sampleRate, data.windowMs) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
