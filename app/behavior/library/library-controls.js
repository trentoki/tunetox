import { getPlaylistRows } from './library-playlist-browsing.js';
import { createLibraryAnalysisControls } from './library-analysis-controls.js';
import { connectLibraryStrip } from './library-strip-interactions.js';
import { createSongManagement } from './song-management.js';
import { createLibraryPresentation } from '../../visual/library/library-view.js';

const songDragType = 'application/x-tunetox-library-song';
// Shared interaction interpretation; all destinations invoke existing deck Behavior.
export function connectSongDrop(target, receive) {
  const accepts = event => [...(event.dataTransfer?.types || [])].includes(songDragType);
  target.addEventListener('dragover', event => {
    if (!accepts(event)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
  });
  target.addEventListener('drop', event => {
    if (!accepts(event)) return;
    event.preventDefault(); event.stopPropagation();
    const id = event.dataTransfer.getData(songDragType);
    if (/^[a-f0-9]{64}$/.test(id)) void receive(id);
  });
}

// One browsing state per existing deck view. Canonical songs remain in storage.
export function connectLibraryControls(library, controls, sendSong, report) {
  const { tabs, sort, search, results, destinations } = controls;
  const view = createLibraryPresentation(controls), expanded = new Set();
  let selectedId = null, content = 'songs', sortKey = 'title', descending = false;
  const analysis = createLibraryAnalysisControls(controls.analysis, report);
  view.analyzeButton.onclick = () => analysis.open();
  const manage = createSongManagement(library, report, id => analysis.open(id));
  view.manageButton.onclick = () => { if (selectedId) manage.open(selectedId); };
  let lastLoadedSongId;
  let generation = 0, rendered = false, limit = 100;
  const fail = error => { view.showError(error.message); report(error.message); };
  view.importButton.onclick = () => { view.dialog.showModal(); view.showImportProgress(library.importJob); };
  view.close.onclick = () => view.dialog.close();
  view.cancel.onclick = () => library.cancelImport();
  view.inputs.forEach((input, index) => input.addEventListener('change', async () => {
    const files = [...input.files]; input.value = '';
    if (!files.length) return;
    try { await library.importFiles(files, { playlist: index === 1 }); } catch (error) { fail(error); }
  }));
  view.persist.onclick = async () => {
    try { view.showStorage(navigator.storage?.persist ? (await navigator.storage.persist() ? 'Persistence granted. Keep your originals.' : 'Persistence not granted; browser data may be evicted.') : 'Persistent storage requests unavailable.'); }
    catch (error) { fail(error); }
  };
  const buttons = [...destinations.children];
  buttons.forEach((button, index) => {
    button.onclick = () => { if (selectedId) void sendSong(selectedId, index, 'deck'); };
    connectSongDrop(button, id => sendSong(id, index, 'deck'));
  });
  connectLibraryStrip(sort, (index, repeat) => {
    const key = ['title', 'verifiedBpm', 'key', 'artist'][index];
    descending = sortKey === key && repeat ? !descending : false;
    sortKey = key; limit = 100; void refresh();
  });
  connectLibraryStrip(tabs, index => { content = ['songs', 'playlists', 'links'][index]; void refresh(); });
  search.oninput = () => { limit = 100; void refresh(); };
  function select(row) { selectedId = row.dataset.songId; view.showSelection(selectedId, row.querySelector('.song-title').textContent); }
  results.addEventListener('click', event => {
    const folder = event.target.closest('[data-playlist-id]');
    if (folder) { const id = folder.dataset.playlistId; if (expanded.has(id)) expanded.delete(id); else expanded.add(id); void refresh(); return; }
    const row = event.target.closest('[data-song-id]'); if (row) select(row);
    if (event.target.closest('[data-more]')) { limit += 100; void refresh(); }
  });
  results.addEventListener('keydown', event => {
    const row = event.target.closest('[data-song-id]');
    if (row && ['Enter', ' '].includes(event.key)) { event.preventDefault(); select(row); }
  });
  results.addEventListener('dragstart', event => {
    const row = event.target.closest('[data-song-id]'); if (!row) return;
    select(row); event.dataTransfer.setData(songDragType, selectedId); event.dataTransfer.effectAllowed = 'copy';
  });
  async function refresh() {
    const request = ++generation;
    try {
      let songs = await library.listSongs({ query: content === 'playlists' ? '' : search.value, sort: sortKey, descending });
      if (content === 'links') {
        const ids = new Set(await library.getLinkedSongIds(controls.getLoadedSongId()));
        songs = songs.filter(song => ids.has(song.id));
      }
      const [playlists, memberships] = content === 'playlists' ? await Promise.all([library.listPlaylists(), library.listMemberships()]) : [[], []];
      if (request !== generation) return;
      const snapshot = content === 'playlists'
        ? getPlaylistRows(playlists, memberships, songs, search.value, expanded, limit)
        : { rows: songs.slice(0, limit), more: songs.length > limit };
      view.render({ ...snapshot, selectedId, content, sortKey, descending });
    } catch (error) { fail(error); }
  }
  library.events.addEventListener('change', () => { rendered = false; if (controls.visible()) { rendered = true; void refresh(); } });
  library.events.addEventListener('progress', () => view.showImportProgress(library.importJob));
  return {
    refresh() { rendered = true; return refresh(); },
    opened() {
      const loaded = controls.getLoadedSongId();
      if (loaded !== lastLoadedSongId) {
        lastLoadedSongId = loaded;
        if (content === 'links') rendered = false;
      }
      if (!rendered) { rendered = true; void refresh(); }
    }
  };
}
