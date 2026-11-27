// Shared song presentation only. Callers own selection, checkboxes and actions.
function bpmLabel(song) {
  if (song.verifiedBpm == null) return song.detectedBpm == null ? 'BPM unknown' : song.detectedBpm + ' BPM (V40)';
  const detected = song.detectedBpm == null ? '' : ' · V40 ' + song.detectedBpm + ' (Δ ' + (song.detectedBpm - song.verifiedBpm).toFixed(2) + ')';
  return song.verifiedBpm + ' BPM verified' + detected;
}
export function createSongRow(song, tag = 'div') {
  const row=document.createElement(tag); row.className='search-result';
  const title=document.createElement('strong');title.className='song-title';title.textContent=song.title;
  const detail=document.createElement('span');detail.className='artist';
  detail.textContent=`${song.artist || 'Unknown artist'} · ${bpmLabel(song)} · ${song.key || 'Key unknown'}`;
  row.append(title,detail);return row;
}
