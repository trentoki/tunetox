// Explicit, session-local opt-in. Neither Normal nor SoundTouch controls use this panel.
(() => {
  const panel = document.createElement('section');
  panel.innerHTML = '<h2>Signalsmith Safari context experiment</h2>' +
    '<label><input type="checkbox"> Keep one running AudioContext (experimental; default off)</label> ' +
    '<button type="button">Shut down Signalsmith engine</button><p role="status"></p>';
  document.body.appendChild(panel);
  const input = panel.querySelector('input');
  const shutdown = panel.querySelector('button');
  const status = panel.querySelector('p');
  let pending = false;
  let failure = '';
  function refresh() {
    const state = signalsmithPlayer.getState();
    input.checked = state.persistentContext;
    input.disabled = pending || state.loaded || state.loading || state.closureBlocked;
    shutdown.disabled = pending || state.engineShutDown;
    status.textContent = failure || (state.persistentContext ? 'Persistent context enabled. ' : 'Control: recreate context. ') +
      'Context ID: ' + (state.contextId ?? 'none') + '. ' + (state.closureStatus || 'Eject before switching.');
  }
  input.onchange = async () => {
    const enabled = input.checked;
    pending = true; failure = ''; refresh();
    try { await signalsmithPlayer.setPersistentContext(enabled); }
    catch (error) { failure = error.message; }
    finally { pending = false; refresh(); }
  };
  shutdown.onclick = async () => {
    pending = true; failure = ''; refresh();
    try { await signalsmithPlayer.shutdown(); }
    catch (error) { failure = error.message; }
    finally { pending = false; refresh(); }
  };
  window.addEventListener('pagehide', () => { void signalsmithPlayer.shutdown().catch(() => {}); });
  setInterval(refresh, 100);
  refresh();
})();
