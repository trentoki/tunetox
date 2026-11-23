import { playDeck, pauseDeck, playQueue } from "./deck.js";

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
