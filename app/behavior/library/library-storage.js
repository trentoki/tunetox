// Durable library only. No DOM, audio decoding, playback or second song cache.
// Metadata and source Blob commit atomically; hash IDs prevent cross-tab duplicates.
export function openLibraryStorage(name = 'tunetox-library-v1') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('songs', { keyPath: 'id' });
      db.createObjectStore('sources');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other TuneTox tabs to open library storage.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      function read(store, id) {
        return new Promise((done, fail) => {
          const tx = db.transaction(store, 'readonly');
          const query = id === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(id);
          query.onsuccess = () => done(query.result);
          query.onerror = () => fail(query.error);
        });
      }
      resolve({
        listSongs: () => read('songs'),
        getSong: id => read('songs', id),
        getSource: id => read('sources', id),
        addSong(song, source) {
          return new Promise((done, fail) => {
            const tx = db.transaction(['songs', 'sources'], 'readwrite');
            let added = false;
            const songs = tx.objectStore('songs'), existing = songs.get(song.id);
            // Keep dependent writes in the request callback: Safari can close a
            // transaction if arbitrary promises are awaited between its requests.
            existing.onsuccess = () => {
              if (existing.result) return;
              songs.add(song); tx.objectStore('sources').add(source, song.id); added = true;
            };
            tx.oncomplete = () => done(added);
            tx.onabort = () => fail(tx.error || new Error('Import transaction aborted.'));
          });
        },
        setVerifiedBpm(id, value) {
          return new Promise((done, fail) => {
            const tx = db.transaction('songs', 'readwrite'), store = tx.objectStore('songs');
            const request = store.get(id); let updated;
            request.onsuccess = () => {
              if (!request.result) { tx.abort(); return; }
              updated = { ...request.result, verifiedBpm: value, verifiedAt: value === null ? null : Date.now() };
              store.put(updated);
            };
            tx.oncomplete = () => done(updated);
            tx.onabort = () => fail(tx.error || new Error('Song not found or BPM could not be saved.'));
          });
        },
        close: () => db.close()
      });
    };
  });
}
