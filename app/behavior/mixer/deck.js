import { buildAudio, loadAudio, startAudio, pauseAudio, ejectAudio, seekAudio, setAudioTempo, setAudioMainVolume } from "../../audio/deck-audio.js";

// Behavior: deck decisions and state. Visual controls are defined elsewhere.
export function buildDeck() {
  return {
    song: null,
    queue: null,
    isPlaying: false,
    mainVolume: 0,
    tempoRatio: 1,
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

export async function loadSong(deck, song) {
  if (deck.isPlaying) return false;
  deck.loadingSong = song;
  try {
    await loadAudio(deck.audio, song);
    deck.song = song;
    return true;
  } finally { if (deck.loadingSong === song) deck.loadingSong = null; }
}

export function loadQueue(deck, song) {
  deck.queue = song; // Replaces any previously queued song.
}

export function sendToDeck(deck, song) {
  if (deck.isPlaying) {
    loadQueue(deck, song);
    return { kind: "queued", song };
  } else {
    return loadSong(deck, song).then(() => ({ kind: "loaded", song }));
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
  deck.isPlaying = true;
}

export async function pauseDeck(deck) {
  if (!deck.isPlaying) return;
  await pauseAudio(deck.audio);
  deck.isPlaying = false;
}

export async function ejectSong(deck) {
  if (deck.isPlaying) return;
  await ejectAudio(deck.audio);
  deck.song = null;
}

export async function playQueue(deck) {
  if (deck.queue === null) return;
  const nextSong = deck.queue;
  await pauseAudio(deck.audio);
  deck.isPlaying = false;
  await loadSong(deck, nextSong);
  deck.queue = null;
  await playDeck(deck);
}

// Coordinates one existing deck; never creates a player or copies deck state.
// The host supplies synchronous presentation callbacks, keeping DOM, messages,
// and file-URL cleanup outside Behavior. Actions resolve after cleanup, including
// on playback rejection; a second action while pending is ignored, as before.
// Create once per deck. Native ended/error events retain the song and queue.
export function createPlaybackCoordinator(deck, callbacks) {
  let pending = false;

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
    }
  }

  deck.audio.addEventListener("ended", () => {
    deck.isPlaying = false;
    callbacks.ended();
  });
  deck.audio.addEventListener("error", () => {
    deck.isPlaying = false;
    callbacks.mediaFailed();
  });

  return {
    isPending: () => pending,
    togglePlayback: () => run(() => deck.isPlaying ? pauseDeck(deck) : playDeck(deck)),
    playQueue: () => run(() => playQueue(deck)),
    sendToDeck(song) {
      if (pending) return Promise.resolve();
      // Queue replacement does no asynchronous work: retain immediate replacement
      // and feedback even when two files are sent in the same event turn.
      if (deck.isPlaying) {
        const result = sendToDeck(deck, song);
        callbacks.completed(result);
        callbacks.settled();
        return Promise.resolve(result);
      }
      return run(() => sendToDeck(deck, song));
    },
    seek: seconds => run(() => seekDeck(deck, seconds))
  };
}
