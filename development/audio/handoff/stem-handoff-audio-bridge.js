// Applies authoritative domain results only. No handoff mathematics or transport changes.
function createStemHandoffAudioBridge(state, mixer, onCommit = () => {}, sharedActions = null) {
  const deckIds = mixer.deckIds || [1, 2];
  const stems = sharedActions ? sharedActions.stems : createStemActions(state);
  const participation = sharedActions ? sharedActions.participation : createParticipationActions(state);
  function synchronizeAudio() {
    const targets = {};
    for (const id of deckIds) {
      const deck = state.decks.find(candidate => candidate.id === id);
      targets[id] = { mainVolume: deck.volume, levels: deck.stems.allocatedLevels };
    }
    return mixer.applyGainSnapshot(targets);
  }
  function commit(action, directControl = null) {
    const previous = state.decks.map(deck => ({ id: deck.id, allocated: deck.stems.allocatedLevels }));
    const changed = action(); // Exceptions leave state and audio unchanged.
    const automaticControls = [];
    for (const deck of state.decks) {
      const before = previous.find(candidate => candidate.id === deck.id);
      for (const name of stemCategories) {
        const id = getStemControlId(deck.id, name);
        if (before.allocated[name] !== deck.stems.allocatedLevels[name] && id !== directControl) automaticControls.push(id);
      }
    }
    onCommit(state, { directControl, automaticControls }); // Refresh displayed allocations immediately, even for automatic receivers.
    // A scheduling failure is reported to the caller; it cannot undo an already committed
    // domain action or pretend native AudioParam operations are transactional.
    synchronizeAudio();
    return changed;
  }
  // Scheduling only: future membership actions must commit only on a true result.
  // This does not mutate domain allocations, requests, authorization or membership.
  function startCoordinated(id, targets) { return mixer.startCoordinated(id, targets); }
  return Object.freeze({ synchronizeAudio, startCoordinated,
    applySnapshot: targets => mixer.applyGainSnapshot(targets),
    setStemLevel: (id, name, value, gestureId) => commit(() => stems.setStemLevel(id, name, value, gestureId), getStemControlId(id, name)),
    setMainVolume: (id, value, gestureId) => commit(() => stems.setDeckVolume(id, value, gestureId), getDeckVolumeControlId(id)),
    setParticipation: (id, value) => commit(() => participation.set(id, 'stemHandoff', value)) });
}
