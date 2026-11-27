// Presentation only: DOM creation and rendering of Behavior-supplied snapshots.
// No selection, navigation, import, sorting or deck-loading decisions live here.
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function bpmLabel(song) {
  if (song.verifiedBpm == null) return song.detectedBpm == null ? 'BPM unknown' : song.detectedBpm + ' BPM (V40)';
  const detected = song.detectedBpm == null ? '' : ' · V40 ' + song.detectedBpm + ' (Δ ' + (song.detectedBpm - song.verifiedBpm).toFixed(2) + ')';
  return song.verifiedBpm + ' BPM verified' + detected;
}
export function createLibraryPresentation(controls) {
  const { tabs, sort, search, results, selected, destinations } = controls;
  [...destinations.children].forEach((button, index) => {
    button.disabled = true; button.removeAttribute('title');
    button.setAttribute('aria-label', 'Send selected library song to Deck ' + (index + 1));
  });
  [...sort.children].forEach(button => {
    button.disabled = false; button.setAttribute('aria-label', 'Sort library by ' + button.textContent);
  });
  [...tabs.children].forEach(button => {
    button.disabled = false; button.title = button.textContent; button.setAttribute('aria-label', button.textContent);
  });
  search.disabled = false; search.setAttribute('aria-label', 'Search library songs, playlists and artists');
  const footer = selected.querySelector('small');
  const importButton = make('button', 'Import', 'library-import-button'); importButton.type = 'button';
  const manageButton = make('button', 'Manage', 'library-import-button'); manageButton.disabled = true;
  const analyzeButton = make('button', 'Analyze All', 'library-import-button');
  const selectionText = document.createTextNode(' · Select a song, then choose 1–4');
  footer.replaceChildren(importButton, document.createTextNode(' · '), manageButton, document.createTextNode(' · '), analyzeButton, selectionText);
  const dialog = make('dialog', undefined, 'library-import-dialog');
  dialog.append(make('h2', 'Import into shared library'), make('p', 'Adds files without loading or interrupting any deck. Your originals stay unchanged.'));
  const inputs = [false, true].map(folder => {
    const label = make('label', folder ? 'Import Playlist' : 'Import Songs');
    const input = make('input'); input.type = 'file'; input.multiple = true;
    input.setAttribute('aria-label', folder ? 'Import music folder' : 'Import multiple audio files');
    if (folder) {
      if ('webkitdirectory' in input) input.webkitdirectory = true;
      else { input.disabled = true; input.dataset.unsupported = 'true'; label.title = 'Use multiple files in this browser.'; }
    }
    label.append(input); dialog.append(label); return input;
  });
  const progress = make('p'); progress.setAttribute('role', 'status');
  const failures = make('ul'), cancel = make('button', 'Cancel import'), close = make('button', 'Close');
  const storage = make('small', 'Stored on this device for this address/browser. Keep originals; browser data may be evicted.');
  const persist = make('button', 'Request persistent storage');
  dialog.append(progress, failures, cancel, close, storage, persist); document.body.append(dialog);
  let displayedFailures, failureCount = 0;
  return {
    importButton, manageButton, analyzeButton, dialog, inputs, cancel, close, persist,
    showStorage(message) { storage.textContent = message; },
    showImportProgress(job) {
      if (!dialog.open) return;
      progress.textContent = job.running ? `Import ${job.processed}/${job.total}: ${job.current}${job.cancelRequested ? ' · stopping…' : ''}`
        : `${job.added} imported · ${job.duplicates} duplicates · ${job.skipped} skipped · ${job.failures.length} failed${job.cancelRequested ? ' · cancelled' : ''}`;
      inputs.forEach(input => { input.disabled = job.running || input.dataset.unsupported === 'true'; });
      cancel.disabled = !job.running || job.cancelRequested;
      if (displayedFailures !== job.failures) { failures.replaceChildren(); failureCount = 0; displayedFailures = job.failures; }
      for (; failureCount < job.failures.length; failureCount++) failures.append(make('li', job.failures[failureCount].filename + ': ' + job.failures[failureCount].message));
    },
    showError(message) { progress.textContent = message; },
    showSelection(id, title) {
      manageButton.disabled = !id;
      selectionText.textContent = ' · ' + title; footer.title = title;
      results.querySelectorAll('[data-song-id]').forEach(row => row.setAttribute('aria-pressed', String(row.dataset.songId === id)));
      destinations.querySelectorAll('button').forEach(button => { button.disabled = !id; });
    },
    render({ rows, selectedId, content, sortKey, descending, more }) {
      const scroll = results.scrollTop;
      results.replaceChildren(...rows.map(item => {
        if (item.folder) {
          const row = make('button', (item.expanded ? '▾ ' : '▸ ') + item.name, 'library-playlist');
          row.dataset.playlistId = item.id; row.setAttribute('aria-expanded', String(item.expanded));
          row.style.paddingLeft = (8 + item.depth * 12) + 'px'; return row;
        }
        const row = make('div', undefined, 'search-result'); row.dataset.songId = item.id;
        row.draggable = true; row.tabIndex = 0; row.setAttribute('role', 'button');
        row.setAttribute('aria-pressed', String(item.id === selectedId));
        row.append(make('strong', item.title, 'song-title'), make('span', `${item.artist || 'Unknown artist'} · ${bpmLabel(item)} · ${item.key || 'Key unknown'}`, 'artist'));
        if (item.depth) row.style.paddingLeft = (8 + item.depth * 12) + 'px';
        return row;
      }));
      if (!rows.length) results.append(make('p', content === 'playlists' ? 'Use Import Playlist to add a folder.' : content === 'links' ? 'No matching links for this deck’s loaded song.' : 'No matching songs. Use Import to add music.'));
      if (more) { const button = make('button', 'Show 100 more'); button.dataset.more = 'true'; results.append(button); }
      results.scrollTop = scroll;
      [...tabs.children].forEach((button, i) => button.setAttribute('aria-pressed', String(['songs', 'playlists', 'links'][i] === content)));
      [...sort.children].forEach((button, i) => {
        const active = ['title', 'verifiedBpm', 'key', 'artist'][i] === sortKey;
        button.setAttribute('aria-pressed', String(active)); button.title = active ? (descending ? 'Descending' : 'Ascending') : 'Sort ascending';
      });
    }
  };
}
