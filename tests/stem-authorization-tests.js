function runStemAuthorizationTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  function application() {
    const model = { decks: [1, 2, 3, 4].map(createDeck), participation: createParticipationState(),
      stemSession: createStemSessionState() };
    return { model, actions: createStemActions(model), participation: createParticipationActions(model) };
  }
  const ceilings = fixture => fixture.model.stemSession.authorization.ceilingsByStem;
  const allNull = fixture => stemCategories.every(stem => ceilings(fixture)[stem] === null);
  const fixture = application();
  const { model, actions, participation } = fixture;
  check(allNull(fixture), 'Initialization must leave all four global ceilings unestablished');
  actions.setStemLevel(1, 'flow', 1, 'unchanged-stem');
  actions.setStemLevel(2, 'flow', 1, 'zero-volume');
  actions.setDeckVolume(3, 0.5, 'zero-stems');
  check(allNull(fixture), 'No-op, zero volume and zero allocated stems must not establish authorization');
  const initial = model.stemSession.authorization;
  actions.setDeckVolume(1, 0.6, 'first-main-volume');
  check(stemCategories.every(stem => ceilings(fixture)[stem] === 0.6), 'Main volume must evaluate all four allocated categories');
  check(Object.values(initial.ceilingsByStem).every(value => value === null), 'Pure updates must preserve previous snapshots');
  actions.setDeckVolume(1, 0.5, 'lower-volume');
  actions.setStemLevel(1, 'flow', 0.8, 'flow-to-point-eight');
  check(actions.getEffectiveGain(1, 'flow') === 0.4 && ceilings(fixture).flow === 0.6,
    'Effective gain 0.4 must not reduce established 0.6 authorization');
  const beforeOtherDeck = model.stemSession.authorization;
  actions.setDeckVolume(2, 0.7, 'second-deck-main');
  check(ceilings(fixture).flow === 0.7 && ceilings(fixture).voice === 0.6,
    'Another participating deck must raise the same global Flow ceiling; zero stems do not raise other categories');
  check(beforeOtherDeck.ceilingsByStem.flow === 0.6, 'Global update must not mutate older snapshots');
  actions.setStemLevel(3, 'voice', 1, 'individual-voice');
  check(ceilings(fixture).voice === 0.6, 'Lower effective gain from another deck preserves high-water authorization');
  actions.setDeckVolume(3, 0.9, 'voice-deck-volume');
  check(ceilings(fixture).voice === 0.9 && ceilings(fixture).flow === 0.7 &&
    ceilings(fixture).transients === 0.6 && ceilings(fixture).tune === 0.6,
    'Deck-wide evaluation must use current allocated levels, including zeros');
  actions.setDeckVolume(2, 1, 'volume-before-individual');
  const previousCategories = { ...ceilings(fixture) };
  actions.setStemLevel(2, 'tune', 0.83, 'only-tune');
  check(ceilings(fixture).tune === 0.83 && ['flow', 'voice', 'transients'].every(stem =>
    ceilings(fixture)[stem] === previousCategories[stem]), 'Individual-stem gesture must evaluate only that category');

  const excluded = application();
  excluded.participation.set(1, 'stemHandoff', false);
  excluded.actions.setDeckVolume(1, 0.8, 'excluded-volume');
  excluded.actions.setStemLevel(1, 'flow', 0.9, 'excluded-stem');
  check(allNull(excluded) && excluded.model.decks[0].volume === 0.8 &&
    excluded.model.decks[0].stems.allocatedLevels.flow === 0.9, 'Excluded decks remain controllable without modifying global authorization');
  const excludedSnapshot = excluded.model.stemSession.authorization;
  excluded.participation.set(1, 'stemHandoff', true);
  check(excluded.model.stemSession.authorization === excludedSnapshot, 'Rejoining must not retroactively authorize excluded gestures');
  excluded.actions.setDeckVolume(1, 0.8, 'same-value-after-rejoin');
  excluded.actions.setStemLevel(1, 'flow', 0.9, 'same-stem-after-rejoin');
  check(allNull(excluded), 'Same-value actions after rejoining do not qualify');
  excluded.actions.setDeckVolume(1, 0.7, 'changed-value-after-rejoin');
  check(ceilings(excluded).transients === 0.7 && ceilings(excluded).flow === 0.7 * 0.9,
    'Only the new participating gesture gain is authorized, not the excluded high value');
  const retained = excluded.model.stemSession.authorization;
  excluded.participation.set(1, 'stemHandoff', false);
  excluded.participation.set(4, 'stemHandoff', false);
  excluded.participation.set(4, 'stemHandoff', true);
  check(excluded.model.stemSession.authorization === retained, 'Joining/leaving must never revoke or increase global ceilings');

  const categoryOnly = application();
  categoryOnly.participation.set(1, 'stemHandoff', false);
  categoryOnly.actions.setDeckVolume(1, 0.8, 'excluded-setup');
  categoryOnly.participation.set(1, 'stemHandoff', true);
  categoryOnly.actions.setStemLevel(1, 'flow', 0.5, 'only-one-category');
  check(ceilings(categoryOnly).flow === 0.4 && ['transients', 'tune', 'voice'].every(stem =>
    ceilings(categoryOnly)[stem] === null), 'Individual gesture cannot opportunistically authorize other audible categories');
  const allocatedOnly = application();
  allocatedOnly.model.decks[0].stems = Object.freeze({
    requestedLevels: Object.freeze({ transients: 1, flow: 1, tune: 1, voice: 1 }),
    allocatedLevels: Object.freeze({ transients: 0, flow: 0.2, tune: 0, voice: 0 })
  });
  allocatedOnly.actions.setDeckVolume(1, 0.5, 'allocated-not-requested');
  check(ceilings(allocatedOnly).flow === 0.1 && ceilings(allocatedOnly).voice === null,
    'Integrated deck-wide calculation must use allocated rather than requested levels');

  const untouched = JSON.stringify(model);
  for (const origin of ['automatic', 'initialization', 'programmatic', undefined]) {
    let rejected = false;
    try { actions.dispatch({ type: 'stemControl.set', controlId: 'deck.1.volume', value: 1,
      origin, gestureId: 'not-human' }); } catch (_) { rejected = true; }
    check(rejected && JSON.stringify(model) === untouched, 'Non-human provenance must not mutate controls or authorization');
  }
  check(Object.isFrozen(model.stemSession.authorization) && Object.isFrozen(ceilings(fixture)), 'Authorization snapshots must be immutable');
  const fresh = application();
  check(allNull(fresh) && fresh.model.stemSession.authorization !== model.stemSession.authorization,
    'Application restart/new session must reset authorization independently');
  check(stemCategories.every(stem => appState.stemSession.authorization.ceilingsByStem[stem] === null),
    'Actual startup must not authorize anything');

  const base = createStemSessionState().authorization;
  const allocation = { transients: 0, flow: 0.5, tune: 1, voice: 0.2 };
  const individual = calculateStemAuthorization(base, 0.8, allocation, 'flow');
  check(individual.ceilingsByStem.flow === 0.4 && individual.ceilingsByStem.tune === null,
    'Pure calculation must use allocated, category-specific effective gain');
  check(calculateStemAuthorization(individual, 0.5, allocation, 'flow') === individual,
    'A lower pure candidate returns the same high-water snapshot');
  check(calculateStemAuthorization(base, 0, allocation) === base, 'Pure zero candidates must preserve nulls');
  const deckWide = calculateStemAuthorization(base, 0.8, allocation);
  check(deckWide.ceilingsByStem.transients === null && deckWide.ceilingsByStem.flow === 0.4 &&
    deckWide.ceilingsByStem.tune === 0.8 && deckWide.ceilingsByStem.voice === 0.8 * 0.2,
    'Pure deck-wide update evaluates all four allocated levels');
  const beforeInvalid = JSON.stringify(base);
  for (const attempt of [() => calculateStemAuthorization(base, -1, allocation),
    () => calculateStemAuthorization(base, 1, { ...allocation, voice: NaN }),
    () => calculateStemAuthorization(base, 1, allocation, 'unknown')]) {
    let rejected = false; try { attempt(); } catch (_) { rejected = true; }
    check(rejected && JSON.stringify(base) === beforeInvalid, 'Invalid pure candidates reject without mutating prior authorization');
  }
  // Authorization is not enforcement: it must never clamp a directly set control.
  actions.setDeckVolume(1, 0.01, 'lower-controls');
  check(model.decks[0].volume === 0.01 && ceilings(fixture).voice === 0.9,
    'Tracking high-water ceilings must not redistribute, restore or clamp controls');
  console.log('Global stem authorization, qualification, high-water, zero gain, exclusions, provenance and session reset tests passed');
}
