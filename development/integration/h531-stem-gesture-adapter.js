// H5.3.1 -> native Handoff gesture adapter. No DOM, audio creation, or allocation math.
// The host supplies the *existing* native Handoff action object and authoritative appState.
(function (root) {
  'use strict';
  const mapping = typeof module !== 'undefined' && module.exports
    ? require('./h531-stem-mapping.js') : root.TuneToxH531StemMapping;

  function createH531StemGestureAdapter(handoff, appState) {
    if (!handoff || typeof handoff.setStemLevel !== 'function' ||
        typeof handoff.setMainVolume !== 'function') {
      throw new TypeError('Existing native Handoff stem and main-volume actions are required.');
    }
    if (!appState || !Array.isArray(appState.decks)) {
      throw new TypeError('Authoritative application deck state is required.');
    }
    let gestureNumber = 0;
    function requireDeck(deckId) {
      if (!Number.isInteger(deckId) || deckId < 1 || deckId > 4 ||
          !appState.decks.some(deck => deck.id === deckId)) {
        throw new RangeError('Deck must exist and have an ID from 1 to 4.');
      }
      return appState.decks.find(deck => deck.id === deckId);
    }
    function requireLevel(level) {
      if (!Number.isFinite(level) || level < 0 || level > 1) {
        throw new RangeError('Fader level must be between 0 and 1.');
      }
    }
    function nextGestureId() { return 'h531-fader-' + (++gestureNumber); }
    return Object.freeze({
      // stemIndex null is the deck's main volume; 0..3 are the four stem faders.
      setLevel(deckId, stemIndex, level) {
        requireDeck(deckId);
        requireLevel(level);
        if (stemIndex === null) {
          return handoff.setMainVolume(deckId, level, nextGestureId());
        }
        const category = mapping.getAudioStemCategory(stemIndex);
        // Native direct stem actions require 0.01 steps; auto allocations may be finer.
        const hundredths = Math.round(level * 100) / 100;
        return handoff.setStemLevel(deckId, category, hundredths, nextGestureId());
      },
      // Always read actual allocations; never render independent preview levels.
      getLevels(deckId) {
        const deck = requireDeck(deckId);
        return Object.freeze({
          stems: mapping.getVisualStemLevels(deck.stems.allocatedLevels),
          volume: deck.volume
        });
      }
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = createH531StemGestureAdapter;
  if (root) root.createH531StemGestureAdapter = createH531StemGestureAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : null);
