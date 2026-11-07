// A controlled clock verifies transport behavior without speakers or real-time waits.
async function runAudioEngineTests() {
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  let resumeAudio = null;
  const sources = [];
  const context = {
    currentTime: 0,
    state: "running",
    destination: {},
    resume() {
      if (resumeAudio) return resumeAudio;
      return Promise.resolve();
    },
    decodeAudioData(data) {
      if (data.invalid) return Promise.reject(new Error("Invalid audio"));
      return Promise.resolve({ duration: 20 });
    },
    createBufferSource() {
      const source = {
        playbackRate: { setValueAtTime(value) { this.value = value; } },
        connect() {},
        disconnect() { this.disconnected = true; },
        start(when, offset) { this.offset = offset; },
        stop() { this.stopped = true; }
      };
      sources.push(source);
      return source;
    }
  };
  let contextsCreated = 0;
  const engine = createAudioEngine(() => {
    contextsCreated += 1;
    return context;
  });
  const file = { name: "song.wav", arrayBuffer: () => Promise.resolve({}) };
  const originalMetadataState = JSON.stringify(appState);

  await engine.play(1);
  engine.pause(1);
  engine.stop(1);
  check(contextsCreated === 0, "Empty transport must not create audio or start playback");
  await engine.loadFile(1, file);
  check(!engine.getState(1).isPlaying, "Loading must not autoplay");
  await engine.play(1);
  await engine.play(1);
  check(sources.length === 1, "Repeated Play must not overlap sources");
  context.currentTime = 5;
  engine.pause(1);
  check(engine.getState(1).position === 5, "Pause must save elapsed time");
  context.currentTime = 10;
  check(engine.getState(1).position === 5, "Paused position must stay fixed");
  await engine.play(1);
  check(sources[1].offset === 5, "Resume must start a new source at the saved position");
  context.currentTime = 12;
  check(engine.getState(1).position === 7, "Resumed clock must include saved position");

  await engine.loadFile(2, file);
  await engine.play(2);
  engine.stop(1);
  check(engine.getState(1).position === 0, "Stop must rewind");
  check(engine.getState(2).isPlaying, "Stopping one deck must preserve another");
  check(contextsCreated === 1, "Decks must share one context");
  await engine.play(1);
  check(sources[sources.length - 1].offset === 0, "Play after Stop must start at zero");
  const endedSource = sources[sources.length - 1];
  endedSource.onended();
  check(!engine.getState(1).isPlaying, "Natural end must clear playing state");
  check(engine.getState(1).position === 20, "Natural end must show the duration");
  await engine.play(1);
  check(sources[sources.length - 1].offset === 0, "Play after natural end must restart");

  try {
    await engine.loadFile(1, {
      name: "bad.wav", arrayBuffer: () => Promise.resolve({ invalid: true })
    });
    throw new Error("Invalid audio should reject");
  } catch (error) {
    check(error.message === "Invalid audio", "Decode failure must be reported");
  }
  check(engine.getState(1).isPlaying, "Failed replacement must preserve previous audio");
  check(!engine.getState(1).loading, "Decode failure must clear loading state");

  let finishOldRead;
  const oldLoad = engine.loadFile(1, {
    name: "old.wav", arrayBuffer: () => new Promise(resolve => { finishOldRead = resolve; })
  });
  await engine.loadFile(1, { ...file, name: "new.wav" });
  finishOldRead({});
  check(await oldLoad === false, "A late old load must be ignored");
  check(engine.getState(1).fileName === "new.wav", "Latest selection must win");

  let finishResume;
  resumeAudio = new Promise(resolve => { finishResume = resolve; });
  const pendingPlay = engine.play(1);
  engine.stop(1);
  finishResume();
  await pendingPlay;
  check(!engine.getState(1).isPlaying, "Stop must cancel Play awaiting context resume");

  resumeAudio = null;
  const deckIds = [1, 2, 3, 4];
  for (const deckId of deckIds) {
    await engine.loadFile(deckId, { ...file, name: "deck-" + deckId + ".wav" });
    context.currentTime += 1;
    await engine.play(deckId);
  }
  check(deckIds.every(id => engine.getState(id).isPlaying),
    "All four decks must play simultaneously");
  context.currentTime += 2;
  for (const deckId of deckIds) engine.pause(deckId);
  const positions = deckIds.map(id => engine.getState(id).position);
  check(positions.join(",") === "5,4,3,2", "Each deck must preserve its own pause position");
  context.currentTime += 5;
  for (const deckId of deckIds) {
    check(engine.getState(deckId).position === positions[deckId - 1],
      "Each paused position must stay fixed");
    await engine.play(deckId);
    check(sources[sources.length - 1].offset === positions[deckId - 1],
      "Each deck must resume at its own offset");
  }
  for (const deckId of deckIds) {
    const otherDeckId = deckId === 4 ? 1 : deckId + 1;
    const otherState = JSON.stringify(engine.getState(otherDeckId));
    engine.stop(deckId);
    check(engine.getState(deckId).position === 0 && !engine.getState(deckId).isPlaying,
      "Stop must rewind and silence each deck");
    await engine.play(deckId);
    const ejectedSource = sources[sources.length - 1];
    engine.eject(deckId);
    const empty = engine.getState(deckId);
    check(!empty.loaded && !empty.isPlaying && !empty.loading &&
      empty.position === 0 && empty.duration === 0 && empty.fileName === "",
      "Eject must fully reset each audio player");
    check(ejectedSource.stopped && ejectedSource.disconnected && ejectedSource.onended === null,
      "Eject must stop and disconnect the source and remove its callback");
    await engine.play(deckId);
    check(!engine.getState(deckId).isPlaying, "Ejected decks must not play");
    engine.eject(deckId);
    check(JSON.stringify(engine.getState(otherDeckId)) === otherState,
      "Stop and Eject must not change another deck");
    await engine.loadFile(deckId, file);
    await engine.play(deckId);
    check(engine.getState(deckId).isPlaying, "Each deck must be reusable after ejecting");
  }

  let finishEjectedRead;
  const ejectedLoad = engine.loadFile(3, {
    name: "pending.wav", arrayBuffer: () => new Promise(resolve => { finishEjectedRead = resolve; })
  });
  engine.eject(3);
  finishEjectedRead({});
  check(await ejectedLoad === false, "Eject must invalidate a pending load");
  check(!engine.getState(3).loaded, "A late load must not restore ejected audio");
  await engine.loadFile(3, file);
  resumeAudio = new Promise(resolve => { finishResume = resolve; });
  const ejectedPlay = engine.play(3);
  engine.eject(3);
  finishResume();
  await ejectedPlay;
  check(!engine.getState(3).loaded && !engine.getState(3).isPlaying,
    "Eject must cancel Play awaiting context resume");
  check(contextsCreated === 1, "Eject must preserve the shared context");

  check(calculatePlaybackRate(120, 150) === 1.25, "Rate must equal target / original BPM");
  check(calculatePlaybackRate(120, 60) === 0.5, "Slower tempo must use a fractional rate");
  check(calculatePlaybackRate(120.5, 120.5) === 1, "Fractional BPM and equal tempos must work");
  for (const invalid of [undefined, null, "120", "", NaN, Infinity, -Infinity, 0, -1]) {
    check(calculatePlaybackRate(invalid, 120) === null &&
      calculatePlaybackRate(120, invalid) === null, "Invalid BPM must not produce a rate");
  }
  check(calculatePlaybackRate(1e-300, 1e300) === null &&
    calculatePlaybackRate(1e300, 1e-300) === null,
    "Unrepresentable rate ratios must be rejected");

  resumeAudio = null;
  for (const deckId of deckIds) {
    await engine.loadFile(deckId, file);
    check(engine.getState(deckId).originalBpm === null &&
      engine.getState(deckId).playbackRate === 1, "Unknown BPM must default to normal speed");
    engine.setTempo(deckId, 120, 120);
    await engine.play(deckId);
  }
  context.currentTime += 2;
  for (const deckId of deckIds) {
    const before = engine.getState(deckId).position;
    const otherStates = deckIds.filter(id => id !== deckId)
      .map(id => JSON.stringify(engine.getState(id)));
    const source = sources[sources.length - (5 - deckId)];
    const count = sources.length;
    check(engine.setTempo(deckId, 120, 180), "Each deck must accept its own target BPM");
    check(engine.getState(deckId).position === before && engine.getState(deckId).isPlaying,
      "Changing tempo must preserve position and playing state");
    check(sources.length === count && !source.stopped && source.playbackRate.value === 1.5,
      "Tempo must update the existing audio source without restarting");
    check(deckIds.filter(id => id !== deckId).every((id, index) =>
      JSON.stringify(engine.getState(id)) === otherStates[index]),
      "Tempo changes must not affect other decks");
  }
  context.currentTime += 2;
  check(engine.getState(1).position === 5, "Position must integrate time at both rates");
  engine.setTempo(1, 120, 60);
  context.currentTime += 2;
  check(engine.getState(1).position === 6, "Repeated rate changes must keep position continuous");
  engine.pause(1);
  engine.setTempo(1, 120, 240);
  context.currentTime += 2;
  check(engine.getState(1).position === 6 && !engine.getState(1).isPlaying,
    "Changing a paused tempo must not move position or start playback");
  await engine.play(1);
  check(sources[sources.length - 1].offset === 6 &&
    sources[sources.length - 1].playbackRate.value === 2,
    "Resume must use saved position and new rate");
  context.currentTime += 1;
  check(engine.getState(1).position === 8, "Resume must track elapsed source position at new rate");
  const beforeInvalid = JSON.stringify(engine.getState(1));
  check(!engine.setTempo(1, 0, 120) && !engine.setTempo(1, 120, NaN),
    "Invalid tempo settings must be rejected");
  check(JSON.stringify(engine.getState(1)) === beforeInvalid,
    "Invalid settings must preserve audio state");
  engine.stop(1);
  engine.setTempo(1, 120, 90);
  check(engine.getState(1).position === 0 && !engine.getState(1).isPlaying,
    "Changing stopped tempo must not start playback");
  await engine.play(1);
  check(sources[sources.length - 1].offset === 0 &&
    sources[sources.length - 1].playbackRate.value === 0.75,
    "Play after Stop must start at zero with configured rate");
  await engine.loadFile(1, file);
  check(engine.getState(1).originalBpm === null && engine.getState(1).targetBpm === null &&
    engine.getState(1).playbackRate === 1, "Replacement must reset track-specific BPM settings");
  engine.setTempo(1, 120, 180);
  engine.eject(1);
  check(engine.getState(1).originalBpm === null && engine.getState(1).targetBpm === null &&
    engine.getState(1).playbackRate === 1, "Eject must clear tempo settings");
  check(!engine.setTempo(1, 120, 180), "Empty decks must reject tempo application");
  console.log("Tempo tests passed");
  check(JSON.stringify(appState) === originalMetadataState,
    "Audio transport must not change metadata, cues, tempo, pitch, or synchronization state");
  console.log("Audio engine tests passed");
}

runAudioEngineTests().catch(error => {
  console.error("Audio engine tests failed:", error);
  throw error;
});
