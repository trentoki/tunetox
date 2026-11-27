import { registerWaveformComparison, validateWaveformComparison } from '../../behavior/mixer/waveform-comparison.js';
import { createExpandedComparison } from '../waveform/expanded-comparison.js';
import { getWaveformColorMode } from '../../behavior/settings.js';
import { createWaveformDeckLayout } from '../themes/waveform/deck-layout.js';
import { createDeckNavigation, connectWaveformPerformanceSelector } from '../../behavior/mixer/deck-navigation.js';
import { connectWaveformSeeking } from '../../behavior/mixer/waveform-seeking.js';
import { installVerticalRoller, usesVerticalRollers, connectPitchWheelPreview } from '../../behavior/mixer/vertical-roller.js';
import { connectTempoControls } from '../../behavior/mixer/tempo-controls.js';
import { connectNudgeControls } from '../../behavior/mixer/nudge-controls.js';
import { createNudgePresentation } from '../waveform/nudge-controls.js';
import { createScrollingCueMarkers } from '../waveform/scrolling-cue-markers.js';
import { connectLibraryControls, connectSongDrop } from '../../behavior/library/library-controls.js';
// Approved H5.3.1 presentation for the new Clean Playback host.
// Inputs: one persistent Clean Deck state and bound host actions.
// Output: a DOM node, render(), and setBusy(). No player creation or DSP here.
// Class names follow docs/visual-verification/APPROVED-NAMING.md.
import { installCueControls } from '../../behavior/mixer/cue-controls.js';
import { createOverviewWaveform, drawOverviewWaveform } from '../waveform/overview-waveform.js';
import { createScrollingWaveform, createScrollingRenderer } from '../waveform/scrolling-waveform.js';

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
  const navigation = createDeckNavigation(render);
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
  const tempoValue = element("output", "", "1.00×");
  tempo.append(tempoValue);
  const pitch = createRangeField("pitch-slider", "Pitch", 0, 12);
  const pitchInput = pitch.querySelector('input');
  const pitchValue = element("output", "", "+0.0");
  pitch.append(pitchValue);
  const getPitchPreviewPosition = connectPitchWheelPreview(pitchInput, renderRollers);
  const cancelTempoRoller = installVerticalRoller(tempo, tempoInput);
  const cancelPitchRoller = installVerticalRoller(pitch, pitchInput);
  connectTempoControls(tempo, tempoInput, actions.setTempo);
  const libraryButton = button("library-button", "Library", "Open Library for Deck " + number, () => {
    navigation.openLibrary();
    back.focus();
  });
  const title = element("strong", "song-title");
  // Reuse the original compact header selector slot: two buttons, no new rows.
  // Each changes only its own deck-local presentation selection.
  const selector = element("div", "performance-selector");
  selector.setAttribute("role", "group");
  selector.setAttribute("aria-label", "Performance views for Deck " + number);
  const upperToggle = button("performance-upper-toggle", "Wave", "Toggle upper section for Deck " + number, () => {
    navigation.toggleUpper();
  });
  const lowerToggle = button("performance-lower-toggle", "Cues", "Toggle lower section for Deck " + number, () => {
    navigation.toggleLower();
  });
  selector.append(upperToggle, lowerToggle);
  connectWaveformPerformanceSelector(upperToggle, navigation);
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
  const renderScrollingCues = createScrollingCueMarkers(wave.surface);
  const scrollingRenderer = createScrollingRenderer(wave.surface, wave.graphic, updatePlaybackTime);
  let animationFrame = 0;
  wave.surface.setAttribute('role', 'slider');
  wave.surface.setAttribute('aria-label', 'Scrolling song position for Deck ' + number);
  wave.surface.setAttribute('aria-valuemin', '0');
  const seeking = connectWaveformSeeking({ deck, node, overview, scrolling: wave.surface,
    actions, getBusy: () => busy,
    isVisible: surface => navigation.workspace === 'performance-view' && (surface === overview || navigation.upperView === 'wave-view'),
    changed: updatePlaybackTime });
  const canSeek = seeking.canSeek;
  const nudgePresentation = createNudgePresentation(wave.surface, number);
  const nudgeControls = connectNudgeControls(deck, node, nudgePresentation,
    () => !busy && canSeek(), updatePlaybackTime, actions.announce);
  let displayedPeaks = null, displayedEnergy = null, displayedAccent = null, displayedColorMode = null;
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
  const renderDeckLayout = createWaveformDeckLayout({ upperToggle, lowerToggle, wave: wave.node, stems, cues, controls });
  performance.append(header, content);
  registerWaveformComparison({ node, navigation, surface: wave.surface, cancelSeek: seeking.cancel,
    presentation: createExpandedComparison({ surface: wave.surface, node, header, lowerSection, redraw: updatePlaybackTime }) });

  const library = element("div", "library-view");
  const libraryHeader = element("div", "library-header");
  const sectionSelector = element("div", "section-selector");
  for (const text of ["Songs", "Playlists", "Links"]) sectionSelector.append(button("", text, text + " (preview)"));
  const back = button("back-to-performance-button", "←", "Return to performance for Deck " + number, () => {
    navigation.showPerformance();
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
  const libraryControls = actions.library ? connectLibraryControls(actions.library,
    { host: library, content: libraryContent, analysis: actions.libraryAnalysis, tabs: sectionSelector, getLoadedSongId: () => deck.song?.librarySongId || null, sort, search, results, selected, destinations, visible: () => navigation.workspace === 'library-view' },
    actions.sendLibrarySong, actions.announce) : null;
  if (actions.library) {
    connectSongDrop(overview, id => actions.sendLibrarySong(id, number - 1, 'deck'));
    connectSongDrop(queue, id => actions.sendLibrarySong(id, number - 1, 'queue'));
  }


  function updatePlaybackTime() {
    const songPosition = seeking.position;
    const duration = deck.audio.duration;
    wave.time.value = formatTime(songPosition) + " / " + formatTime(duration);
    const fraction = Number.isFinite(duration) && duration > 0 ? songPosition / duration : 0;
    overviewPosition.style.left = fraction * 100 + "%";
    overview.setAttribute('aria-valuemax', String(Number.isFinite(duration) ? duration : 0));
    overview.setAttribute('aria-valuenow', String(songPosition));
    overview.setAttribute('aria-valuetext', formatTime(songPosition) + ' of ' + formatTime(duration));
    scrollingRenderer.draw(deck.audio.scrollingWaveform, songPosition, deck.audio.frequencyEnergy);
    renderScrollingCues(deck.cuePositions, songPosition,
      Boolean(deck.song && !deck.loadingSong && deck.audio.src === deck.song.url && duration > 0));
    wave.surface.setAttribute('aria-valuemax', String(Number.isFinite(duration) ? duration : 0));
    wave.surface.setAttribute('aria-valuenow', String(songPosition));
    wave.surface.setAttribute('aria-valuetext', formatTime(songPosition) + ' of ' + formatTime(duration));
    scheduleAnimation();
  }

  function scheduleAnimation() {
    const animate = node.isConnected && !document.hidden && !node.inert && !deck.audio.paused &&
      navigation.workspace === 'performance-view' && navigation.upperView === 'wave-view' && wave.surface.getClientRects().length > 0;
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
  document.addEventListener('tunetox-waveform-orientation-change', updatePlaybackTime);
  document.addEventListener('tunetox-waveform-zoom-change', updatePlaybackTime);

  function renderRollers() {
    const pitchPreviewPosition = getPitchPreviewPosition();
    const futuristic = usesVerticalRollers();
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
    cancelTempoRoller(); cancelPitchRoller(); seeking.cancel(); renderRollers(); renderOverview(); render();
  });

  document.addEventListener('tunetox-waveform-colors-change', () => {
    renderOverview(); updatePlaybackTime();
  });

  function renderOverview() {
    const colorMode = getWaveformColorMode();
    const peaks = deck.audio.waveformPeaks;
    const energy = deck.audio.frequencyEnergy;
    const accent = getComputedStyle(node).getPropertyValue('--accent').trim() || '#5ce0dc';
    if (peaks !== displayedPeaks || energy !== displayedEnergy || accent !== displayedAccent || colorMode !== displayedColorMode) {
      displayedPeaks = peaks; displayedEnergy = energy; displayedAccent = accent; displayedColorMode = colorMode;
      drawOverviewWaveform(overviewGraphic, peaks, energy, accent, colorMode);
      overviewPosition.hidden = !peaks;
      wave.scrollingPlayhead.hidden = !peaks;
    }
  }

  function render() {
    seeking.validate();
    validateWaveformComparison();
    nudgeControls.validate();
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
    performance.hidden = navigation.workspace !== "performance-view";
    library.hidden = navigation.workspace !== "library-view";
    upperToggle.textContent = navigation.upperView === "wave-view" ? "Wave" : "Stems";
    lowerToggle.textContent = navigation.lowerView === "cues-view" ? "Cues" : "Controls";
    upperToggle.setAttribute("aria-pressed", String(navigation.upperView === "stems-view"));
    lowerToggle.setAttribute("aria-pressed", String(navigation.lowerView === "controls"));
    upperToggle.title = "Switch upper section to " + (navigation.upperView === "wave-view" ? "Stems" : "Wave");
    lowerToggle.title = "Switch lower section to " + (navigation.lowerView === "cues-view" ? "Controls" : "Cues");
    upperToggle.setAttribute("aria-label", "Toggle upper section for Deck " + number);
    renderDeckLayout(navigation.presentation);
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
    if (libraryControls) {
      if (navigation.workspace === 'library-view') libraryControls.opened();
      return;
    }
    results.replaceChildren();
    for (const song of actions.librarySongs()) {
      const row = element("div", "search-result");
      row.append(element("strong", "song-title", song.name), element("span", "artist", "Local audio"));
      results.append(row);
    }
    if (!results.children.length) results.append(element("p", "", "No songs loaded. Use Load D1–D4 above."));
  }

  return { node, render, updatePlaybackTime, completed:navigation.completed, setBusy(value) { busy = value; render(); } };
}

