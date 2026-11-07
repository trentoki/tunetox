// Extracted from app.js. Loading this file defines tests without running them.
function assertCueTest(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Checks the retained metadata cue-preparation rules; no audio is rendered.
function runCueSongTests() {
  assertCueTest(
    normalizeMatchingKey({ tonic: "C", mode: "dorian" }) === 10,
    "C Dorian should normalize to the B-flat major collection"
  );
  assertCueTest(
    normalizeMatchingKey({ tonic: "G", mode: "minor" }) === 10,
    "G minor should normalize to the B-flat major collection"
  );
  assertCueTest(
    normalizeMatchingKey({ tonic: "Bb", mode: "major" }) === 10,
    "B-flat major should normalize to the B-flat major collection"
  );

  const modesOnCScale = [
    { tonic: "C", mode: "ionian" },
    { tonic: "D", mode: "dorian" },
    { tonic: "E", mode: "phrygian" },
    { tonic: "F", mode: "lydian" },
    { tonic: "G", mode: "mixolydian" },
    { tonic: "A", mode: "aeolian" },
    { tonic: "B", mode: "locrian" }
  ];

  modesOnCScale.forEach(key => {
    assertCueTest(
      normalizeMatchingKey(key) === 0,
      key.mode + " should normalize to the C major collection"
    );
  });

  const testDecks = [
    createDeck(1),
    createDeck(2),
    createDeck(3),
    createDeck(4)
  ];
  const testState = {
    interfaceMode: "fourDeck",
    globalTempo: 118,
    globalPitchShift: 0.5,
    referenceKey: null,
    decks: testDecks
  };

  testDecks[0].song = {
    title: "Deck 1 reference",
    bpm: 120,
    key: { tonic: "C", mode: "dorian" }
  };
  testDecks[0].pitchShift = 2;
  testDecks[0].isPlaying = true;

  testDecks[1].song = {
    title: "Deck 2 reference",
    bpm: 100,
    key: { tonic: "G", mode: "minor" }
  };
  testDecks[1].isPlaying = true;

  testDecks[2].song = {
    title: "Deck 3 active song",
    bpm: 90,
    key: { tonic: "C", mode: "major" }
  };
  testDecks[2].tempo = 95;
  testDecks[2].pitchShift = 0.25;

  const cuedSong = {
    title: "Cued song",
    bpm: 150,
    key: { tonic: "G", mode: "minor" }
  };
  const originalActiveSong = testDecks[2].song;
  const originalAverage = calculateAverageTempo(testDecks);

  cueSong(testDecks[2], cuedSong, testState);

  assertCueTest(testDecks[2].song === originalActiveSong, "Cueing must keep the active song");
  assertCueTest(testDecks[2].tempo === 95, "Cueing must not change active tempo");
  assertCueTest(testDecks[2].pitchShift === 0.25, "Cueing must not change active pitch");
  assertCueTest(testDecks[2].cue.song === cuedSong, "The cue slot should store the cued song");
  assertCueTest(testDecks[2].cue.tempo === 118, "The cue should use the current global tempo");
  assertCueTest(testDecks[2].cue.pitchShift === 2, "Deck 3 should prefer playing Deck 1 for key matching");
  assertCueTest(
    wrapPitchClass(
      normalizeMatchingKey(cuedSong.key) +
      testDecks[2].cue.pitchShift +
      testState.globalPitchShift
    ) === getCurrentSoundingMatchingKey(testDecks[0], testState),
    "The prepared cue should match Deck 1 after global pitch is applied"
  );
  assertCueTest(testDecks[2].isPlaying === false, "Cueing must not start playback");
  assertCueTest(testState.globalTempo === 118, "Cueing must preserve global tempo");
  assertCueTest(testState.referenceKey === null, "Cueing must not establish a reference key");
  assertCueTest(
    calculateAverageTempo(testDecks) === originalAverage,
    "Cued songs must not contribute to average tempo"
  );

  cueSong(testDecks[3], cuedSong, testState);
  assertCueTest(
    testDecks[3].cue.pitchShift === 0,
    "Deck 4 should prefer playing Deck 2 for key matching"
  );
  assertCueTest(
    wrapPitchClass(
      normalizeMatchingKey(cuedSong.key) +
      testDecks[3].cue.pitchShift +
      testState.globalPitchShift
    ) === getCurrentSoundingMatchingKey(testDecks[1], testState),
    "The prepared cue should match Deck 2 after global pitch is applied"
  );

  cueSong(testDecks[1], cuedSong, testState);
  assertCueTest(
    testDecks[1].cue.pitchShift === 2,
    "Other cue destinations should use the lowest-numbered playing deck"
  );

  const referenceState = {
    globalTempo: null,
    globalPitchShift: 2,
    referenceKey: { tonic: "C", mode: "major" },
    decks: [createDeck(1), createDeck(2), createDeck(3), createDeck(4)]
  };
  cueSong(referenceState.decks[0], cuedSong, referenceState);
  assertCueTest(
    referenceState.decks[0].cue.pitchShift === 2,
    "An established reference key should prepare a cue when no deck is playing"
  );
  assertCueTest(
    referenceState.decks[0].cue.tempo === cuedSong.bpm,
    "A cue should use its original BPM when global tempo is unavailable"
  );

  const activeSongState = {
    globalTempo: 100,
    globalPitchShift: 0,
    referenceKey: null,
    decks: [createDeck(1), createDeck(2), createDeck(3), createDeck(4)]
  };
  activeSongState.decks[0].song = {
    title: "Loaded reference",
    bpm: 110,
    key: { tonic: "C", mode: "dorian" }
  };
  activeSongState.decks[0].pitchShift = 2;
  cueSong(activeSongState.decks[2], cuedSong, activeSongState);
  assertCueTest(
    activeSongState.decks[2].cue.pitchShift === 2,
    "With no playing deck or stored reference, use the lowest-numbered active song"
  );

  const emptyState = {
    globalTempo: null,
    globalPitchShift: 0,
    referenceKey: null,
    decks: [createDeck(1), createDeck(2), createDeck(3), createDeck(4)]
  };
  cueSong(emptyState.decks[0], cuedSong, emptyState);
  assertCueTest(
    emptyState.decks[0].cue.pitchShift === 0,
    "Without a reference, a cue should retain its original key"
  );
  assertCueTest(
    emptyState.decks[0].cue.tempo === cuedSong.bpm,
    "The first cue should be prepared at its original BPM"
  );
  playCuedSong(emptyState.decks[0]);
  assertCueTest(
    emptyState.decks[0].tempo === cuedSong.bpm && emptyState.decks[0].isPlaying,
    "The first cue should start playing at its original BPM"
  );

  const twoDeckState = {
    interfaceMode: "twoDeck",
    globalTempo: 77,
    decks: [createDeck(1), createDeck(2), createDeck(3), createDeck(4)]
  };
  loadSong(twoDeckState.decks[0], { title: "A", bpm: 120 }, twoDeckState);
  loadSong(twoDeckState.decks[1], { title: "B", bpm: 106 }, twoDeckState);
  assertCueTest(
    twoDeckState.decks[0].tempo === 120 && twoDeckState.decks[1].tempo === 106,
    "Two-deck song loading should remain independent"
  );
  assertCueTest(
    twoDeckState.globalTempo === 77,
    "Two-deck song loading should not change global tempo"
  );

  console.log("Cue tests passed");
}

// Verifies the existing diatonic parent-scale transposition and midpoint calculations.
// These tests also ensure the songs' original tonic and mode are not changed.
function runParentScaleMatchingTests() {
  const cMajorSong = {
    key: { tonic: "C", mode: "major" }
  };
  const bMinorSong = {
    key: { tonic: "B", mode: "minor" }
  };

  assertCueTest(
    calculateParentScaleTransposition(cMajorSong, bMinorSong) === 2,
    "C major should transpose up two semitones to match B minor's parent scale"
  );

  const midpointShifts = calculateSymmetricalParentScaleShifts(
    cMajorSong,
    bMinorSong
  );
  assertCueTest(
    midpointShifts.firstSongShift === 1 && midpointShifts.secondSongShift === -1,
    "The C major and B minor midpoint should use equal and opposite semitone shifts"
  );
  assertCueTest(
    wrapPitchClass(
      normalizeMatchingKey(cMajorSong.key) + midpointShifts.firstSongShift
    ) === wrapPitchClass(
      normalizeMatchingKey(bMinorSong.key) + midpointShifts.secondSongShift
    ),
    "Midpoint shifts should make the parent collections identical"
  );
  assertCueTest(
    wrapPitchClass(pitchClasses.C + midpointShifts.firstSongShift) === pitchClasses.Db &&
    wrapPitchClass(pitchClasses.B + midpointShifts.secondSongShift) === pitchClasses.Bb,
    "The midpoint should be Db major and Bb minor enharmonically"
  );
  assertCueTest(
    cMajorSong.key.tonic === "C" && cMajorSong.key.mode === "major" &&
    bMinorSong.key.tonic === "B" && bMinorSong.key.mode === "minor",
    "Parent-scale calculations must not change the songs' original tonic or mode"
  );

  const modeComparisons = [
    { first: { tonic: "D", mode: "dorian" }, second: { tonic: "E", mode: "dorian" } },
    { first: { tonic: "E", mode: "phrygian" }, second: { tonic: "F#", mode: "phrygian" } },
    { first: { tonic: "F", mode: "lydian" }, second: { tonic: "G", mode: "lydian" } },
    { first: { tonic: "G", mode: "mixolydian" }, second: { tonic: "A", mode: "mixolydian" } },
    { first: { tonic: "A", mode: "aeolian" }, second: { tonic: "B", mode: "aeolian" } },
    { first: { tonic: "B", mode: "locrian" }, second: { tonic: "C#", mode: "locrian" } }
  ];

  modeComparisons.forEach(comparison => {
    const firstSong = { key: comparison.first };
    const secondSong = { key: comparison.second };
    const transposition = calculateParentScaleTransposition(
      firstSong,
      secondSong
    );

    assertCueTest(
      transposition === 2,
      comparison.first.mode + " should match its transposed parent collection"
    );
    assertCueTest(
      wrapPitchClass(normalizeMatchingKey(firstSong.key) + transposition) ===
        normalizeMatchingKey(secondSong.key),
      comparison.first.mode + " parent collections should align after transposition"
    );
  });

  const fractionalMidpoint = calculateSymmetricalParentScaleShifts(
    { key: { tonic: "A", mode: "dorian" } },
    { key: { tonic: "E", mode: "phrygian" } }
  );
  assertCueTest(
    fractionalMidpoint.firstSongShift === 2.5 &&
      fractionalMidpoint.secondSongShift === -2.5,
    "Symmetrical midpoint matching should support fractional semitone shifts"
  );

  assertCueTest(
    calculateParentScaleTransposition(
      { key: { tonic: "C", mode: "unknown" } },
      cMajorSong
    ) === null,
    "Unsupported modes should not produce a parent-scale transposition"
  );

  console.log("Parent-scale matching tests passed");
}

// Verifies pentatonic collections against relative pentatonics and all seven diatonic modes.
// Includes containment, midpoint shifts, canonical ties, and invalid metadata.
function runPentatonicMatchingTests() {
  const cMajorPentatonic = {
    key: { tonic: "C", scaleType: "majorPentatonic" }
  };
  const aMinorPentatonic = {
    key: { tonic: "A", scaleType: "minorPentatonic" }
  };
  const relativePentatonicComparison = comparePitchClassCollections(
    getSongPitchClassCollection(cMajorPentatonic),
    getSongPitchClassCollection(aMinorPentatonic)
  );

  assertCueTest(
    relativePentatonicComparison.equal,
    "C major and A minor pentatonic should contain the same pitch classes"
  );

  const relativePentatonicShifts = calculateSymmetricalScaleCompatibilityShifts(
    cMajorPentatonic,
    aMinorPentatonic
  );
  assertCueTest(
    relativePentatonicShifts.firstSongShift === 0 &&
      relativePentatonicShifts.secondSongShift === 0,
    "Relative pentatonic scales should match without transposition"
  );

  const tiedMatch = findSmallestCompatibleScaleTransposition(
    cMajorPentatonic,
    { key: { tonic: "F#", mode: "ionian" } }
  );
  assertCueTest(
    tiedMatch.relativeShift === 1 &&
      compareSortedPitchClassCollections(
        tiedMatch.matchedPitchClassCollection,
        [1, 3, 5, 8, 10]
      ) === 0,
    "Equal shifts should choose the lexicographically lowest shared collection"
  );

  assertCueTest(
    cMajorPentatonic.key.tonic === "C" &&
      cMajorPentatonic.key.scaleType === "majorPentatonic" &&
      aMinorPentatonic.key.tonic === "A" &&
      aMinorPentatonic.key.scaleType === "minorPentatonic",
    "Pentatonic matching should preserve each song's tonic and scale identity"
  );

  const cMinorPentatonic = {
    key: { tonic: "C", scaleType: "minorPentatonic" }
  };
  const diatonicModes = [
    { mode: "ionian" },
    { mode: "dorian", expectedShift: 0 },
    { mode: "phrygian", expectedShift: 0 },
    { mode: "lydian" },
    { mode: "mixolydian" },
    { mode: "aeolian", expectedShift: 0 },
    { mode: "locrian", expectedShift: -2 }
  ];

  diatonicModes.forEach(modeInfo => {
    const diatonicSong = {
      key: { tonic: "C", mode: modeInfo.mode }
    };
    const match = findSmallestCompatibleScaleTransposition(
      cMinorPentatonic,
      diatonicSong
    );

    assertCueTest(
      match !== null,
      "C minor pentatonic should find a compatible transposition with C " + modeInfo.mode
    );

    if (modeInfo.expectedShift !== undefined) {
      assertCueTest(
        match.relativeShift === modeInfo.expectedShift,
        "C minor pentatonic should use the expected relative shift with C " + modeInfo.mode
      );
    }

    const midpoint = calculateSymmetricalScaleCompatibilityShifts(
      cMinorPentatonic,
      diatonicSong
    );
    const matchedCollections = comparePitchClassCollections(
      midpoint.firstSongSoundingPitchClasses,
      midpoint.secondSongSoundingPitchClasses
    );

    assertCueTest(
      matchedCollections.firstContainedInSecond,
      "C minor pentatonic notes should remain contained in C " + modeInfo.mode
    );
    assertCueTest(
      cMinorPentatonic.key.tonic === "C" &&
        cMinorPentatonic.key.scaleType === "minorPentatonic" &&
        diatonicSong.key.tonic === "C" &&
        diatonicSong.key.mode === modeInfo.mode,
      "Matching should not alter either song's tonic or scale identity"
    );
  });

  const locrianMatch = calculateSymmetricalScaleCompatibilityShifts(
    cMinorPentatonic,
    { key: { tonic: "C", mode: "locrian" } }
  );
  assertCueTest(
    locrianMatch.firstSongShift === -1 && locrianMatch.secondSongShift === 1,
    "C minor pentatonic and C Locrian should split the two-semitone move equally"
  );
  assertCueTest(
    locrianMatch.matchedPitchClassCollection.join(",") === "1,3,5,8,10",
    "The matched collection should describe compatibility before midpoint shifts"
  );
  assertCueTest(
    locrianMatch.firstSongSoundingPitchClasses.join(",") === "2,4,6,9,11" &&
      locrianMatch.secondSongSoundingPitchClasses.join(",") === "1,2,4,6,7,9,11",
    "Sounding collections should include both songs' midpoint shifts"
  );

  const reversedLocrianMatch = calculateSymmetricalScaleCompatibilityShifts(
    { key: { tonic: "C", mode: "locrian" } },
    cMinorPentatonic
  );
  assertCueTest(
    reversedLocrianMatch.firstSongShift === 1 &&
      reversedLocrianMatch.secondSongShift === -1,
    "Containment matching should work when the diatonic song comes first"
  );

  [
    undefined,
    null,
    {},
    { key: undefined },
    { key: null },
    { key: { tonic: "C", scaleType: "harmonicMinor" } },
    { key: { tonic: "C", scaleType: "melodicMinor" } }
  ].forEach(invalidSong => {
    assertCueTest(
      getSongPitchClassCollection(invalidSong) === null,
      "Missing keys and unsupported scale types should return null safely"
    );
  });

  console.log("Pentatonic matching tests passed");
}


// Verifies Play Cue state transitions, including empty cues and preserving other decks.
function runPlayCuedSongTests() {
  const testDecks = [createDeck(1), createDeck(2)];
  const testState = {
    globalTempo: 118,
    globalPitchShift: 0.5,
    referenceKey: { tonic: "C", mode: "major" },
    decks: testDecks
  };

  const oldSong = { title: "Old active song", bpm: 120 };
  const cuedSong = { title: "Prepared cue", bpm: 90 };
  const otherSong = { title: "Other deck song", bpm: 106 };

  testDecks[0].song = oldSong;
  testDecks[0].isPlaying = true;
  testDecks[0].tempo = 122;
  testDecks[0].pitchShift = -1;
  testDecks[0].cue = {
    song: cuedSong,
    tempo: 118,
    pitchShift: 2
  };

  testDecks[1].song = otherSong;
  testDecks[1].isPlaying = true;
  testDecks[1].tempo = 106;
  testDecks[1].pitchShift = -0.5;

  playCuedSong(testDecks[0]);

  assertCueTest(testDecks[0].song === cuedSong, "Play Cue should replace the active song");
  assertCueTest(testDecks[0].tempo === 118, "Play Cue should apply the prepared tempo");
  assertCueTest(testDecks[0].pitchShift === 2, "Play Cue should apply the prepared pitch shift");
  assertCueTest(testDecks[0].isPlaying, "The cued song should start playing");
  assertCueTest(testDecks[0].cue === null, "The cue slot should clear after activation");
  assertCueTest(cuedSong.bpm === 90, "Play Cue should preserve original song BPM");
  assertCueTest(testDecks[1].song === otherSong, "Play Cue should preserve other deck songs");
  assertCueTest(testDecks[1].isPlaying, "Play Cue should not interrupt other decks");
  assertCueTest(testDecks[1].tempo === 106, "Play Cue should preserve other deck tempo");
  assertCueTest(testDecks[1].pitchShift === -0.5, "Play Cue should preserve other deck pitch");
  assertCueTest(testState.globalTempo === 118, "Play Cue should preserve global tempo");
  assertCueTest(testState.globalPitchShift === 0.5, "Play Cue should preserve global pitch");
  assertCueTest(
    testState.referenceKey.tonic === "C",
    "Play Cue should preserve the synchronization reference"
  );

  const emptyDeck = createDeck(3);
  emptyDeck.cue = {
    song: cuedSong,
    tempo: 100,
    pitchShift: -2
  };
  playCuedSong(emptyDeck);
  assertCueTest(emptyDeck.song === cuedSong, "A cue should activate on an empty deck");
  assertCueTest(emptyDeck.tempo === 100, "An empty deck should receive the prepared tempo");
  assertCueTest(emptyDeck.pitchShift === -2, "An empty deck should receive the prepared pitch");
  assertCueTest(emptyDeck.isPlaying, "An activated cue on an empty deck should play");
  assertCueTest(emptyDeck.cue === null, "An activated cue on an empty deck should clear");

  const unchangedDeck = createDeck(4);
  unchangedDeck.song = oldSong;
  unchangedDeck.isPlaying = true;
  unchangedDeck.tempo = 111;
  unchangedDeck.pitchShift = 0.75;
  playCuedSong(unchangedDeck);
  assertCueTest(unchangedDeck.song === oldSong, "An empty cue should preserve the active song");
  assertCueTest(unchangedDeck.isPlaying, "An empty cue should not stop playback");
  assertCueTest(unchangedDeck.tempo === 111, "An empty cue should preserve tempo");
  assertCueTest(unchangedDeck.pitchShift === 0.75, "An empty cue should preserve pitch");
  assertCueTest(unchangedDeck.cue === null, "An empty cue should remain empty");

  console.log("Play Cue tests passed");
}

function runMetadataModelTests() {
  runCueSongTests();
  runParentScaleMatchingTests();
  runPentatonicMatchingTests();
  runPlayCuedSongTests();
  runLegacySynchronizationDemoTests();
}

function runApplicationStartupTests() {
  assertCueTest(appState.interfaceMode === 'twoDeck', 'Startup must retain the declared interface mode');
  assertCueTest(appState.globalTempo === null && appState.globalPitchShift === 0 && appState.referenceKey === null,
    'Startup must not establish demonstration tempo or pitch references');
  assertCueTest(appState.decks.length === 4, 'Startup must create four decks');
  for (let index = 0; index < 4; index++) {
    assertCueTest(JSON.stringify(appState.decks[index]) === JSON.stringify(createDeck(index + 1)),
      'Startup must leave each metadata deck empty with factory playback settings');
  }
  assertCueTest(JSON.stringify(appState.participation) === JSON.stringify(createParticipationState()),
    'Startup must preserve all twelve participation defaults');
  console.log('Clean application startup tests passed');
}

function runLegacySynchronizationDemoTests() {
  const before = JSON.stringify(appState);
  const demo = runLegacySynchronizationDemo();
  assertCueTest(demo.beforeSync.join(',') === '120,106,,', 'Two-deck loads must remain independent');
  assertCueTest(demo.afterViewChange.join(',') === '120,106,,', 'Changing the view must not synchronize');
  const expectedTempo = (120 + 106 + 130) / 3;
  assertCueTest(demo.state.globalTempo === expectedTempo, 'Legacy load must establish the arithmetic average');
  assertCueTest(demo.state.decks.slice(0, 3).every(deck => deck.tempo === expectedTempo),
    'Legacy four-deck load must synchronize all loaded decks');
  assertCueTest(demo.state.decks[3].song === null && demo.state.decks[3].tempo === null,
    'Legacy synchronization must leave empty decks untouched');
  assertCueTest(JSON.stringify(appState) === before, 'Explicit demonstrations must not mutate application state');
  console.log('Explicit legacy synchronization demonstration tests passed');
}
