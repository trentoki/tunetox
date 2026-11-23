// Audio: work with the browser's audio player, not buttons or deck rules.
export function buildAudio() {
  return new Audio();
}

export function loadAudio(player, song) {
  player.pause();
  player.src = song.url;
  player.load();
}

export async function startAudio(player) {
  await player.play();
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
