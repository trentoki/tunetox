// Design Mode host. No production scripts, audio objects, persistence or media files.
(() => {
  const design = globalThis.TuneToxDesign, model = design.model, components = design.components;
  let state = model.createState();
  // The live page shares presentation components, not Design Mode's simulated audio.
  const complete = createAudioEngine();
  const native = createMainStemIntegration(complete);
  const audio = createH531AudioControls({ appState, handoff: native.handoff, router: native.router });
  const filePanel = document.getElementById('live-file-inputs');
  const fileSelections = new Map();
  state.decks.forEach(deck => { deck.songId = null; deck.playing = false; deck.volume = 0; deck.stems = [0, 0, 0, 0]; });
  const categories = ['transients', 'flow', 'tune', 'voice'];
  const errors = new Map();
  function message(error) { status.textContent = error instanceof Error ? error.message : String(error); }
  function syncAudio() {
    for (const deck of state.decks) {
      const current = audio.getLevels(deck.id);
      const playback = audio.getPlaybackState(deck.id);
      deck.volume = current.volume;
      deck.stems = current.stems;
      deck.playing = playback.playing;
    }
  }
  async function loadRealStems(id) {
    const fields = fileSelections.get(id);
    const files = Object.fromEntries(categories.map(name => [name, fields[name].files[0]]));
    if (categories.some(name => !files[name])) { message('Select four files for Deck ' + id + ' first.'); return; }
    if (!native.router.setSourceMode(id, 'stems') && native.router.getSourceMode(id) !== 'stems') {
      message('Eject Deck ' + id + ' before changing its source.'); return;
    }
    try {
      status.textContent = 'Loading Deck ' + id + '…';
      await native.router.loadStems(id, files);
      const title = files.transients.name.replace(/\\.[^.]+$/, '');
      const songId = 'local-stems-' + id + '-' + Date.now();
      design.data.songs.push({ id: songId, title: 'Local stems: ' + title, artist: 'Your audio files', bpm: '—', key: '—', duration: '—', color: '#9fbbff' });
      state.decks[id - 1].songId = songId;
      syncAudio(); render();
      status.textContent = 'Deck ' + id + ' loaded. Raise MAIN and a stem fader, then press Play.';
    } catch (error) { message(error); console.error(error); }
  }
  for (const id of [1, 2, 3, 4]) {
    const group = document.createElement('fieldset');
    group.style.cssText = 'display:inline-block;vertical-align:top;max-width:100%;margin:6px;padding:8px;border:1px solid #62718b;border-radius:8px';
    const legend = document.createElement('legend'); legend.textContent = 'Deck ' + id;
    group.append(legend);
    const fields = {};
    for (const name of categories) {
      const label = document.createElement('label');
      label.style.cssText = 'display:block;font-size:12px;margin:5px 0';
      label.textContent = name + ' ';
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'audio/*,.wav,.aiff,.aif,.mp3,.m4a'; input.style.maxWidth = '180px';
      label.append(input); group.append(label); fields[name] = input;
    }
    fileSelections.set(id, fields);
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Load Deck ' + id + ' stems';
    button.addEventListener('click', () => { void loadRealStems(id); });
    group.append(button); filePanel.append(group);
  }
  // Native handoff can change other decks automatically. Read it back continuously.
  setInterval(() => { syncAudio(); render(); }, 150);
  const status = document.getElementById('design-status');
  function announce(message) { status.textContent = message + ' — preview feature (no audio effect).'; }
  const actions = {
    sampler(id, stemIndex) { if (columns.active()) {
      if (design.isPhone()) { state.phone.samplerReturnMode = state.phone.mode; state.phone.mode = 'sampler'; }
      design.samplerModel.open(state, id, stemIndex); render();
    } },
    waveform(id, kind, value) {
      if (model.waveformGesture(state, id, kind, value)) { announce('Deck ' + id + ' waveform ' + kind + ' preview'); render(); }
    },
    transition() { state.phone.transitionOpen = !state.phone.transitionOpen; state.phone.mode = state.phone.transitionOpen ? 'transition' : 'decks'; render(); },
    performance(id, key, value, index) { model.setPerformanceControl(state, id, key, value, index); render(); },
    view(id) { const deck = state.decks.find(d => d.id === id); model.setDeckControl(state, id, 'sliceView', deck.sliceView === 'controls' ? 'waveform' : 'controls'); render(); },
    links(id) {
      if (columns.active()) { columns.showLinks(id); render(); return; }
      state.context = { type: 'links', deckId: id }; if (state.layout === 'full') state.drawerOpen = true; render(); },
    load(id) { status.textContent = 'Use the real stem-file panel above to load Deck ' + id + '.'; },
    async play(id) {
      try { await audio.togglePlayback(id); syncAudio(); render(); }
      catch (error) { message(error); console.error(error); }
    },
    async eject(id) {
      try { await audio.eject(id); state.decks[id - 1].songId = null; syncAudio(); render(); }
      catch (error) { message(error); console.error(error); }
    },
    toggle(id, key) { const deck = state.decks.find(d => d.id === id); model.setDeckControl(state, id, key, !deck[key]); render(); },
    control(id, key, value) { model.setDeckControl(state, id, key, value); render(); },
    level(id, index, value) {
      try {
        if (index === null) audio.setMainVolume(id, value);
        else audio.setStemLevel(id, index, value);
        syncAudio(); render();
      } catch (error) { message(error); console.error(error); }
    }
  };
  // Mount once; slider updates and search never recreate deck cards or input listeners.
  const decks = [1, 2, 3, 4].map(id => components.createDeckCard(id, actions));
  document.getElementById('design-decks').append(...decks.map(deck => deck.node));
  const playlistList = components.createList(document.getElementById('playlist-list'), components.playlistRow, 'No matching playlists.');
  const songList = components.createList(document.getElementById('song-list'), components.songRow, 'No matching examples. Try another search.');
  const loadTargets = [1, 2, 3, 4].map(id => {
    const button = components.button('library-load', String(id), 'Load selected example into deck ' + id, () => actions.load(id));
    button.dataset.deck = id; document.getElementById('library-load-targets').append(button); return button;
  });
  function receiveDrop(songId, target) {
    if (!model.dropSong(state, songId, target)) return;
    const song = model.findSong(songId);
    announce(song.title + ' added to example playlist');
    render();
  }
  design.enableDragDrop(document.querySelector('.library'), receiveDrop, announce);
  const layout = design.createLayoutPreview(() => state, render);
  const columns = design.createColumnLibraries(decks, () => state, render, announce);
  const sampler = design.createSamplerView(() => state, render, announce);
  const phone = design.createPhoneView(() => state, render, actions);
  const context = design.createLibraryContext(document.querySelector('.library'), () => state, render, announce);
  document.querySelector('.library').addEventListener('manage-song', event => {
    state.context = { type: 'manage', songId: event.detail }; render();
  });
  const songSearch = document.getElementById('song-search'), playlistSearch = document.getElementById('playlist-search');
  songSearch.addEventListener('input', () => { model.setSongQuery(state, songSearch.value); render(); });
  playlistSearch.addEventListener('input', () => { state.playlistQuery = playlistSearch.value; render(); });
  document.getElementById('demo-tempo').addEventListener('input', event => { state.tempo = event.target.valueAsNumber; render(); });
  document.getElementById('demo-pitch').addEventListener('input', event => { state.pitch = event.target.valueAsNumber; render(); });
  document.getElementById('reset-demo').addEventListener('click', () => {
    // Reset only visual previews; live audio and its faders must not be reset.
    songSearch.value = ''; playlistSearch.value = '';
    announce('Example settings reset'); render();
  });
  function render() {
    const selected = model.findSong(state.songId), songs = model.visibleSongs(state);
    phone.render();
    layout.render();
    context.render();
    columns.render();
    sampler.render();
    decks.forEach((deck, i) => deck.render(state.decks[i], selected));
    document.getElementById('demo-tempo').value = state.tempo;
    document.getElementById('demo-pitch').value = state.pitch;
    document.getElementById('tempo-value').value = state.tempo.toFixed(1);
    document.getElementById('pitch-value').value = (state.pitch >= 0 ? '+' : '') + state.pitch.toFixed(1);
    playlistList.render(model.visiblePlaylists(state), state.playlistId, id => { model.selectPlaylist(state, id); render(); }, state.playlistQuery);
    songList.render(songs, state.songId, id => { model.selectSong(state, id); render(); }, state.playlistId + '/' + state.songQuery);
    document.getElementById('song-count').textContent = songs.length + ' EXAMPLES';
    document.getElementById('selected-title').textContent = selected ? selected.title : 'Select a song';
    loadTargets.forEach(button => { button.disabled = !selected; button.title = selected ? 'Load ' + selected.title + ' into deck ' + button.dataset.deck : 'Select a song first'; });
  }
  syncAudio(); render();
  // Read-only snapshot for the isolated preview checks, never a production state owner.
  design.preview = { getSnapshot: () => JSON.parse(JSON.stringify(state)) };
})();
