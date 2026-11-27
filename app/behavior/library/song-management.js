import { createSongManagementPresentation } from '../../visual/library/song-management-view.js';

// Manage operates on the selected library song captured when opened, independently
// of the deck-loaded song that drives Links. No audio or mirrored metadata cache.
export function createSongManagement(library, report, analyzeSong) {
  const view = createSongManagementPresentation();
  let songId = null, generation = 0;
  async function refresh() {
    const request = ++generation;
    try {
      const [song, songs, linked, playlists, memberships, analysis] = await Promise.all([
        library.getSong(songId), library.listSongs({ query: view.search.value }), library.getLinkedSongIds(songId), library.listPlaylists(), library.listMemberships(), library.getAnalysisResults(songId)
      ]);
      if (request !== generation || !view.dialog.open) return;
      if (!song) throw new Error('Selected song is unavailable.');
      view.render({ analysis, song, songs: songs.filter(s => s.id !== songId), linked, playlists, memberIds: memberships.filter(m => m.songId === songId).map(m => m.playlistId) });
    } catch (error) { view.showError(error.message); report(error.message); }
  }
  view.analyze.onclick = () => { if (songId) analyzeSong(songId); };
  view.bpmForm.onsubmit = async event => {
    event.preventDefault();
    try {
      const text = view.verifiedBpm.value.trim();
      await library.setVerifiedBpm(songId, text === '' ? null : Number(text));
      view.showError('Verified BPM saved.'); await refresh();
    } catch (error) { view.showError(error.message); report(error.message); }
  };
  view.close.onclick = () => view.dialog.close();
  view.search.oninput = () => void refresh();
  view.dialog.addEventListener('change', async event => {
    const input = event.target;
    if (!input.dataset.linkSongId && !input.dataset.membershipId) return;
    try {
      if (input.dataset.linkSongId) await library.setSongLink(songId, input.dataset.linkSongId, input.checked);
      if (input.dataset.membershipId) await library.setPlaylistMembership(songId, input.dataset.membershipId, input.checked);
    } catch (error) { view.showError(error.message); report(error.message); }
    await refresh();
  });
  library.events.addEventListener('change', () => { if (view.dialog.open) void refresh(); });
  return { open(id) { view.beginSong(); songId = id; view.search.value = ''; view.showError(''); view.dialog.showModal(); void refresh(); } };
}
