import { createSongRow } from './song-row.js';
// Presentation only: DOM creation and rendering of Behavior-supplied snapshots.
// No selection, navigation, import, sorting or deck-loading decisions live here.
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
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
  const selectionText = document.createTextNode('Select a song, then choose 1–4');
  footer.replaceChildren(selectionText);
  function showRowManagement(row, selectedId) {
    const previous = row.querySelector('.song-manage-button'); previous?.remove();
    if (row.dataset.songId !== selectedId) return;
    const button = make('button', 'Manage', 'song-manage-button'); button.type = 'button'; button.draggable = false;
    button.setAttribute('aria-label', 'Manage selected song'); row.append(button);
  }
  return {
    showBrowsing(visible) { controls.content.hidden = !visible; },
    restoreScroll(value) { results.scrollTop = value; },
    showSelection(id, title) {
      selectionText.textContent = ' · ' + title; footer.title = title;
      results.querySelectorAll('[data-song-id]').forEach(row => { row.setAttribute('aria-pressed', String(row.dataset.songId === id)); showRowManagement(row, id); });
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
        const row = createSongRow(item); row.dataset.songId = item.id;
        row.draggable = true; row.tabIndex = 0; row.setAttribute('role', 'button');
        row.setAttribute('aria-pressed', String(item.id === selectedId));
        showRowManagement(row, selectedId);
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
