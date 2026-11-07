// Temporary audio controls. These do not call metadata loading or cueing.
const signalsmithPlayer = createSignalsmithPlayer();
const audioEngine = createDeckOneExperimentRouter(createAudioEngine(), createPitchPreservingPlayer(), signalsmithPlayer);

// Each call keeps its elements and pending selections local to one deck.
function createDeckAudioControls(deckId) {
  const template = document.getElementById("audio-deck-template");
  const section = template.content.firstElementChild.cloneNode(true);
  section.querySelector("h2").textContent = "Deck " + deckId;
  const headingId = "audio-deck-title-" + deckId;
  section.querySelector("h2").id = headingId;
  section.setAttribute("aria-labelledby", headingId);
  document.getElementById("audio-decks").appendChild(section);

  const audioFileInput = section.querySelector('input[type="file"]');
  const loadSelectedButton = section.querySelector('[data-action="load-selected"]');
  let selectedSignalsmithFile = null;
  const isSignalsmith = () => deckId === 1 && audioEngine.getMode() === 'signalsmith';
  const playButton = section.querySelector('[data-action="play"]');
  const pauseButton = section.querySelector('[data-action="pause"]');
  const stopButton = section.querySelector('[data-action="stop"]');
  const ejectButton = section.querySelector('[data-action="eject"]');
  const audioStatus = section.querySelector('[data-display="status"]');
  const audioPosition = section.querySelector('[data-display="position"]');
  const originalBpmInput = section.querySelector('[data-input="original-bpm"]');
  const targetBpmInput = section.querySelector('[data-input="target-bpm"]');
  const tempoButton = section.querySelector('[data-action="tempo"]');
  const tempoStatus = section.querySelector('[data-display="tempo"]');
  const modeInput = section.querySelector('[data-input="playback-mode"]');
  if (deckId === 1) section.querySelector('[data-experiment]').hidden = false;
  const isPreserving = () => deckId === 1 && audioEngine.isPitchPreserving();
  const comparisonPanel = section.querySelector('[data-comparison]');
  const comparisonInput = section.querySelector('[data-input="comparison-level"]');
  comparisonInput.addEventListener('input', () => {
    if (deckId === 1 && isPreserving()) {
      audioEngine.setComparisonLevel(comparisonInput.valueAsNumber * 0.25);
    }
  });
  let selectionVersion = 0;
  let wasClosureBlocked = false;
  let wasReleasing = false;

  function resetTempoControls() {
    originalBpmInput.value = "";
    targetBpmInput.value = "";
    tempoStatus.textContent = "BPM unknown — playback rate 1.000×";
  }

  function updateAudioControls() {
    const state = audioEngine.getState(deckId);
    const closureBlocked = isSignalsmith() && state.closureBlocked;
    if (closureBlocked) audioStatus.textContent = state.closureStatus;
    else if (wasClosureBlocked) audioStatus.textContent = 'Signalsmith context closure completed. Click Load selected file or Play to continue.';
    if (!closureBlocked && isSignalsmith()) {
      if (state.releasePending) audioStatus.textContent = 'Signalsmith release finishing; Play/Load will require a fresh click.';
      else if (wasReleasing) audioStatus.textContent = 'Signalsmith release finished. Click Play or Load selected file to continue.';
    }
    wasReleasing = !!state.releasePending;
    wasClosureBlocked = closureBlocked;
    comparisonPanel.hidden = !isPreserving();
    if (isPreserving()) comparisonInput.value = String(state.comparisonLevel / 0.25);
    playButton.disabled = !state.loaded || state.loading || state.isPlaying || closureBlocked;
    pauseButton.disabled = !state.isPlaying || state.loading;
    stopButton.disabled = !state.loaded || state.loading;
    ejectButton.disabled = !state.loaded && !state.loading && !(isSignalsmith() && selectedSignalsmithFile);
    loadSelectedButton.hidden = !isSignalsmith();
    loadSelectedButton.disabled = !selectedSignalsmithFile || state.loading || closureBlocked;
    originalBpmInput.disabled = !state.loaded || state.loading;
    targetBpmInput.disabled = !state.loaded || state.loading;
    tempoButton.disabled = !state.loaded || state.loading;
    modeInput.disabled = state.loaded || state.loading;
    audioFileInput.disabled = state.loading;
    audioPosition.textContent = state.position.toFixed(1) + " / " +
      state.duration.toFixed(1) + " seconds — " +
      (state.isPlaying ? "Playing" : "Paused / stopped");
    if (isPreserving()) {
      const seconds = value => Number.isFinite(value) ? value.toFixed(3) + ' s' : 'unavailable';
      if (audioEngine.getMode() === 'signalsmith') {
        audioPosition.textContent += ' | saved source coordinate ' + seconds(state.savedSourcePosition) +
          ' | library read-ahead report ' + seconds(state.libraryInputPosition) +
          ' | DSP consumed / rendered position unavailable | DSP latency ' + seconds(state.dspLatency);
      } else {
        audioPosition.textContent += ' | PCM read ' + seconds(state.sourcePosition) +
          ' | DSP consumed ' + seconds(state.processedPosition) +
          ' | rendered map ' + seconds(state.renderedPosition);
      }
      audioPosition.textContent += ' | estimated audible ' + seconds(state.estimatedAudiblePosition) +
        ' | device latency estimate ' + seconds(state.estimatedOutputLatency) +
        ' | sampled peak ' + state.outputPeak.toFixed(3) +
        ' RMS ' + state.outputRms.toFixed(3) + (state.outputPeak >= 1 ? ' — CLIPPING: lower comparison output level' : '');
      if (state.error && !closureBlocked) audioStatus.textContent = state.error;
    }
  }

  modeInput.addEventListener('change', () => {
    if (deckId !== 1) return;
    if (!audioEngine.setMode(modeInput.value)) {
      modeInput.value = audioEngine.getMode();
      return;
    }
    if (selectedSignalsmithFile) audioFileInput.value = "";
    selectedSignalsmithFile = null;
    ++selectionVersion;
    resetTempoControls();
    audioStatus.textContent = isPreserving()
      ? audioEngine.getMode() + ' selected. Load a file; tempo range 0.8–1.2×.'
      : 'Normal Playback selected.';
    updateAudioControls();
  });

  audioFileInput.addEventListener("change", () => {
    const file = audioFileInput.files[0];
    if (!file) return;
    if (isSignalsmith()) {
      selectedSignalsmithFile = file;
      ++selectionVersion;
      audioStatus.textContent = 'Selected: ' + file.name + '. Click Load selected file (temporary activation experiment).';
      updateAudioControls();
      return;
    }
    void loadFileFromControls(file);
  });

  loadSelectedButton.addEventListener('click', () => {
    if (!isSignalsmith() || !selectedSignalsmithFile || audioEngine.getState(deckId).loading || audioEngine.getState(deckId).closureBlocked) return;
    // No await or deferred callback before the adapter creates/resumes its context.
    void loadFileFromControls(selectedSignalsmithFile);
  });

  async function loadFileFromControls(file) {
    const version = ++selectionVersion;
    audioStatus.textContent = "Loading " + file.name + "…";
    try {
      const loading = audioEngine.loadFile(deckId, file);
      updateAudioControls();
      if (await loading && version === selectionVersion) {
        if (isSignalsmith()) selectedSignalsmithFile = null;
        audioStatus.textContent = "Loaded: " + file.name;
        resetTempoControls();
      }
    } catch (error) {
      if (version === selectionVersion) {
        // Safari must emit change again when retrying the same failed AIFF file.
        if (deckId === 1 && audioEngine.getMode() === 'signalsmith') audioFileInput.value = '';
        const previous = audioEngine.getState(deckId).fileName;
        audioStatus.textContent = "Could not load this file. Try a Safari-supported audio file." +
          (previous ? " Previous file retained: " + previous : "");
        console.error("Audio loading failed:", error);
      }
    } finally {
      if (version === selectionVersion) updateAudioControls();
    }
  }

  tempoButton.addEventListener("click", () => {
    // valueAsNumber returns NaN for a blank or invalid number input.
    const applied = audioEngine.setTempo(
      deckId, originalBpmInput.valueAsNumber, targetBpmInput.valueAsNumber
    );
    if (applied) {
      const state = audioEngine.getState(deckId);
      tempoStatus.textContent = state.originalBpm + " → " + state.targetBpm +
        " BPM — rate " + state.playbackRate.toFixed(3) +
        (isPreserving() ? "× (experimental pitch preservation)" : "× (pitch changes too)");
    } else {
      tempoStatus.textContent = "Enter finite BPM values greater than zero with a supported ratio. " +
        (isPreserving() ? "Experiment requires a ratio from 0.8 to 1.2. " : "") +
        "Applied settings unchanged; rate " + audioEngine.getState(deckId).playbackRate.toFixed(3) + "×.";
    }
    updateAudioControls();
  });

  playButton.addEventListener("click", async () => {
    const version = selectionVersion;
    try {
      await audioEngine.play(deckId);
    } catch (error) {
      if (version === selectionVersion) audioStatus.textContent = error.message;
      console.error("Audio playback failed:", error);
    }
    updateAudioControls();
  });
  pauseButton.addEventListener("click", async () => {
    try { await audioEngine.pause(deckId); }
    catch (error) { audioStatus.textContent = error.message; }
    updateAudioControls();
  });
  stopButton.addEventListener("click", async () => {
    try { await audioEngine.stop(deckId); }
    catch (error) { audioStatus.textContent = error.message; }
    updateAudioControls();
  });

  ejectButton.addEventListener("click", async () => {
    const version = ++selectionVersion;
    selectedSignalsmithFile = null;
    const ejecting = audioEngine.eject(deckId);
    audioFileInput.value = "";
    resetTempoControls();
    audioStatus.textContent = "No audio file loaded.";
    updateAudioControls();
    try { await ejecting; }
    catch (error) { if (version === selectionVersion) audioStatus.textContent = error.message; }
    if (version === selectionVersion) updateAudioControls();
  });

  updateAudioControls();
  return updateAudioControls;
}

const updateDeckAudioControls = [1, 2, 3, 4].map(createDeckAudioControls);
// One refresh timer updates all decks, including natural playback endings.
setInterval(() => {
  updateDeckAudioControls.forEach(update => update());
}, 100);
