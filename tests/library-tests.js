import { checkLibraryDeckLoading } from './library-deck-loading-tests.js';
import { openLibraryStorage } from '../app/behavior/library/library-storage.js';
import { createLibraryManagement } from '../app/behavior/library/library-management.js';

const assert = (value, message) => { if (!value) throw Error(message); };
document.querySelector('#run').onclick = async () => {
  const output = document.querySelector('#results'); output.textContent = ''; output.dataset.result = 'running';
  const pass = text => output.textContent += 'PASS ' + text + '\n';
  const name = 'tunetox-library-test-' + crypto.randomUUID();
  let db, reopened;
  try {
    db = await openLibraryStorage(name); const library = createLibraryManagement(Promise.resolve(db));
    const one = new File(['one waveform fixture'], 'Artist - First.wav', { type: 'audio/wav' });
    const duplicate = new File(['one waveform fixture'], 'Renamed.wav', { type: 'audio/wav' });
    const other = new File(['second waveform fixture'], '<b>Second</b>.wav', { type: 'audio/wav' });
    Object.defineProperty(other, 'webkitRelativePath', { value: 'Folder/Nested/Second.wav' });
    let result = await library.importFiles([one, duplicate, other, new File(['sidecar'], 'notes.txt'), new File([], 'empty.wav')]);
    assert(result.added === 2 && result.duplicates === 1 && result.skipped === 1 && result.failures.length === 1, 'Import counters/failure isolation');
    let songs = await library.listSongs();
    assert(songs.length === 2 && songs.some(s => s.relativePath.startsWith('Folder/Nested/')), 'Folder metadata missing');
    const first = songs.find(s => s.title === 'First');
    assert(first.artist === 'Artist' && await (await library.getSource(first.id)).text() === await one.text(), 'Source/metadata round trip');
    pass('multiple files, nested folder paths, content duplicate detection, skipped sidecars and individual empty-file failure');
    await library.setVerifiedBpm(first.id, 120.5);
    await library.importFiles([duplicate]);
    assert((await library.getSong(first.id)).verifiedBpm === 120.5, 'Duplicate overwrote verified BPM');
    assert((await library.listSongs({ query: 'artist' })).length === 1 && (await library.listSongs({ query: 'nested' })).length === 1, 'Search failed');
    assert((await library.listSongs({ sort: 'verifiedBpm' }))[0].id === first.id, 'BPM sort unknown ordering');
    let rejected = false; try { await library.setVerifiedBpm(first.id, NaN); } catch { rejected = true; }
    assert(rejected && (await library.getSong(first.id)).verifiedBpm === 120.5, 'Invalid BPM changed metadata');
    pass('search, numeric sorting, immutable duplicate metadata and validated manual BPM');
    db.close(); reopened = await openLibraryStorage(name);
    const restored = createLibraryManagement(Promise.resolve(reopened));
    assert((await restored.listSongs()).length === 2 && (await restored.getSong(first.id)).verifiedBpm === 120.5 && (await restored.getSource(first.id)).size === one.size, 'Restart lost data');
    pass('database close/reopen retains source files, metadata and verified BPM');
    let cancelled = false;
    const cancel = () => { if (restored.importJob.running && restored.importJob.processed === 1) { cancelled = true; restored.cancelImport(); } };
    restored.events.addEventListener('progress', cancel);
    result = await restored.importFiles([new File(['three'], 'three.wav'), new File(['four'], 'four.wav')]);
    restored.events.removeEventListener('progress', cancel);
    assert(cancelled && result.processed === 1 && result.added === 1 && !result.running, 'Import cancellation failed');
    pass('sequential import cancellation retains completed files and stops remaining files');
    const noSpace = createLibraryManagement(Promise.resolve({ addSong: async () => { throw new DOMException('Full', 'QuotaExceededError'); } }));
    result = await noSpace.importFiles([one, other]);
    assert(result.failures.length === 2 && result.failures.every(f => f.message.includes('storage is full')), 'Quota failure reporting');
    pass('per-file quota failure reporting and batch guard recovery');
    let open; const pendingStorage = new Promise(resolve => { open = resolve; });
    const guarded = createLibraryManagement(pendingStorage); const pendingImport = guarded.importFiles([one]);
    let overlapRejected = false; try { await guarded.importFiles([other]); } catch { overlapRejected = true; }
    open(reopened); await pendingImport;
    assert(overlapRejected, 'Overlapping imports accepted while database opening');
    pass('one import guard across shared views, including asynchronous database opening');
    await restored.importFiles([other, duplicate], { playlist: true });
    const folders = await restored.listPlaylists(), members = await restored.listMemberships();
    assert(folders.length === 2 && folders.find(p => p.name === 'Nested').parentId === folders.find(p => p.name === 'Folder').id, 'Nested playlist hierarchy');
    assert(members.length === 1 && members[0].songId === songs.find(s => s.title.includes('Second')).id, 'Duplicate folder import did not reference canonical song');
    assert((await restored.listSongs()).length === 3, 'Playlist duplicated song records');
    pass('folder import creates nested playlists referencing existing songs without duplicating metadata or audio');
    const otherId = songs.find(s => s.id !== first.id).id;
    await restored.setSongLink(first.id, otherId, true); await restored.setSongLink(otherId, first.id, true);
    assert((await restored.getLinkedSongIds(first.id))[0] === otherId && (await restored.getLinkedSongIds(otherId))[0] === first.id && (await reopened.listLinks()).length === 1, 'Bidirectional link identity');
    await restored.setPlaylistMembership(first.id, folders[0].id, true); await restored.setPlaylistMembership(first.id, folders[1].id, true);
    await restored.setPlaylistMembership(first.id, folders[0].id, false);
    assert((await restored.listMemberships()).filter(m => m.songId === first.id).length === 1 && (await restored.getLinkedSongIds(first.id)).length === 1, 'Independent relationships');
    await restored.setSongLink(first.id, otherId, false);
    let selfRejected = false; try { await restored.setSongLink(first.id, first.id, true); } catch { selfRejected = true; }
    let missingRejected = false; try { await restored.setPlaylistMembership('missing', folders[0].id, true); } catch { missingRejected = true; }
    assert(selfRejected && missingRejected && !(await restored.getLinkedSongIds(first.id)).length, 'Invalid relationship handling');
    pass('reciprocal unique links, membership addition/removal, independent relationships and invalid references');
    await checkLibraryDeckLoading(restored);
    pass('stored songs load directly onto all four persistent decks; playing deck queues; occupied queue and controls preserved');
    output.dataset.result = 'pass';
  } catch (error) { output.textContent += 'FAIL ' + error.stack; output.dataset.result = 'fail'; }
  finally {
    db?.close(); reopened?.close(); indexedDB.deleteDatabase(name);
  }
};
