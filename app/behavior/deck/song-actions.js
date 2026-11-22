//#region 2. METADATA LOADING AND CUE ACTIONS

// Loads song metadata into a deck and resets its playback state; synchronizes only in four-deck mode.
// Inputs: the deck, song metadata, and shared app state. Returns nothing.
function loadSong(deck, song, appState) {
  deck.song = song;

  deck.isPlaying = false;

  deck.tempo = song.bpm;

  deck.pitchShift = 0;

  // Legacy prototype trigger; visibility will not govern future matching.
  if (appState.interfaceMode === "fourDeck") {
    synchronizeLoadedDecks(appState);
  }
}

// Prepares a song in the deck's cue slot without replacing its active song.
// Inputs: the destination deck, song metadata, and app state. Returns nothing.
function cueSong(deck, song, appState) {
  const cueKey = normalizeMatchingKey(song.key);
  const referenceKey = findCueReferenceKey(deck, appState);
  const globalPitchShift = appState.globalPitchShift || 0;
  const cueTempo = appState.globalTempo === null
    ? song.bpm
    : appState.globalTempo;
  let pitchShift = 0;

  if (cueKey !== null && referenceKey !== null) {
    const referenceBeforeGlobalShift = referenceKey - globalPitchShift;
    pitchShift = findSmallestPitchShift(
      cueKey,
      referenceBeforeGlobalShift
    );
  }

  deck.cue = {
    song: song,
    tempo: cueTempo,
    pitchShift: pitchShift
  };
}

// Activates the prepared cue by changing this deck's state; an empty cue is a no-op.
// Input: the deck. Returns nothing and does not change other decks or global state.
function playCuedSong(deck) {
  if (deck.cue === null) {
    return;
  }

  deck.song = deck.cue.song;
  deck.tempo = deck.cue.tempo;
  deck.pitchShift = deck.cue.pitchShift;
  deck.isPlaying = true;
  deck.cue = null;
}

//#endregion 2. METADATA LOADING AND CUE ACTIONS

