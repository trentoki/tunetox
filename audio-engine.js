// Pure calculation: reject unknown BPMs and rates Web Audio cannot represent safely.
function calculatePlaybackRate(originalBpm, targetBpm) {
  if (!Number.isFinite(originalBpm) || originalBpm <= 0 ||
      !Number.isFinite(targetBpm) || targetBpm <= 0) return null;
  const rate = targetBpm / originalBpm;
  // AudioParam values use 32-bit floats; reject overflow and underflow as well.
  if (!Number.isFinite(Math.fround(rate)) || Math.fround(rate) <= 0) return null;
  return rate;
}

// Real audio is kept separate from the metadata-only deck and cue prototype.
// Pass a context factory in tests; the browser creates its context on first use.
function createAudioEngine(createContext = () => new window.AudioContext()) {
  let context = null;
  const players = new Map();

  function getContext() {
    if (context === null) context = createContext();
    return context;
  }

  function getPlayer(deckId) {
    if (!players.has(deckId)) {
      players.set(deckId, {
        buffer: null, source: null, position: 0, startedAt: 0,
        fileName: "", loadVersion: 0, playVersion: 0, loading: false,
        originalBpm: null, targetBpm: null, playbackRate: 1
      });
    }
    return players.get(deckId);
  }

  function getPosition(player) {
    if (player.source === null) return player.position;
    return Math.min(
      player.buffer.duration,
      player.position + (context.currentTime - player.startedAt) * player.playbackRate
    );
  }

  function releaseSource(player) {
    if (player.source === null) return;
    // Detach the callback so an old source cannot reset a later playback.
    player.source.onended = null;
    player.source.stop();
    player.source.disconnect();
    player.source = null;
  }

  async function loadFile(deckId, file) {
    const player = getPlayer(deckId);
    const version = ++player.loadVersion;
    ++player.playVersion;
    player.loading = true;
    try {
      const audioContext = getContext();
      const data = await file.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(data);
      // Only the latest selection may replace a deck's audio.
      if (version !== player.loadVersion) return false;
      releaseSource(player);
      player.buffer = buffer;
      player.position = 0;
      player.fileName = file.name;
      player.originalBpm = null;
      player.targetBpm = null;
      player.playbackRate = 1;
      return true;
    } finally {
      if (version === player.loadVersion) player.loading = false;
    }
  }

  async function play(deckId) {
    const player = getPlayer(deckId);
    if (!player.buffer || player.loading || player.source !== null) return;
    const audioContext = getContext();
    const version = player.playVersion;
    // Call from a Play click so Safari permits audio output.
    await audioContext.resume();
    // Pause, Stop, or loading another file may have happened while resuming.
    if (version !== player.playVersion || player.source !== null || player.loading) return;
    if (audioContext.state !== "running") {
      throw new Error("Audio could not start. Press Play to try again.");
    }
    if (player.position >= player.buffer.duration) player.position = 0;
    const source = audioContext.createBufferSource();
    source.buffer = player.buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      if (player.source !== source) return;
      source.disconnect();
      player.source = null;
      player.position = player.buffer.duration;
    };
    try {
      source.playbackRate.setValueAtTime(player.playbackRate, audioContext.currentTime);
      source.start(0, player.position);
    } catch (error) {
      source.disconnect();
      throw error;
    }
    player.startedAt = audioContext.currentTime;
    player.source = source;
  }

  function pause(deckId) {
    const player = getPlayer(deckId);
    ++player.playVersion; // Also cancels a pending Play request.
    player.position = getPosition(player);
    releaseSource(player);
  }

  // Changes an existing source in place: no restart, seeking, or automatic Play.
  function setTempo(deckId, originalBpm, targetBpm) {
    const player = getPlayer(deckId);
    const rate = calculatePlaybackRate(originalBpm, targetBpm);
    if (!player.buffer || player.loading || rate === null) return false;
    const position = getPosition(player);
    if (player.source !== null) {
      player.source.playbackRate.setValueAtTime(rate, context.currentTime);
      player.startedAt = context.currentTime;
    }
    player.position = position;
    player.originalBpm = originalBpm;
    player.targetBpm = targetBpm;
    player.playbackRate = rate;
    return true;
  }

  function stop(deckId) {
    pause(deckId);
    getPlayer(deckId).position = 0;
  }

  function eject(deckId) {
    const player = getPlayer(deckId);
    stop(deckId);
    // A decode already in progress may finish, but must not restore ejected audio.
    ++player.loadVersion;
    player.buffer = null;
    player.fileName = "";
    player.startedAt = 0;
    player.loading = false;
    player.originalBpm = null;
    player.targetBpm = null;
    player.playbackRate = 1;
  }

  function getState(deckId) {
    const player = getPlayer(deckId);
    return {
      fileName: player.fileName,
      loaded: player.buffer !== null,
      loading: player.loading,
      isPlaying: player.source !== null,
      position: getPosition(player),
      originalBpm: player.originalBpm,
      targetBpm: player.targetBpm,
      playbackRate: player.playbackRate,
      duration: player.buffer ? player.buffer.duration : 0
    };
  }

  return { loadFile, play, pause, stop, eject, setTempo, getState };
}
