import { createSongRow } from './song-row.js';
// Presentation of one selected song. Relationship and analysis actions are bound
// in Behavior; checkboxes only display the supplied canonical relationships.
const make = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
export function createSongManagementPresentation(host) {
  const dialog = make('section'); dialog.className = 'library-manage-view'; dialog.hidden = true;
  const toolbar = make('div'); toolbar.className = 'library-manage-toolbar';
  const body = make('div'); body.className = 'library-manage-body';
  const title = make('h2'), status = make('p'); status.setAttribute('role', 'status');
  const search = make('input'); search.type = 'search'; search.placeholder = 'Find songs to link'; search.setAttribute('aria-label', 'Find songs to link');
  const allSongs = make('button', '▸ All Songs'); allSongs.dataset.manageAllSongs = 'true';
  const more = make('button', 'Show 100 more'); more.dataset.manageMore = 'true'; more.hidden = true;
  const links = make('div'), memberships = make('div'), close = make('button', 'Back to Library');
  const bpmForm = make('form'), verifiedBpm = make('input'); verifiedBpm.type = 'number'; verifiedBpm.min = '0.001'; verifiedBpm.max = '1000'; verifiedBpm.step = 'any';
  verifiedBpm.setAttribute('aria-label', 'Verified BPM');
  const bpmLabel = make('label', 'Verified BPM (blank clears) '); bpmLabel.append(verifiedBpm);
  const saveBpm = make('button', 'Save verified BPM'); saveBpm.type = 'submit'; bpmForm.append(bpmLabel, saveBpm);
  const analyze = make('button', 'Analyze BPM (V40)'), analysisResults = make('div');
  const development = make('details'); development.className = 'library-development-analysis';
  development.append(make('summary', 'Development · BPM analysis and correction'), bpmForm, analyze, analysisResults);
  const analysisStatus = make('p'), cancelAnalysis = make('button', 'Cancel analysis');
  analysisStatus.setAttribute('role', 'status'); development.append(analysisStatus, cancelAnalysis);
  const allSongsSection=make('section'); allSongsSection.append(allSongs,links);
  toolbar.append(close, title); body.append(status, make('h3', 'Song links'), search, allSongsSection, make('h3', 'Playlists'), memberships, more, development);
  dialog.append(toolbar, body); host.append(dialog);
  return {
    dialog, search, allSongs, close, bpmForm, verifiedBpm, analyze, cancelAnalysis,
    showVisible(visible) { dialog.hidden = !visible; },
    showAnalysis(job) {
      analyze.disabled = job.running; cancelAnalysis.disabled = !job.running || job.cancelRequested;
      analysisStatus.textContent = `${job.processed}/${job.total} processed · ${job.succeeded} detected · ${job.failures.length} failed${job.running ? ' · ' + job.current : ''}${job.cancelRequested ? ' · cancelled/stopping' : ''}`;
    },
    beginSong() { delete verifiedBpm.dataset.editingSongId; },
    showError(message) { status.textContent = message; },
    render({ song, songs, linked, playlistRows, memberIds, analysis, allSongsExpanded, allSongsCount, more: hasMore }) {
      title.textContent = 'Manage · ' + song.title;
      if (verifiedBpm.dataset.editingSongId !== song.id) verifiedBpm.value = song.verifiedBpm ?? '';
      verifiedBpm.dataset.editingSongId = song.id;
      analysisResults.replaceChildren(...analysis.map(result => {
        const details = make('details'), summary = make('summary');
        const difference = song.verifiedBpm != null && result.bpm != null ? ' · Δ ' + (result.bpm - song.verifiedBpm).toFixed(2) + ' BPM' : '';
        summary.textContent = result.detectorId + ': ' + (result.bpm ?? 'unknown') + difference + (result.lastAttempt?.status === 'failed' ? ' · last attempt failed' : '');
        const data = make('pre', JSON.stringify(result, null, 2)); details.append(summary, data); return details;
      }));
      if (!analysis.length) analysisResults.append(make('p', 'No detected BPM yet. Verified BPM is never replaced by analysis.'));
      const songLink = other => {
        const row=createSongRow(other,'label');row.classList.add('manage-song-row');
        const input=make('input');input.type='checkbox';input.dataset.linkSongId=other.id;input.checked=linked.includes(other.id);
        input.setAttribute('aria-label','Link to '+other.title);row.prepend(input);return row;
      };
      allSongs.setAttribute('aria-expanded', String(allSongsExpanded));
      allSongs.textContent = (allSongsExpanded ? '▾ ' : '▸ ') + 'All Songs (' + allSongsCount + ')';
      links.hidden = !allSongsExpanded; links.replaceChildren(...songs.map(songLink));
      if (allSongsExpanded && !songs.length) links.append(make('p', 'No other matching songs.'));
      const playlistContents=document.createDocumentFragment(), sections=[];
      for (const item of playlistRows) {
        if (!item.folder) {
          while (sections.length && sections.at(-1).depth >= item.depth) sections.pop();
          const row = songLink(item); row.style.paddingLeft = (12 + item.depth * 12) + 'px';
          (sections.at(-1)?.node || playlistContents).append(row); continue;
        }
        const row = make('div'); row.className = 'manage-playlist-row'; row.style.paddingLeft = item.depth * 12 + 'px';
        const member = make('input'); member.type = 'checkbox'; member.dataset.membershipId = item.id;
        member.checked = memberIds.includes(item.id); member.setAttribute('aria-label', 'Membership in ' + item.name);
        const disclosure = make('button', (item.expanded ? '▾ ' : '▸ ') + item.name);
        disclosure.dataset.managePlaylist = item.id; disclosure.setAttribute('aria-expanded', String(item.expanded));
        row.append(member, disclosure);
        while (sections.length && sections.at(-1).depth >= item.depth) sections.pop();
        const section=make('section');section.className='manage-playlist-section';section.append(row);
        (sections.at(-1)?.node || playlistContents).append(section);
        sections.push({depth:item.depth,node:section});
      }
      memberships.replaceChildren(playlistContents);
      if (!playlistRows.length) memberships.append(make('p', 'No matching playlists. Use Import Playlist to add a folder.'));
      more.hidden = !hasMore;
    }
  };
}
