//#region 1. METADATA STATE AND SHARED PARTICIPATION ACTIONS

// Creates one empty deck. Participation lives only in appState.participation.
function createDeck(id) {
  return {
    id: id,

    // Song and playback state.
    song: null,
    queue: null,
    isPlaying: false,

    // Current playback settings.
    tempo: null,
    pitchShift: 0,
    volume: 0,
    stems: createDeckStemState(id),

    // Equalizer settings in decibels.
    eq: {
      low: 0,
      mid: 0,
      high: 0
    }
  };
}

const appState = {
  participation: createParticipationState(),
  stemSession: createStemSessionState(),
  // Which interface is currently displayed?
  interfaceMode: "twoDeck",

  // Global synchronization settings.
  globalTempo: null,
  globalPitchShift: 0,
  referenceKey: null,

  // The four shared TuneToss decks.
  decks: [
    createDeck(1),
    createDeck(2),
    createDeck(3),
    createDeck(4)
  ]
};

// Future mouse/touch/keyboard/MIDI adapters share these actions; no DSP wiring yet.
const appActions = Object.freeze({
  participation: createParticipationActions(appState),
  stems: createStemActions(appState),
  stemHandoff: createAutomaticStemHandoffActions(appState)
});
// Startup boundary: no storage is read. Later defaults must be supplied here before session actions.
appActions.participation.initialize();

//#endregion 1. METADATA STATE AND SHARED PARTICIPATION ACTIONS

//#region 3. PURE HARMONIC CALCULATIONS

// Maps note spellings to pitch classes: enharmonic names share one value in the 12-note octave.
const pitchClasses = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11
};

// Semitones from each mode's tonic back to its relative Ionian (parent-major) tonic.
// Example: D Dorian has offset 2, so D (2) - 2 wraps to C (0).
const modeOffsets = {
  ionian: 0,
  dorian: 2,
  phrygian: 4,
  lydian: 5,
  mixolydian: 7,
  aeolian: 9,
  locrian: 11
};

// Converts a tonic/mode key to its parent-major pitch class; returns null for unsupported input.
// Input: a key object such as { tonic: "D", mode: "dorian" }.
function normalizeMatchingKey(key) {
  if (key === null || typeof key !== "object") {
    return null;
  }

  const tonic = pitchClasses[key.tonic];
  let mode = key.mode;

  if (mode === "major") {
    mode = "ionian";
  } else if (mode === "minor") {
    mode = "aeolian";
  }

  if (tonic === undefined || modeOffsets[mode] === undefined) {
    return null;
  }

  return (tonic - modeOffsets[mode] + 12) % 12;
}

// Wraps any positive or negative semitone value into the 0-11 pitch-class range.
// Example: -1 becomes 11 (B), and 13 becomes 1 (C-sharp/D-flat).
function wrapPitchClass(pitchClass) {
  return (pitchClass % 12 + 12) % 12;
}

// Returns the shortest signed shift from one pitch class to another; a tritone tie stays +6.
// Inputs and result are semitone pitch classes/shifts.
function findSmallestPitchShift(fromPitchClass, toPitchClass) {
  let shift = wrapPitchClass(toPitchClass - fromPitchClass);

  if (shift > 6) {
    shift -= 12;
  }

  return shift;
}

// Interval patterns relative to a song's tonic; these preserve its named tonic and scale identity.
const pentatonicScaleIntervals = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10]
};

// Ionian intervals provide the seven-note collection used to build every diatonic mode.
const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

// Builds and returns a sorted pitch-class collection, or null for missing/unsupported metadata.
// map() creates new shifted values, so the song's tonic and scale metadata remain unchanged.
function getSongPitchClassCollection(song) {
  if (song === null || song === undefined) {
    return null;
  }

  if (
    song.key === null ||
    song.key === undefined ||
    typeof song.key !== "object"
  ) {
    return null;
  }

  const tonic = pitchClasses[song.key.tonic];

  if (tonic === undefined) {
    return null;
  }

  let intervals;

  if (song.key.scaleType !== undefined) {
    intervals = pentatonicScaleIntervals[song.key.scaleType];

    if (intervals === undefined) {
      return null;
    }
  } else {
    let mode = song.key.mode;

    if (mode === "major") {
      mode = "ionian";
    } else if (mode === "minor") {
      mode = "aeolian";
    }

    if (modeOffsets[mode] === undefined) {
      return null;
    }

    // Subtracting the mode offset rotates the Ionian pattern to the requested mode.
    const modeOffset = modeOffsets[mode];
    intervals = majorScaleIntervals.map(interval => (
      wrapPitchClass(interval - modeOffset)
    ));
  }

  // The numeric sort keeps pitch classes in musical order (default sort is text-based).
  return intervals
    .map(interval => wrapPitchClass(tonic + interval))
    .sort((first, second) => first - second);
}

// A pentatonic/mode match is containment: all five notes must occur in the seven-note mode.
// Reports whether each collection contains the other, and whether both are identical.
// every() requires all notes to pass; includes() checks whether each note is present.
function comparePitchClassCollections(firstCollection, secondCollection) {
  const firstContainedInSecond = firstCollection.every(
    pitchClass => secondCollection.includes(wrapPitchClass(pitchClass))
  );
  const secondContainedInFirst = secondCollection.every(
    pitchClass => firstCollection.includes(wrapPitchClass(pitchClass))
  );

  return {
    firstContainedInSecond: firstContainedInSecond,
    secondContainedInFirst: secondContainedInFirst,
    equal: firstContainedInSecond && secondContainedInFirst
  };
}

// Compares sorted pitch-class arrays lexicographically for deterministic tie-breaking.
// The first lower note at a differing position wins; e.g. [1,3,5] precedes [1,3,6].
function compareSortedPitchClassCollections(firstCollection, secondCollection) {
  for (let index = 0; index < firstCollection.length; index += 1) {
    if (firstCollection[index] !== secondCollection[index]) {
      return firstCollection[index] - secondCollection[index];
    }
  }

  return 0;
}

// Searches all 12 semitone positions for the smallest scale contained in the larger one.
// Returns the winning relative shift and pre-midpoint matched collection, or null if invalid.
function findSmallestCompatibleScaleTransposition(firstSong, secondSong) {
  const firstCollection = getSongPitchClassCollection(firstSong);
  const secondCollection = getSongPitchClassCollection(secondSong);

  if (firstCollection === null || secondCollection === null) {
    return null;
  }

  const firstCollectionIsSmaller = firstCollection.length <= secondCollection.length;
  const smallerCollection = firstCollectionIsSmaller
    ? firstCollection
    : secondCollection;
  const largerCollection = firstCollectionIsSmaller
    ? secondCollection
    : firstCollection;
  let bestMatch = null;

  for (let pitchClassShift = 0; pitchClassShift < 12; pitchClassShift += 1) {
    const relativeShift = findSmallestPitchShift(0, pitchClassShift);
    // Test a fresh shifted copy at each pitch class; sort numerically for membership and ties.
    const shiftedSmallerCollection = smallerCollection
      .map(pitchClass => wrapPitchClass(pitchClass + relativeShift))
      .sort((first, second) => first - second);
    const comparison = firstCollectionIsSmaller
      ? comparePitchClassCollections(shiftedSmallerCollection, largerCollection)
      : comparePitchClassCollections(largerCollection, shiftedSmallerCollection);
    const isContained = firstCollectionIsSmaller
      ? comparison.firstContainedInSecond
      : comparison.secondContainedInFirst;

    if (!isContained) {
      continue;
    }

    const candidate = {
      relativeShift: relativeShift,
      matchedPitchClassCollection: shiftedSmallerCollection,
      firstCollectionIsSmaller: firstCollectionIsSmaller
    };

    if (bestMatch === null || Math.abs(relativeShift) < Math.abs(bestMatch.relativeShift)) {
      bestMatch = candidate;
      continue;
    }

    // Equal-size movements use the lexicographically lowest shared collection, not a direction preference.
    if (
      Math.abs(relativeShift) === Math.abs(bestMatch.relativeShift) &&
      compareSortedPitchClassCollections(
        candidate.matchedPitchClassCollection,
        bestMatch.matchedPitchClassCollection
      ) < 0
    ) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

// Returns equal-and-opposite shifts plus both collections after those shifts; does not mutate songs.
// Example: relative -2 becomes -1 for the first song and +1 for the second.
function calculateSymmetricalScaleCompatibilityShifts(firstSong, secondSong) {
  const match = findSmallestCompatibleScaleTransposition(firstSong, secondSong);

  if (match === null) {
    return null;
  }

  const halfShift = match.relativeShift / 2;
  const firstSongShift = match.firstCollectionIsSmaller
    ? halfShift
    : -halfShift;
  const secondSongShift = match.firstCollectionIsSmaller
    ? -halfShift
    : halfShift;
  const firstSongSoundingPitchClasses = getSongPitchClassCollection(firstSong)
    .map(pitchClass => wrapPitchClass(pitchClass + firstSongShift))
    .sort((first, second) => first - second);
  const secondSongSoundingPitchClasses = getSongPitchClassCollection(secondSong)
    .map(pitchClass => wrapPitchClass(pitchClass + secondSongShift))
    .sort((first, second) => first - second);

  return {
    firstSongShift: firstSongShift,
    secondSongShift: secondSongShift,
    matchedPitchClassCollection: match.matchedPitchClassCollection,
    firstSongSoundingPitchClasses: firstSongSoundingPitchClasses,
    secondSongSoundingPitchClasses: secondSongSoundingPitchClasses
  };
}

// Returns the shortest shift aligning two diatonic parent scales; no state is changed.
// Inputs are songs with supported tonic/mode metadata; invalid keys produce null.
function calculateParentScaleTransposition(firstSong, secondSong) {
  const firstParentScale = normalizeMatchingKey(firstSong.key);
  const secondParentScale = normalizeMatchingKey(secondSong.key);

  if (firstParentScale === null || secondParentScale === null) {
    return null;
  }

  return findSmallestPitchShift(firstParentScale, secondParentScale);
}

// Splits a parent-scale transposition evenly between two songs; may return fractional semitones.
// Inputs are songs; returns null when their diatonic keys cannot be normalized.
function calculateSymmetricalParentScaleShifts(firstSong, secondSong) {
  const transposition = calculateParentScaleTransposition(
    firstSong,
    secondSong
  );

  if (transposition === null) {
    return null;
  }

  return {
    firstSongShift: transposition / 2,
    secondSongShift: -transposition / 2
  };
}

//#endregion 3. PURE HARMONIC CALCULATIONS

//#region 4. SOUNDING-PITCH REFERENCE AND CUE-SELECTION POLICY

// Retained prototype cue policy; participation is not connected to matching yet.
// Computes a deck's current sounding parent-scale pitch class from song key and pitch offsets.
// This is a calculation only; it does not apply or change either offset.
function getCurrentSoundingMatchingKey(deck, appState) {
  const matchingKey = normalizeMatchingKey(deck.song.key);

  if (matchingKey === null) {
    return null;
  }

  const deckPitchShift = deck.pitchShift || 0;
  const globalPitchShift = appState.globalPitchShift || 0;

  return wrapPitchClass(
    matchingKey + deckPitchShift + globalPitchShift
  );
}

// Selects the cue's key reference using playing-deck priority, stored reference, then loaded decks.
// Returns a sounding parent-scale pitch class or null; deck ordering uses numeric IDs.
function findCueReferenceKey(deck, appState) {
  // filter() keeps eligible decks, numeric sort() orders them, and find() selects a preferred ID.
  const playingDecks = appState.decks
    .filter(candidate => (
      candidate.isPlaying &&
      candidate.song !== null &&
      normalizeMatchingKey(candidate.song.key) !== null
    ))
    .sort((first, second) => first.id - second.id);

  let preferredDeckId = null;

  if (deck.id === 3) {
    preferredDeckId = 1;
  } else if (deck.id === 4) {
    preferredDeckId = 2;
  }

  const preferredDeck = playingDecks.find(
    candidate => candidate.id === preferredDeckId
  );

  if (preferredDeck !== undefined) {
    return getCurrentSoundingMatchingKey(preferredDeck, appState);
  }

  if (playingDecks.length > 0) {
    return getCurrentSoundingMatchingKey(playingDecks[0], appState);
  }

  const establishedKey = normalizeMatchingKey(appState.referenceKey);

  if (establishedKey !== null) {
    return wrapPitchClass(
      establishedKey + (appState.globalPitchShift || 0)
    );
  }

  const loadedDecks = appState.decks
    .filter(candidate => (
      candidate.song !== null &&
      normalizeMatchingKey(candidate.song.key) !== null
    ))
    .sort((first, second) => first.id - second.id);

  if (loadedDecks.length > 0) {
    return getCurrentSoundingMatchingKey(loadedDecks[0], appState);
  }

  return null;
}

//#endregion 4. SOUNDING-PITCH REFERENCE AND CUE-SELECTION POLICY

//#region 5. LEGACY PROTOTYPE SYNCHRONIZATION UTILITIES

// Historical view-dependent load behavior, preserved for explicit calls and tests.
// This is not continuous Beatmatching, Tune matching, or the future Match All feature.

// Averages original BPMs for active songs only; returns null when no deck has a song.
// Input: the deck array. Cue slots are intentionally excluded.
function calculateAverageTempo(decks) {
  // Cue slots are excluded; shared tempo uses active songs only.
  // filter() creates a new list so the caller's deck array is left unchanged.
  const loadedDecks = decks.filter(
    deck => deck.song !== null
  );

  // No loaded songs means no tempo.
  if (loadedDecks.length === 0) {
    return null;
  }

  // reduce() accumulates the original BPM values into one total.
  const totalTempo = loadedDecks.reduce(
    (total, deck) => total + deck.song.bpm,
    0
  );

  return totalTempo / loadedDecks.length;
}

// Applies a tempo decision to every loaded deck and stores it in globalTempo.
// Input: app state. This function mutates global/deck state; it currently handles only no-playing-deck loads.
function synchronizeLoadedDecks(appState) {
  const decks = appState.decks;

  // For now, only handle the case where
  // no decks are playing.
  const anyDeckPlaying = decks.some(
    deck => deck.isPlaying
  );

  if (anyDeckPlaying) {
    console.log("Playing-deck synchronization not implemented yet");
    return;
  }

  // Calculate the average original BPM.
  const averageTempo = calculateAverageTempo(decks);

  // No loaded songs means no global tempo.
  if (averageTempo === null) {
    appState.globalTempo = null;
    return;
  }

  appState.globalTempo = averageTempo;

  decks.forEach(deck => {
    if (deck.song !== null) {
      deck.tempo = appState.globalTempo;
    }
  });
}

//#endregion 5. LEGACY PROTOTYPE SYNCHRONIZATION UTILITIES
