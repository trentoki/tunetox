// Compose existing audio adapters without importing Design Mode or starting audio.
// The live host owns appState, native Handoff, and the existing source router.
(function (root) {
  'use strict';
  const makeFaders = typeof module !== 'undefined' && module.exports
    ? require('./h531-stem-gesture-adapter.js') : root.createH531StemGestureAdapter;
  const makeTransport = typeof module !== 'undefined' && module.exports
    ? require('./h531-transport-adapter.js') : root.createH531TransportAdapter;

  function createH531AudioControls({ appState, handoff, router }) {
    const faders = makeFaders(handoff, appState);
    const transport = makeTransport(router);
    return Object.freeze({
      // Visual deck cards use stable IDs 1..4; no simulated deck state is copied.
      setStemLevel: (deckId, stemIndex, level) => faders.setLevel(deckId, stemIndex, level),
      setMainVolume: (deckId, level) => faders.setLevel(deckId, null, level),
      getLevels: deckId => faders.getLevels(deckId),
      getPlaybackState: deckId => transport.getPlaybackState(deckId),
      togglePlayback: deckId => transport.togglePlayback(deckId),
      play: deckId => transport.play(deckId),
      pause: deckId => transport.pause(deckId),
      eject: deckId => transport.eject(deckId)
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = createH531AudioControls;
  if (root) root.createH531AudioControls = createH531AudioControls;
})(typeof globalThis !== 'undefined' ? globalThis : null);
