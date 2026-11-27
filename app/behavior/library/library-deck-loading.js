// Library identity resolves once from canonical storage, then uses the existing
// coordinator. No playback rules, queue state or library metadata are duplicated.
export function createLibraryDeckLoading(library, coordinators, audioFileURLs, releaseUnusedURLs, render, report) {
  return async function sendLibrarySong(id, index, destination = 'deck') {
    try {
      const playback = coordinators[index];
      if (!playback || playback.isPending()) { report('Deck ' + (index + 1) + ' is busy; try again.'); return; }
      const record = await library.getSong(id);
      if (!record) throw new Error('Library song not found.');
      const source = await library.getSource(id);
      if (playback.isPending()) { report('Deck ' + (index + 1) + ' is busy; try again.'); return; }
      const song = { librarySongId: record.id, name: record.filename, url: audioFileURLs.create(source) };
      if (destination === 'queue') await playback.queueSong(song);
      else await playback.sendToDeck(song);
    } catch (error) { report('Library: ' + error.message); }
    finally { releaseUnusedURLs(); render(); }
  };
}
