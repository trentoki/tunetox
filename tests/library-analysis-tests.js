import { checkLibraryArchitecture } from './library-architecture-tests.js';
import { openLibraryStorage } from '../app/behavior/library/library-storage.js';
import { createLibraryManagement } from '../app/behavior/library/library-management.js';
import { createLibraryAnalysisQueue } from '../app/behavior/library/library-analysis-queue.js';
import { analyzeLibraryAudio, V40_DETECTOR_ID } from '../app/audio/analysis/library-audio-analysis.js';
import { estimateV40Bpm } from '../app/audio/analysis/v40-bpm.js';
import { buildDeck, createPlaybackCoordinator } from '../app/behavior/mixer/deck.js';
import { ejectAudio } from '../app/audio/deck-audio.js';
const assert = (value, message) => { if (!value) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function recording(bpm, silent = false) {
  const rate = 8000, count = rate * 20, samples = new Float32Array(count);
  for (let i = 0; i < count && !silent; i++) {
    const phase = (i / rate) % (60 / bpm);
    samples[i] = phase < .08 ? Math.sin(i / rate * 2 * Math.PI * 100) * Math.exp(-phase * 60) * .7 : 0;
  }
  const bytes = new ArrayBuffer(44 + count * 2), data = new DataView(bytes);
  const text = (at, value) => [...value].forEach((c, i) => data.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); data.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  text(36, 'data'); data.setUint32(40, count * 2, true);
  samples.forEach((value, i) => data.setInt16(44 + i * 2, Math.round(value * 32767), true));
  return { file: new File([bytes], silent ? 'Silence.wav' : bpm + ' BPM.wav', { type: 'audio/wav' }),
    buffer: { sampleRate: rate, length: count, numberOfChannels: 1, getChannelData: () => samples } };
}
document.querySelector('#run').onclick = async () => {
  const output = document.querySelector('#results'); output.dataset.result = 'running'; output.textContent = '';
  const pass = text => output.textContent += 'PASS ' + text + '\n';
  const name = 'tunetox-analysis-test-' + crypto.randomUUID(); let storage, deck, url;
  try {
    await checkLibraryArchitecture(); pass('production responsibility boundaries and byte-preserved V40 baseline/math');
    const original = (await (await fetch('reference/v40-bpm.js')).text()).split('\nfunction adjustBpmOctave')[0];
    const baseline = new Function('buffer', 'let audioContext={decodeAudioData:async()=>buffer};' + original + '\nreturn estimateBPM({arrayBuffer:async()=>new ArrayBuffer(0)});');
    for (const bpm of [80, 120, 150]) {
      const { buffer, file } = recording(bpm);
      assert(estimateV40Bpm(buffer) === await baseline(buffer), 'Mathematical V40 parity at ' + bpm);
      const result = await analyzeLibraryAudio(file);
      assert(result.detectorId === V40_DETECTOR_ID && result.bpm === (bpm === 150 ? 75 : bpm), 'Real decode/worker BPM at ' + bpm + ': ' + result.bpm);
    }
    assert(estimateV40Bpm(recording(120, true).buffer) === null, 'Silence must remain unknown');
    pass('unchanged V40 parity and real decoding/worker results: 80→80, 120→120, 150→75 (existing half-time limitation); silence remains unknown');
    storage = await openLibraryStorage(name); const library = createLibraryManagement(Promise.resolve(storage));
    const pulse = recording(120).file;
    await library.importFiles([pulse, new File(['corrupt audio'], 'Corrupt.wav'), recording(120, true).file]);
    const song = (await library.listSongs({ query: '120 BPM' }))[0]; await library.setVerifiedBpm(song.id, 121.25);
    deck = buildDeck(); const playback = createPlaybackCoordinator(deck, {busyChanged(){},completed(){},failed(error){throw error;},settled(){},ended(){},mediaFailed(){}});
    url = URL.createObjectURL(pulse); await playback.sendToDeck({name:pulse.name,url}); await playback.togglePlayback();
    for (let i=0;i<100 && deck.audio.currentTime < .05;i++) await delay(20);
    const start = deck.audio.currentTime, identity = deck.audio, source = deck.audio.src;
    const queue = createLibraryAnalysisQueue(library); const result = await queue.start();
    assert(result.processed === 3 && result.succeeded === 1 && result.failures.length === 2, 'Sequential failures/progress');
    assert(deck.audio === identity && deck.audio.src === source && !deck.audio.paused && deck.audio.currentTime > start, 'Analysis interrupted playback');
    assert((await library.getSong(song.id)).verifiedBpm === 121.25 && (await library.getAnalysisResults(song.id))[0].bpm === 120, 'Verified BPM overwritten');
    pass('sequential bulk analysis, corrupt/silent failures, protected verified BPM and advancing real deck playback');
    await library.saveAnalysisResult({ songId: song.id, detectorId: 'experiment-test-1', bpm: 119, analyzedAt: Date.now() });
    await queue.start(song.id);
    assert((await library.getAnalysisResults(song.id)).length === 2, 'Reanalysis overwrote another detector');
    const bad = createLibraryAnalysisQueue(library, async () => { throw Error('forced failure'); }); await bad.start(song.id);
    assert((await library.getAnalysisResults(song.id)).find(r => r.detectorId === V40_DETECTOR_ID).bpm === 120, 'Failed retry removed last success');
    pass('individual reanalysis, separately versioned results and retained prior success after failed retry');
    const cancel = () => { if (queue.job.processed === 1) queue.cancel(); }; queue.events.addEventListener('progress', cancel);
    const cancelled = await queue.start(); queue.events.removeEventListener('progress', cancel);
    assert(cancelled.cancelRequested && cancelled.processed === 1 && !cancelled.running, 'Between-song cancellation');
    const slow = createLibraryAnalysisQueue(library, (_, signal) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {once:true})));
    const pending = slow.start(song.id); await delay(30); let rejected = false;
    try { await slow.start(); } catch { rejected = true; }
    slow.cancel(); await pending;
    assert(rejected && slow.job.cancelRequested && !slow.job.running, 'Running cancellation/overlap guard');
    const controller = new AbortController(); controller.abort(); let aborted = false;
    try { await analyzeLibraryAudio(pulse, controller.signal); } catch(error) { aborted = error.name === 'AbortError'; }
    assert(aborted, 'Audio cancellation ignored');
    const NativeWorker = window.Worker, workerAbort = new AbortController();
    try {
      window.Worker = class extends NativeWorker {
        postMessage(...args) { super.postMessage(...args); queueMicrotask(() => workerAbort.abort()); }
      };
      let stopped = false;
      try { await analyzeLibraryAudio(pulse, workerAbort.signal); } catch(error) { stopped = error.name === 'AbortError'; }
      assert(stopped, 'Transferred-PCM worker cancellation ignored');
    } finally { window.Worker = NativeWorker; }
    pass('cancellation before decoding, transferred-PCM worker termination and between songs; overlap rejected');
    storage.close(); storage = await openLibraryStorage(name);
    assert((await storage.listAnalysisResults()).filter(r => r.songId === song.id).length === 2 && (await storage.getSong(song.id)).verifiedBpm === 121.25, 'Result persistence lost');
    assert((await storage.listAnalysisResults()).every(r => !('frequencyEnergy' in r) && !('channels' in r)), 'Large intermediates persisted');
    pass('restart persistence for detector versions/manual BPM, compact results only');
    const restored = createLibraryManagement(Promise.resolve(storage));
    const pairs = [[77,115],[109,110],[111,112],[115,110]];
    for (let index=0;index<pairs.length;index++) {
      const id = (100+index).toString(16).padStart(64,'0');
      await storage.addSong({id,title:'Reference fixture ' + index,verifiedBpm:pairs[index][1]}, new Blob(['fixture']));
      await restored.saveAnalysisResult({songId:id,detectorId:V40_DETECTOR_ID,bpm:pairs[index][0]});
    }
    const exported = await restored.exportBpmResearch();
    assert(exported.formatVersion === 1 && exported.measurements.every(row => Object.keys(row).length === 5), 'Export field allowlist');
    assert(exported.measurements.filter(row => row.title === song.title).length === 2, 'Export merged detector versions');
    for (let index=0;index<pairs.length;index++) {
      const row = exported.measurements.find(row => row.title === 'Reference fixture ' + index);
      assert(row.detectedBpm === pairs[index][0] && row.verifiedBpm === pairs[index][1] && row.difference === pairs[index][0]-pairs[index][1], 'Reference difference wrong');
    }
    storage.close(); storage = await openLibraryStorage(name);
    const afterUpdate = await createLibraryManagement(Promise.resolve(storage)).exportBpmResearch();
    assert(JSON.stringify(afterUpdate) === JSON.stringify(exported), 'Application reopening changed research values');
    assert(!JSON.stringify(exported).includes('relativePath') && !JSON.stringify(exported).includes('sources'), 'Export leaked source data');
    pass('compact versioned JSON export, independent detector rows, reference differences and reopened-application persistence');
    output.dataset.result = 'pass';
  } catch(error) { output.textContent += 'FAIL ' + error.stack; output.dataset.result = 'fail'; }
  finally { if (deck) await ejectAudio(deck.audio); if (url) URL.revokeObjectURL(url); storage?.close(); indexedDB.deleteDatabase(name); }
};
