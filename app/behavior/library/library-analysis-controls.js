import { createLibraryAnalysisPresentation } from '../../visual/library/library-analysis-view.js';

// Global controls operate the one shared job and explicitly requested local export.
export function createLibraryAnalysisControls(queue, report, library) {
  const view = createLibraryAnalysisPresentation();
  let targetSongId = null, exportURL = null, exportGeneration = 0;
  const refresh = () => { if (view.dialog.open) view.render(queue.job, targetSongId !== null); };
  view.start.onclick = async () => {
    try { await queue.start(targetSongId); }
    catch (error) { view.showError(error.message); report(error.message); }
  };
  view.cancel.onclick = () => queue.cancel();
  view.exportButton.onclick = async () => {
    const request = ++exportGeneration;
    try {
      const data = await library.exportBpmResearch();
      if (request !== exportGeneration || !view.dialog.open) return;
      if (exportURL) { const old = exportURL; setTimeout(() => URL.revokeObjectURL(old), 30000); }
      exportURL = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      // A visible download link supplies a fresh user gesture on physical Safari.
      view.showExport(exportURL);
    } catch (error) { view.showError(error.message); report(error.message); }
  };
  view.close.onclick = () => view.dialog.close();
  view.dialog.addEventListener('close', () => {
    exportGeneration++; view.clearExport();
    if (exportURL) { const old = exportURL; exportURL = null; setTimeout(() => URL.revokeObjectURL(old), 30000); }
  });
  queue.events.addEventListener('progress', refresh);
  return { open(id = null) { targetSongId = id; view.dialog.showModal(); refresh(); } };
}
