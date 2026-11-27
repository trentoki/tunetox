// Wire existing deck Library DOM only. No new Library area, playback state or
// metadata cache. Each view owns its browsing/selection; IndexedDB owns songs.
const songDragType = 'application/x-tunetox-library-song';
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

export function connectLibraryControls(library, controls, sendSong, report) {
  const { sort, search, results, selected, destinations } = controls;
  let selectedId = null, sortKey = 'title', descending = false, generation = 0, rendered = false, limit = 100;
  const selectionLabel = selected.querySelector('small');
  const importButton = document.createElement('button'); importButton.type = 'button';
  importButton.textContent = 'Import'; importButton.className = 'library-import-button';
  importButton.setAttribute('aria-label', 'Import songs or a music folder');
  const selectionText = document.createTextNode(' · Select a song, then choose 1–4');
  selectionLabel.replaceChildren(importButton, selectionText);
  const dialog = document.createElement('dialog'); dialog.className = 'library-import-dialog';
  const title = document.createElement('h2'); title.textContent = 'Import into shared library';
  const note = document.createElement('p'); note.textContent = 'Adds files without loading or interrupting any deck. Your originals stay unchanged.';
  const progress = document.createElement('p'); progress.setAttribute('role', 'status');
  const failures = document.createElement('ul');
  const fileInputs = [];
  for (const folder of [false, true]) {
    const label = document.createElement('label'); label.textContent = folder ? 'Choose folder' : 'Choose multiple files';
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
    input.setAttribute('aria-label', folder ? 'Import music folder' : 'Import multiple audio files');
    if (folder) {
      if ('webkitdirectory' in input) input.webkitdirectory = true;
      else { input.disabled = true; input.dataset.unsupported = 'true'; label.title = 'Use multiple files in this browser.'; }
    }
    input.addEventListener('change', async () => {
      const files = [...input.files]; input.value = '';
      if (!files.length) return;
      try { await library.importFiles(files); }
      catch (error) { progress.textContent = error.message; report(error.message); }
    });
    label.append(input); dialog.append(label); fileInputs.push(input);
  }
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel import';
  cancel.onclick = () => library.cancelImport();
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.onclick = () => dialog.close();
  const storage = document.createElement('small');
  storage.textContent = 'Stored on this device for this address/browser. Keep your original music; browser storage may be cleared or evicted.';
  const persist = document.createElement('button'); persist.type = 'button'; persist.textContent = 'Request persistent storage';
  persist.onclick = async () => {
    try { storage.textContent = navigator.storage?.persist ? (await navigator.storage.persist() ? 'Persistence granted. Keep your originals.' : 'Persistence not granted; browser data may be evicted.') : 'Persistent storage requests unavailable.'; }
    catch (error) { storage.textContent = error.message; }
  };
  dialog.prepend(title, note); dialog.append(progress, failures, cancel, close, storage, persist); document.body.append(dialog);
  let displayedFailures = null, failureCount = 0;
  importButton.onclick = () => { dialog.showModal(); showProgress(); };
  function showProgress() {
    if (!dialog.open) return;
    const job = library.importJob;
    progress.textContent = job.running ? `Import ${job.processed}/${job.total}: ${job.current}${job.cancelRequested ? ' · stopping…' : ''}`
      : `${job.added} imported · ${job.duplicates} duplicates · ${job.skipped} skipped · ${job.failures.length} failed${job.cancelRequested ? ' · cancelled' : ''}`;
    fileInputs.forEach(input => { input.disabled = job.running || input.dataset.unsupported === 'true'; });
    cancel.disabled = !job.running || job.cancelRequested;
    if (displayedFailures !== job.failures) { failures.replaceChildren(); failureCount = 0; displayedFailures = job.failures; }
    for (; failureCount < job.failures.length; failureCount++) {
      const failure = job.failures[failureCount], item = document.createElement('li');
      item.textContent = failure.filename + ': ' + failure.message; failures.append(item);
    }
  }
  const buttons = [...destinations.querySelectorAll('button')];
  async function send(id, index) {
    try { await sendSong(id, index, 'deck'); } catch (error) { report(error.message); }
  }
  buttons.forEach((button, index) => {
    button.setAttribute('aria-label', 'Send selected library song to Deck ' + (index + 1));
    button.removeAttribute('title'); button.disabled = true;
    button.addEventListener('click', () => { if (selectedId) void send(selectedId, index); });
    connectSongDrop(button, id => send(id, index));
  });
  [...sort.querySelectorAll('button')].forEach((button, index) => {
    const key = ['title', 'verifiedBpm', 'key', 'artist'][index];
    button.disabled = false; button.removeAttribute('title'); button.setAttribute('aria-label', 'Sort library by ' + button.textContent);
    button.addEventListener('click', () => {
      descending = sortKey === key ? !descending : false; sortKey = key; limit = 100; void refresh();
    });
  });
  search.disabled = false; search.setAttribute('aria-label', 'Search library songs and artists');
  search.addEventListener('input', () => { limit = 100; void refresh(); });
  async function refresh() {
    const request = ++generation;
    try {
      const songs = await library.listSongs({ query: search.value, sort: sortKey, descending });
      if (request !== generation) return;
      const scroll = results.scrollTop;
      results.replaceChildren(...songs.slice(0, limit).map(song => {
        const row = document.createElement('div'); row.className = 'search-result'; row.dataset.songId = song.id;
        row.draggable = true; row.tabIndex = 0; row.setAttribute('role', 'button');
        row.setAttribute('aria-pressed', String(song.id === selectedId));
        const title = document.createElement('strong'); title.className = 'song-title'; title.textContent = song.title;
        const info = document.createElement('span'); info.className = 'artist';
        info.textContent = `${song.artist || 'Unknown artist'} · ${song.verifiedBpm == null ? 'BPM unknown' : song.verifiedBpm + ' BPM'} · ${song.key || 'Key unknown'}`;
        row.append(title, info);
        const select = () => {
          selectedId = song.id; selectionText.textContent = ' · ' + song.title; selectionLabel.title = song.title;
          results.querySelectorAll('[data-song-id]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.songId === selectedId)));
          buttons.forEach(button => { button.disabled = false; });
        };
        row.addEventListener('click', select);
        row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
        row.addEventListener('dragstart', event => { select(); event.dataTransfer.setData(songDragType, song.id); event.dataTransfer.effectAllowed = 'copy'; });
        return row;
      }));
      if (!songs.length) {
        const empty = document.createElement('p'); empty.textContent = 'No matching songs. Use Import to add music.'; results.append(empty);
      }
      if (songs.length > limit) {
        const more = document.createElement('button'); more.textContent = 'Show 100 more'; more.onclick = () => { limit += 100; void refresh(); }; results.append(more);
      }
      results.scrollTop = scroll;
      [...sort.querySelectorAll('button')].forEach((button, index) => {
        const active = ['title', 'verifiedBpm', 'key', 'artist'][index] === sortKey;
        button.setAttribute('aria-pressed', String(active)); button.title = active ? (descending ? 'Descending' : 'Ascending') : 'Sort ascending';
      });
    } catch (error) { report('Library storage: ' + error.message); }
  }
  library.events.addEventListener('change', () => { rendered = false; if (controls.visible()) { rendered = true; void refresh(); } });
  library.events.addEventListener('progress', showProgress);
  showProgress();
  return { refresh() { rendered = true; return refresh(); }, opened() { if (!rendered) { rendered = true; void refresh(); } } };
}
