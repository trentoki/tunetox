// H5.3.1 transport adapter. Routes requests to the existing source router.
// Loading audio is a separate prerequisite: Play never invents a song or source.
// No DOM, timers, audio contexts, or simulated playing state live here.
(function (root) {
  'use strict';

  function createH531TransportAdapter(router) {
    if (!router || !['play', 'pause', 'eject', 'getState'].every(
      method => typeof router[method] === 'function')) {
      throw new TypeError('An existing audio router with play/pause/eject/getState is required.');
    }
    function requireDeckId(deckId) {
      if (!Number.isInteger(deckId) || deckId < 1 || deckId > 4) {
        throw new RangeError('Deck ID must be an integer from 1 to 4.');
      }
    }
    function getPlaybackState(deckId) {
      requireDeckId(deckId);
      const state = router.getState(deckId);
      if (!state || typeof state !== 'object') {
        throw new Error('Audio router did not provide deck state.');
      }
      return Object.freeze({
        loaded: state.loaded === true,
        playing: state.isPlaying === true,
        loading: state.loading === true
      });
    }
    return Object.freeze({
      getPlaybackState,
      // The caller must await Play: native stem playback starts asynchronously.
      async play(deckId) {
        const state = getPlaybackState(deckId);
        if (!state.loaded || state.loading || state.playing) return false;
        return router.play(deckId);
      },
      async pause(deckId) {
        const state = getPlaybackState(deckId);
        if (!state.playing) return false;
        return router.pause(deckId);
      },
      async togglePlayback(deckId) {
        return getPlaybackState(deckId).playing ? this.pause(deckId) : this.play(deckId);
      },
      async eject(deckId) {
        requireDeckId(deckId);
        return router.eject(deckId);
      }
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = createH531TransportAdapter;
  if (root) root.createH531TransportAdapter = createH531TransportAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : null);
