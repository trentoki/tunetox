const stemPrototypeMixer = createTwoDeckStemPlayer();
const refreshPrototypeDecks = [];
// Only the two audible fixture decks participate. This separate page has its own appState;
// the main application page and its defaults are untouched.
appActions.participation.set(3, 'stemHandoff', false);
appActions.participation.set(4, 'stemHandoff', false);
const prototypeControlOrigins = {};
const stemPrototypeBridge = createStemHandoffAudioBridge(appState, stemPrototypeMixer,
  (state, details) => {
    if (details.directControl) prototypeControlOrigins[details.directControl] = 'direct human input';
    for (const id of details.automaticControls) prototypeControlOrigins[id] = 'automatic allocation';
    refreshPrototypeDecks.forEach(refresh => refresh());
  });
stemPrototypeBridge.synchronizeAudio();
for (const deckId of [1, 2]) {
  const component = mountStemControls(document.getElementById('decks'), deckId, {
    player: stemPrototypeMixer.getDeck(deckId), state: appState, bridge: stemPrototypeBridge,
    origins: prototypeControlOrigins, refreshAll: () => refreshPrototypeDecks.forEach(refresh => refresh())
  });
  refreshPrototypeDecks.push(component.refresh);
}
document.getElementById('close').addEventListener('click', async () => {
  try { await stemPrototypeMixer.close(); } catch (error) { document.getElementById('shutdown').textContent = error.message; }
  refreshPrototypeDecks.forEach(refresh => refresh());
});
const prototypeRefreshTimer = setInterval(() => refreshPrototypeDecks.forEach(refresh => refresh()),100);
window.addEventListener('pagehide', () => { clearInterval(prototypeRefreshTimer); void stemPrototypeMixer.close().catch(console.error); });
