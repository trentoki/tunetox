// Presentation of one selected song. Relationship and analysis actions are bound
// in Behavior; checkboxes only display the supplied canonical relationships.
const make = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
export function createSongManagementPresentation() {
  const dialog = make('dialog'); dialog.className = 'library-import-dialog library-manage-dialog';
  const title = make('h2'), status = make('p'); status.setAttribute('role', 'status');
  const search = make('input'); search.type = 'search'; search.placeholder = 'Find songs to link'; search.setAttribute('aria-label', 'Find songs to link');
  const links = make('div'), memberships = make('div'), close = make('button', 'Close');
  dialog.append(title, status, make('h3', 'Song links'), search, links, make('h3', 'Playlist membership'), memberships, close);
  document.body.append(dialog);
  function checkbox(label, field, id, checked) {
    const row = make('label'), input = make('input'); input.type = 'checkbox'; input.dataset[field] = id; input.checked = checked;
    row.append(input, document.createTextNode(' ' + label)); return row;
  }
  return {
    dialog, search, close,
    showError(message) { status.textContent = message; },
    render({ song, songs, linked, playlists, memberIds }) {
      title.textContent = 'Manage · ' + song.title;
      links.replaceChildren(...songs.map(other => checkbox(other.title + (other.artist ? ' · ' + other.artist : ''), 'linkSongId', other.id, linked.includes(other.id))));
      if (!songs.length) links.append(make('p', 'No other matching songs.'));
      const path = folder => { const parent = playlists.find(p => p.id === folder.parentId); return parent ? path(parent) + ' / ' + folder.name : folder.name; };
      memberships.replaceChildren(...playlists.map(folder => checkbox(path(folder), 'membershipId', folder.id, memberIds.includes(folder.id))));
      if (!playlists.length) memberships.append(make('p', 'Import a playlist folder first.'));
    }
  };
}
