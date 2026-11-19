// H5.3.1 visual stem positions -> existing audio/Handoff category names.
// This module contains no audio, DOM, or simulated deck state.
// Keep the order explicit: changing it would send a gesture to the wrong instrument.
(function (root) {
  'use strict';
  const categoryByIndex = Object.freeze(['transients', 'flow', 'tune', 'voice']);

  function getAudioStemCategory(stemIndex) {
    if (!Number.isInteger(stemIndex) || stemIndex < 0 || stemIndex >= categoryByIndex.length) {
      throw new RangeError('Stem index must be an integer from 0 to 3.');
    }
    return categoryByIndex[stemIndex];
  }

  // Read the four *allocated* levels; these may change automatically through Handoff.
  // Never use Design Mode's example values as authoritative performance levels.
  function getVisualStemLevels(allocatedLevels) {
    if (!allocatedLevels || typeof allocatedLevels !== 'object') {
      throw new TypeError('Allocated stem levels are required.');
    }
    return categoryByIndex.map(category => {
      const value = allocatedLevels[category];
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError('Invalid allocated level for ' + category + '.');
      }
      return value;
    });
  }

  const mapping = Object.freeze({ categoryByIndex, getAudioStemCategory, getVisualStemLevels });
  if (typeof module !== 'undefined' && module.exports) module.exports = mapping;
  if (root) root.TuneToxH531StemMapping = mapping;
})(typeof globalThis !== 'undefined' ? globalThis : null);
