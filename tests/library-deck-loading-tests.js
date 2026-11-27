import { buildDeck, createPlaybackCoordinator } from '../app/behavior/mixer/deck.js';
import { createAudioFileURLs, ejectAudio } from '../app/audio/deck-audio.js';

// Real stored Blob -> existing URL owner -> existing deck coordinator. This test
// does not add an application route or change musical loading/queue behavior.
export async function checkLibraryDeckLoading(library) {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const rate = 8000, length = rate * 15, bytes = new ArrayBuffer(44 + length * 2), data = new DataView(bytes);
  const text = (at, value) => [...value].forEach((char, i) => data.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF'); data.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  text(36, 'data'); data.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) data.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 220 / rate) * 1000, true);
  await library.importFiles([new File([bytes], 'Stored tone.wav', { type: 'audio/wav' })]);
  const song = (await library.listSongs({ query: 'Stored tone' }))[0];
  const decks = Array.from({ length: 4 }, () => buildDeck()), identities = decks.map(deck => deck.audio);
  const urls = createAudioFileURLs();
  const release = () => urls.releaseUnused(decks.flatMap(deck => [deck.song?.url, deck.queue?.url, deck.loadingSong?.url]));
  const coordinators = decks.map(deck => createPlaybackCoordinator(deck, {
    busyChanged() {}, completed() {}, failed() {}, settled: release, ended() {}, mediaFailed() {}
  }));
  async function load(index) {
    const record = await library.getSong(song.id), source = await library.getSource(song.id);
    return coordinators[index].sendToDeck({ librarySongId: record.id, name: record.filename, url: urls.create(source) });
  }
  try {
    for (let index = 0; index < 4; index++) {
      await load(index);
      assert(decks[index].song?.librarySongId === song.id && decks[index].audio.readyState === 2 && decks[index].audio.paused,
        'Stored song failed to load paused onto deck ' + (index + 1));
    }
    const pausedSong = decks[1].song, pausedSource = decks[1].audio.src;
    decks[1].cuePositions[0] = 2;
    const queuedSong = { name: 'Explicit paused Queue', url: urls.create(await library.getSource(song.id)) };
    const queued = await coordinators[1].queueSong(queuedSong);
    assert(queued.kind === 'queued' && decks[1].song === pausedSong && decks[1].audio.src === pausedSource &&
      decks[1].audio.paused && decks[1].cuePositions[0] === 2, 'Paused Queue destination changed current source/cues');
    const full = await coordinators[1].queueSong({ name: 'Rejected Queue', url: urls.create(await library.getSource(song.id)) });
    assert(full.kind === 'queue-full' && decks[1].queue === queuedSong, 'Explicit occupied Queue replaced');
    const busySong = { name: 'Busy rejection', url: urls.create(await library.getSource(song.id)) };
    const seeking = coordinators[2].seek(1);
    await coordinators[2].queueSong(busySong);
    await seeking;
    assert(decks[2].queue === null, 'Explicit Queue bypassed the deck operation guard');
    await coordinators[0].togglePlayback();
    const playingUrl = decks[0].audio.src;
    await load(0);
    const playingQueue = decks[0].queue;
    assert(playingQueue?.librarySongId === song.id && decks[0].audio.src === playingUrl && !decks[0].audio.paused,
      'Library load interrupted playback instead of queueing');
    await load(0);
    assert(decks[0].queue !== playingQueue && decks[0].queue.librarySongId === song.id && decks[0].audio.src === playingUrl, 'Playing queue did not replace prepared resource safely');
    assert(decks.every((deck, index) => deck.audio === identities[index] && deck.mainVolume === 0 && deck.tempoRatio === 1),
      'Library recreated players or reset controls');
    await coordinators[0].togglePlayback();
  } finally {
    await Promise.all(decks.map(deck => ejectAudio(deck.audio))); urls.releaseUnused([]);
  }
}
