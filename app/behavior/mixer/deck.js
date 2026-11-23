import { buildAudio, loadAudio, startAudio, pauseAudio, ejectAudio } from "../../audio/deck-audio.js";

// Behavior: deck decisions and state. Visual controls are defined elsewhere.
export function buildDeck() {
  return {
    song: null,
    queue: null,
    isPlaying: false,
    audio: buildAudio()
  };
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
