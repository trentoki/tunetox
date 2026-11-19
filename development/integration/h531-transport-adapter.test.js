// Run with: node --test development/integration/h531-transport-adapter.test.js
// Test the router contract without starting real audio or changing the approved UI.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createAdapter = require('./h531-transport-adapter.js');

function fixture() {
  const states = Object.fromEntries([1,2,3,4].map(id => [id, {
    loaded: false, loading: false, isPlaying: false
  }]));
  const calls = [];
  const router = {
    getState(id) { return states[id]; },
    async play(id) { calls.push(['play', id]); states[id].isPlaying = true; return true; },
    async pause(id) { calls.push(['pause', id]); states[id].isPlaying = false; return true; },
    async eject(id) { calls.push(['eject', id]); states[id].loaded = false; return true; }
  };
  return { states, calls, adapter: createAdapter(router) };
}

test('unloaded deck cannot start playback', async () => {
  const { calls, adapter } = fixture();
  assert.equal(await adapter.play(1), false);
  assert.deepEqual(calls, []);
});

test('all four loaded decks use the existing router', async () => {
  const { states, calls, adapter } = fixture();
  for (let id = 1; id <= 4; id++) {
    states[id].loaded = true;
    assert.equal(await adapter.play(id), true);
    assert.equal(adapter.getPlaybackState(id).playing, true);
    assert.equal(await adapter.pause(id), true);
  }
  assert.deepEqual(calls, [1,2,3,4].flatMap(id => [['play', id], ['pause', id]]));
});

test('toggle chooses Play or Pause based on actual engine state', async () => {
  const { states, calls, adapter } = fixture();
  states[3].loaded = true;
  await adapter.togglePlayback(3);
  await adapter.togglePlayback(3);
  assert.deepEqual(calls, [['play',3], ['pause',3]]);
});

test('loading prevents Play and Eject delegates to router', async () => {
  const { states, calls, adapter } = fixture();
  states[2].loaded = true;
  states[2].loading = true;
  assert.equal(await adapter.play(2), false);
  states[2].loading = false;
  await adapter.eject(2);
  assert.deepEqual(calls, [['eject', 2]]);
});

test('invalid deck IDs and incomplete routers fail clearly', async () => {
  const { adapter } = fixture();
  assert.throws(() => adapter.getPlaybackState(0), RangeError);
  await assert.rejects(adapter.play(5), RangeError);
  assert.throws(() => createAdapter({ play() {} }), TypeError);
});
