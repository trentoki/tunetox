// Store the active song on a deck.
function loadSong(deck, song) {
  deck.song = song;
  deck.isPlaying = false;
  deck.tempo = song.bpm;
  deck.pitchShift = 0;
}

// Store the song prepared to play next.
function loadQueue(deck, song) {
  deck.queue = song;
}
