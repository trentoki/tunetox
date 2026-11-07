// Explicit metadata-only demonstration of the historical view-dependent prototype.
// This is not the approved continuous matching model and does not load audio.
function runLegacySynchronizationDemo() {
  const state = {
    participation: createParticipationState(),
    interfaceMode: 'twoDeck',
    globalTempo: null,
    globalPitchShift: 0,
    referenceKey: null,
    decks: [1, 2, 3, 4].map(createDeck)
  };
  loadSong(state.decks[0], { title: 'Song A', bpm: 120 }, state);
  loadSong(state.decks[1], { title: 'Song B', bpm: 106 }, state);
  const beforeSync = state.decks.map(deck => deck.tempo);
  console.log('Before sync:', beforeSync);

  state.interfaceMode = 'fourDeck';
  const afterViewChange = state.decks.map(deck => deck.tempo);
  loadSong(state.decks[2], { title: 'Song C', bpm: 130 }, state);
  console.log('After sync:', state.decks.map(deck => deck.tempo));
  console.log('Global tempo:', state.globalTempo);
  return { state, beforeSync, afterViewChange };
}
