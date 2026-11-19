// Run with: node --test development/integration/h531-stem-gesture-adapter.test.js
// A fake action receiver verifies routing; no browser or audio engine is started.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createAdapter = require('./h531-stem-gesture-adapter.js');

function fixture() {
  const calls = [];
  const decks = [1, 2, 3, 4].map(id => ({
    id, volume: 0.5, stems: { allocatedLevels: {
      transients: 0.1, flow: 0.2, tune: 0.3, voice: 0.4
    } }
  }));
  const handoff = {
    setStemLevel(...args) { calls.push(['stem', ...args]); return true; },
    setMainVolume(...args) { calls.push(['main', ...args]); return true; }
  };
  return { calls, decks, adapter: createAdapter(handoff, { decks }) };
}

test('every deck and visual stem routes to the correct native category', () => {
  const { calls, adapter } = fixture();
  for (let deck = 1; deck <= 4; deck++) {
    for (let stem = 0; stem < 4; stem++) adapter.setLevel(deck, stem, 0.67);
  }
  assert.equal(calls.length, 16);
  for (let deck = 1; deck <= 4; deck++) {
    assert.deepEqual(calls.slice((deck - 1) * 4, deck * 4).map(call => call.slice(0, 4)),
      ['transients', 'flow', 'tune', 'voice'].map(name => ['stem', deck, name, 0.67]));
  }
  assert.equal(new Set(calls.map(call => call[4])).size, 16);
});

test('main fader uses native main-volume action, not a stem action', () => {
  const { calls, adapter } = fixture();
  adapter.setLevel(2, null, 0.425);
  assert.deepEqual(calls[0].slice(0, 3), ['main', 2, 0.425]);
  assert.match(calls[0][3], /^h531-fader-\d+$/);
});

test('stem gestures use hundredths while readback preserves automatic precision', () => {
  const { calls, decks, adapter } = fixture();
  adapter.setLevel(1, 0, 0.427);
  assert.equal(calls[0][3], 0.43);
  decks[0].stems.allocatedLevels.transients = 1 / 3;
  assert.deepEqual(adapter.getLevels(1), {
    stems: [1 / 3, 0.2, 0.3, 0.4], volume: 0.5
  });
});

test('invalid inputs cannot reach the native Handoff engine', () => {
  const { calls, adapter } = fixture();
  for (const deck of [0, 5, 1.5, '1']) {
    assert.throws(() => adapter.setLevel(deck, 0, 0.5), RangeError);
  }
  for (const index of [-1, 4, '0']) {
    assert.throws(() => adapter.setLevel(1, index, 0.5), RangeError);
  }
  for (const level of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => adapter.setLevel(1, 0, level), RangeError);
  }
  assert.equal(calls.length, 0);
});

test('adapter rejects missing native actions or application state', () => {
  assert.throws(() => createAdapter({}, { decks: [] }), TypeError);
  assert.throws(() => createAdapter({
    setStemLevel() {}, setMainVolume() {}
  }, null), TypeError);
});
