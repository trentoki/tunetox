// Separate temporary UI; does not alter the existing loading or playback handlers.
(() => {
  const panel = document.createElement('section');
  panel.innerHTML = '<h2>Temporary Signalsmith diagnostics (Deck 1 only)</h2>' +
    '<label><input type="checkbox"> Capture Load / startup / Stop (enable before loading)</label> ' +
    '<button type="button">Refresh captures</button><p role="status"></p><div></div>';
  document.body.appendChild(panel);
  const status = panel.querySelector('p');
  const list = panel.querySelector('div');
  let urls = [];
  panel.querySelector('input').onchange = event => {
    signalsmithDiagnostics.setEnabled(event.target.checked);
    refresh();
  };
  function refresh() {
    urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
    list.replaceChildren();
    status.textContent = signalsmithDiagnostics.message;
    for (const capture of signalsmithDiagnostics.captures) {
      const row = document.createElement('p');
      row.textContent = 'Capture ' + capture.id + ' (' + capture.kind + '): ' + (capture.complete ? 'complete internal window (pre-tap output unobserved)' : 'INCOMPLETE — ' + capture.reason) + (capture.checkpointAtStop ? ' PRE-STOP age: ' + (capture.checkpointAtStop.ageSeconds ?? 'unavailable') + ' s. ' : ' ');
      const { channels, command, events, ...metadata } = capture;
      const add = (label, blob, extension) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); urls.push(link.href);
        link.download = 'signalsmith-capture-' + capture.id + extension;
        link.textContent = label + ' '; row.appendChild(link);
      };
      add('Metadata JSON', new Blob([JSON.stringify({ ...metadata, events,
        channelOrder: ['pre-gain left', 'pre-gain right', 'post-gain left', 'post-gain right'],
        eventsTruncated: events.length >= 500,
        lifecycleTruncated: capture.lifecycle.length >= 1000,
        note: 'Unknown PCM is NaN in the float WAV; inspect validRanges before listening or processing. Frame-indexed digital graph samples; device output and internal DSP positions are not measured.' }, null, 2)], { type: 'application/json' }), '.json');
      const audio = signalsmithDiagnostics.wav(capture);
      if (audio) add('4-channel float WAV', new Blob([audio], { type: 'audio/wav' }), '.wav');
      list.appendChild(row);
    }
  }
  panel.querySelector('button').onclick = refresh;
  window.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)));
  refresh();
})();
