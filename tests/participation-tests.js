function runParticipationTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const capabilities = ['beatmatching', 'tuneMatching', 'stemHandoff'];
  const initial = createParticipationState();
  check(initial.schemaVersion === 1 && Object.keys(initial.byDeck).length === 4, 'Exactly four versioned participation records required');
  const model = { participation: initial, interfaceMode: 'twoDeck', visibleDeckIds: [1, 2],
    decks: [1, 2, 3, 4].map(id => ({ id, song: id === 1 ? { bpm: 100 } : null,
      isPlaying: id === 1, tempo: 100 + id, pitchShift: 0.25, position: 2,
      stemLevels: { transients: 0.4, flow: 0.1, tune: 0.2, voice: 0 } })),
    globalTempo: 100, globalPitchShift: 0.5, referenceKey: { tonic: 'C', mode: 'minor' } };
  const actions = createParticipationActions(model);
  const unrelated = () => JSON.stringify({ ...model, participation: undefined });
  const before = unrelated();
  const ids = new Set();
  for (let deckId = 1; deckId <= 4; deckId++) for (const capability of capabilities) {
    check(actions.get(deckId, capability) === true, 'All twelve defaults must be enabled even for empty/hidden decks');
    const controlId = actions.controlId(deckId, capability);
    ids.add(controlId);
    check(controlId === 'deck.' + deckId + '.participation.' + capability, 'Stable deck-scoped control ID required');
    const previous = model.participation;
    check(actions.set(deckId, capability, false), 'Set must report a change');
    for (let otherId = 1; otherId <= 4; otherId++) for (const otherCapability of capabilities) {
      check(actions.get(otherId, otherCapability) === !(otherId === deckId && otherCapability === capability),
        'Changing participation must not toggle other capabilities or decks');
    }
    check(previous.byDeck[deckId][capability] === true, 'Previous snapshot must not mutate');
    check(!actions.set(deckId, capability, false), 'Repeated Set must be an idempotent no-op');
    check(actions.toggle(deckId, capability) && actions.get(deckId, capability), 'Toggle must restore this capability only');
  }
  check(ids.size === 12 && unrelated() === before, 'Actions must preserve transport, tempo, pitch, stems, and presentation');
  actions.set(4, 'stemHandoff', false);
  model.interfaceMode = 'fourDeck'; model.visibleDeckIds = [3, 4]; model.libraryLayout = 'single';
  model.decks[3].song = { bpm: 130 }; model.decks[3].isPlaying = true;
  check(!actions.get(4, 'stemHandoff') && actions.get(4, 'beatmatching'), 'Presentation/song/playback changes cannot reset participation');
  check(actions.controlId(4, 'stemHandoff') === 'deck.4.participation.stemHandoff', 'Layout changes cannot rename controls');
  const sameActions = createParticipationActions(model);
  sameActions.dispatch({ type: 'participation.set', controlId: 'deck.4.participation.stemHandoff', value: true });
  check(actions.get(4, 'stemHandoff'), 'All action adapters must read the one authoritative application snapshot');
  check(JSON.stringify(JSON.parse(JSON.stringify(model.participation))) === JSON.stringify(model.participation),
    'State must be plain versioned JSON, without audio/DOM objects');
  check(Object.isFrozen(model.participation) && Object.isFrozen(model.participation.byDeck) &&
    Object.isFrozen(model.participation.byDeck[1]), 'Exposed snapshots must resist accidental direct mutation');
  const invalid = [
    () => actions.set(0, 'beatmatching', false), () => actions.set(5, 'beatmatching', false),
    () => actions.set('1', 'beatmatching', false), () => actions.set(1, 'keyMatch', false),
    () => actions.set(1, 'beatmatching', 0), () => actions.set(1, 'beatmatching', 'false'),
    () => actions.dispatch(null), () => actions.dispatch({ type: 'other' }),
    () => actions.dispatch({ type: 'participation.toggle', controlId: 'deck.1.participation.__proto__' }),
    () => actions.dispatch({ type: 'participation.set', controlId: 'deck.1.participation.beatmatching' }),
    () => reduceParticipation({ schemaVersion: 2 }, { type: 'participation.toggle', controlId: 'deck.1.participation.beatmatching' })
  ];
  for (const attempt of invalid) {
    const previous = model.participation;
    let rejected = false;
    try { attempt(); } catch (_) { rejected = true; }
    check(rejected && model.participation === previous, 'Invalid inputs must reject atomically without mutation');
  }
  check(createParticipationState().byDeck[4].stemHandoff === true, 'New installations must not inherit earlier session changes');
  for (const deck of appState.decks) check(!('beatmatch' in deck) && !('keyMatch' in deck), 'No competing legacy participation fields');
  const existing = JSON.stringify({ ...appState, participation: undefined });
  check(appActions.participation.get(1, 'beatmatching') && appActions.participation.get(4, 'stemHandoff'), 'Application must install the shared defaults');
  appActions.participation.set(1, 'tuneMatching', false);
  check(appState.participation.byDeck[1].tuneMatching === false, 'Public actions must update the actual application state');
  appActions.participation.set(1, 'tuneMatching', true);
  check(JSON.stringify({ ...appState, participation: undefined }) === existing, 'Actual prototype metadata must stay unchanged');
  console.log('Participation defaults, twelve independent controls, actions, versioning, validation, and presentation isolation tests passed');
}
