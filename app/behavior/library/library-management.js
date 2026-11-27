import { V40_DETECTOR_ID } from '../../audio/analysis/v40-bpm.js';
import { openLibraryStorage } from './library-storage.js';

const audioExtension = /\.(wav|wave|mp3|m4a|mp4|aac|aif|aiff|flac|ogg|oga|opus|webm)$/i;
const compare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function matchesLibrarySong(song, query) {
  const text = query.toLocaleLowerCase().trim();
  return !text || [song.title, song.artist, song.filename, song.relativePath, song.verifiedBpm ?? '', song.detectedBpm ?? '', song.key ?? '']
    .some(value => String(value).toLocaleLowerCase().includes(text));
}

// One shared service for all library panels. IndexedDB is the canonical song
// collection; per-view Behavior owns browsing only. Decoded audio is never stored here.
export function createLibraryManagement(storage = openLibraryStorage()) {
  const events = new EventTarget();
  const job = { running: false, cancelRequested: false, total: 0, processed: 0, added: 0, duplicates: 0, skipped: 0, failures: [], current: '' };
  const notify = type => events.dispatchEvent(new Event(type));
  async function listSongs({ query = '', sort = 'title', descending = false } = {}) {
    const db = await storage;
    const [records, results] = await Promise.all([db.listSongs(), db.listAnalysisResults()]);
    const baseline = new Map(results.filter(result => result.detectorId === V40_DETECTOR_ID).map(result => [result.songId, result]));
    // Derived query rows only: durable song fields and detector results each have
    // one authoritative store. Verified BPM wins display sorting when supplied.
    const all = records.map(song => {
      const detectedBpm = baseline.get(song.id)?.bpm ?? null;
      return { ...song, detectedBpm, displayBpm: song.verifiedBpm ?? detectedBpm };
    }), text = query.toLocaleLowerCase().trim();
    const songs = all.filter(song => matchesLibrarySong(song, text));
    if (sort === 'verifiedBpm') sort = 'displayBpm';
    const key = ['displayBpm', 'title', 'artist', 'verifiedBpm', 'key', 'addedAt'].includes(sort) ? sort : 'title';
    return songs.sort((a, b) => {
      const left = a[key], right = b[key];
      if (left === null || left === undefined) return right === null || right === undefined ? compare.compare(a.title, b.title) : 1;
      if (right === null || right === undefined) return -1;
      const difference = typeof left === 'number' ? left - right : compare.compare(left, right);
      return difference ? difference * (descending ? -1 : 1) : compare.compare(a.title, b.title);
    });
  }
  return {
    ready: storage,
    events, importJob: job, listSongs,
    async exportBpmResearch() {
      const db = await storage;
      const [songs, results] = await Promise.all([db.listSongs(), db.listAnalysisResults()]);
      const measurements = [], bySong = new Map();
      for (const result of results) {
        if (!bySong.has(result.songId)) bySong.set(result.songId, []);
        bySong.get(result.songId).push(result);
      }
      for (const song of songs) {
        const detected = bySong.get(song.id) || [];
        for (const result of detected.length ? detected : [null]) {
          const detectedBpm = result?.bpm ?? null, verifiedBpm = song.verifiedBpm ?? null;
          measurements.push({ title: song.title, detectorVersion: result?.detectorId ?? null,
            detectedBpm, verifiedBpm,
            difference: detectedBpm !== null && verifiedBpm !== null ? Number((detectedBpm - verifiedBpm).toFixed(6)) : null });
        }
      }
      // Explicit field allowlist: no source Blob, paths, IDs, links, playlists or
      // regenerable measurements. JSON preserves exact titles without spreadsheet
      // formula interpretation. Each detector version remains a separate row.
      return { formatVersion: 1, measurements };
    },
    async getAnalysisResults(songId) {
      const results = await (await storage).listAnalysisResults();
      return songId ? results.filter(result => result.songId === songId) : results;
    },
    async saveAnalysisResult(result) {
      if (!result.songId || !result.detectorId || (result.bpm !== null && (!Number.isFinite(result.bpm) || result.bpm <= 0))) throw new Error('Invalid analysis result.');
      await (await storage).saveAnalysisResult({ ...result, id: result.songId + ':' + result.detectorId });
      notify('change');
    },
    async getLinkedSongIds(id) {
      if (!id) return [];
      return (await (await storage).listLinks()).filter(link => link.a === id || link.b === id).map(link => link.a === id ? link.b : link.a);
    },
    async setSongLink(id, otherId, present) {
      if (id === otherId) throw new Error('A song cannot link to itself.');
      const [a, b] = [id, otherId].sort();
      await (await storage).setRelationship('links', { id: a + ':' + b, a, b }, present, [['songs', a], ['songs', b]]);
      notify('change');
    },
    async setPlaylistMembership(songId, playlistId, present) {
      await (await storage).setRelationship('memberships', { id: playlistId + ':' + songId, playlistId, songId }, present, [['songs', songId], ['playlists', playlistId]]);
      notify('change');
    },
    async listPlaylists() { return (await storage).listPlaylists(); },
    async listMemberships() { return (await storage).listMemberships(); },
    async getSong(id) { return (await storage).getSong(id); },
    async getSource(id) {
      const source = await (await storage).getSource(id);
      if (!(source instanceof Blob)) throw new Error('Stored audio is unavailable. Reimport the original file.');
      return source;
    },
    async setVerifiedBpm(id, value) {
      if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 1000))
        throw new RangeError('Verified BPM must be above 0 and at most 1000, or blank.');
      await (await storage).setVerifiedBpm(id, value); notify('change');
    },
    cancelImport() { if (job.running) { job.cancelRequested = true; notify('progress'); } },
    async importFiles(files, { playlist = false } = {}) {
      if (job.running) throw new Error('An import is already running.');
      if (!globalThis.crypto?.subtle) throw new Error('Import requires HTTPS or localhost for content-based duplicate checking.');
      job.running = true; // Claim synchronously, including while IndexedDB opens.
      let db;
      try { db = await storage; }
      catch (error) { job.running = false; notify('progress'); throw error; }
      Object.assign(job, { running: true, cancelRequested: false, total: files.length, processed: 0, added: 0, duplicates: 0, skipped: 0, failures: [], current: '' });
      notify('progress');
      // Each folder import is a distinct playlist tree. Duplicate audio remains shared.
      const folders = new Map();
      async function foldersFor(file) {
        const names = (file.webkitRelativePath || '').split('/').slice(0, -1).filter(Boolean);
        if (!playlist || !names.length) return null;
        let parentId = null, path = '';
        const records = [], pending = new Map();
        for (const name of names) {
          path += '/' + name;
          if (!folders.has(path) && !pending.has(path)) {
            const item = { id: crypto.randomUUID(), name, parentId };
            pending.set(path, item); records.push(item);
          }
          parentId = (folders.get(path) || pending.get(path)).id;
        }
        if (records.length) {
          await db.savePlaylists(records);
          for (const [path, item] of pending) folders.set(path, item);
        }
        return parentId;
      }
      try {
        // FileList references only; read/hash/store exactly one source at a time.
        for (const file of files) {
          if (job.cancelRequested) break;
          job.current = file.name; notify('progress');
          try {
            if (!file.type.startsWith('audio/') && !audioExtension.test(file.name)) { job.skipped++; continue; }
            if (!file.size) throw new Error('Empty audio file.');
            const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
            if (job.cancelRequested) break;
            const id = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
            const raw = file.name.replace(/\.[^.]+$/, ''), parts = raw.split(' - ');
            const artist = parts.length > 1 ? parts.shift().trim() : '';
            const song = { version: 1, id, filename: file.name, title: parts.join(' - ').trim() || raw, artist,
              relativePath: file.webkitRelativePath || '', size: file.size, type: file.type,
              addedAt: Date.now(), verifiedBpm: null, verifiedAt: null, key: null };
            if (await db.addSong(song, file)) job.added++; else job.duplicates++;
            const playlistId = await foldersFor(file);
            if (playlistId) await db.addMemberships([{ id: playlistId + ':' + id, playlistId, songId: id }]);
          } catch (error) {
            job.failures.push({ filename: file.name, message: error.name === 'QuotaExceededError' ? 'Browser storage is full; this file was not imported.' : error.message });
          } finally { job.processed++; notify('progress'); }
        }
      } finally { job.running = false; job.current = ''; notify('progress'); notify('change'); }
      return job;
    }
  };
}
