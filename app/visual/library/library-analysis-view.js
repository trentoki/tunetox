// Presentation of the shared analysis job; no scheduling, decoding or cancellation
// decisions. Opening/closing this transient dialog never creates another job.
export function createLibraryAnalysisPresentation() {
  const dialog = document.createElement('dialog'); dialog.className = 'library-import-dialog library-analysis-dialog';
  const title = document.createElement('h2'); title.textContent = 'BPM analysis · V40 original v1';
  const note = document.createElement('p'); note.textContent = 'Sequential reference analysis. Known inaccuracies remain; verified BPM and playback are unchanged.';
  const progress = document.createElement('p'); progress.setAttribute('role', 'status');
  const failures = document.createElement('ul');
  const start = document.createElement('button'), cancel = document.createElement('button'), close = document.createElement('button');
  cancel.textContent = 'Cancel analysis'; close.textContent = 'Close';
  dialog.append(title, note, progress, failures, start, cancel, close); document.body.append(dialog);
  return {
    dialog, start, cancel, close,
    showError(message) { progress.textContent = message; },
    render(job, individual) {
      start.textContent = individual ? 'Analyze selected song' : 'Analyze entire library';
      start.disabled = job.running; cancel.disabled = !job.running || job.cancelRequested;
      progress.textContent = job.running ? `${job.processed}/${job.total} · ${job.current}${job.cancelRequested ? ' · stopping after decode…' : ''}`
        : `${job.processed}/${job.total} processed · ${job.succeeded} detected · ${job.failures.length} failed${job.cancelRequested ? ' · cancelled' : ''}`;
      failures.replaceChildren(...job.failures.map(failure => {
        const item = document.createElement('li'); item.textContent = failure.title + ': ' + failure.message; return item;
      }));
    }
  };
}
