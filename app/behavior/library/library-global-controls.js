import { createLibraryImportPresentation } from '../../visual/library/library-import-view.js';
import { createLibraryAnalysisControls } from './library-analysis-controls.js';

// One global entry point for the shared import and analysis jobs. No deck action.
export function connectGlobalLibraryControls(host, library, queue, report) {
  const view = createLibraryImportPresentation(host);
  const analysis = createLibraryAnalysisControls(queue, report, library);
  const fail = error => { view.showError(error.message); report(error.message); };
  view.analyzeButton.onclick = () => analysis.open();
  view.importButton.onclick = () => { view.dialog.showModal(); view.showImportProgress(library.importJob); };
  view.close.onclick = () => view.dialog.close();
  view.cancel.onclick = () => library.cancelImport();
  view.inputs.forEach((input, index) => input.addEventListener('change', async () => {
    const files = [...input.files]; input.value = '';
    if (!files.length) return;
    try { await library.importFiles(files, { playlist: index === 1 }); } catch (error) { fail(error); }
  }));
  view.persist.onclick = async () => {
    try { view.showStorage(navigator.storage?.persist ? (await navigator.storage.persist() ? 'Persistence granted. Keep your originals.' : 'Persistence not granted; browser data may be evicted.') : 'Persistent storage requests unavailable.'); }
    catch (error) { fail(error); }
  };
  library.events.addEventListener('progress', () => view.showImportProgress(library.importJob));
}
