// Test-only compatibility pickers for transport regression fixtures. They are
// detached from the production UI and use global Import + numbered destinations.
// Frames must remap the database before application startup; no personal library
// is read or changed. Renamed generated WAVs get an ignored trailing test tag so
// content deduplication does not collapse deliberately distinct test resources.
export function libraryTestStorageScript(name, isolatePreferences = true) {
  const preferences = isolatePreferences ? 'const preferences=new Map(),readPreference=Storage.prototype.getItem,writePreference=Storage.prototype.setItem;Storage.prototype.getItem=function(k){return k==="tunetox-settings-v1"?(preferences.get(k)||null):readPreference.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==="tunetox-settings-v1")preferences.set(k,v);else writePreference.call(this,k,v)};' : '';
  return '<script>'+preferences+'const libraryOpen=indexedDB.open.bind(indexedDB);indexedDB.open=(n,v)=>libraryOpen(n==="tunetox-library-v1"?' + JSON.stringify(name) + ':n,v);<\/script>';
}
export function createLibraryLoadingFixtures(win, doc) {
  let pending = Promise.resolve();
  const inputs = Array.from({ length: 4 }, (_, index) => {
    const input = doc.createElement('input'); input.type = 'file';
    input.addEventListener('change', () => {
      const original = input.files[0]; if (!original) return;
      input.disabled = true;
      pending = pending.then(async () => {
        const file = new win.File([original, new TextEncoder().encode(original.name)], original.name, {type:original.type});
        const title = original.name.replace(/\.[^.]+$/, '');
        doc.querySelector('.global-library-import').click();
        const dialog = doc.querySelector('.library-import-dialog[open]'), picker = dialog.querySelector('input');
        const transfer = new win.DataTransfer(); transfer.items.add(file); picker.files = transfer.files;
        picker.dispatchEvent(new win.Event('change', {bubbles:true}));
        await new Promise(resolve => setTimeout(resolve, 0));
        await wait(() => !picker.disabled && dialog.textContent.includes('1 imported'), 'Fixture import');
        [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Close').click();
        const deck = doc.querySelectorAll('.deck')[index], library = deck.querySelector('.library-view');
        const wasVisible = !library.hidden && library.getClientRects().length > 0;
        if (!wasVisible) deck.querySelector('.library-button').click();
        library.querySelectorAll('.section-selector button')[0].click();
        const search = library.querySelector('.search'); search.value = title; search.dispatchEvent(new win.Event('input'));
        await wait(() => [...library.querySelectorAll('.search-result')].some(row => row.querySelector('.song-title')?.textContent === title), 'Fixture row');
        [...library.querySelectorAll('.search-result')].find(row => row.querySelector('.song-title')?.textContent === title).click();
        doc.querySelector('#playback-status').textContent = '';
        library.querySelectorAll('.library-content > div:last-child > div button')[index].click();
        await wait(() => deck.querySelector('.song-title').textContent === original.name || deck.querySelector('.queue-button').title === original.name || doc.querySelector('#playback-status').textContent.includes('failed') || doc.querySelector('#playback-status').textContent.includes('queue occupied'), 'Fixture deck action');
        if (!wasVisible) deck.querySelector('.back-to-performance-button').click();
      }).finally(() => { input.disabled = false; });
      input.fixtureCompletion = pending;
      pending.catch(error => console.error(error));
    });
    return input;
  });
  async function wait(test, label) {
    for (let i=0;i<800;i++) { if (test()) return; await new Promise(resolve=>setTimeout(resolve,10)); }
    throw Error(label + ' timed out');
  }
  return inputs;
}
