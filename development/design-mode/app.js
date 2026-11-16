// Design Mode host. No production scripts, audio objects, persistence or media files.
(() => {
  const design = globalThis.TuneToxDesign, model = design.model, components = design.components;
  let state = model.createState();
  const status = document.getElementById('design-status');
  function announce(message) { status.textContent = message + ' — simulation only, no audio.'; }
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
    load(id) {
      if (!model.loadSelected(state, id)) return;
      announce(model.findSong(state.songId).title + ' loaded into deck ' + id); render();
    },
    play(id) { if (model.togglePlay(state, id)) { announce('Deck ' + id + (state.decks[id - 1].playing ? ' preview playing' : ' preview paused')); render(); } },
    eject(id) { model.eject(state, id); announce('Deck ' + id + ' cleared'); render(); },
    toggle(id, key) { const deck = state.decks.find(d => d.id === id); model.setDeckControl(state, id, key, !deck[key]); render(); },
    control(id, key, value) { model.setDeckControl(state, id, key, value); render(); },
    level(id, index, value) { model.setLevel(state, id, index, value); render(); }
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
    state = model.createState(); songSearch.value = ''; playlistSearch.value = '';
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
  render();
  // Read-only snapshot for the isolated preview checks, never a production state owner.
  design.preview = { getSnapshot: () => JSON.parse(JSON.stringify(state)) };
})();
