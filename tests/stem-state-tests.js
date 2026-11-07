function runStemStateTests() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  function application() {
    return { decks: [1, 2, 3, 4].map(createDeck), participation: createParticipationState(),
      stemSession: createStemSessionState(), interfaceMode: 'twoDeck', globalTempo: null };
  }
  const model = application();
  const actions = createStemActions(model);
  const participation = model.participation;
  const authorization = model.stemSession.authorization;
  check(model.stemSession.lastChange.origin === 'initialization' && model.stemSession.lastChange.gestureId === null,
    'Initialization must not pretend to be a direct gesture');
  check(Object.keys(authorization.ceilingsByStem).join(',') === stemCategories.join(',') &&
    Object.values(authorization.ceilingsByStem).every(value => value === null),
    'Authorization boundary must have four global, unestablished category slots, not per-deck ceilings');
  const ids = new Set();
  for (const deck of model.decks) {
    check(deck.volume === 0 && deck.song === null && !deck.isPlaying, 'Every deck must initialize silent and empty');
    check(deck.stems.requestedLevels !== deck.stems.allocatedLevels, 'Requested and allocated records must be distinct');
    check(Object.isFrozen(deck.stems) && Object.isFrozen(deck.stems.requestedLevels) &&
      Object.isFrozen(deck.stems.allocatedLevels), 'Stem snapshots must resist mutation');
    ids.add(actions.volumeControlId(deck.id));
    for (const stem of stemCategories) {
      const expected = deck.id === 1 ? 1 : 0;
      check(deck.stems.requestedLevels[stem] === expected && deck.stems.allocatedLevels[stem] === expected,
        'Deck 1 must start at 1 per stem; Decks 2–4 must start at 0');
      check(actions.getEffectiveGain(deck.id, stem) === 0, 'Zero volume must yield zero effective gain');
      ids.add(actions.stemControlId(deck.id, stem));
      check(participation.byDeck[deck.id].stemHandoff, 'Stem participation must default ON for every deck');
    }
  }
  const mutedModel = application();
  const mutedActions = createStemActions(mutedModel);
  mutedActions.setDeckVolume(1, 0.7, 'audible-deck');
  const otherStemSnapshot = mutedModel.decks[0].stems;
  mutedActions.setStemLevel(2, 'flow', 1, 'muted-deck-stem');
  check(mutedActions.getEffectiveGain(2, 'flow') === 0 && mutedActions.getEffectiveGain(1, 'flow') === 0.7 &&
    mutedModel.decks[0].stems === otherStemSnapshot, 'A stem raised on a zero-volume deck must not reduce another deck');
  check(ids.size === 20 && ids.has('deck.4.volume') && ids.has('deck.2.stem.flow.level'), 'Twenty stable deck-scoped control IDs required');
  const untouched = JSON.stringify({ participation: model.participation, mode: model.interfaceMode,
    globalTempo: model.globalTempo, music: model.decks.map(({ volume, stems, ...music }) => music) });
  for (let deckId = 1; deckId <= 4; deckId++) {
    const otherDecks = JSON.stringify(model.decks.filter(deck => deck.id !== deckId));
    check(actions.setDeckVolume(deckId, 0.7, 'volume-' + deckId), 'Direct volume change should report a value change');
    for (const stem of stemCategories) {
      const before = model.decks[deckId - 1].stems;
      const previous = before.requestedLevels[stem];
      check(actions.setStemLevel(deckId, stem, 0.43, 'stem-' + deckId + '-' + stem), 'Direct stem action should change its target');
      const current = model.decks[deckId - 1].stems;
      check(current.requestedLevels[stem] === 0.43 && current.allocatedLevels[stem] === 0.43, 'No-handoff direct action must pass its level through');
      check(before.requestedLevels[stem] === previous, 'Prior stem snapshots must remain unchanged');
      for (const other of stemCategories.filter(name => name !== stem)) {
        check(current.requestedLevels[other] === before.requestedLevels[other] &&
          current.allocatedLevels[other] === before.allocatedLevels[other], 'Other categories must not redistribute');
      }
      check(actions.getEffectiveGain(deckId, stem) === 0.7 * 0.43, 'Effective gain must multiply volume by allocation');
      check(model.stemSession.lastChange.origin === 'direct' &&
        model.stemSession.lastChange.controlId === actions.stemControlId(deckId, stem) &&
        model.stemSession.lastChange.gestureId === 'stem-' + deckId + '-' + stem, 'Direct provenance must preserve control and gesture identity');
    }
    check(JSON.stringify(model.decks.filter(deck => deck.id !== deckId)) === otherDecks, 'Actions must not change other decks');
  }
  check(model.participation === participation && authorization.ceilingsByStem.flow === null &&
    model.stemSession.authorization.ceilingsByStem.flow === 0.7,
    'Direct actions must preserve participation and prior snapshots while tracking global authorization');
  check(JSON.stringify({ participation: model.participation, mode: model.interfaceMode,
    globalTempo: model.globalTempo, music: model.decks.map(({ volume, stems, ...music }) => music) }) === untouched,
    'Music metadata, playback, EQ, pitch and presentation must remain unchanged');
  check(!actions.setStemLevel(1, 'flow', 0.43, 'same-value-gesture') &&
    model.stemSession.lastChange.gestureId === 'same-value-gesture', 'No-op values still carry direct provenance');
  const second = createStemActions(model);
  second.setDeckVolume(1, 0.3, 'second-adapter');
  check(actions.getEffectiveGain(1, 'flow') === 0.3 * 0.43, 'Action adapters must read the existing deck records');
  const allocated = model.decks[0].stems.allocatedLevels;
  model.decks[0].stems = Object.freeze({ requestedLevels: Object.freeze({ ...allocated, flow: 0.9 }), allocatedLevels: allocated });
  check(actions.getEffectiveGain(1, 'flow') === 0.3 * 0.43, 'Effective calculations must use allocation, not requested intent');

  const invalid = [
    () => actions.setDeckVolume(0, 0.5, 'g'), () => actions.setDeckVolume('1', 0.5, 'g'),
    () => actions.setStemLevel(5, 'flow', 0.5, 'g'), () => actions.setStemLevel(1, '__proto__', 0.5, 'g'),
    () => actions.setStemLevel(1, 'flow', 0.333, 'g'), () => actions.setDeckVolume(1, 0.5),
    () => actions.setDeckVolume(1, 0.5, ' '), () => actions.dispatch(null),
    () => actions.dispatch({ type: 'other', origin: 'direct', gestureId: 'g' }),
    () => actions.dispatch({ type: 'stemControl.set', origin: 'automatic', gestureId: 'g', controlId: 'deck.1.volume', value: 0.5 }),
    () => actions.dispatch({ type: 'stemControl.set', origin: 'initialization', gestureId: 'g', controlId: 'deck.1.volume', value: 0.5 })
  ];
  for (const value of [-0.01, 1.01, NaN, Infinity, '0.5', null, undefined]) {
    invalid.push(() => actions.setDeckVolume(1, value, 'g'), () => actions.setStemLevel(1, 'flow', value, 'g'),
      () => calculateEffectiveStemGain(value, 1), () => calculateEffectiveStemGain(1, value));
  }
  for (const attempt of invalid) {
    const before = JSON.stringify(model), session = model.stemSession, stems = model.decks[0].stems;
    let rejected = false; try { attempt(); } catch (_) { rejected = true; }
    check(rejected && JSON.stringify(model) === before && model.stemSession === session && model.decks[0].stems === stems,
      'Invalid input must reject atomically without replacing state or provenance');
  }
  check(calculateEffectiveStemGain(0, 1) === 0 && calculateEffectiveStemGain(1, 1) === 1 &&
    calculateEffectiveStemGain(0.123, 0.456) === 0.123 * 0.456, 'Pure effective gains must support continuous allocated values');
  const fresh = application();
  check(fresh.stemSession !== model.stemSession && fresh.stemSession.authorization !== authorization &&
    Object.values(fresh.stemSession.authorization.ceilingsByStem).every(value => value === null),
    'Each session must have its own empty authorization boundary');
  check(fresh.decks[0].volume === 0 && fresh.decks[0].stems.allocatedLevels.flow === 1 &&
    fresh.stemSession.lastChange.origin === 'initialization', 'New sessions must not inherit direct controls or provenance');
  for (const deck of appState.decks) check(deck.volume === 0 && deck.stems.allocatedLevels.flow === (deck.id === 1 ? 1 : 0),
    'Actual application startup must install the approved stem and volume defaults');
  check(appState.stemSession.lastChange.origin === 'initialization' && appActions.stems,
    'Application must expose shared stem actions without startup gestures');
  console.log('Stem initialization, independent direct actions, effective gains, validation, provenance and session isolation tests passed');
}
