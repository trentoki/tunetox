import { createSongManagementPresentation } from '../../visual/library/song-management-view.js';

// Manage operates on the selected library song captured when opened, independently
// of the deck-loaded song that drives Links. No audio or mirrored metadata cache.
export function createSongManagement(library, report) {
  const view = createSongManagementPresentation();
  let songId = null, generation = 0;
  async function refresh() {
    const request = ++generation;
    try {
      const [song, songs, linked, playlists, memberships] = await Promise.all([
        library.getSong(songId), library.listSongs({ query: view.search.value }), library.getLinkedSongIds(songId), library.listPlaylists(), library.listMemberships()
      ]);
      if (request !== generation || !view.dialog.open) return;
      if (!song) throw new Error('Selected song is unavailable.');
      view.render({ song, songs: songs.filter(s => s.id !== songId), linked, playlists, memberIds: memberships.filter(m => m.songId === songId).map(m => m.playlistId) });
    } catch (error) { view.showError(error.message); report(error.message); }
  }
  view.close.onclick = () => view.dialog.close();
  view.search.oninput = () => void refresh();
  view.dialog.addEventListener('change', async event => {
    const input = event.target;
    try {
      if (input.dataset.linkSongId) await library.setSongLink(songId, input.dataset.linkSongId, input.checked);
      if (input.dataset.membershipId) await library.setPlaylistMembership(songId, input.dataset.membershipId, input.checked);
    } catch (error) { view.showError(error.message); report(error.message); }
    await refresh();
  });
  library.events.addEventListener('change', () => { if (view.dialog.open) void refresh(); });
  return { open(id) { songId = id; view.search.value = ''; view.showError(''); view.dialog.showModal(); void refresh(); } };
}
