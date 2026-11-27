// Presentation of one selected song. Relationship and analysis actions are bound
// in Behavior; checkboxes only display the supplied canonical relationships.
const make = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
export function createSongManagementPresentation(host) {
  const dialog = make('section'); dialog.className = 'library-manage-view'; dialog.hidden = true;
  const toolbar = make('div'); toolbar.className = 'library-manage-toolbar';
  const body = make('div'); body.className = 'library-manage-body';
  const title = make('h2'), status = make('p'); status.setAttribute('role', 'status');
  const search = make('input'); search.type = 'search'; search.placeholder = 'Find songs to link'; search.setAttribute('aria-label', 'Find songs to link');
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
  toolbar.append(close, title); body.append(status, make('h3', 'Song links'), search, links, make('h3', 'Playlist membership'), memberships, development);
  dialog.append(toolbar, body); host.append(dialog);
  function checkbox(label, field, id, checked) {
    const row = make('label'), input = make('input'); input.type = 'checkbox'; input.dataset[field] = id; input.checked = checked;
    row.append(input, document.createTextNode(' ' + label)); return row;
  }
  return {
    dialog, search, close, bpmForm, verifiedBpm, analyze, cancelAnalysis,
    showVisible(visible) { dialog.hidden = !visible; },
    showAnalysis(job) {
      analyze.disabled = job.running; cancelAnalysis.disabled = !job.running || job.cancelRequested;
      analysisStatus.textContent = `${job.processed}/${job.total} processed · ${job.succeeded} detected · ${job.failures.length} failed${job.running ? ' · ' + job.current : ''}${job.cancelRequested ? ' · cancelled/stopping' : ''}`;
    },
    beginSong() { delete verifiedBpm.dataset.editingSongId; },
    showError(message) { status.textContent = message; },
    render({ song, songs, linked, playlists, memberIds, analysis }) {
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
      links.replaceChildren(...songs.map(other => checkbox(other.title + (other.artist ? ' · ' + other.artist : ''), 'linkSongId', other.id, linked.includes(other.id))));
      if (!songs.length) links.append(make('p', 'No other matching songs.'));
      const path = folder => { const parent = playlists.find(p => p.id === folder.parentId); return parent ? path(parent) + ' / ' + folder.name : folder.name; };
      memberships.replaceChildren(...playlists.map(folder => checkbox(path(folder), 'membershipId', folder.id, memberIds.includes(folder.id))));
      if (!playlists.length) memberships.append(make('p', 'Import a playlist folder first.'));
    }
  };
}
