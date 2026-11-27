import { matchesLibrarySong } from './library-management.js';

// Derive inline rows from canonical references and one panel's expansion state.
// Search retains ancestor context; a matching folder includes its subtree's songs.
// Filtering never changes expansion state or playlist membership.
export function getPlaylistRows(playlists, memberships, songs, query, expanded, limit) {
  const text = query.toLocaleLowerCase().trim(), children = new Map(), contents = new Map();
  for (const folder of playlists) {
    if (!children.has(folder.parentId)) children.set(folder.parentId, []);
    children.get(folder.parentId).push(folder);
  }
  for (const member of memberships) {
    if (!contents.has(member.playlistId)) contents.set(member.playlistId, new Set());
    contents.get(member.playlistId).add(member.songId);
  }
  const branch = (folder, inherited) => {
    const matchesFolder = inherited || !text || folder.name.toLocaleLowerCase().includes(text);
    const members = songs.filter(song => contents.get(folder.id)?.has(song.id) && (matchesFolder || matchesLibrarySong(song, text)));
    const nested = (children.get(folder.id) || []).sort((a,b) => a.name.localeCompare(b.name)).map(child => branch(child, matchesFolder));
    return { folder, members, nested, visible: matchesFolder || members.length > 0 || nested.some(child => child.visible) };
  };
  const rows = []; let more = false;
  function append(node, depth) {
    if (!node.visible) return;
    const { folder } = node;
    rows.push({ ...folder, folder: true, depth, expanded: expanded.has(folder.id) });
    if (!expanded.has(folder.id)) return;
    node.nested.forEach(child => append(child, depth + 1));
    rows.push(...node.members.slice(0, limit).map(song => ({ ...song, depth: depth + 1 })));
    more ||= node.members.length > limit;
  }
  (children.get(null) || []).sort((a,b) => a.name.localeCompare(b.name)).forEach(folder => append(branch(folder, false), 0));
  return { rows, more };
}
