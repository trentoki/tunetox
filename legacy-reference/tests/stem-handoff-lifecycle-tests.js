function runStemHandoffLifecycleTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  function fixture() {
    const model = { decks: [1, 2, 3, 4].map(createDeck), participation: createParticipationState(), stemSession: createStemSessionState() };
    return { model, actions: createStemActions(model), participation: createParticipationActions(model) };
  }
  function setFlow(f, id, volume, allocated, requested = allocated) {
    const deck = f.model.decks[id - 1]; deck.volume = volume;
    deck.stems = Object.freeze({ requestedLevels: Object.freeze({ ...deck.stems.requestedLevels, flow: requested }),
      allocatedLevels: Object.freeze({ ...deck.stems.allocatedLevels, flow: allocated }) });
  }
  const f = fixture(), session = f.model.stemSession;
  for (let id = 1; id <= 4; id++) for (const stem of stemCategories) {
    check(session.eligibilityByDeck[id][stem] === (id === 1), 'Only Deck 1 stems start eligible');
    check(session.authorization.ceilingsByStem[stem] === null && session.relationshipsByStem[stem] === null,
      'Initialization must not establish authorization or relationships');
  }
  check(Object.isFrozen(session.eligibilityByDeck[1]) && Object.isFrozen(session.relationshipsByStem), 'Session snapshots must be immutable');
  f.participation.set(2, 'stemHandoff', false);
  f.actions.setStemLevel(2, 'flow', 0.3, 'muted-excluded-positive');
  check(f.model.stemSession.eligibilityByDeck[2].flow && f.model.decks[1].volume === 0 &&
    f.model.stemSession.authorization.ceilingsByStem.flow === null,
    'Positive changed stem gestures introduce eligibility even muted/excluded, without authorization');
  check(!f.model.stemSession.eligibilityByDeck[2].voice, 'Introduction must be category-specific');
  f.actions.setStemLevel(2, 'flow', 0, 'direct-zero');
  check(f.model.stemSession.eligibilityByDeck[2].flow, 'Direct zero never revokes eligibility');
  const zeroSession = f.model.stemSession;
  f.actions.setStemLevel(2, 'flow', 0, 'reengaged-at-zero');
  check(f.model.stemSession.eligibilityByDeck === zeroSession.eligibilityByDeck, 'No-op/reengagement must not revoke eligibility');
  f.actions.setStemLevel(2, 'flow', 0.4, 'another-gesture');
  const introduced = f.model.stemSession;
  setFlow(f, 2, 0, 0, 0.4); // Model only the allocation result of future automatic suppression.
  check(f.model.stemSession === introduced && f.model.stemSession.eligibilityByDeck[2].flow,
    'Allocation-only suppression to zero cannot erase eligibility, authorization or provenance');
  setFlow(f, 3, 0, 0.5);
  f.actions.setStemLevel(3, 'flow', 0.5, 'same-positive-value');
  check(!f.model.stemSession.eligibilityByDeck[3].flow, 'Same-value positive actions do not introduce eligibility');
  f.actions.setDeckVolume(3, 0.7, 'main-volume-only');
  check(!f.model.stemSession.eligibilityByDeck[3].flow, 'Main volume does not introduce individual stem eligibility');
  const beforeInvalid = JSON.stringify(f.model);
  try { f.actions.dispatch({ type: 'stemControl.set', controlId: 'deck.4.stem.flow.level', origin: 'automatic', gestureId: 'auto', value: 0.5 }); } catch (_) {}
  check(JSON.stringify(f.model) === beforeInvalid, 'Non-human actions cannot introduce eligibility or authorize');

  const pair = fixture();
  pair.participation.set(3, 'stemHandoff', false); pair.participation.set(4, 'stemHandoff', false);
  setFlow(pair, 1, 1, 0.6, 1); setFlow(pair, 2, 1, 0.2, 0.2);
  pair.actions.setStemLevel(2, 'flow', 0.3, 'available-capacity');
  check(pair.model.stemSession.relationshipsByStem.flow === null, 'Below-unity space must not establish sharing prematurely');
  pair.actions.setStemLevel(2, 'flow', 0.4, 'reach-unity');
  const relation = pair.model.stemSession.relationshipsByStem.flow;
  check(relation.established && relation.deckIds.join(',') === '1,2', 'Upward unity crossing stores the category/pair relationship');
  check(pair.model.stemSession.relationshipsByStem.voice === null, 'Individual gestures do not establish other categories');
  pair.actions.setStemLevel(2, 'flow', 0, 'reverse-to-zero');
  pair.actions.setStemLevel(2, 'flow', 0.7, 'new-gesture');
  check(pair.model.stemSession.relationshipsByStem.flow === relation && Math.abs(pair.model.decks[0].stems.allocatedLevels.flow - 0.3) < 1e-12,
    'Relationship survives reversals/zero/gestures while the integrated action updates allocation');
  const beforeToggle = JSON.stringify(pair.model.decks);
  const auth = pair.model.stemSession.authorization, eligibility = pair.model.stemSession.eligibilityByDeck;
  pair.participation.set(1, 'beatmatching', false);
  check(pair.model.stemSession.relationshipsByStem.flow === relation, 'Other capability toggles do not invalidate stem sharing');
  pair.participation.set(2, 'stemHandoff', false);
  check(pair.model.stemSession.relationshipsByStem.flow === null && JSON.stringify(pair.model.decks) === beforeToggle &&
    pair.model.stemSession.authorization === auth && pair.model.stemSession.eligibilityByDeck === eligibility,
    'Disable clears sharing but preserves actual/requested allocations, eligibility and authorization');
  pair.participation.set(2, 'stemHandoff', true);
  check(pair.model.stemSession.relationshipsByStem.flow === null && JSON.stringify(pair.model.decks) === beforeToggle,
    'Re-enable never restores old requested values, normalizes, or immediately establishes sharing');
  setFlow(pair, 1, 1, 0.6, 1); setFlow(pair, 2, 1, 0.4, 0.4);
  const beforeNoop = pair.model.stemSession;
  pair.actions.setStemLevel(2, 'flow', 0.4, 'same-value-at-unity');
  check(pair.model.stemSession.relationshipsByStem.flow === null, 'No-op at complementary total does not qualify');
  pair.actions.setStemLevel(2, 'flow', 0.5, 'qualifying-after-reenable');
  check(pair.model.stemSession.relationshipsByStem.flow.established && pair.model.decks[0].stems.allocatedLevels.flow === 0.5,
    'Next changed participating gesture at already-unity establishes and applies complementary sharing');
  check(beforeNoop.relationshipsByStem.flow === null, 'Previously inactive snapshots never mutate');
  pair.participation.set(3, 'stemHandoff', true);
  check(pair.model.stemSession.relationshipsByStem.flow === null, 'Moving from two to three participants invalidates the pair');
  pair.participation.set(2, 'stemHandoff', false);
  check(pair.model.stemSession.relationshipsByStem.flow === null && getStemHandoffPair(pair.model.participation).join(',') === '1,3',
    'A different pair starts inactive rather than inheriting another pair relationship');
  pair.participation.set(3, 'stemHandoff', false); pair.participation.set(2, 'stemHandoff', true);
  check(pair.model.stemSession.relationshipsByStem.flow === null, 'Returning to a former pair must not restore its old latch');
  const secondAdapter = createParticipationActions(pair.model);
  setFlow(pair, 1, 1, 0.6); setFlow(pair, 2, 1, 0.4);
  pair.actions.setDeckVolume(1, 0.9, 'deck-wide-at-unity');
  check(pair.model.stemSession.relationshipsByStem.flow.established, 'Qualifying main-volume gestures evaluate relationship metadata too');
  secondAdapter.set(1, 'stemHandoff', false);
  check(pair.model.stemSession.relationshipsByStem.flow === null, 'All participation adapters invalidate the same session relationships');
  const fresh = fixture();
  check(fresh.model.stemSession !== session && !fresh.model.stemSession.eligibilityByDeck[2].flow &&
    stemCategories.every(stem => fresh.model.stemSession.relationshipsByStem[stem] === null), 'New sessions reset eligibility and relationships to factory values');
  check(stemCategories.every(stem => appState.stemSession.eligibilityByDeck[1][stem] &&
    !appState.stemSession.eligibilityByDeck[2][stem]), 'Actual application startup must install approved eligibility');
  console.log('Stem session eligibility and pair lifecycle tests passed: initialization, muted/excluded introduction, zeros, disable/re-enable, pair changes and isolation');
}
