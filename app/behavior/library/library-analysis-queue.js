import { analyzeLibraryAudio, V40_DETECTOR_ID } from '../../audio/analysis/library-audio-analysis.js';

// One shared sequential analysis job, independent of all deck playback Queues.
// The job owns progress only; storage owns results. Cancellation never changes
// verified BPM, previous results or a currently playing source.
export function createLibraryAnalysisQueue(library, analyze = analyzeLibraryAudio) {
  const events = new EventTarget();
  const job = { running: false, cancelRequested: false, total: 0, processed: 0, succeeded: 0, current: '', failures: [] };
  let controller;
  const notify = () => events.dispatchEvent(new Event('progress'));
  return {
    events, job,
    cancel() { if (job.running) { job.cancelRequested = true; controller?.abort(); notify(); } },
    async start(songId = null) {
      if (job.running) throw new Error('A library analysis job is already running.');
      Object.assign(job, { running: true, cancelRequested: false, total: 0, processed: 0, succeeded: 0, current: '', failures: [] });
      controller = new AbortController(); notify();
      try {
        const songs = songId ? [await library.getSong(songId)] : await library.listSongs();
        if (songs.some(song => !song)) throw new Error('Song is unavailable.');
        job.total = songs.length; notify();
        for (const song of songs) {
          if (job.cancelRequested) break;
          job.current = song.title; notify();
          try {
            const result = await analyze(await library.getSource(song.id), controller.signal);
            if (job.cancelRequested) break;
            await library.saveAnalysisResult({ ...result, songId: song.id, analyzedAt: Date.now(), lastAttempt: { status: 'success', at: Date.now() } });
            job.succeeded++;
          } catch (error) {
            if (job.cancelRequested || error.name === 'AbortError') break;
            job.failures.push({ songId: song.id, title: song.title, message: error.message });
            // Preserve a prior successful BPM when a later attempt fails.
            try {
              const previous = (await library.getAnalysisResults(song.id)).find(result => result.detectorId === V40_DETECTOR_ID);
              await library.saveAnalysisResult({ ...previous, songId: song.id, detectorId: V40_DETECTOR_ID, bpm: previous?.bpm ?? null,
                lastAttempt: { status: 'failed', at: Date.now(), message: error.message } });
            } catch (saveError) { job.failures[job.failures.length - 1].message += ' · Result could not be saved: ' + saveError.message; }
          }
          job.processed++; notify();
          // Yield between songs; decoded data has left the Audio function scope.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } finally { job.running = false; job.current = ''; controller = null; notify(); }
      return job;
    }
  };
}
