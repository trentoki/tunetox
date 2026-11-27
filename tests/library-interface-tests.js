import { openLibraryStorage } from '../app/behavior/library/library-storage.js';
const frame = document.querySelector('#application'), output = document.querySelector('#results');
const assert = (value, message) => { if (!value) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message) {
  for (let i = 0; i < 600; i++) { if (await test()) return; await delay(25); }
  throw Error(message);
}
function tone(win, name, frequency) {
  const rate = 8000, count = rate * 30, bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes);
  const text = (at, value) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * frequency / rate) * 1000, true);
  return new win.File([bytes], name, { type: 'audio/wav' });
}
document.querySelector('#run').onclick = async () => {
  output.dataset.result = 'running'; output.textContent = ''; document.querySelector('#run').disabled = true;
  const pass = message => output.textContent += 'PASS ' + message + '\n';
  const dbName = 'tunetox-library-interface-test-' + crypto.randomUUID();
  let win, doc, players = [], store;
  try {
    const source = await (await fetch('../tunetox.html')).text();
    const prefix = '<base href="' + new URL('../', location.href).href + '"><script>' +
      'window.__players=[];const Native=EventTarget;window.EventTarget=class extends Native{constructor(){super();queueMicrotask(()=>{if("currentTime" in this)__players.push(this);});}};' +
      'const originalOpen=indexedDB.open.bind(indexedDB);indexedDB.open=(name,version)=>originalOpen(name==="tunetox-library-v1"?' + JSON.stringify(dbName) + ':name,version);<\/script>';
    async function load() {
      frame.srcdoc = source.replace('<head>', '<head>' + prefix);
      await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
      win = frame.contentWindow; doc = frame.contentDocument;
      await until(() => win.__players.length === 4 && doc.querySelectorAll('.library-import-dialog input[type=file]').length === 8, 'Application did not mount');
      players = win.__players;
    }
    await load(); store = await openLibraryStorage(dbName);
    const deck = index => doc.querySelectorAll('.deck')[index];
    const library = index => deck(index).querySelector('.library-view');
    function open(index) { deck(index).querySelector('.library-button').click(); }
    function back(index) { deck(index).querySelector('.back-to-performance-button').click(); }
    async function rows(index, count) { await until(() => library(index).querySelectorAll('[data-song-id]').length === count, 'Library row count ' + index + '/' + count); }
    async function importFiles(files, folder = false) {
      library(0).querySelector('.library-import-button').click();
      const dialog = doc.querySelector('dialog[open]');
      const input = dialog.querySelectorAll('input[type=file]')[folder ? 1 : 0], transfer = new win.DataTransfer();
      files.forEach(file => transfer.items.add(file)); input.files = transfer.files; input.dispatchEvent(new win.Event('change', { bubbles: true }));
      await delay(20);
      await until(() => dialog.querySelector('button').disabled && !dialog.querySelector('input').disabled, 'Import did not finish');
      const progress = dialog.querySelector('[role=status]').textContent;
      [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Close').click();
      return progress;
    }
    open(0); await rows(0, 0);
    const first = tone(win, 'Zed - Alpha.wav', 220), second = tone(win, 'Amy - Beta.wav', 330);
    const duplicate = new win.File([await first.arrayBuffer()], 'Renamed.wav', { type: 'audio/wav' });
    let progress = await importFiles([first, second, duplicate]); await rows(0, 2);
    assert(progress.includes('2 imported') && progress.includes('1 duplicates') && players.every(player => player.readyState === 0), 'Import loaded a deck or lost duplicates');
    for (let i = 1; i < 4; i++) { open(i); await rows(i, 2); }
    const initial = await store.listSongs();
    assert(initial.every(song => song.verifiedBpm === null && song.key === null), 'Unknown BPM/key invented');
    pass('existing four Library views share persistent imports; renamed duplicates skipped; importing leaves decks empty; BPM/key unknown');
    const getRow = (index, text) => [...library(index).querySelectorAll('[data-song-id]')].find(row => row.textContent.includes(text));
    getRow(0, 'Alpha').click(); library(0).querySelector('.send-to-deck-one').click();
    await until(() => players[0].readyState === 2 && !deck(0).querySelector('.play-pause-button').disabled, 'Numbered load failed');
    back(0); deck(0).querySelector('.play-pause-button').click();
    await until(() => !players[0].paused && players[0].currentTime > .05, 'Play/clock failed');
    const playingSource = players[0].src, position = players[0].currentTime;
    open(0);
    const third = tone(win, 'Mia - Gamma.wav', 440);
    Object.defineProperty(third, 'webkitRelativePath', { value: 'Music/Nested/Mia - Gamma.wav' });
    progress = await importFiles([third, duplicate], true);
    await rows(0, 3); await rows(1, 3); await rows(2, 3); await rows(3, 3);
    assert(progress.includes('1 imported') && progress.includes('1 duplicates') && players[0].src === playingSource && !players[0].paused && players[0].currentTime > position,
      'Subsequent/folder import replaced collection or interrupted playback: ' + JSON.stringify({progress, sameSource:players[0].src===playingSource, paused:players[0].paused, before:position, after:players[0].currentTime}));
    pass('second nested-folder batch adds to collection; no source, position or playback interruption');
    library(0).querySelectorAll('.section-selector button')[1].click();
    await until(() => library(0).querySelectorAll('.library-playlist').length === 1, 'Root playlist missing');
    library(0).querySelector('.library-playlist').click();
    await until(() => library(0).querySelectorAll('.library-playlist').length === 2, 'Nested playlist missing');
    library(0).querySelectorAll('.library-playlist')[1].click(); await rows(0, 1);
    assert(getRow(0, 'Gamma') && library(0).querySelectorAll('[aria-expanded=true]').length === 2, 'Inline expansion lost parent');
    library(1).querySelectorAll('.section-selector button')[1].click();
    await until(() => library(1).querySelectorAll('.library-playlist').length === 1, 'Independent playlist browsing');
    assert(!library(1).querySelector('[aria-expanded=true]'), 'Expansion leaked across decks');
    library(0).querySelectorAll('.section-selector button')[0].click();
    library(1).querySelectorAll('.section-selector button')[0].click(); await rows(0, 3); await rows(1, 3);
    pass('inline nested playlist expansion retains multiple open levels and independent per-deck browsing');
    const search = library(0).querySelector('.search'); search.value = 'Alpha'; search.dispatchEvent(new win.Event('input', { bubbles: true }));
    await rows(0, 1); await rows(1, 3);
    assert(!library(1).querySelector('[aria-pressed=true][data-song-id]'), 'Selection shared across views');
    search.value = ''; search.dispatchEvent(new win.Event('input', { bubbles: true })); await rows(0, 3);
    library(0).querySelectorAll('.song-sort-selector button')[3].click();
    await until(() => library(0).querySelector('[data-song-id] .song-title').textContent === 'Beta', 'Artist sort');
    library(0).querySelectorAll('.song-sort-selector button')[0].click();
    await until(() => library(0).querySelector('[data-song-id] .song-title').textContent === 'Alpha', 'Title sort');
    // Manually supplied metadata fixture, not inferred from filenames/audio.
    const meta = await store.listSongs(), beta = meta.find(song => song.title === 'Beta'); await store.setVerifiedBpm(beta.id, 120);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName); request.onsuccess = () => {
        const db = request.result, tx = db.transaction('songs', 'readwrite'), source = tx.objectStore('songs'), get = source.get(beta.id);
        get.onsuccess = () => source.put({ ...get.result, key: 'C minor' });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
      }; request.onerror = () => reject(request.error);
    });
    library(0).querySelectorAll('.song-sort-selector button')[1].click();
    await until(() => library(0).querySelector('[data-song-id] .song-title').textContent === 'Beta', 'BPM sort unknown last');
    library(0).querySelectorAll('.song-sort-selector button')[2].click();
    await until(() => library(0).querySelector('[data-song-id] .song-title').textContent === 'Beta', 'Key sort unknown last');
    function slide(strip, from, to) {
      const buttons = strip.querySelectorAll('button');
      const point = i => { const box = buttons[i].getBoundingClientRect(); return {clientX:box.x + box.width / 2, clientY:box.y + box.height / 2}; };
      strip.dispatchEvent(new win.PointerEvent('pointerdown', {...point(from), pointerId: 31, isPrimary:true, button:0, bubbles:true, cancelable:true}));
      const step = to > from ? 1 : -1;
      for (let i = from + step; step > 0 ? i <= to : i >= to; i += step)
        strip.dispatchEvent(new win.PointerEvent('pointermove', {...point(i), pointerId:31, isPrimary:true, bubbles:true}));
      strip.dispatchEvent(new win.PointerEvent('pointerup', {...point(to), pointerId:31, isPrimary:true, bubbles:true}));
    }
    slide(library(0).querySelector('.song-sort-selector'), 0, 3);
    await until(() => library(0).querySelectorAll('.song-sort-selector button')[3].getAttribute('aria-pressed') === 'true', 'Continuous sort slide');
    slide(library(0).querySelector('.section-selector'), 0, 2);
    await until(() => library(0).querySelectorAll('.section-selector button')[2].getAttribute('aria-pressed') === 'true', 'Continuous Library navigation slide');
    assert(library(1).querySelectorAll('.section-selector button')[0].getAttribute('aria-pressed') === 'true', 'Navigation slide affected another deck');
    library(0).querySelectorAll('.section-selector button')[0].click(); await rows(0, 3);
    pass('continuous pointer sliding across organization/content controls; independent deck choices');
    pass('independent search/selection; Title/Artist/BPM/Key sorting; supplied values sort ahead of unknown values');
    getRow(0, 'Alpha').click();
    [...library(0).querySelectorAll('.library-import-button')].find(b => b.textContent === 'Manage').click();
    const manage = doc.querySelector('.library-manage-dialog[open]');
    await until(() => manage.querySelectorAll('[data-link-song-id]').length === 2, 'Manage songs missing');
    const betaId = meta.find(s => s.title === 'Beta').id, alphaId = meta.find(s => s.title === 'Alpha').id;
    const link = manage.querySelector('[data-link-song-id="' + betaId + '"]'); link.click();
    await until(async () => (await store.listLinks()).length === 1, 'Link was not saved');
    const folders = await store.listPlaylists();
    for (const folder of folders) {
      await until(() => manage.querySelector('[data-membership-id="' + folder.id + '"]'), 'Membership row missing');
      manage.querySelector('[data-membership-id="' + folder.id + '"]').click();
      await until(async () => (await store.listMemberships()).some(m => m.songId === alphaId && m.playlistId === folder.id), 'Membership not saved');
    }
    assert((await store.listMemberships()).filter(m => m.songId === alphaId).length === 2, 'Adding membership removed another');
    manage.querySelector('[data-membership-id="' + folders[0].id + '"]').click();
    await until(async () => (await store.listMemberships()).filter(m => m.songId === alphaId).length === 1, 'Individual membership removal failed');
    assert((await store.listLinks()).length === 1, 'Membership altered links');
    [...manage.querySelectorAll('button')].find(b => b.textContent === 'Close').click();
    library(0).querySelectorAll('.section-selector button')[2].click(); await rows(0, 1);
    assert(getRow(0, 'Beta'), 'Links does not follow loaded Alpha');
    library(1).querySelectorAll('.section-selector button')[2].click(); await rows(1, 0);
    library(0).querySelectorAll('.section-selector button')[0].click(); await rows(0, 3);
    library(1).querySelectorAll('.section-selector button')[0].click(); await rows(1, 3);
    pass('single-song Manage saves independent links/memberships; Links follows loaded song rather than library selection');
    function drop(row, target) {
      const transfer = new win.DataTransfer();
      row.dispatchEvent(new win.DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new win.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new win.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }
    drop(getRow(0, 'Beta'), library(0).querySelector('.send-to-deck-two'));
    await until(() => players[1].readyState === 2 && deck(1).querySelector('.song-title').textContent.includes('Beta'), 'Numbered drop');
    library(1).querySelectorAll('.section-selector button')[2].click(); await rows(1, 1);
    assert(getRow(1, 'Alpha') && players[1].paused, 'Reciprocal Links does not follow paused loaded Beta');
    library(1).querySelectorAll('.section-selector button')[0].click(); await rows(1, 3);
    back(2); drop(getRow(0, 'Gamma'), deck(2).querySelector('.waveform-overview'));
    await until(() => players[2].readyState === 2 && deck(2).querySelector('.song-title').textContent.includes('Gamma'), 'Overview drop');
    back(3); drop(getRow(0, 'Beta'), deck(3).querySelector('.queue-button'));
    await until(() => deck(3).querySelector('.queue-button').textContent === 'READY', 'Empty paused Queue drop');
    assert(players[3].readyState === 0 && players[3].paused, 'Queue drop loaded or started deck');
    drop(getRow(0, 'Gamma'), deck(3).querySelector('.queue-button'));
    await until(() => doc.querySelector('#playback-status').textContent.includes('queue occupied'), 'Occupied Queue feedback');
    assert(deck(3).querySelector('.queue-button').title.includes('Beta') && players[0].src === playingSource && !players[0].paused, 'Queue overwritten/peer interrupted');
    back(0); drop(getRow(1, 'Beta'), deck(0).querySelector('.waveform-overview'));
    await until(() => deck(0).querySelector('.queue-button').textContent === 'READY', 'Playing overview drop should queue');
    assert(players[0].src === playingSource && !players[0].paused, 'Playing overview drop replaced source');
    pass('numbered-button, overview and explicit Queue drops reuse existing paused/playing/occupied rules');
    await Promise.all(players.map(player => win.eval("import('/app/audio/deck-audio.js')").then(audio => audio.ejectAudio(player))));
    await load(); open(0); await rows(0, 3);
    assert([...library(0).querySelectorAll('[data-song-id]')].some(row => row.textContent.includes('120 BPM') && row.textContent.includes('C minor')),
      'Reload lost persistent collection or supplied metadata');
    assert(players.every(player => player.readyState === 0), 'Library restoration loaded a deck');
    pass('application reload restores songs and supplied BPM/key without loading or recreating performance state');
    output.dataset.result = 'pass';
  } catch (error) { output.textContent += 'FAIL ' + error.stack; output.dataset.result = 'fail'; }
  finally {
    if (win) { const audio = await win.eval("import('/app/audio/deck-audio.js')"); await Promise.all(players.map(player => audio.ejectAudio(player))); }
    store?.close(); frame.src = 'about:blank'; frame.removeAttribute('srcdoc');
    await delay(50); indexedDB.deleteDatabase(dbName); document.querySelector('#run').disabled = false;
  }
};
