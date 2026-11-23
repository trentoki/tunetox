// Audio: work with the browser's audio player, not buttons or deck rules.
// All four players share one context, but each has its own source and Main gain.
// Keep the native media element API so load, queue, pause and resume stay intact.
let context;
const mainGains = new WeakMap();
const volumeRampSeconds = 0.015;

export function buildAudio() {
  const player = new Audio();
  context ??= new AudioContext();
  const source = context.createMediaElementSource(player);
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(context.destination);
  mainGains.set(player, { gain, ramp: { from: 0, to: 0, start: 0, end: 0 } });
  return player;
}

// Behavior supplies a validated 0–1 Main value. A short linear ramp reaches zero
// exactly. Retarget from the modeled current gain, not AudioParam.value, so rapid
// fader movement stays continuous even when a previous ramp has not finished.
export function setAudioMainVolume(player, value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("Main volume must be a number from 0 to 1.");
  }
  const path = mainGains.get(player);
  const now = context.currentTime;
  const previous = path.ramp;
  const fraction = previous.end > previous.start
    ? Math.max(0, Math.min(1, (now - previous.start) / (previous.end - previous.start))) : 1;
  const from = previous.from + (previous.to - previous.from) * fraction;
  path.gain.gain.cancelScheduledValues(now);
  path.gain.gain.setValueAtTime(from, now);
  path.gain.gain.linearRampToValueAtTime(value, now + volumeRampSeconds);
  path.ramp = { from, to: value, start: now, end: now + volumeRampSeconds };
}

export function loadAudio(player, song) {
  player.pause();
  player.src = song.url;
  player.load();
}

export async function startAudio(player) {
  // Both calls happen during the initiating gesture, before the first await.
  // A failed context resume must not leave an unreported running media player.
  const resumed = context.resume();
  try {
    await Promise.all([resumed, player.play()]);
  } catch (error) {
    player.pause();
    throw error;
  }
}

export function pauseAudio(player) {
  player.pause();
}

export function ejectAudio(player) {
  player.pause();
  player.removeAttribute("src");
  player.load();
}

// One resource collection per application host. Creation reads a browser-selected
// File without writing it. The caller supplies all loaded/queued URL references;
// cleanup revokes only URLs this collection created and that are no longer used.
// Call after load/queue changes and settled playback operations, as before.
export function createAudioFileURLs() {
  const objectURLs = new Set();
  return {
    create(file) {
      const url = URL.createObjectURL(file);
      objectURLs.add(url);
      return url;
    },
    releaseUnused(retainedURLs) {
      const retained = new Set(retainedURLs);
      for (const url of objectURLs) {
        if (!retained.has(url)) {
          URL.revokeObjectURL(url);
          objectURLs.delete(url);
        }
      }
    }
  };
}
