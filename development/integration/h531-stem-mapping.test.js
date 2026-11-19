// Run with: node --test development/integration/h531-stem-mapping.test.js
// No browser, audio device, or external packages are required.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('./h531-stem-mapping.js');

test('all four H5.3.1 faders target the correct audio stem', () => {
  assert.deepEqual([0, 1, 2, 3].map(mapping.getAudioStemCategory),
    ['transients', 'flow', 'tune', 'voice']);
});

test('invalid visual fader indices cannot target an unintended stem', () => {
  for (const invalid of [-1, 4, 1.5, NaN, '1', null]) {
    assert.throws(() => mapping.getAudioStemCategory(invalid), RangeError);
  }
});

test('authoritative allocated audio levels appear in visual order', () => {
  const allocated = { voice: 0.13, tune: 0.24, flow: 0.35, transients: 0.46 };
  assert.deepEqual(mapping.getVisualStemLevels(allocated), [0.46, 0.35, 0.24, 0.13]);
});

test('automatic Handoff values retain full precision when displayed', () => {
  const allocated = { transients: 1 / 3, flow: 0, tune: 1, voice: 0.1275 };
  assert.deepEqual(mapping.getVisualStemLevels(allocated), [1 / 3, 0, 1, 0.1275]);
});

test('missing or invalid allocated levels fail clearly instead of showing fake values', () => {
  assert.throws(() => mapping.getVisualStemLevels(null), TypeError);
  assert.throws(() => mapping.getVisualStemLevels({ transients: 1 }), RangeError);
  assert.throws(() => mapping.getVisualStemLevels({
    transients: 0, flow: 0, tune: 0, voice: 1.1
  }), RangeError);
});
