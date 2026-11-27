import { buildAudio, loadAudio, startAudio, pauseAudio, ejectAudio, seekAudio, setAudioTempo, setAudioMainVolume } from "../../audio/deck-audio.js";

// Behavior: deck decisions and state. Visual controls are defined elsewhere.
export function buildDeck() {
  return {
    song: null,
    queue: null,
    isPlaying: false,
    mainVolume: 0,
    tempoRatio: 1,
    stemLevels: { beat: 1, bass: 1, tune: 1, voice: 1 },
    cuePositions: Array(8).fill(null),
    loadingSong: null,
    audio: buildAudio()
  };
}

// One authoritative requested Main value per deck, in normalized 0–1 units.
// Reject invalid input before changing state or touching the audio graph.
export function setMainVolume(deck, value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("Main volume must be a number from 0 to 1.");
  }
  setAudioMainVolume(deck.audio, value);
  deck.mainVolume = value;
}

// Loaded songs only, in deck order; queued songs are not Library results.
// Return the existing song objects without creating a second state store.
export function getLoadedSongs(decks) {
  return decks.filter(deck => deck.song).map(deck => deck.song);
}

// Permanent requested stem settings, independent of Main. No stem DSP/Handoff
// is connected yet. Keep one value per stem in the same persistent deck state.
export function setStemLevel(deck, stem, value) {
  if (!Object.prototype.hasOwnProperty.call(deck.stemLevels, stem)) throw new RangeError("Unknown stem.");
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("Stem level must be from 0 to 1.");
  deck.stemLevels[stem] = Math.round(value * 100) / 100;
}

export async function loadSong(deck, song) {
  if (deck.isPlaying) return false;
  deck.loadingSong = song;
  try {
    await loadAudio(deck.audio, song);
    if (deck.loadingSong !== song || deck.audio.src !== song.url) return false;
    if (deck.song !== song) deck.cuePositions.fill(null);
    deck.song = song;
    return true;
  } finally { if (deck.loadingSong === song) deck.loadingSong = null; }
}

export function loadQueue(deck, song) {
  // Intentional assignments replace a playing deck's prepared slot only.
  // The sounding song, cues, controls and Audio transport are never touched.
  // Paused explicit Queue assignment retains its existing occupied-slot rule.
  if (deck.queue && !deck.isPlaying) return false;
  deck.queue = song;
  return true;
}

export function sendToDeck(deck, song) {
  if (deck.isPlaying) {
    return loadQueue(deck, song) ? { kind: "queued", song } : { kind: "queue-full", song: deck.queue };
  } else {
    return loadSong(deck, song).then(loaded => loaded ? { kind: "loaded", song } : undefined);
  }
}

export function setTempo(deck, ratio) {
  if (!Number.isFinite(ratio) || ratio < .5 || ratio > 2) throw new RangeError("Tempo ratio must be from 0.5 to 2.");
  const applied = setAudioTempo(deck.audio, ratio);
  deck.tempoRatio = ratio;
  return applied;
}

export async function seekDeck(deck, seconds) {
  await seekAudio(deck.audio, seconds);
  deck.isPlaying = !deck.audio.paused;
}

export async function playDeck(deck) {
  if (deck.song === null) return;
  await startAudio(deck.audio);
  // Audio may already have ended while its scheduling acknowledgement waited.
  deck.isPlaying = !deck.audio.paused;
}

export async function pauseDeck(deck) {
  if (!deck.isPlaying) return;
  await pauseAudio(deck.audio);
  deck.isPlaying = false;
}

export async function ejectSong(deck) {
  if (deck.isPlaying) return;
  deck.loadingSong = null;
  const removing = ejectAudio(deck.audio);
  deck.song = null;
  deck.cuePositions.fill(null);
  // Clear before asynchronous disposal, so its late reply cannot erase a newer load.
  await removing;
}

export async function playQueue(deck) {
  if (deck.queue === null) return;
  const nextSong = deck.queue;
  deck.loadingSong = nextSong;
  try {
    // Audio keeps the outgoing source alive until the candidate is ready. Commit
    // song/cues/queue together only after preparation succeeds (specs/queue.md).
    await loadAudio(deck.audio, nextSong, { preservePlayback: true });
    if (deck.loadingSong !== nextSong || deck.audio.src !== nextSong.url) return;
    if (deck.song !== nextSong) deck.cuePositions.fill(null);
    deck.song = nextSong;
    if (deck.queue === nextSong) deck.queue = null;
    deck.isPlaying = false;
  } finally { if (deck.loadingSong === nextSong) deck.loadingSong = null; }
  await playDeck(deck);
}

// Coordinates one existing deck; never creates a player or copies deck state.
// The host supplies synchronous presentation callbacks, keeping DOM, messages,
// and file-URL cleanup outside Behavior. Actions resolve after cleanup, including
// on playback rejection; overlapping transport actions are ignored. Seek batches
// are the exception: they retain the latest requested target under the same guard.
// Create once per deck. Errors retain songs; natural end may advance the queue.
export function createPlaybackCoordinator(deck, callbacks) {
  let pending = false;
  let seeking = false, nextSeek;
  let seekCompletion;
  let endedQueue = null;
  let swappingQueue = false;
  const readyToSeek = () => Boolean(deck.song) && !deck.loadingSong && deck.audio.readyState >= 2;

  async function run(operation) {
    if (pending) return;
    pending = true;
    callbacks.busyChanged(true);
    try {
      const result = await operation();
      callbacks.completed(result);
      return result;
    } catch (error) {
      deck.isPlaying = !deck.audio.paused;
      callbacks.failed(error);
    } finally {
      pending = false;
      callbacks.busyChanged(false);
      callbacks.settled();
      advanceEndedQueue();
    }
  }

  deck.audio.addEventListener("ended", () => {
    deck.isPlaying = false;
    // Only a real natural completion advances. A seek to the end is paused, not
    // ended. Keep one intent across delayed Play/seek acknowledgements.
    if (!swappingQueue && deck.audio.ended && deck.song && deck.queue) endedQueue = { song: deck.song, queue: deck.queue };
    callbacks.ended();
    advanceEndedQueue();
  });
  deck.audio.addEventListener("error", () => {
    endedQueue = null;
    deck.isPlaying = false;
    callbacks.mediaFailed();
  });

  function advanceEndedQueue() {
    if (pending || !endedQueue) return;
    const intent = endedQueue;
    endedQueue = null; // A failed swap must not trigger an automatic retry loop.
    if (deck.song === intent.song && deck.queue === intent.queue && deck.audio.ended)
      void run(swapQueue);
  }

  async function swapQueue() {
    swappingQueue = true;
    endedQueue = null;
    try { await playQueue(deck); }
    finally { swappingQueue = false; }
  }

  function seek(seconds) {
    if (!Number.isFinite(seconds)) return Promise.reject(new RangeError("Seek position must be finite source seconds."));
    if (!readyToSeek() || (pending && !seeking)) return Promise.resolve();
    // One guarded batch, with only the latest waiting target retained. Never
    // overlap worklet transport commands or drop the user's final position.
    nextSeek = Math.max(0, Math.min(deck.audio.duration, seconds));
    if (seeking) return seekCompletion;
    seeking = true;
    const wasPlaying = deck.isPlaying;
    seekCompletion = run(async () => {
      try {
        while (nextSeek !== undefined) {
          const target = nextSeek;
          nextSeek = undefined;
          await seekDeck(deck, target);
          // Reaching the end pauses Audio. A newer seek back into the song
          // must still preserve the batch's original playing intent.
          if (nextSeek === undefined && wasPlaying && deck.audio.paused && target < deck.audio.duration)
            await playDeck(deck);
        }
      } finally { seeking = false; nextSeek = undefined; }
    });
    return seekCompletion;
  }

  return {
    isPending: () => pending,
    togglePlayback: () => run(() => deck.isPlaying ? pauseDeck(deck) : playDeck(deck)),
    playQueue: () => run(swapQueue),
    sendToDeck(song) {
      if (pending) return Promise.resolve();
      // One prepared slot; intentional replacement never interrupts sounding Audio.
      if (deck.isPlaying) {
        const result = sendToDeck(deck, song);
        callbacks.completed(result);
        callbacks.settled();
        return Promise.resolve(result);
      }
      return run(() => sendToDeck(deck, song));
    },
    // Explicit Queue destinations reuse the same one-slot state even if paused.
    // All other destinations keep sendToDeck's paused-load/playing-queue rule.
    queueSong(song) {
      return run(() => loadQueue(deck, song)
        ? { kind: "queued", song } : { kind: "queue-full", song: deck.queue });
    },
    canSeek: () => readyToSeek() && (!pending || seeking),
    seek,
    cue(number, clear = false) {
      if (!Number.isInteger(number) || number < 1 || number > 8) throw new RangeError("Cue number must be from 1 to 8.");
      if (typeof clear !== 'boolean') throw new TypeError("Cue clearing must be a boolean.");
      if (!readyToSeek()) return Promise.resolve();
      const index = number - 1;
      if (clear) {
        deck.cuePositions[index] = null;
        callbacks.settled();
        return Promise.resolve();
      }
      const position = deck.cuePositions[index];
      if (position !== null) return seek(position);
      // Do not capture the transient paused coordinate of an unfinished seek.
      if (pending) return Promise.resolve();
      deck.cuePositions[index] = Math.max(0, Math.min(deck.audio.duration, deck.audio.currentTime));
      callbacks.settled();
      return Promise.resolve();
    }
  };
}
