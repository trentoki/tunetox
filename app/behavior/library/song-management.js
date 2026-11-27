import { getPlaylistRows } from './library-playlist-browsing.js';
import { matchesLibrarySong } from './library-management.js';
import { createSongManagementPresentation } from '../../visual/library/song-management-view.js';

// Manage operates on the selected library song captured when opened, independently
// of the deck-loaded song that drives Links. No audio or mirrored metadata cache.
export function createSongManagement(library, report, analysis, controls, returned) {
  const view = createSongManagementPresentation(controls.host);
  let songId = null, generation = 0, open = false, allSongsExpanded = false, limit = 100;
  const expandedPlaylists = new Set();
  async function refresh() {
    const request = ++generation;
    try {
      const [song, songs, linked, playlists, memberships, analysis] = await Promise.all([
        library.getSong(songId), library.listSongs(), library.getLinkedSongIds(songId), library.listPlaylists(), library.listMemberships(), library.getAnalysisResults(songId)
      ]);
      if (request !== generation || !open) return;
      if (!song) throw new Error('Selected song is unavailable.');
      const candidates = songs.filter(other => other.id !== songId);
      const filtered = candidates.filter(other => matchesLibrarySong(other, view.search.value));
      const playlistRows = getPlaylistRows(playlists, memberships, candidates, view.search.value, expandedPlaylists, limit);
      view.render({ analysis, song, songs: allSongsExpanded ? filtered.slice(0, limit) : [],
        allSongsExpanded, allSongsCount: filtered.length, linked, playlistRows: playlistRows.rows,
        more: playlistRows.more || (allSongsExpanded && filtered.length > limit),
        memberIds: memberships.filter(m => m.songId === songId).map(m => m.playlistId) });
    } catch (error) { view.showError(error.message); report(error.message); }
  }
  view.analyze.onclick = async () => {
    try { if (songId) await analysis.start(songId); }
    catch (error) { view.showError(error.message); report(error.message); }
  };
  view.cancelAnalysis.onclick = () => analysis.cancel();
  analysis.events.addEventListener('progress', () => { if (open) view.showAnalysis(analysis.job); });
  function close(restore = true) {
    if (!open) return;
    open = false; generation++; view.showVisible(false); void returned(restore);
  }
  view.bpmForm.onsubmit = async event => {
    event.preventDefault();
    try {
      const text = view.verifiedBpm.value.trim();
      await library.setVerifiedBpm(songId, text === '' ? null : Number(text));
      view.showError('Verified BPM saved.'); await refresh();
    } catch (error) { view.showError(error.message); report(error.message); }
  };
  view.close.onclick = () => close();
  view.allSongs.onclick = () => { allSongsExpanded = !allSongsExpanded; void refresh(); };
  view.search.oninput = () => { if (view.search.value.trim()) allSongsExpanded = true; limit = 100; void refresh(); };
  view.dialog.addEventListener('click', event => {
    const folder = event.target.closest('[data-manage-playlist]');
    if (folder) {
      const id = folder.dataset.managePlaylist;
      if (expandedPlaylists.has(id)) expandedPlaylists.delete(id); else expandedPlaylists.add(id);
      void refresh();
    }
    if (event.target.closest('[data-manage-more]')) { limit += 100; void refresh(); }
  });
  view.dialog.addEventListener('change', async event => {
    const input = event.target;
    if (!input.dataset.linkSongId && !input.dataset.membershipId) return;
    try {
      if (input.dataset.linkSongId) await library.setSongLink(songId, input.dataset.linkSongId, input.checked);
      if (input.dataset.membershipId) await library.setPlaylistMembership(songId, input.dataset.membershipId, input.checked);
    } catch (error) { view.showError(error.message); report(error.message); }
    await refresh();
  });
  library.events.addEventListener('change', () => { if (open) void refresh(); });
  return {
    isOpen: () => open,
    close,
    open(id) {
      view.beginSong(); songId = id; open = true; view.search.value = ''; view.showError('');
      view.showVisible(true); view.showAnalysis(analysis.job); void refresh();
    }
  };
}
