// Session-only preview state. These actions never call appState, audio or storage.
(() => {
  const design = globalThis.TuneToxDesign;
  const performanceNeutral = Object.freeze({ filter: 0, high: 0, mid: 0, low: 0, effectValue: 0 });
  function getPerformanceNeutral(key) { return performanceNeutral[key]; }
  const stems = ['Transients', 'Flow', 'Tune', 'Voice'];
  function createState() {
    return {
      sampler: design.samplerModel.createState(),
      phone: { mode: 'decks', selectedDeckId: 1, pair: [1, 2], samplerReturnMode: 'decks', transitionOpen: false },
      playlists: design.data.playlists.map(p => ({ ...p, songIds: [...p.songIds] })), linkedSongId: null, userLinks: {}, context: null, layout: 'full', arrangement: 'slices', editingDeckId: 1, drawerOpen: false, drawerSide: 'left',
      columnLibraries: [1,2,3,4].map(() => ({ playlistId: 'all', songId: 'neon', playlistQuery: '', songQuery: '', searchQuery: '', songQueries: { all: '' }, libraryView: 'songs', linksQuery: '', context: null })),
      tempo: 120, pitch: 0, playlistId: 'all', songId: 'neon', playlistQuery: '', songQuery: '',
      decks: [1, 2, 3, 4].map(id => ({
        id, songId: id === 1 ? 'neon' : id === 2 ? 'after' : null,
        face: 'front', sliceView: 'waveform', columnMode: 'waveform', tempo: 120, pitch: 0, beatMatch: false, tuneMatch: false, handoff: false,
        waveformPreview: { navigation: 0, nudge: 0 },
        position: 0, performance: { eq: { low: performanceNeutral.low, mid: performanceNeutral.mid, high: performanceNeutral.high }, filter: performanceNeutral.filter, loopEnabled: false, loopBeats: 4,
          effects: ['Echo', 'Reverb', 'Delay'].map(assignment => ({ assignment, value: performanceNeutral.effectValue })) },
        playing: false, volume: id === 1 ? 0.7 : id === 2 ? 0.55 : 0,
        stems: [0.8, 0.65, 0.75, 0.5]
      }))
    };
  }
  function findSong(id) { return design.data.songs.find(song => song.id === id) || null; }
  function findDeck(state, id) { return state.decks.find(deck => deck.id === id); }
  function matches(value, query) { return value.toLowerCase().includes(query.trim().toLowerCase()); }
  function visiblePlaylists(state) {
    return state.playlists.filter(playlist => matches(playlist.title, state.playlistQuery) ||
      playlist.songIds.some(id => {
        const song = findSong(id);
        return matches(song.title + ' ' + song.artist, state.playlistQuery);
      }));
  }
  function visibleSongs(state) {
    const playlist = state.playlists.find(item => item.id === state.playlistId);
    return design.data.songs.filter(song => playlist.songIds.includes(song.id) &&
      matches(song.title + ' ' + song.artist + ' ' + playlist.title, state.songQuery));
  }
  function selectPlaylist(state, id) {
    if (!state.playlists.some(item => item.id === id)) return false;
    state.playlistId = id;
    if (!visibleSongs(state).some(song => song.id === state.songId)) state.songId = null;
    return true;
  }
  function selectSong(state, id) {
    if (!visibleSongs(state).some(song => song.id === id)) return false;
    state.songId = id; return true;
  }
  function setSongQuery(state, query) {
    state.songQuery = query;
    if (!visibleSongs(state).some(song => song.id === state.songId)) state.songId = null;
  }
  function loadSelected(state, deckId) {
    const deck = findDeck(state, deckId), song = findSong(state.songId);
    if (!deck || !song) return false;
    deck.songId = song.id; deck.playing = false;
    return true;
  }
  function togglePlay(state, deckId) {
    const deck = findDeck(state, deckId);
    if (!deck || !deck.songId) return false;
    deck.playing = !deck.playing; return true;
  }
  function eject(state, deckId) {
    const deck = findDeck(state, deckId);
    if (!deck) return false;
    deck.songId = null; deck.playing = false; return true;
  }
  function setLevel(state, deckId, stemIndex, value) {
    const deck = findDeck(state, deckId);
    if (!deck || !Number.isFinite(value) || value < 0 || value > 1) return false;
    if (stemIndex === null) deck.volume = value;
    else if (Number.isInteger(stemIndex) && stemIndex >= 0 && stemIndex < 4) deck.stems[stemIndex] = value;
    else return false;
    return true;
  }
  function setDeckControl(state, id, key, value) {
    const deck = findDeck(state, id);
    if (!deck) return false;
    if (['beatMatch', 'tuneMatch', 'handoff'].includes(key) && typeof value === 'boolean') deck[key] = value;
    else if (key === 'columnMode' && ['waveform', 'controls', 'library'].includes(value)) deck.columnMode = value;
    else if (key === 'sliceView' && ['waveform', 'controls'].includes(value)) deck.sliceView = value;
    else if (key === 'tempo' && Number.isFinite(value) && value >= 90 && value <= 150) deck.tempo = value;
    else if (key === 'pitch' && Number.isFinite(value) && value >= -6 && value <= 6) deck.pitch = value;
    else return false;
    return true;
  }
  function dropSong(state, songId, playlistId) {
    if (!findSong(songId)) return false;
    if (playlistId === 'link') { state.linkedSongId = songId; return true; }
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!playlist) return false;
    if (!playlist.songIds.includes(songId)) playlist.songIds.push(songId);
    return true;
  }
  // Delta-linked preview gestures only; all peers keep their existing offsets.
  // A common bounded delta prevents any participating preview control exceeding its range.
  function adjustMatchedControl(state, id, key, value) {
    const selected = findDeck(state, id);
    if (!selected || !['tempo', 'pitch'].includes(key) || !Number.isFinite(value)) return false;
    const min = key === 'tempo' ? 90 : -6, max = key === 'tempo' ? 150 : 6;
    if (value < min || value > max) return false;
    const participation = key === 'tempo' ? 'beatMatch' : 'tuneMatch';
    const targets = selected[participation] ? state.decks.filter(deck => deck[participation]) : [selected];
    const lower = Math.max(...targets.map(deck => min - deck[key]));
    const upper = Math.min(...targets.map(deck => max - deck[key]));
    const delta = Math.max(lower, Math.min(upper, value - selected[key]));
    targets.forEach(deck => { deck[key] = Math.round((deck[key] + delta) * 1000) / 1000; });
    return true;
  }
  function selectPhoneDeck(state, id) {
    if (!findDeck(state, id)) return false;
    const old = state.phone.selectedDeckId;
    state.phone.selectedDeckId = id; state.editingDeckId = id;
    state.phone.pair[0] = id;
    if (state.phone.pair[1] === id) state.phone.pair[1] = old !== id ? old : state.decks.find(deck => deck.id !== id).id;
    if (state.sampler.open && state.phone.mode === 'sampler') design.samplerModel.open(state, id, state.sampler.stemIndex);
    return true;
  }
  function setTransitionPair(state, side, id) {
    if (![0, 1].includes(side) || !findDeck(state, id) || state.phone.pair[1 - side] === id) return false;
    state.phone.pair[side] = id; return true;
  }
  function setPerformanceControl(state, id, key, value, index = null) {
    const deck = findDeck(state, id); if (!deck) return false;
    const p = deck.performance;
    if (['low', 'mid', 'high'].includes(key) && Number.isFinite(value) && value >= -12 && value <= 12) p.eq[key] = value;
    else if (key === 'filter' && Number.isFinite(value) && value >= -1 && value <= 1) p.filter = value;
    else if (key === 'loopEnabled' && typeof value === 'boolean') p.loopEnabled = value;
    else if (key === 'loopBeats' && Number.isFinite(value) && value >= .25 && value <= 32) p.loopBeats = value;
    else if (key === 'effectValue' && [0,1,2].includes(index) && Number.isFinite(value) && value >= 0 && value <= 1) p.effects[index].value = value;
    else if (key === 'effectAssignment' && [0,1,2].includes(index) && ['Echo', 'Reverb', 'Delay', 'Chorus', 'Flanger', 'None'].includes(value)) p.effects[index].assignment = value;
    else return false;
    return true;
  }
  function waveformGesture(state, id, kind, value) {
    const deck = findDeck(state, id); if (!deck || !Number.isFinite(value)) return false;
    if (kind === 'nudge' && [-1, 1].includes(value)) deck.waveformPreview.nudge += value;
    else if (kind === 'navigation' && value >= 0 && value <= 1) deck.waveformPreview.navigation = value;
    else return false;
    return true;
  }
  function setUserLink(state, sourceId, targetId, enabled) {
    if (!findSong(sourceId) || !findSong(targetId) || sourceId === targetId || typeof enabled !== 'boolean') return false;
    const links = state.userLinks[sourceId] || [];
    state.userLinks[sourceId] = enabled ? [...new Set([...links, targetId])] : links.filter(id => id !== targetId);
    return true;
  }
  function setMembership(state, songId, playlistId, enabled) {
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!findSong(songId) || !playlist || playlistId === 'all' || typeof enabled !== 'boolean') return false;
    playlist.songIds = enabled ? [...new Set([...playlist.songIds, songId])] : playlist.songIds.filter(id => id !== songId);
    return true;
  }
  design.model = { getPerformanceNeutral, stems, createState, findSong, visiblePlaylists, visibleSongs, selectPlaylist, selectSong,
    waveformGesture, selectPhoneDeck, setTransitionPair, setPerformanceControl, adjustMatchedControl, setUserLink, setMembership, setDeckControl, dropSong, setSongQuery, loadSelected, togglePlay, eject, setLevel };
})();
