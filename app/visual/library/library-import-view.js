// Global import chooser presentation only. Behavior owns all actions.
const make = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
export function createLibraryImportPresentation(host) {
  const group = make('div', undefined, 'global-library-controls');
  const importButton = make('button', 'Import'), analyzeButton = make('button', 'Analyze All');
  importButton.className = 'global-library-import'; analyzeButton.className = 'global-library-analyze';
  group.append(importButton, analyzeButton); host.append(group);
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
    importButton, analyzeButton, dialog, inputs, cancel, close, persist,
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
  };
}
