import { createLibraryAnalysisPresentation } from '../../visual/library/library-analysis-view.js';

// Each view can inspect the one shared job, but never owns a separate queue.
export function createLibraryAnalysisControls(queue, report) {
  const view = createLibraryAnalysisPresentation();
  let targetSongId = null;
  const refresh = () => { if (view.dialog.open) view.render(queue.job, targetSongId !== null); };
  view.start.onclick = async () => {
    try { await queue.start(targetSongId); }
    catch (error) { view.showError(error.message); report(error.message); }
  };
  view.cancel.onclick = () => queue.cancel();
  view.close.onclick = () => view.dialog.close();
  queue.events.addEventListener('progress', refresh);
  return { open(id = null) { targetSongId = id; view.dialog.showModal(); refresh(); } };
}
