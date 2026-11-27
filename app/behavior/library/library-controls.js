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
    try { view.storage.textContent = navigator.storage?.persist ? (await navigator.storage.persist() ? 'Persistence granted. Keep your originals.' : 'Persistence not granted; browser data may be evicted.') : 'Persistent storage requests unavailable.'; }
    catch (error) { fail(error); }
  };
  const buttons = [...destinations.children];
  buttons.forEach((button, index) => {
    button.disabled = true; button.removeAttribute('title'); button.setAttribute('aria-label', 'Send selected library song to Deck ' + (index + 1));
    button.onclick = () => { if (selectedId) void sendSong(selectedId, index, 'deck'); };
    connectSongDrop(button, id => sendSong(id, index, 'deck'));
  });
  [...sort.children].forEach((button, index) => {
    const key = ['title', 'verifiedBpm', 'key', 'artist'][index];
    button.disabled = false; button.setAttribute('aria-label', 'Sort library by ' + button.textContent);
    button.onclick = () => { descending = sortKey === key ? !descending : false; sortKey = key; limit = 100; void refresh(); };
  });
  [...tabs.children].forEach((button, index) => {
    if (index === 2) return;
    button.disabled = false; button.title = button.textContent; button.setAttribute('aria-label', button.textContent);
    button.onclick = () => { content = ['songs', 'playlists'][index]; void refresh(); };
  });
  search.disabled = false; search.setAttribute('aria-label', 'Search library songs and artists');
  search.oninput = () => { limit = 100; void refresh(); };
  function select(row) { selectedId = row.dataset.songId; view.select(selectedId, row.querySelector('.song-title').textContent); }
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
      const songs = await library.listSongs({ query: search.value, sort: sortKey, descending });
      const [playlists, memberships] = content === 'playlists' ? await Promise.all([library.listPlaylists(), library.listMemberships()]) : [[], []];
      if (request !== generation) return;
      const rows = [];
      if (content === 'playlists') {
        const append = (parentId, depth) => {
          for (const folder of playlists.filter(p => p.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name))) {
            rows.push({ ...folder, folder: true, depth, expanded: expanded.has(folder.id) });
            if (!expanded.has(folder.id)) continue;
            append(folder.id, depth + 1);
            const ids = new Set(memberships.filter(m => m.playlistId === folder.id).map(m => m.songId));
            rows.push(...songs.filter(song => ids.has(song.id)).slice(0, limit).map(song => ({ ...song, depth: depth + 1 })));
          }
        };
        append(null, 0);
      } else rows.push(...songs.slice(0, limit));
      view.render({ rows, selectedId, content, sortKey, descending, more: songs.length > limit });
    } catch (error) { fail(error); }
  }
  library.events.addEventListener('change', () => { rendered = false; if (controls.visible()) { rendered = true; void refresh(); } });
  library.events.addEventListener('progress', () => view.showImportProgress(library.importJob));
  return { refresh() { rendered = true; return refresh(); }, opened() { if (!rendered) { rendered = true; void refresh(); } } };
}
