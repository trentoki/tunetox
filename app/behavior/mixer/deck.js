import { buildAudio, loadAudio, startAudio, pauseAudio, ejectAudio, setAudioMainVolume } from "../../audio/deck-audio.js";

// Behavior: deck decisions and state. Visual controls are defined elsewhere.
export function buildDeck() {
  return {
    song: null,
    queue: null,
    isPlaying: false,
    mainVolume: 0,
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

export function loadSong(deck, song) {
  if (deck.isPlaying) return false;
  loadAudio(deck.audio, song);
  deck.song = song;
  return true;
}

export function loadQueue(deck, song) {
  deck.queue = song; // Replaces any previously queued song.
}

export function sendToDeck(deck, song) {
  if (deck.isPlaying) {
    loadQueue(deck, song);
  } else {
    loadSong(deck, song);
  }
}

export async function playDeck(deck) {
  if (deck.song === null) return;
  await startAudio(deck.audio);
  deck.isPlaying = true;
}

export function pauseDeck(deck) {
  if (!deck.isPlaying) return;
  pauseAudio(deck.audio);
  deck.isPlaying = false;
}

export function ejectSong(deck) {
  if (deck.isPlaying) return;
  ejectAudio(deck.audio);
  deck.song = null;
}

export async function playQueue(deck) {
  if (deck.queue === null) return;
  const nextSong = deck.queue;
  pauseAudio(deck.audio);
  deck.isPlaying = false;
  loadSong(deck, nextSong);
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
      await operation();
      callbacks.completed();
    } catch (error) {
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
    playQueue: () => run(() => playQueue(deck))
  };
}
