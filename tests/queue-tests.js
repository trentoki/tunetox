import { buildDeck, createPlaybackCoordinator, loadQueue, setMainVolume, setStemLevel, setTempo } from '../app/behavior/mixer/deck.js';
import { ejectAudio } from '../app/audio/deck-audio.js';
const output = document.querySelector('#results'), run = document.querySelector('#run');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw Error(message); };
async function until(test, message) {
  for (let i = 0; i < 400; i++) { if (test()) return; await delay(25); }
  throw Error(message);
}
function tone(seconds = 20) {
  const rate = 8000, samples = Math.floor(rate * seconds), bytes = new ArrayBuffer(44 + samples * 2), data = new DataView(bytes);
  const text = (at, value) => [...value].forEach((char, i) => data.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF'); data.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  text(36, 'data'); data.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) data.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 220 / rate) * 1000, true);
  return new Blob([bytes], { type: 'audio/wav' });
}
run.addEventListener('click', async () => {
  run.disabled = true; output.dataset.result = 'running'; output.textContent = '';
  const pass = message => { output.textContent += 'PASS ' + message + '\n'; };
  const urls = [], fixtures = [], nodes = [], mainGains = [];
  const NativeContext = window.AudioContext, NativeWorklet = window.AudioWorkletNode, nativeFetch = window.fetch;
  let context;
  window.AudioContext = class extends NativeContext {
    constructor(...args) { super(...args); context = this; }
    createGain() {
      const gain = super.createGain(), connect = gain.connect.bind(gain);
      gain.connect = (...args) => { if (args[0] === this.destination) mainGains.push(gain); return connect(...args); };
      return gain;
    }
  };
  window.AudioWorkletNode = class extends NativeWorklet { constructor(...args) { super(...args); nodes.push(this); } };
  const song = (name, seconds = 20) => { const url = URL.createObjectURL(tone(seconds)); urls.push(url); return { name, url }; };
  async function fixture(seconds = 20) {
    const deck = buildDeck(), notices = [];
    const callbacks = { busyChanged() {}, completed: result => notices.push(result?.kind || 'completed'),
      settled() {}, ended: () => notices.push('ended'), mediaFailed: () => notices.push('media-error'), failed: error => notices.push(error.message) };
    const coordinator = createPlaybackCoordinator(deck, callbacks);
    const item = { deck, coordinator, notices }; fixtures.push(item);
    await coordinator.sendToDeck(song('Current', seconds));
    return item;
  }
  try {
    const first = await fixture(), peers = [];
    for (let i = 0; i < 3; i++) peers.push(await fixture());
    const { deck, coordinator } = first;
    setMainVolume(deck, .3); setStemLevel(deck, 'beat', .23); await setTempo(deck, 1.2);
    await coordinator.cue(1);
    await coordinator.togglePlayback();
    for (const peer of peers) await peer.coordinator.togglePlayback();
    await until(() => deck.audio.currentTime > .2, 'Outgoing song did not pass its processing lead-in');
    await coordinator.sendToDeck(song('First assignment'));
    const queued = song('Accepted replacement');
    const replaced = await coordinator.sendToDeck(queued);
    assert(replaced.kind === 'queued' && deck.queue === queued && deck.song.name === 'Current' && deck.cuePositions[0] === 0, 'Occupied queue/cue state changed');
    pass('intentional playing Queue assignment replaces the prepared song without changing source, cues or playback');

    let releaseRead, reading = false;
    window.fetch = (url, options) => url === queued.url ? (reading = true, new Promise(resolve => { releaseRead = () => resolve(nativeFetch(url, options)); })) : nativeFetch(url, options);
    const source = deck.audio.src, before = deck.audio.currentTime, peerTimes = peers.map(peer => peer.deck.audio.currentTime);
    const swapping = coordinator.playQueue();
    await until(() => reading, 'Swap did not prepare');
    const analyser = context.createAnalyser(), samples = new Float32Array(2048); mainGains[0].connect(analyser);
    await delay(150); analyser.getFloatTimeDomainData(samples);
    assert(deck.song.name === 'Current' && deck.queue === queued && deck.audio.src === source && !deck.audio.paused && deck.audio.currentTime > before, 'Preparation interrupted outgoing transport');
    assert(samples.some(value => Math.abs(value) > .001), 'Preparation muted outgoing measured signal');
    setMainVolume(deck, .37); setStemLevel(deck, 'beat', .27);
    await coordinator.playQueue(); await coordinator.sendToDeck(song('Busy'));
    releaseRead(); await swapping; window.fetch = nativeFetch; analyser.disconnect();
    assert(deck.song === queued && deck.queue === null && deck.isPlaying && !deck.audio.paused && deck.cuePositions.every(value => value === null), 'Manual swap did not commit exactly once');
    assert(deck.mainVolume === .37 && deck.tempoRatio === 1.2 && deck.stemLevels.beat === .27, 'Swap reset the latest deck settings');
    assert(peers.every((peer, i) => peer.deck.isPlaying && peer.deck.audio.currentTime > peerTimes[i]), 'Swap interrupted another deck');
    pass('manual swap preserves audible outgoing preparation, commits once, clears cues and inherits controls; three peers keep playing');

    const bad = { name: 'Invalid queue', url: URL.createObjectURL(new Blob(['invalid audio'])) }; urls.push(bad.url);
    await coordinator.sendToDeck(bad);
    const retainedSong = deck.song, retainedSource = deck.audio.src;
    const activeAfterFailure = nodes[nodes.length - 1];
    await coordinator.playQueue();
    assert(deck.song === retainedSong && deck.queue === bad && deck.audio.src === retainedSource && !deck.audio.paused && !deck.audio.error && !coordinator.isPending(), 'Invalid candidate damaged outgoing playback or consumed queue');
    assert(first.notices.some(value => !['completed', 'queued', 'queue-full'].includes(value)), 'Failure was not reported');
    pass('invalid queued audio preserves outgoing playback and queue, reports failure and releases guard');

    const failedAuto = await fixture(.1);
    loadQueue(failedAuto.deck, bad);
    let badReads = 0;
    window.fetch = (url, options) => { if (url === bad.url) badReads++; return nativeFetch(url, options); };
    await failedAuto.coordinator.togglePlayback();
    await until(() => failedAuto.deck.audio.ended && !failedAuto.coordinator.isPending(), 'Failed automatic swap did not settle');
    await delay(100);
    assert(badReads === 1 && failedAuto.deck.queue === bad && failedAuto.deck.song.name === 'Current', 'Automatic failure retried or discarded songs');
    window.fetch = nativeFetch;
    pass('automatic decode failure preserves both songs, settles and does not retry in a loop');

    const endingDuringSwap = await fixture(.15);
    await endingDuringSwap.coordinator.togglePlayback();
    await endingDuringSwap.coordinator.sendToDeck(bad);
    let finishBadRead, manualBadReads = 0;
    window.fetch = (url, options) => url === bad.url ? (++manualBadReads, new Promise(resolve => {
      finishBadRead = () => resolve(nativeFetch(url, options));
    })) : nativeFetch(url, options);
    const failingManual = endingDuringSwap.coordinator.playQueue();
    await until(() => finishBadRead && endingDuringSwap.deck.audio.ended, 'Outgoing song did not end during preparation');
    finishBadRead(); await failingManual; await delay(100); window.fetch = nativeFetch;
    assert(manualBadReads === 1 && endingDuringSwap.deck.queue === bad && !endingDuringSwap.coordinator.isPending(), 'Manual failure at natural end retried automatically');
    pass('natural end during failed manual preparation cannot schedule a duplicate retry');

    const auto = await fixture(.15), next = song('Automatic');
    loadQueue(auto.deck, next); setMainVolume(auto.deck, .17); setStemLevel(auto.deck, 'voice', .41);
    const oldNode = nodes[nodes.length - 1], schedule = oldNode.schedule;
    let releasePlay;
    oldNode.schedule = function(command) {
      const reply = schedule.call(this, command);
      if (!command.active) return reply;
      oldNode.schedule = schedule;
      return reply.then(() => new Promise(resolve => { releasePlay = resolve; }));
    };
    const starting = auto.coordinator.togglePlayback();
    await until(() => releasePlay && auto.deck.audio.ended, 'Short song did not end during held acknowledgement');
    assert(auto.deck.queue === next && auto.deck.song.name === 'Current', 'Pending Play was overlapped by a swap');
    releasePlay(); await starting;
    await until(() => auto.deck.song === next && auto.deck.isPlaying && !auto.coordinator.isPending(), 'Deferred automatic advancement failed');
    assert(auto.deck.queue === null && auto.deck.mainVolume === .17 && auto.deck.stemLevels.voice === .41, 'Automatic swap lost settings');
    pass('natural end during delayed Play waits for guard, advances exactly once and inherits levels');

    // Natural completion of four independent decks must also work concurrently.
    const together = [];
    for (let i = 0; i < 4; i++) { const item = await fixture(.25); const next = song('Next ' + i); loadQueue(item.deck, next); together.push({ ...item, next }); }
    await Promise.all(together.map(item => item.coordinator.togglePlayback()));
    await until(() => together.every(item => item.deck.song === item.next && item.deck.isPlaying && !item.coordinator.isPending()), 'Four automatic swaps failed');
    assert(together.every(item => item.deck.queue === null), 'Automatic advancement retained a consumed slot');
    pass('four decks automatically advance independently');

    const stopped = await fixture(.15);
    loadQueue(stopped.deck, song('Do not auto-start from seek'));
    await stopped.coordinator.seek(stopped.deck.audio.duration); await delay(100);
    assert(stopped.deck.song.name === 'Current' && stopped.deck.queue && stopped.deck.audio.paused, 'Seek to end auto-started queue');
    await stopped.coordinator.playQueue();
    assert(stopped.deck.isPlaying && stopped.deck.queue === null, 'Paused READY failed');
    const noQueue = await fixture(.1);
    await noQueue.coordinator.togglePlayback();
    await until(() => noQueue.deck.audio.ended && !noQueue.coordinator.isPending(), 'No-queue natural end failed');
    assert(noQueue.deck.song.name === 'Current' && !noQueue.deck.isPlaying, 'Natural end unloaded or restarted song');
    pass('paused READY starts replacement; seek-to-end does not advance; natural end without queue retains song');

    const startFailure = await fixture();
    const readyButPaused = song('Committed, Play retry'); loadQueue(startFailure.deck, readyButPaused);
    const nativeResume = NativeContext.prototype.resume;
    let resumes = 0;
    NativeContext.prototype.resume = function() {
      if (++resumes === 2) return Promise.reject(new Error('Queued Play denied'));
      return nativeResume.call(this);
    };
    try { await startFailure.coordinator.playQueue(); }
    finally { NativeContext.prototype.resume = nativeResume; }
    assert(startFailure.deck.song === readyButPaused && startFailure.deck.queue === null && startFailure.deck.audio.paused && !startFailure.coordinator.isPending(), 'Post-commit start failure misrepresented loaded/queued state');
    await startFailure.coordinator.togglePlayback();
    assert(startFailure.deck.isPlaying, 'Committed replacement could not recover with Play');
    pass('post-commit Play rejection leaves replacement loaded/paused and recovers on explicit Play');

    const cancel = await fixture(); await cancel.coordinator.togglePlayback();
    const cancellingSong = song('Cancelled'); await cancel.coordinator.sendToDeck(cancellingSong);
    let cancelRead, entered = false;
    window.fetch = (url, options) => url === cancellingSong.url ? (entered = true, new Promise(resolve => { cancelRead = () => resolve(nativeFetch(url, options)); })) : nativeFetch(url, options);
    const pending = cancel.coordinator.playQueue(); await until(() => entered, 'Cancellation fixture did not read');
    // Direct Audio disposal simulates cancellation independently of guarded UI.
    await ejectAudio(cancel.deck.audio); cancel.deck.song = null;
    cancelRead(); await pending; window.fetch = nativeFetch;
    assert(cancel.deck.audio.src === '' && cancel.deck.song === null && cancel.deck.queue === cancellingSong && !cancel.coordinator.isPending(), 'Cancelled replacement resurrected audio or consumed queue');
    pass('cancelled preparation cannot commit stale source or consume queue');
    activeAfterFailure.onprocessorerror();
    assert(deck.audio.error && deck.audio.paused && !deck.isPlaying, 'Failed candidate made current processor errors invisible');
    pass('current processor errors remain visible after rejected queue preparation');
    output.dataset.result = 'pass';
  } catch (error) {
    output.textContent += 'FAIL ' + error.message; output.dataset.result = 'fail';
  } finally {
    window.fetch = nativeFetch;
    window.AudioContext = NativeContext; window.AudioWorkletNode = NativeWorklet;
    await Promise.all(fixtures.map(item => ejectAudio(item.deck.audio)));
    urls.forEach(url => URL.revokeObjectURL(url)); run.disabled = false;
  }
});
