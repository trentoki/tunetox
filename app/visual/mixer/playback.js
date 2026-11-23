// Approved H5.3.1 presentation for the new Clean Playback host.
// Inputs: one persistent Clean Deck state and bound host actions.
// Output: a DOM node, render(), and setBusy(). No player creation or DSP here.
// Class names follow docs/visual-verification/APPROVED-NAMING.md.
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, label, action) {
  const node = element("button", className, text);
  node.type = "button";
  node.setAttribute("aria-label", label);
  if (action) node.addEventListener("click", action);
  else {
    node.disabled = true;
    node.title = "Visual preview — not connected to playback";
  }
  return node;
}

// Deterministic illustration only; no decoding, analysis or audio-derived claims.
function waveform(seed) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 360 160");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 60; index++) {
    const height = 12 + Math.abs(Math.sin(index * .43 + seed) * Math.cos(index * .17)) * 136;
    const bar = document.createElementNS(svg.namespaceURI, "rect");
    bar.setAttribute("x", index * 6);
    bar.setAttribute("y", (160 - height) / 2);
    bar.setAttribute("width", 3);
    bar.setAttribute("height", height);
    svg.append(bar);
  }
  return svg;
}

function drawWaveform(svg, peaks) {
  svg.replaceChildren();
  if (!peaks?.length) return;
  for (let index = 0; index < peaks.length; index++) {
    const height = Math.max(1, peaks[index] * 160);
    const bar = document.createElementNS(svg.namespaceURI, "rect");
    bar.setAttribute("x", String(index * 360 / peaks.length));
    bar.setAttribute("y", String((160 - height) / 2));
    bar.setAttribute("width", String(360 / peaks.length));
    bar.setAttribute("height", String(height));
    svg.append(bar);
  }
}

function previewRange(className, label, value, max = 100) {
  const node = element("label", className);
  node.append(element("span", "", label));
  const input = element("input");
  input.type = "range";
  input.min = "0";
  input.max = String(max);
  input.value = String(value);
  input.disabled = true;
  input.setAttribute("aria-label", label + " (preview)");
  node.append(input);
  return node;
}

function createWave(number) {
  const node = element("div", "wave-view");
  const wave = element("div", "scrolling-waveform");
  wave.append(waveform(number), element("span", "playhead"));
  const caption = element("small", "", "Hold · ±5% nudge     ZOOM · ILLUSTRATIVE");
  wave.append(caption);
  const time = element("output", "current-playback-time", "0:00 / —");
  node.append(wave, time);
  return { node, time };
}

function createCues() {
  const node = element("div", "cues-view");
  const pads = element("div", "cue-pads");
  for (let cue = 1; cue <= 8; cue++) {
    const pad = button("cue-pad", cue + " · Set", "Cue " + cue + " (preview)");
    pad.dataset.cue = cue;
    pads.append(pad);
  }
  const loop = element("div", "loop-controls");
  loop.append(element("small", "", "4b"),
    button("halve-loop-button", "−½", "Halve loop (preview)"),
    button("loop-toggle-button", "ON", "Loop (preview)"),
    button("double-loop-button", "×2", "Double loop (preview)"),
    button("", "Repeat", "Repeat (preview)"), button("", "Shift", "Shift (preview)"));
  node.append(pads, loop);
  return node;
}

function createControls() {
  const node = element("div", "controls");
  const knobs = element("div");
  for (const [label, band] of [["Filter", null], ["Low", "low"], ["Mid", "mid"], ["High", "high"]]) {
    const wrap = element("label");
    const knob = button(band ? "eq-knob" : "filter-knob", "", label + " (preview)");
    if (band) knob.dataset.frequencyBand = band;
    wrap.append(element("span", "", label), knob, element("output", "", band ? "0.0 dB" : "0.00"));
    knobs.append(wrap);
  }
  const effects = element("div", "effects-controls");
  for (const effect of ["Echo", "Reverb", "Delay"]) {
    const pair = element("div");
    pair.append(button("effect-selector", effect, effect + " selection (preview)"),
      button("effect-knob", "", effect + " amount (preview)"), element("output", "", "0%"));
    effects.append(pair);
  }
  node.append(knobs, effects);
  return node;
}

function createStems() {
  const node = element("div", "stems-view");
  const stems = element("div", "stem-faders");
  // Approved attribute identities; visible historical labels remain unchanged.
  for (const [name, stem] of [["Transients", "beat"], ["Flow", "bass"], ["Tune", "tune"], ["Voice", "voice"]]) {
    const fader = previewRange("", name + " 100%", 100);
    fader.querySelector("span").replaceChildren(document.createTextNode(name), element("output", "", "100%"));
    fader.querySelector("input").dataset.stem = stem;
    stems.append(fader);
  }
  node.append(stems);
  return node;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

export function createPlaybackDeck(number, deck, actions) {
  let upperView = "wave-view";
  let lowerView = "cues-view";
  let workspace = "performance-view";
  let busy = false;
  const node = element("section", "deck");
  node.dataset.deck = number;
  node.setAttribute("aria-label", "Deck " + number);
  const performance = element("div", "performance-view");
  const header = element("div", "performance-header");
  const participation = button("deck-participation-button", "D" + number, "Deck " + number + " participation (preview)");
  participation.append(element("small", "", "B T H"));
  const tempo = previewRange("tempo-slider", "Tempo", 500, 1000);
  const tempoInput = tempo.querySelector("input");
  tempoInput.disabled = false;
  tempoInput.step = "1";
  tempoInput.setAttribute("aria-label", "Tempo ratio for Deck " + number);
  // Log2 scale: endpoints are half/double speed, exact center is unity.
  tempoInput.addEventListener("input", () => actions.setTempo(2 ** (2 * Number(tempoInput.value) / 1000 - 1)));
  const tempoValue = element("output", "", "1.00×");
  tempo.append(tempoValue);
  const pitch = previewRange("pitch-slider", "Pitch", 0, 12);
  pitch.append(element("output", "", "+0.0"));
  const libraryButton = button("library-button", "Library", "Open Library for Deck " + number, () => {
    workspace = "library-view";
    render();
    back.focus();
  });
  const title = element("strong", "song-title");
  // Reuse the original compact header selector slot: two buttons, no new rows.
  // Each changes only its own deck-local presentation selection.
  const selector = element("div", "performance-selector");
  selector.setAttribute("role", "group");
  selector.setAttribute("aria-label", "Performance views for Deck " + number);
  const upperToggle = button("performance-upper-toggle", "Wave", "Toggle upper section for Deck " + number, () => {
    upperView = upperView === "wave-view" ? "stems-view" : "wave-view";
    render();
  });
  const lowerToggle = button("performance-lower-toggle", "Cues", "Toggle lower section for Deck " + number, () => {
    lowerView = lowerView === "cues-view" ? "controls" : "cues-view";
    render();
  });
  selector.append(upperToggle, lowerToggle);
  const play = button("play-pause-button", "▶", "Play Deck " + number, actions.togglePlayback);
  const queue = button("queue-button", "EMPTY", "Queue empty", actions.playQueue);
  const main = previewRange("main-volume-fader", "MAIN 0%", 0);
  const mainPercentage = element("output", "", "MAIN 0%");
  main.querySelector("span").replaceChildren(mainPercentage);
  const mainInput = main.querySelector("input");
  mainInput.disabled = false;
  mainInput.setAttribute("aria-label", "Main volume for Deck " + number);
  mainInput.addEventListener("input", () => actions.setMainVolume(Number(mainInput.value) / 100));
  const overview = element("div", "waveform-overview");
  const overviewGraphic = waveform(number);
  overview.append(overviewGraphic);
  const overviewPosition = element("span", "playhead");
  const overviewCaption = element("small", "", "FULL SONG · LOAD AUDIO");
  overview.append(overviewPosition, overviewCaption);
  let displayedPeaks = null;
  header.append(participation, tempo, pitch, libraryButton, title, selector, play, queue, main, overview);
  const content = element("div", "performance-content");
  const upperSection = element("section", "performance-upper-section");
  upperSection.setAttribute("aria-label", "Upper performance section for Deck " + number);
  const lowerSection = element("section", "performance-lower-section");
  lowerSection.setAttribute("aria-label", "Lower performance section for Deck " + number);
  upperSection.id = "deck-" + number + "-upper";
  lowerSection.id = "deck-" + number + "-lower";
  upperToggle.setAttribute("aria-controls", upperSection.id);
  lowerToggle.setAttribute("aria-controls", lowerSection.id);
  const wave = createWave(number);
  const stems = createStems();
  const cues = createCues();
  const controls = createControls();
  upperSection.append(wave.node, stems);
  lowerSection.append(cues, controls);
  content.append(upperSection, lowerSection);
  performance.append(header, content);

  const library = element("div", "library-view");
  const libraryHeader = element("div", "library-header");
  const sectionSelector = element("div", "section-selector");
  for (const text of ["Songs", "Playlists", "Links"]) sectionSelector.append(button("", text, text + " (preview)"));
  const back = button("back-to-performance-button", "←", "Return to performance for Deck " + number, () => {
    workspace = "performance-view";
    render();
    libraryButton.focus();
  });
  libraryHeader.append(element("small", "", "D" + number), sectionSelector, back);
  const libraryContent = element("div", "library-content");
  const sort = element("div", "song-sort-selector");
  for (const text of ["Title", "BPM", "Key", "Artist"]) sort.append(button("", text, "Sort " + text + " (preview)"));
  const search = element("input", "search");
  search.type = "search";
  search.placeholder = "Search songs / artists";
  search.setAttribute("aria-label", "Search library (preview)");
  search.disabled = true;
  const results = element("div", "search-results");
  const selected = element("div");
  selected.append(element("small", "", "Load audio using the controls above"));
  const destinations = element("div");
  for (const [index, name] of ["one", "two", "three", "four"].entries()) {
    destinations.append(button("send-to-deck-" + name, String(index + 1), "Send to Deck " + (index + 1) + " (preview)"));
  }
  selected.append(destinations);
  libraryContent.append(sort, search, results, selected);
  library.append(libraryHeader, libraryContent);
  node.append(performance, library);

  function updatePlaybackTime() {
    const songPosition = deck.audio.currentTime;
    const duration = deck.audio.duration;
    wave.time.value = formatTime(songPosition) + " / " + formatTime(duration);
    const fraction = Number.isFinite(duration) && duration > 0 ? songPosition / duration : 0;
    overviewPosition.style.left = fraction * 100 + "%";
  }

  function render() {
    const peaks = deck.audio.waveformPeaks;
    if (peaks !== displayedPeaks) {
      displayedPeaks = peaks;
      drawWaveform(overviewGraphic, peaks);
      overviewCaption.textContent = peaks ? "FULL SONG · REAL AUDIO" : "FULL SONG · LOAD AUDIO";
    }
    tempoValue.value = deck.tempoRatio.toFixed(2) + "×";
    tempoInput.value = String(Math.round((Math.log2(deck.tempoRatio) + 1) * 500));
    tempoInput.setAttribute("aria-valuetext", deck.tempoRatio.toFixed(2) + " times original speed");
    tempoInput.disabled = busy;
    const percentage = Math.round(deck.mainVolume * 100);
    mainPercentage.textContent = "MAIN " + percentage + "%";
    mainInput.value = String(percentage);
    mainInput.style.setProperty("--main-volume-fill", percentage + "%");
    mainInput.setAttribute("aria-valuetext", percentage + "%");
    performance.hidden = workspace !== "performance-view";
    library.hidden = workspace !== "library-view";
    wave.node.hidden = upperView !== "wave-view";
    stems.hidden = upperView !== "stems-view";
    cues.hidden = lowerView !== "cues-view";
    controls.hidden = lowerView !== "controls";
    upperToggle.textContent = upperView === "wave-view" ? "Wave" : "Stems";
    lowerToggle.textContent = lowerView === "cues-view" ? "Cues" : "Controls";
    upperToggle.setAttribute("aria-pressed", String(upperView === "stems-view"));
    lowerToggle.setAttribute("aria-pressed", String(lowerView === "controls"));
    upperToggle.title = "Switch upper section to " + (upperView === "wave-view" ? "Stems" : "Wave");
    lowerToggle.title = "Switch lower section to " + (lowerView === "cues-view" ? "Controls" : "Cues");
    title.textContent = deck.song?.name || "Load a song";
    title.title = title.textContent;
    play.textContent = deck.isPlaying ? "Ⅱ" : "▶";
    play.disabled = !deck.song || busy;
    play.setAttribute("aria-label", (deck.isPlaying ? "Pause" : "Play") + " Deck " + number);
    play.setAttribute("aria-pressed", String(deck.isPlaying));
    queue.textContent = deck.queue ? "READY" : "EMPTY";
    queue.disabled = !deck.queue || busy;
    queue.title = deck.queue?.name || "Queue empty";
    queue.setAttribute("aria-label", deck.queue ? "Play queued song on Deck " + number : "Queue empty");
    updatePlaybackTime();
    // The full-song waveform is derived from source samples; zoomed view is still illustrative.
    results.replaceChildren();
    for (const song of actions.librarySongs()) {
      const row = element("div", "search-result");
      row.append(element("strong", "song-title", song.name), element("span", "artist", "Local audio"));
      results.append(row);
    }
    if (!results.children.length) results.append(element("p", "", "No songs loaded. Use Load D1–D4 above."));
  }

  return { node, render, updatePlaybackTime, setBusy(value) { busy = value; render(); } };
}

