// Approved H5.3.1 presentation for the new Clean Playback host.
// Inputs: one persistent Clean Deck state and bound host actions.
// Output: a DOM node, render(), and setBusy(). No player creation or DSP here.
// Class names follow docs/visual-verification/APPROVED-NAMING.md.
import { installCueControls } from '../themes/glass-hardware/cue-preview.js';
import { createOverviewWaveform, drawOverviewWaveform } from '../waveform/overview-waveform.js';
import { createScrollingWaveform, createScrollingRenderer, SCROLLING_WINDOW_SECONDS } from '../waveform/scrolling-waveform.js';

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

function createRangeField(className, label, value, max = 100) {
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

// Futuristic changes pointer operation only, reusing the native range's input
// action and keyboard support. 360px covers the full range (180px per octave
// for Tempo). The anchor is gesture state, never another stored Tempo value.
function installVerticalRoller(surface, input) {
  const rollerTravelPixels = 360;
  let drag = null;
  let removal;
  function cancel() {
    const previous = drag;
    drag = null;
    removal?.disconnect();
    window.removeEventListener('blur', cancel);
    delete surface.dataset.dragging;
    if (previous && surface.hasPointerCapture(previous.id)) surface.releasePointerCapture(previous.id);
  }
  surface.addEventListener('pointerdown', event => {
    if (document.documentElement.dataset.theme !== 'futuristic' || input.disabled ||
      drag || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); // Suppress the native horizontal range jump.
    input.focus({ preventScroll: true });
    drag = { id: event.pointerId, y: event.clientY, value: Number(input.value) };
    surface.setPointerCapture(event.pointerId);
    surface.dataset.dragging = 'true';
    window.addEventListener('blur', cancel);
    removal = new MutationObserver(() => { if (!surface.isConnected) cancel(); });
    removal.observe(document, { childList: true, subtree: true });
  }, true);
  surface.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (input.disabled || document.documentElement.dataset.theme !== 'futuristic') { cancel(); return; }
    event.preventDefault();
    const min = Number(input.min), max = Number(input.max);
    const value = Math.round(Math.max(min, Math.min(max,
      drag.value + (drag.y - event.clientY) * (max - min) / rollerTravelPixels)));
    if (Number(input.value) !== value) {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => { if (drag?.id === event.pointerId) cancel(); });
  }
  return cancel;
}

function createWave() {
  const node = element("div", "wave-view");
  const wave = element("div", "scrolling-waveform");
  const scrollingGraphic = createScrollingWaveform();
  const scrollingPlayhead = element("span", "playhead");
  wave.append(scrollingGraphic, scrollingPlayhead);
  const time = element("output", "current-playback-time", "0:00 / —");
  node.append(wave, time);
  return { node, time, surface: wave, graphic: scrollingGraphic, scrollingPlayhead };
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

function createStems(actions) {
  const node = element("div", "stems-view");
  const stems = element("div", "stem-faders");
  // Approved attribute identities; visible historical labels remain unchanged.
  for (const [name, stem] of [["Transients", "beat"], ["Flow", "bass"], ["Tune", "tune"], ["Voice", "voice"]]) {
    const fader = createRangeField("", name + " 100%", 100);
    fader.querySelector("span").replaceChildren(document.createTextNode(name), element("output", "", "100%"));
    const input = fader.querySelector("input");
    input.dataset.stem = stem;
    input.disabled = false;
    input.step = "1";
    input.setAttribute("aria-label", name + " level (stem audio not connected)");
    input.addEventListener("input", () => actions.setStemLevel(stem, Number(input.value) / 100));
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
  const tempo = createRangeField("tempo-slider", "Tempo", 500, 1000);
  const tempoInput = tempo.querySelector("input");
  tempoInput.disabled = false;
  tempoInput.step = "1";
  tempoInput.setAttribute("aria-label", "Tempo ratio for Deck " + number);
  // Log2 scale: endpoints are half/double speed, exact center is unity.
  tempoInput.addEventListener("input", () => actions.setTempo(2 ** (2 * Number(tempoInput.value) / 1000 - 1)));
  const tempoValue = element("output", "", "1.00×");
  tempo.append(tempoValue);
  const pitch = createRangeField("pitch-slider", "Pitch", 0, 12);
  const pitchInput = pitch.querySelector('input');
  const pitchValue = element("output", "", "+0.0");
  pitch.append(pitchValue);
  // Only a theme-local travel preview. This is not semitones or musical state.
  let pitchPreviewPosition = 500;
  pitchInput.addEventListener('input', () => {
    if (document.documentElement.dataset.theme !== 'futuristic') return;
    pitchPreviewPosition = Number(pitchInput.value);
    renderRollers();
  });
  const cancelTempoRoller = installVerticalRoller(tempo, tempoInput);
  const cancelPitchRoller = installVerticalRoller(pitch, pitchInput);
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
  const main = createRangeField("main-volume-fader", "MAIN 0%", 0);
  const mainPercentage = element("output", "", "MAIN 0%");
  main.querySelector("span").replaceChildren(mainPercentage);
  const mainInput = main.querySelector("input");
  mainInput.disabled = false;
  mainInput.setAttribute("aria-label", "Main volume for Deck " + number);
  mainInput.addEventListener("input", () => actions.setMainVolume(Number(mainInput.value) / 100));
  const overview = element("div", "waveform-overview");
  const overviewGraphic = createOverviewWaveform();
  overview.append(overviewGraphic);
  const overviewPosition = element("span", "playhead");
  overview.append(overviewPosition);
  const cueMarkers = element('div', 'cue-markers');
  cueMarkers.setAttribute('aria-hidden', 'true');
  overview.append(cueMarkers);
  overview.setAttribute('role', 'slider');
  overview.setAttribute('aria-label', 'Song position for Deck ' + number);
  overview.setAttribute('aria-valuemin', '0');
  const wave = createWave();
  const scrollingRenderer = createScrollingRenderer(wave.surface, wave.graphic, updatePlaybackTime);
  let animationFrame = 0;
  wave.surface.setAttribute('role', 'slider');
  wave.surface.setAttribute('aria-label', 'Scrolling song position for Deck ' + number);
  wave.surface.setAttribute('aria-valuemin', '0');
  let seekGesture = null, seekPreview = null, previewSource, seekRequest = 0, seekRemoval;
  const canSeek = () => Boolean(deck.song) && Number.isFinite(deck.audio.duration) && deck.audio.duration > 0 &&
    typeof actions.seek === 'function' && (actions.canSeek ? actions.canSeek() : !busy);
  function cancelSeekGesture() {
    const previous = seekGesture;
    seekGesture = null;
    seekRemoval?.disconnect();
    window.removeEventListener('blur', cancelSeekGesture);
    window.removeEventListener('resize', cancelSeekGesture);
    if (previous && previous.surface.hasPointerCapture(previous.id)) previous.surface.releasePointerCapture(previous.id);
    seekPreview = null;
    updatePlaybackTime();
  }
  function previewSeek(clientX) {
    const surface = seekGesture.surface;
    const rect = surface.getBoundingClientRect();
    previewSource = deck.audio.src;
    // Overview is absolute. The scrolling window is a grabbed piece of the same
    // source timeline: pulling it right moves backward, pulling left moves ahead.
    const seconds = surface === overview ? (clientX - rect.left) / rect.width * deck.audio.duration :
      seekGesture.anchorTime - (clientX - seekGesture.anchorX) / seekGesture.width * SCROLLING_WINDOW_SECONDS;
    seekPreview = Math.max(0, Math.min(deck.audio.duration, seconds));
    updatePlaybackTime();
  }
  function commitSeek(seconds) {
    const request = ++seekRequest;
    previewSource = deck.audio.src;
    seekPreview = seconds;
    updatePlaybackTime();
    // A requested marker is temporary feedback, never another advancing clock.
    // Reconcile to Audio after completion/failure; older replies cannot clear it.
    Promise.resolve(actions.seek(seconds)).finally(() => {
      if (request === seekRequest && !seekGesture) { seekPreview = null; updatePlaybackTime(); }
    }).catch(() => {}); // The host/coordinator owns error reporting.
  }
  for (const surface of [overview, wave.surface]) {
    surface.addEventListener('pointerdown', event => {
      if (!canSeek() || seekGesture || !event.isPrimary || event.button !== 0) return;
      const width = surface.getBoundingClientRect().width;
      if (!width) return;
      event.preventDefault();
      surface.focus({ preventScroll: true });
      seekGesture = { id: event.pointerId, source: deck.audio.src, surface,
        anchorX: event.clientX, anchorTime: seekPreview ?? deck.audio.currentTime, width };
      surface.setPointerCapture(event.pointerId);
      previewSeek(event.clientX);
      window.addEventListener('blur', cancelSeekGesture);
      window.addEventListener('resize', cancelSeekGesture);
      seekRemoval = new MutationObserver(() => {
        if (!surface.isConnected || node.inert || surface.closest('[hidden]')) cancelSeekGesture();
      });
      seekRemoval.observe(document, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['hidden', 'inert', 'data-iphone-selected'] });
    });
    surface.addEventListener('pointermove', event => {
      if (seekGesture?.id !== event.pointerId || seekGesture.surface !== surface) return;
      if (!canSeek() || deck.audio.src !== seekGesture.source) { cancelSeekGesture(); return; }
      event.preventDefault();
      previewSeek(event.clientX);
    });
    surface.addEventListener('pointerup', event => {
      if (seekGesture?.id !== event.pointerId || seekGesture.surface !== surface) return;
      const allowed = canSeek() && deck.audio.src === seekGesture.source;
      if (allowed) previewSeek(event.clientX);
      const target = seekPreview;
      cancelSeekGesture();
      if (allowed) commitSeek(target);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) surface.addEventListener(type, event => {
      if (seekGesture?.id === event.pointerId && seekGesture.surface === surface) cancelSeekGesture();
    });
    surface.addEventListener('keydown', event => {
      if (!canSeek()) return;
      const current = seekPreview ?? deck.audio.currentTime;
      const target = { ArrowLeft: current - 5, ArrowDown: current - 5,
        ArrowRight: current + 5, ArrowUp: current + 5, Home: 0, End: deck.audio.duration }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      commitSeek(Math.max(0, Math.min(deck.audio.duration, target)));
    });
  }
  let displayedPeaks = null, displayedEnergy = null, displayedAccent = null;
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
  const stems = createStems(actions);
  const cues = createCues();
  const renderCues = installCueControls(cues, deck, actions);
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
    if (seekPreview !== null && (!deck.song || previewSource !== deck.audio.src)) seekPreview = null;
    const songPosition = seekPreview ?? deck.audio.currentTime;
    const duration = deck.audio.duration;
    wave.time.value = formatTime(songPosition) + " / " + formatTime(duration);
    const fraction = Number.isFinite(duration) && duration > 0 ? songPosition / duration : 0;
    overviewPosition.style.left = fraction * 100 + "%";
    overview.setAttribute('aria-valuemax', String(Number.isFinite(duration) ? duration : 0));
    overview.setAttribute('aria-valuenow', String(songPosition));
    overview.setAttribute('aria-valuetext', formatTime(songPosition) + ' of ' + formatTime(duration));
    scrollingRenderer.draw(deck.audio.scrollingWaveform, songPosition, deck.audio.frequencyEnergy);
    wave.surface.setAttribute('aria-valuemax', String(Number.isFinite(duration) ? duration : 0));
    wave.surface.setAttribute('aria-valuenow', String(songPosition));
    wave.surface.setAttribute('aria-valuetext', formatTime(songPosition) + ' of ' + formatTime(duration));
    scheduleAnimation();
  }

  function scheduleAnimation() {
    const animate = node.isConnected && !document.hidden && !node.inert && !deck.audio.paused &&
      workspace === 'performance-view' && upperView === 'wave-view' && wave.surface.getClientRects().length > 0;
    if (!animate) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if (!animationFrame) {
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        updatePlaybackTime(); // Read Audio again; never integrate elapsed frame time.
      });
    }
  }
  document.addEventListener('visibilitychange', updatePlaybackTime);

  function renderRollers() {
    const futuristic = document.documentElement.dataset.theme === 'futuristic';
    pitchInput.disabled = !futuristic;
    pitchInput.max = futuristic ? '1000' : '12';
    pitchInput.value = futuristic ? String(pitchPreviewPosition) : '0';
    pitchInput.setAttribute('aria-label', futuristic
      ? 'Pitch roller visual preview for Deck ' + number + '; no audio effect' : 'Pitch (preview)');
    pitch.querySelector('span').textContent = futuristic ? 'Pitch demo' : 'Pitch';
    if (futuristic) pitch.title = 'Visual travel preview only — does not change sound';
    else pitch.removeAttribute('title');
    pitchValue.value = futuristic ? Math.round(pitchPreviewPosition / 10) + '%' : '+0.0';
    if (futuristic) pitchInput.setAttribute('aria-valuetext', Math.round(pitchPreviewPosition / 10) + '% preview travel; no audio effect');
    else pitchInput.removeAttribute('aria-valuetext');
    for (const [surface, position] of [[tempo, Number(tempoInput.value)], [pitch, pitchPreviewPosition]]) {
      if (futuristic) surface.style.setProperty('--roller-offset', -position / 1000 * 120 + 'px');
      else surface.style.removeProperty('--roller-offset');
    }
  }
  document.addEventListener('tunetox-theme-change', () => {
    cancelTempoRoller(); cancelPitchRoller(); cancelSeekGesture(); renderRollers(); renderOverview();
  });

  function renderOverview() {
    const peaks = deck.audio.waveformPeaks;
    const energy = deck.audio.frequencyEnergy;
    const accent = getComputedStyle(node).getPropertyValue('--accent').trim() || '#5ce0dc';
    if (peaks !== displayedPeaks || energy !== displayedEnergy || accent !== displayedAccent) {
      displayedPeaks = peaks; displayedEnergy = energy; displayedAccent = accent;
      drawOverviewWaveform(overviewGraphic, peaks, energy, accent);
      overviewPosition.hidden = !peaks;
      wave.scrollingPlayhead.hidden = !peaks;
    }
  }

  function render() {
    if (seekGesture && (!canSeek() || deck.audio.src !== seekGesture.source || workspace !== 'performance-view' ||
        (seekGesture.surface === wave.surface && upperView !== 'wave-view'))) cancelSeekGesture();
    for (const surface of [overview, wave.surface]) {
      surface.tabIndex = canSeek() ? 0 : -1;
      surface.setAttribute('aria-disabled', String(!canSeek()));
    }
    renderCues();
    cueMarkers.replaceChildren();
    if (deck.song && !deck.loadingSong && deck.audio.src === deck.song.url && deck.audio.duration > 0) deck.cuePositions.forEach((position, index) => {
      if (position === null) return;
      const marker = element('span', 'cue-marker');
      marker.dataset.cueNumber = index + 1;
      if (position / deck.audio.duration < .03) marker.dataset.edge = 'start';
      else if (position / deck.audio.duration > .97) marker.dataset.edge = 'end';
      const percent = Math.max(0, Math.min(100, position / deck.audio.duration * 100));
      marker.style.left = percent + '%';
      const label = element('span', '', String(index + 1));
      // Coincident cues share a row of numbers. Percent bounds remain responsive;
      // the line itself stays at the exact source coordinate, including 0/end.
      const count = deck.cuePositions.filter(value => value === position).length;
      const ordinal = deck.cuePositions.slice(0, index).filter(value => value === position).length;
      label.style.left = `calc(clamp(calc(1px - ${percent}%), ${-count * 6}px, calc(${100 - percent}% - ${count * 12}px)) + ${ordinal * 12}px)`;
      marker.append(label);
      cueMarkers.append(marker);
    });
    stems.querySelectorAll('input[data-stem]').forEach(input => {
      const percent = Math.round(deck.stemLevels[input.dataset.stem] * 100);
      input.value = String(percent);
      input.style.setProperty('--stem-level-fill', percent + '%');
      input.setAttribute('aria-valuetext', percent + '%; stem audio not connected');
      input.closest('label').querySelector('output').textContent = percent + '%';
    });
    renderOverview();
    tempoValue.value = deck.tempoRatio.toFixed(2) + "×";
    tempoInput.value = String(Math.round((Math.log2(deck.tempoRatio) + 1) * 500));
    tempoInput.setAttribute("aria-valuetext", deck.tempoRatio.toFixed(2) + " times original speed");
    tempoInput.disabled = busy;
    renderRollers();
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

