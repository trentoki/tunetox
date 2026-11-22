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
