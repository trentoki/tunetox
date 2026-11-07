// Versioned starting defaults are inputs; session participation is the only runtime store.
function runParticipationDefaultsTests() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const capabilities = ['beatmatching', 'tuneMatching', 'stemHandoff'];
  function defaultsRecord() {
    const participationByDeck = {};
    for (let deckId = 1; deckId <= 4; deckId++) {
      participationByDeck[deckId] = { beatmatching: deckId % 2 === 0,
        tuneMatching: deckId <= 2, stemHandoff: deckId !== 3 };
    }
    return { schemaVersion: 1, participationByDeck };
  }
  function application() {
    return { participation: createParticipationState(), interfaceMode: 'twoDeck',
      decks: [{ id: 1, song: { bpm: 123 }, isPlaying: true, tempo: 125, pitchShift: 0.25,
        stemLevels: { transients: 0.4 } }], globalTempo: 125 };
  }
  const input = defaultsRecord();
  const original = JSON.stringify(input);
  const validation = validateParticipationDefaults(input);
  check(validation.valid && validation.error === null, 'Complete v1 defaults must validate');
  check(JSON.stringify(input) === original, 'Validation must not change the input');
  check(validation.defaults !== input && validation.defaults.participationByDeck !== input.participationByDeck,
    'Validation must return an owned snapshot, not freeze or retain the caller record');
  check(Object.isFrozen(validation.defaults) && Object.isFrozen(validation.defaults.participationByDeck) &&
    Object.isFrozen(validation.defaults.participationByDeck[4]), 'Validated defaults must be deeply frozen');
  check(!Object.isFrozen(input), 'Caller input must remain owned by the caller');
  const model = application();
  const unrelated = JSON.stringify({ ...model, participation: undefined });
  const actions = createParticipationActions(model);
  const otherActions = createParticipationActions(model);
  const result = actions.initialize(validation.defaults);
  check(result.initialized && result.source === 'provided' && result.error === null, 'Validated defaults must initialize');
  for (let deckId = 1; deckId <= 4; deckId++) for (const capability of capabilities) {
    check(actions.get(deckId, capability) === input.participationByDeck[deckId][capability], 'All twelve defaults must apply exactly');
  }
  check(model.participation.byDeck[1] !== validation.defaults.participationByDeck[1], 'Runtime must own its deck snapshots');
  check(JSON.stringify({ ...model, participation: undefined }) === unrelated, 'Initialization must not alter metadata, playback or presentation');
  input.participationByDeck[1].beatmatching = true;
  check(!actions.get(1, 'beatmatching'), 'Later changes to supplied defaults must not alter the session');
  actions.toggle(4, 'stemHandoff');
  check(validation.defaults.participationByDeck[4].stemHandoff === true, 'Session actions must not overwrite starting defaults');
  const session = model.participation;
  const repeated = otherActions.initialize(defaultsRecord());
  check(!repeated.initialized && repeated.error && model.participation === session,
    'A second adapter must not bypass the per-application initialization guard');
  check(!actions.initialize().initialized && model.participation === session, 'Factory fallback must not reset an initialized session');

  const invalid = [null, undefined, false, 1, 'defaults', [], {},
    { schemaVersion: 2, participationByDeck: defaultsRecord().participationByDeck },
    { schemaVersion: '1', participationByDeck: defaultsRecord().participationByDeck },
    { ...defaultsRecord(), extra: true }, Object.create(defaultsRecord())];
  for (const deckId of ['1', '2', '3', '4']) {
    const missing = defaultsRecord(); delete missing.participationByDeck[deckId]; invalid.push(missing);
    for (const capability of capabilities) {
      const incomplete = defaultsRecord(); delete incomplete.participationByDeck[deckId][capability]; invalid.push(incomplete);
      for (const value of [0, 1, 'false', null, undefined, {}]) {
        const malformed = defaultsRecord(); malformed.participationByDeck[deckId][capability] = value; invalid.push(malformed);
      }
    }
  }
  for (const extraId of ['0', '5', '01', '__proto__']) {
    const extra = defaultsRecord();
    Object.defineProperty(extra.participationByDeck, extraId, { value: {}, enumerable: true }); invalid.push(extra);
  }
  const extraFlag = defaultsRecord(); extraFlag.participationByDeck[2].keyMatch = true; invalid.push(extraFlag);
  const arrayDecks = defaultsRecord(); arrayDecks.participationByDeck = [null, {}, {}, {}, {}]; invalid.push(arrayDecks);
  const arrayFlags = defaultsRecord(); arrayFlags.participationByDeck[1] = []; invalid.push(arrayFlags);
  const accessor = defaultsRecord();
  Object.defineProperty(accessor, 'schemaVersion', { enumerable: true, get() { throw new Error('Getter must not execute'); } }); invalid.push(accessor);
  const hidden = defaultsRecord(); Object.defineProperty(hidden, 'schemaVersion', { value: 1, enumerable: false }); invalid.push(hidden);
  const symbol = defaultsRecord(); symbol[Symbol('extra')] = true; invalid.push(symbol);
  const cyclic = defaultsRecord(); cyclic.participationByDeck[1].beatmatching = cyclic; invalid.push(cyclic);
  for (const record of invalid) {
    const rejected = validateParticipationDefaults(record);
    check(!rejected.valid && rejected.defaults === null && typeof rejected.error === 'string', 'Invalid input must reject with an explanation');
    const fallbackModel = application();
    const fallback = createParticipationActions(fallbackModel).initialize(record);
    check(fallback.initialized && fallback.source === 'factory', 'Invalid/missing defaults must fall back atomically');
    check(record === undefined ? fallback.error === null : !!fallback.error, 'Missing defaults are normal; invalid defaults must report rejection');
    check(JSON.stringify(fallbackModel.participation) === JSON.stringify(createParticipationState()), 'Fallback must enable all twelve settings');
    check(!createParticipationActions(fallbackModel).initialize(defaultsRecord()).initialized, 'Fallback also closes initialization');
  }
  for (const command of ['set', 'toggle', 'dispatch']) {
    const activeModel = application();
    const active = createParticipationActions(activeModel);
    if (command === 'set') active.set(1, 'beatmatching', true); // An intentional no-op still starts a session.
    if (command === 'toggle') active.toggle(2, 'tuneMatching');
    if (command === 'dispatch') active.dispatch({ type: 'participation.toggle', controlId: 'deck.3.participation.stemHandoff' });
    const before = activeModel.participation;
    check(!createParticipationActions(activeModel).initialize(input).initialized && activeModel.participation === before,
      'Late initialization must not reset a session, including after a valid no-op');
  }
  const retryModel = application(); const retryActions = createParticipationActions(retryModel);
  try { retryActions.set(1, 'beatmatching', 'false'); } catch (_) { /* A rejected command changes nothing. */ }
  check(retryActions.initialize(defaultsRecord()).initialized, 'Rejected actions must not consume initialization');
  const independent = application();
  check(createParticipationActions(independent).initialize().source === 'factory', 'Other applications have independent initialization lifetimes');
  const realSnapshot = appState.participation;
  check(!appActions.participation.initialize(defaultsRecord()).initialized && appState.participation === realSnapshot,
    'Normal application startup must already be sealed against delayed initialization');
  console.log('Participation defaults validation, factory fallback, one-time initialization, adapter guards and session independence tests passed');
}
