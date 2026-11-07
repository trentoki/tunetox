function runStemHandoffIntegrationTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  function fixture(count = 2) {
    const model = { decks: [1, 2, 3, 4].map(createDeck), participation: createParticipationState(), stemSession: createStemSessionState() };
    const participation = createParticipationActions(model);
    for (let id = count + 1; id <= 4; id++) participation.set(id, 'stemHandoff', false);
    const ceilings = {}; for (const stem of stemCategories) ceilings[stem] = 1;
    model.stemSession = Object.freeze({ ...model.stemSession,
      authorization: Object.freeze({ ceilingsByStem: Object.freeze(ceilings) }) });
    return { model, actions: createStemActions(model), participation };
  }
  function flow(f, id, allocated, requested = allocated, volume = 1) {
    const deck = f.model.decks[id - 1]; deck.volume = volume;
    deck.stems = Object.freeze({ requestedLevels: Object.freeze({ ...deck.stems.requestedLevels, flow: requested }),
      allocatedLevels: Object.freeze({ ...deck.stems.allocatedLevels, flow: allocated }) });
  }
  function establish(f) {
    f.model.stemSession = Object.freeze({ ...f.model.stemSession,
      relationshipsByStem: Object.freeze({ ...f.model.stemSession.relationshipsByStem,
        flow: Object.freeze({ deckIds: Object.freeze([1, 2]), established: true }) }) });
  }
  const f = fixture(); flow(f, 1, 0.6, 1); flow(f, 2, 0.2);
  const auth = f.model.stemSession.authorization;
  const requestedReceiver = f.model.decks[0].stems.requestedLevels;
  const unrelated = JSON.stringify(f.model.decks.slice(2));
  for (const [value, receiver, established] of [
    [0.3,0.6,false], [0.4,0.6,true], [0.5,0.5,true], [0.2,0.8,true], [0.7,0.3,true],
    [1,0,true], [0,1,true], [0.75,0.25,true], [0.1,0.9,true]
  ]) {
    check(f.actions.setStemLevel(2, 'flow', value, 'gesture-' + value), 'Direct changes retain the Boolean action result');
    check(f.model.decks[1].stems.requestedLevels.flow === value && f.model.decks[1].stems.allocatedLevels.flow === value &&
      near(f.model.decks[0].stems.allocatedLevels.flow, receiver), 'Integrated actions must follow capacity-first and reversal sequences');
    check(!!f.model.stemSession.relationshipsByStem.flow === established, 'Sharing state must commit with the allocations');
    check(f.model.decks[0].stems.requestedLevels === requestedReceiver && f.model.decks[0].stems.requestedLevels.flow === 1,
      'Automatic allocation must not overwrite requested intent');
    check(f.model.stemSession.lastChange.origin === 'direct' && f.model.stemSession.lastChange.controlId === 'deck.2.stem.flow.level' &&
      f.model.stemSession.lastChange.gestureId === 'gesture-' + value, 'Only the human-controlled deck produces direct provenance');
    check(f.model.stemSession.authorization === auth && f.model.decks.every(deck => deck.volume === (deck.id <= 2 ? 1 : 0)),
      'Automatic changes do not update authorization or main volume');
    check(JSON.stringify(f.model.decks.slice(2)) === unrelated, 'Excluded decks remain untouched');
    check(f.model.decks[0].stems.allocatedLevels.voice === 1 && f.model.decks[1].stems.allocatedLevels.voice === 0,
      'A Flow gesture must not change another stem category');
  }
  const disabledAllocations = JSON.stringify(f.model.decks);
  const retainedEligibility = f.model.stemSession.eligibilityByDeck;
  f.participation.set(2, 'stemHandoff', false);
  check(JSON.stringify(f.model.decks) === disabledAllocations && f.model.stemSession.relationshipsByStem.flow === null,
    'Disable preserves allocations differing from requested levels and clears the relationship');
  f.participation.set(2, 'stemHandoff', true);
  check(JSON.stringify(f.model.decks) === disabledAllocations && f.model.stemSession.relationshipsByStem.flow === null &&
    f.model.stemSession.eligibilityByDeck === retainedEligibility, 'Re-enable preserves values and eligibility without normalization');
  f.actions.setStemLevel(2, 'flow', 0.2, 'after-reenable-at-unity');
  check(near(f.model.decks[0].stems.allocatedLevels.flow, 0.8) && f.model.stemSession.relationshipsByStem.flow.established,
    'Next changed gesture at complementary total reestablishes and applies sharing');

  const alternating = fixture();
  alternating.actions.setStemLevel(2,'flow',0.2,'introduce-alternating-deck'); // eligibility while muted
  flow(alternating,1,0.5,0.5); flow(alternating,2,0.5,0.2); establish(alternating);
  const humanRequests = { 1: 0.5, 2: 0.2 };
  const alternatingAuth = alternating.model.stemSession.authorization;
  for (const [id, value] of [[1,0.7],[1,0.8],[2,0.6],[1,0.2],[2,0.1],[1,0.8],[2,0.4]]) {
    const otherId = id === 1 ? 2 : 1;
    const receiverRequested = alternating.model.decks[otherId - 1].stems.requestedLevels;
    const gesture = 'alternating-' + id + '-' + value;
    alternating.actions.setStemLevel(id,'flow',value,gesture);
    humanRequests[id] = value;
    check(near(alternating.model.decks[id - 1].stems.allocatedLevels.flow,value) &&
      near(alternating.model.decks[otherId - 1].stems.allocatedLevels.flow,1-value),
      'Repeated and alternating direct gestures must preserve complementary allocations');
    check(alternating.model.decks[0].stems.requestedLevels.flow === humanRequests[1] &&
      alternating.model.decks[1].stems.requestedLevels.flow === humanRequests[2] &&
      alternating.model.decks[otherId - 1].stems.requestedLevels === receiverRequested,
      'Each deck must retain its latest human request when the other is adjusted automatically');
    check(alternating.model.stemSession.lastChange.origin === 'direct' &&
      alternating.model.stemSession.lastChange.controlId === 'deck.' + id + '.stem.flow.level' &&
      alternating.model.stemSession.lastChange.gestureId === gesture,
      'Provenance must follow the current human actor rather than the automatic receiver');
    check(alternating.model.stemSession.authorization === alternatingAuth,
      'Alternating automatic allocations must not create authorization updates');
  }

  const limited = fixture(); flow(limited,1,0,1); flow(limited,2,1); establish(limited);
  limited.model.stemSession = Object.freeze({ ...limited.model.stemSession,
    authorization: Object.freeze({ ceilingsByStem: Object.freeze({ transients:1,flow:0.4,tune:1,voice:1 }) }) });
  limited.actions.setStemLevel(2,'flow',0.2,'limited-return');
  check(near(limited.model.decks[0].stems.allocatedLevels.flow,0.4) && near(limited.model.stemSession.lastChange.handoff.deficit,0.4) &&
    limited.model.stemSession.authorization.ceilingsByStem.flow === 0.4, 'Authorization-limited return must commit a deficit without authorizing the automatic receiver');
  limited.actions.setStemLevel(2,'flow',0.7,'direct-authorizes-higher');
  check(near(limited.model.decks[0].stems.allocatedLevels.flow,0.3) && limited.model.stemSession.authorization.ceilingsByStem.flow === 0.7,
    'Only a qualifying direct gain raises authorization before redistribution');
  limited.actions.setStemLevel(2,'flow',0.1,'limited-again');
  check(near(limited.model.decks[0].stems.allocatedLevels.flow,0.7) && near(limited.model.stemSession.lastChange.handoff.deficit,0.2),
    'Subsequent restoration respects the retained high-water ceiling');
  const physical = fixture(); flow(physical,1,0,1,0.3); flow(physical,2,1); establish(physical);
  physical.actions.setStemLevel(2,'flow',0.2,'physical-limit');
  check(physical.model.decks[0].stems.allocatedLevels.flow === 1 && near(physical.model.stemSession.lastChange.handoff.deficit,0.5),
    'Physical limit caps the automatic fader without changing volume');
  const precision = fixture(); flow(precision,1,0.75,1,0.8); flow(precision,2,0.4,0.4,0.5);
  precision.actions.setStemLevel(2,'flow',1,'fractional-allocation');
  check(near(precision.model.decks[0].stems.allocatedLevels.flow,0.625), 'Automatic allocations retain calculator precision beyond direct 0.01 steps');

  const ineligible = fixture(); flow(ineligible,1,1); flow(ineligible,2,0); establish(ineligible);
  ineligible.actions.setStemLevel(1,'flow',0.4,'no-untouched-introduction');
  check(ineligible.model.decks[1].stems.allocatedLevels.flow === 0 && !ineligible.model.stemSession.eligibilityByDeck[2].flow,
    'Global authorization must not introduce an ineligible untouched zero');
  const muted = fixture(); flow(muted,1,0.3,1); flow(muted,2,0.1,0.1,0); establish(muted);
  muted.actions.setStemLevel(2,'flow',1,'muted-direct');
  check(muted.model.decks[0].stems.allocatedLevels.flow === 0.3 && muted.model.stemSession.lastChange.handoff === undefined &&
    muted.model.stemSession.eligibilityByDeck[2].flow, 'Zero effective-change actions can introduce eligibility but must not redistribute');
  const noEffect = fixture(); flow(noEffect,1,0.1,1); flow(noEffect,2,0.4,0.2); establish(noEffect);
  noEffect.actions.setStemLevel(2,'flow',0.4,'intent-only');
  check(noEffect.model.decks[0].stems.allocatedLevels.flow === 0.1 && noEffect.model.stemSession.lastChange.handoff === undefined,
    'Requested-only changes with unchanged allocated effective gain must not redistribute');
  noEffect.actions.setDeckVolume(2,0.5,'volume-no-redistribution');
  check(noEffect.model.decks[0].stems.allocatedLevels.flow === 0.1 && noEffect.model.stemSession.lastChange.handoff === undefined,
    'Main-volume gestures do not redistribute');
  for (const count of [1,3,4]) {
    const many = fixture(count); flow(many,1,0.6); flow(many,2,0.2);
    many.actions.setStemLevel(1,'flow',0.7,'unsupported-count');
    check(many.model.decks[1].stems.allocatedLevels.flow === 0.2 && many.model.stemSession.lastChange.handoff === undefined,
      'Non-two-deck counts preserve direct-only behavior');
  }
  f.participation.set(2,'stemHandoff',false);
  const otherBefore = f.model.decks[0].stems;
  f.actions.setStemLevel(2,'flow',0.4,'excluded-direct');
  check(f.model.decks[0].stems === otherBefore, 'Excluded direct gestures cannot redistribute');
  const otherPair = fixture(4);
  otherPair.actions.setStemLevel(2,'flow',0.6,'introduce-deck-two');
  otherPair.participation.set(1,'stemHandoff',false); otherPair.participation.set(3,'stemHandoff',false);
  flow(otherPair,2,0.6,0.9); flow(otherPair,4,0.2);
  otherPair.actions.setStemLevel(4,'flow',0.5,'pair-two-four');
  check(near(otherPair.model.decks[1].stems.allocatedLevels.flow,0.5) &&
    otherPair.model.decks[1].stems.requestedLevels.flow === 0.9 &&
    otherPair.model.stemSession.relationshipsByStem.flow.deckIds.join(',') === '2,4',
    'Live integration must select the actual participant pair rather than assume Decks 1/2');
  // A calculation failure must occur before either deck or session is committed.
  const atomic = fixture(); flow(atomic,1,0.6); flow(atomic,2,0.2);
  const originalCalculator = calculateTwoDeckStemHandoff;
  const beforeFailure = JSON.stringify(atomic.model), priorSession = atomic.model.stemSession;
  let failed = false;
  try {
    calculateTwoDeckStemHandoff = () => { throw new Error('simulated calculation failure'); };
    atomic.actions.setStemLevel(2,'flow',0.5,'must-not-commit');
  } catch (_) { failed = true; } finally { calculateTwoDeckStemHandoff = originalCalculator; }
  check(failed && JSON.stringify(atomic.model) === beforeFailure && atomic.model.stemSession === priorSession,
    'Failed calculation must not partially commit controls, eligibility, authorization or sharing');
  check(appState.decks.every(deck => deck.volume === 0 && deck.song === null), 'Tests must not alter startup state');
  console.log('Live domain two-deck stem handoff integration tests passed: capacity, reversals, limits, provenance, participation and atomic commits');
}
