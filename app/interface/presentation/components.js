// Small DOM components. State and interaction callbacks are supplied by the host.
(() => {
  const design = globalThis.TuneToxDesign;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, label, action) {
    const node = element('button', className, text); node.type = 'button';
    node.setAttribute('aria-label', label); node.addEventListener('click', action);
    return node;
  }
  function slider(labelText, id, action, openSampler) {
    const label = element(openSampler ? 'div' : 'label', 'mix-control');
    const caption = element('span', 'control-caption', labelText);
    if (openSampler) {
      caption.textContent = '';
      const name = element('span', 'stem-label-static', labelText);
      name.addEventListener('click', () => document.getElementById(id).focus());
      const trigger = button('stem-sampler-trigger', labelText, 'Open shared sampler for ' + labelText + ' on deck ' + id.split('-')[2], openSampler);
      caption.append(name, trigger);
    }
    const value = element('output', 'level-value'); value.htmlFor = id;
    const input = element('input'); input.type = 'range'; input.id = id;
    input.min = 0; input.max = 1; input.step = 0.01;
    input.setAttribute('aria-label', labelText + ' — simulated level');
    input.addEventListener('input', () => action(input.valueAsNumber));
    caption.append(value); label.append(caption, input);
    return { node: label, render(number) { input.value = number; value.value = Math.round(number * 100) + '%'; } };
  }
  function waveform(seed) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 280 24'); svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true'); svg.classList.add('example-wave');
    for (let i = 0; i < 70; i++) {
      const height = 2 + 19 * Math.abs(Math.sin(i * 0.43 + seed) * Math.cos(i * 0.19));
      const bar = document.createElementNS(svg.namespaceURI, 'rect');
      for (const [name, value] of Object.entries({ x: i * 4, y: (24 - height) / 2, width: 2, height })) bar.setAttribute(name, value);
      svg.append(bar);
    }
    return svg;
  }
  function createDeckCard(id, actions) {
    const card = element('section', 'design-deck'); card.dataset.deck = id;
    card.setAttribute('aria-label', 'Simulated deck ' + id);
    const header = element('header', 'deck-heading');
    const heading = element('h2', '', 'DECK ' + id), status = element('span', 'deck-status');
    const eject = button('eject-button', '↥', 'Eject example from deck ' + id, () => actions.eject(id));
    const links = button('deck-links', 'Links', 'Show links for deck ' + id, () => actions.links(id));
    const viewSwitch = button('slice-view-switch', 'Controls', 'Show controls for deck ' + id, () => actions.view(id));
    viewSwitch.setAttribute('aria-controls', 'slice-overlay-' + id);
    const columnLabel = element('div', 'column-mode-label');
    const columnMode = element('select'); columnMode.className = 'column-mode';
    columnMode.setAttribute('aria-label', 'Presentation for deck ' + id + ' column');
    [['waveform', 'Waveform'], ['controls', 'Controls'], ['library', 'Library']].forEach(([value, text]) => {
      const option = element('option', '', text); option.value = value; columnMode.append(option);
    });
    columnMode.addEventListener('change', () => actions.control(id, 'columnMode', columnMode.value));
    columnLabel.append(columnMode);
    const columnButtons = ['waveform', 'controls', 'library'].map(mode => {
      const control = button('column-mode-button', { waveform: 'Waveform', controls: 'Controls', library: 'Library' }[mode], 'Show ' + mode + ' in deck ' + id + ' column', () => actions.control(id, 'columnMode', mode));
      control.dataset.mode = mode; columnLabel.append(control); return { mode, control };
    });
    header.append(heading, status, viewSwitch, columnLabel, links, eject);
    const track = element('div', 'deck-track');
    const title = element('strong', 'deck-title'), subtitle = element('span', 'deck-subtitle');
    const names = element('div', 'track-names'); names.append(title, subtitle);
    const load = button('deck-load', '↓ Load', 'Load selected example into deck ' + id, () => actions.load(id));
    const phonePlay = button('phone-play', '▶', 'Play simulated deck ' + id, () => actions.play(id));
    const progress = element('span', 'phone-song-progress');
    track.append(names, load, phonePlay, progress);
    const visual = element('div', 'wave-strip'); visual.append(waveform(id));
    const illustration = element('span', 'wave-note', 'ILLUSTRATIVE'); visual.append(illustration);
    const transport = element('div', 'deck-transport');
    const play = button('play-button', '▶', 'Play simulated deck ' + id, () => actions.play(id));
    play.dataset.action = 'play'; play.setAttribute('aria-pressed', 'false');
    const main = slider('MAIN', 'demo-deck-' + id + '-main', value => actions.level(id, null, value));
    main.node.classList.add('main-control'); transport.append(play, main.node);
    const stems = element('div', 'stem-controls');
    const controls = design.model.stems.map((name, index) => {
      const control = slider(name, 'demo-deck-' + id + '-stem-' + index, value => actions.level(id, index, value), () => actions.sampler(id, index));
      stems.append(control.node); return control;
    });
    // Front face is an extension point only: no flip gesture or alternate face is defined.
    card.dataset.face = 'front';
    const matching = element('div', 'matching-controls');
    const toggles = [['beatMatch', 'Beat Match'], ['tuneMatch', 'Tune Match'], ['handoff', 'Handoff']].map(([key, text]) => {
      const control = button('match-toggle', text, text + ' on simulated deck ' + id, () => actions.toggle(id, key));
      control.dataset.control = key; matching.append(control); return { key, control };
    });
    const waveMatching = element('div', 'waveform-matching');
    waveMatching.setAttribute('aria-label', 'Waveform matching for deck ' + id);
    const overlay = element('section', 'slice-controls-overlay');
    overlay.id = 'slice-overlay-' + id; overlay.setAttribute('aria-label', 'Simulated controls for deck ' + id);
    overlay.append(element('span', 'overlay-caption', 'SIMULATED CONTROLS'));
    const overlayToggles = [['beatMatch', 'Beat Match'], ['tuneMatch', 'Tune Match'], ['handoff', 'Handoff']].map(([key, text]) => {
      const control = button('overlay-toggle', text, text + ' on simulated deck ' + id, () => actions.toggle(id, key));
      control.dataset.control = key; control.textContent = { beatMatch: 'Beat', tuneMatch: 'Tune', handoff: 'Hand' }[key];
      control.dataset.fullLabel = text; waveMatching.append(control); return { key, control };
    });
    ['Effects', 'Looping'].forEach(name => {
      const placeholder = button('overlay-placeholder', name + ' · planned', name + ' placeholder — not implemented', () => {});
      placeholder.disabled = true; overlay.append(placeholder);
    });
    const overlayMain = slider('MAIN · Deck ' + id, 'legacy-overlay-main-' + id, value => actions.level(id, null, value));
    overlayMain.node.classList.add('overlay-main'); overlay.append(overlayMain.node);
    const performance = design.createPerformanceControls({
      scope: 'overlay', getDeck: () => currentDeck, actions, id
    });
    let currentDeck = null;
    overlay.append(performance.node);
    const waveformNavigation = design.createWaveformNavigation(id, actions);
    visual.append(waveformNavigation.node, overlay);
    function controlsActive() {
      const app = document.querySelector('.design-app');
      return (design.isPhone() || app.dataset.layout === 'full' ? card.dataset.columnMode === 'controls' : card.dataset.sliceView === 'controls') &&
        (design.isPhone() || app.dataset.arrangement === 'slices' && matchMedia('(orientation: landscape) and (min-width: 900px) and (max-width: 1600px) and (min-height: 650px)').matches);
    }
    // No scrubbing exists. Contain overlay gestures so they cannot become waveform gestures.
    ['pointerdown', 'pointermove', 'pointerup'].forEach(type => visual.addEventListener(type, event => {
      if (controlsActive()) event.stopPropagation();
    }));
    visual.addEventListener('dragstart', event => { if (controlsActive()) { event.preventDefault(); event.stopPropagation(); } });
    const tuning = element('div', 'deck-tuning');
    const tuningInputs = ['tempo', 'pitch'].map(key => {
      const label = element('label', '', key === 'tempo' ? 'Tempo' : 'Pitch');
      const input = element('input'); input.type = 'number'; input.min = key === 'tempo' ? 90 : -6;
      input.max = key === 'tempo' ? 150 : 6; input.step = key === 'tempo' ? .5 : .1;
      input.setAttribute('aria-label', 'Simulated ' + key + ' for deck ' + id);
      input.dataset.control = key;
      input.addEventListener('change', () => actions.control(id, key, input.valueAsNumber));
      label.append(input); tuning.append(label); return { key, input };
    });
    card.append(header, track, waveMatching, visual, matching, tuning, transport, stems);
    return { node: card, render(deck, selectedSong) {
      currentDeck = deck; performance.render(); waveformNavigation.render(deck);
      const song = design.model.findSong(deck.songId);
      card.dataset.sliceView = deck.sliceView;
      card.dataset.columnMode = deck.columnMode;
      columnMode.value = deck.columnMode;
      columnButtons.forEach(({ mode, control }) => control.setAttribute('aria-pressed', String(mode === deck.columnMode)));
      viewSwitch.textContent = deck.sliceView === 'controls' ? 'Waveform' : 'Controls';
      viewSwitch.setAttribute('aria-label', 'Show ' + (deck.sliceView === 'controls' ? 'waveform' : 'controls') + ' for deck ' + id);
      viewSwitch.setAttribute('aria-expanded', String(deck.sliceView === 'controls'));
      overlayToggles.forEach(({ key, control }) => {
        control.textContent = control.dataset.fullLabel;
        control.setAttribute('aria-pressed', String(deck[key]));
      });
      card.classList.toggle('is-empty', !song); card.classList.toggle('is-playing', deck.playing);
      status.textContent = !song ? 'EMPTY' : deck.playing ? 'SIMULATED PLAY' : 'READY';
      title.textContent = song ? song.title : 'Load an example';
      subtitle.textContent = song ? song.artist + ' · ' + song.bpm + ' BPM' : 'Select a song below';
      phonePlay.disabled = !song; phonePlay.textContent = deck.playing ? 'Ⅱ' : '▶';
      phonePlay.setAttribute('aria-pressed', String(deck.playing));
      progress.textContent = design.performanceProgress(deck).text;
      play.disabled = !song; eject.disabled = !song; load.disabled = !selectedSong;
      load.title = selectedSong ? 'Load ' + selectedSong.title + ' into deck ' + id : 'Select an example song first';
      play.textContent = deck.playing ? 'Ⅱ' : '▶';
      play.setAttribute('aria-label', (deck.playing ? 'Pause' : 'Play') + ' simulated deck ' + id + ' — no audio');
      play.setAttribute('aria-pressed', String(deck.playing));
      toggles.forEach(({ key, control }) => control.setAttribute('aria-pressed', String(deck[key])));
      tuningInputs.forEach(({ key, input }) => { if (document.activeElement !== input) input.value = deck[key]; });
      overlayMain.render(deck.volume);
      main.render(deck.volume); controls.forEach((control, i) => control.render(deck.stems[i]));
    } };
  }
  function playlistRow(playlist, selected, onSelect) {
    const row = button('playlist-row', '', playlist.title + ' — example playlist', () => onSelect(playlist.id));
    row.dataset.playlistId = playlist.id; row.setAttribute('aria-pressed', String(selected));
    const caption = element('span', 'playlist-caption');
    caption.append(element('strong', '', playlist.title), element('small', '', playlist.songIds.length + ' examples'));
    row.append(element('span', 'playlist-icon', playlist.icon), caption); return row;
  }
  function songRow(song, selected, onSelect) {
    const row = element('div', 'song-row');
    const select = button('song-select', '', song.title + ' by ' + song.artist + ' — example song', () => onSelect(song.id));
    row.draggable = true; row.dataset.songId = song.id; row.setAttribute('aria-pressed', String(selected));
    const art = element('span', 'song-art', '♪'); art.style.setProperty('--cover', song.color);
    const info = element('span', 'song-info'); info.append(element('strong', '', song.title), element('small', '', song.artist));
    const details = element('span', 'song-meta');
    details.append(element('strong', '', song.bpm + ' BPM'), element('small', '', song.key + ' · ' + song.duration));
    select.setAttribute('aria-pressed', String(selected));
    select.append(art, info, details);
    const manage = button('song-manage', 'Manage', 'Manage ' + song.title, () => {
      row.dispatchEvent(new CustomEvent('manage-song', { bubbles: true, detail: song.id }));
    });
    row.append(select, manage); return row;
  }
  function createList(container, makeRow, emptyMessage) {
    let previousSignature = '', previousLocation = '';
    return { render(items, selectedId, onSelect, location) {
      const signature = JSON.stringify([items.map(item => [item.id, item.songIds]), selectedId, location]);
      if (signature === previousSignature) return;
      const scroll = location === previousLocation ? container.scrollTop : 0;
      const nodes = items.map(item => makeRow(item, item.id === selectedId, onSelect));
      container.replaceChildren(...(nodes.length ? nodes : [element('p', 'empty-list', emptyMessage)]));
      container.scrollTop = scroll;
      previousSignature = signature; previousLocation = location;
    } };
  }
  design.components = { element, button, slider, waveform, createDeckCard, createList, playlistRow, songRow };
})();
