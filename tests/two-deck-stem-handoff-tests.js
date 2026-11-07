function runTwoDeckStemHandoffTests() {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const near = (actual, expected) => Math.abs(actual - expected) < 1e-12;
  function fixture() {
    return { decks: [1, 2, 3, 4].map(id => ({ id, volume: 1, allocatedLevel: id === 1 ? 1 : 0,
      participating: id <= 2, returnEligible: id <= 2 })), directDeckId: 2, directStemLevel: 0,
      authorizationCeiling: 1, relationshipEstablished: true, trigger: 'directGesture' };
  }
  const input = fixture();
  // No release/gesture-ID state: the same sequence works while held or across gestures.
  for (const value of [0, 0.4, 1, 0.75, 0, 0.5, 1, 0.2, 0, 1, 0]) {
    input.directStemLevel = value;
    const before = JSON.stringify(input);
    const result = calculateTwoDeckStemHandoff(input);
    check(near(result.allocationsByDeck[1], 1 - value) && result.allocationsByDeck[2] === value,
      'Established pair must follow immediate complementary reversals, including endpoints');
    check(result.status === 'balanced' && near(result.combinedGain, 1) && result.relationshipEstablished,
      'Reaching zero must not deactivate sharing');
    check(result.allocationsByDeck[3] === 0 && result.allocationsByDeck[4] === 0 && JSON.stringify(input) === before,
      'Input, eligibility, main volumes and excluded decks must never mutate');
    for (const deck of input.decks) deck.allocatedLevel = result.allocationsByDeck[deck.id];
  }
  input.directDeckId = 1; input.directStemLevel = 0.35;
  const switched = calculateTwoDeckStemHandoff(input);
  check(near(switched.allocationsByDeck[2], 0.65), 'Either member can become the direct deck in a later gesture');

  const below = fixture(); below.relationshipEstablished = false;
  below.decks[0].allocatedLevel = 0.3; below.decks[1].allocatedLevel = 0.4; below.directStemLevel = 0.2;
  const belowResult = calculateTwoDeckStemHandoff(below);
  check(near(belowResult.combinedGain, 0.5) && near(belowResult.deficit, 0.5) && belowResult.status === 'inactive',
    'A downward inactive gesture must not fill spare capacity or establish sharing');
  const above = fixture(); above.decks[0].allocatedLevel = 0.6; above.decks[1].allocatedLevel = 0.7;
  above.trigger = 'participationChange'; above.directStemLevel = 0.1;
  const joined = calculateTwoDeckStemHandoff(above);
  check(joined.allocationsByDeck[1] === 0.6 && joined.allocationsByDeck[2] === 0.7 && near(joined.excess, 0.3),
    'Joining must preserve above-unity allocations, report excess, and ignore direct proposals');
  above.trigger = 'directGesture'; above.relationshipEstablished = false; above.directStemLevel = 0.8;
  const unestablished = calculateTwoDeckStemHandoff(above);
  check(near(unestablished.excess, 0.4) && unestablished.allocationsByDeck[1] === 0.6,
    'Unestablished above-unity input must not invent a convergence curve');

  const rising = fixture(); rising.relationshipEstablished = false;
  rising.decks[0].allocatedLevel = 0.6; rising.decks[1].allocatedLevel = 0.2;
  const sequence = [
    [0.3, 0.6, false], [0.4, 0.6, true], [0.5, 0.5, true], [1, 0, true],
    [0.75, 0.25, true], [0, 1, true], [1, 0, true], [0.2, 0.8, true]
  ];
  for (const [directLevel, otherLevel, established] of sequence) {
    rising.directStemLevel = directLevel;
    const before = JSON.stringify(rising);
    const result = calculateTwoDeckStemHandoff(rising);
    check(near(result.allocationsByDeck[1], otherLevel) && result.allocationsByDeck[2] === directLevel &&
      result.relationshipEstablished === established, 'Below-unity rise must use space then establish complementary sharing');
    check(JSON.stringify(rising) === before, 'Establishment must return a proposal without mutating input');
    for (const deck of rising.decks) deck.allocatedLevel = result.allocationsByDeck[deck.id];
    rising.relationshipEstablished = result.relationshipEstablished;
  }
  const persistent = fixture(); persistent.relationshipEstablished = false;
  persistent.decks[0].allocatedLevel = 0.6; persistent.decks[1].allocatedLevel = 0.2;
  for (const [directLevel, otherLevel, established] of [
    [0.3, 0.6, false], [0.4, 0.6, true], [0.5, 0.5, true],
    [0.2, 0.8, true], [0.7, 0.3, true], [0, 1, true], [1, 0, true], [0.7, 0.3, true]
  ]) {
    // Rebuild each proposal as a caller would after either an update or release/reengagement.
    // No gesture-local memory is supplied: only prior allocations and the returned latch.
    const proposal = { ...persistent, directStemLevel: directLevel };
    const result = calculateTwoDeckStemHandoff(proposal);
    check(near(result.allocationsByDeck[1], otherLevel) && result.allocationsByDeck[2] === directLevel &&
      result.relationshipEstablished === established, 'Sharing must persist through the approved reversal sequence and separate proposals');
    for (const deck of persistent.decks) deck.allocatedLevel = result.allocationsByDeck[deck.id];
    persistent.relationshipEstablished = result.relationshipEstablished;
  }
  const constrainedLatch = calculateTwoDeckStemHandoff({ ...persistent, directStemLevel: 0.1, authorizationCeiling: 0.4 });
  check(constrainedLatch.relationshipEstablished && constrainedLatch.status === 'constrained' && near(constrainedLatch.deficit, 0.5),
    'An authorization-limited reversal must report deficit without clearing established sharing');
  const explicitlyOff = calculateTwoDeckStemHandoff({ ...persistent, relationshipEstablished: false, directStemLevel: 0.2 });
  check(!explicitlyOff.relationshipEstablished && near(explicitlyOff.allocationsByDeck[1], 0.3),
    'Only explicit disable clears the carried relationship; a subsequent lowering does not restore a complement');

  const skippedBoundary = fixture(); skippedBoundary.relationshipEstablished = false;
  skippedBoundary.decks[0].allocatedLevel = 0.6; skippedBoundary.decks[1].allocatedLevel = 0.2;
  skippedBoundary.directStemLevel = 0.5;
  const crossed = calculateTwoDeckStemHandoff(skippedBoundary);
  check(crossed.relationshipEstablished && near(crossed.allocationsByDeck[1], 0.5),
    'A single upward event crossing unity must establish without needing an exact intermediate sample');
  const tinyRise = { ...skippedBoundary, directStemLevel: 0.21 };
  const notYet = calculateTwoDeckStemHandoff(tinyRise);
  check(!notYet.relationshipEstablished && notYet.allocationsByDeck[1] === 0.6,
    'An upward event below unity must not reduce the other deck or establish sharing early');
  const stationary = { ...skippedBoundary, directStemLevel: 0.2 };
  check(!calculateTwoDeckStemHandoff(stationary).relationshipEstablished, 'A same-value event must not establish sharing');
  const enabling = { ...skippedBoundary, trigger: 'participationChange', directStemLevel: 1 };
  const enabled = calculateTwoDeckStemHandoff(enabling);
  check(!enabled.relationshipEstablished && enabled.allocationsByDeck[1] === 0.6 && enabled.allocationsByDeck[2] === 0.2,
    'Enabling below unity must not apply direct proposals, normalize or establish sharing');
  const quieterVolume = fixture(); quieterVolume.relationshipEstablished = false;
  quieterVolume.decks[0].volume = 0.8; quieterVolume.decks[0].allocatedLevel = 0.75; // gain 0.6
  quieterVolume.decks[1].volume = 0.5; quieterVolume.decks[1].allocatedLevel = 0.4; // gain 0.2
  quieterVolume.directStemLevel = 0.6; // gain 0.3: still below unity
  check(!calculateTwoDeckStemHandoff(quieterVolume).relationshipEstablished &&
    calculateTwoDeckStemHandoff(quieterVolume).allocationsByDeck[1] === 0.75,
    'Use effective gain rather than fader position for available space');
  quieterVolume.directStemLevel = 1; // gain 0.5: crosses unity
  const nonUnityCrossing = calculateTwoDeckStemHandoff(quieterVolume);
  check(nonUnityCrossing.relationshipEstablished && near(nonUnityCrossing.allocationsByDeck[1], 0.625),
    'Crossing must convert the effective complement back to the receiver allocation');
  const zeroDirect = { ...skippedBoundary, decks: skippedBoundary.decks.map(deck =>
    deck.id === 2 ? { ...deck, volume: 0 } : { ...deck }), directStemLevel: 1 };
  check(!calculateTwoDeckStemHandoff(zeroDirect).relationshipEstablished &&
    calculateTwoDeckStemHandoff(zeroDirect).allocationsByDeck[1] === 0.6,
    'Raising a muted fader cannot establish sharing or reduce another deck');
  const unauthorized = { ...skippedBoundary, authorizationCeiling: null, directStemLevel: 1 };
  const suppressed = calculateTwoDeckStemHandoff(unauthorized);
  unauthorized.decks = unauthorized.decks.map(deck => ({ ...deck, allocatedLevel: suppressed.allocationsByDeck[deck.id] }));
  unauthorized.relationshipEstablished = suppressed.relationshipEstablished;
  unauthorized.directStemLevel = 0.2;
  const cannotRestore = calculateTwoDeckStemHandoff(unauthorized);
  check(cannotRestore.relationshipEstablished && cannotRestore.allocationsByDeck[1] === 0 && near(cannotRestore.deficit, 0.8),
    'After establishment, reversal must retain authorization limits without deactivating sharing');
  const disabled = { ...rising, relationshipEstablished: false, directStemLevel: 0.1 };
  check(!calculateTwoDeckStemHandoff(disabled).relationshipEstablished,
    'Explicit disabling followed by a downward move must remain inactive');

  const capped = fixture(); capped.decks[0].allocatedLevel = 0; capped.directStemLevel = 0.2;
  capped.authorizationCeiling = 0.4;
  const limited = calculateTwoDeckStemHandoff(capped);
  check(limited.allocationsByDeck[2] === 0.2 && near(limited.effectiveGainsByDeck[1], 0.4) &&
    near(limited.deficit, 0.4) && limited.status === 'constrained', 'Authorization shortage must preserve direct input and report deficit');
  capped.authorizationCeiling = null;
  check(near(calculateTwoDeckStemHandoff(capped).deficit, 0.8), 'Unestablished authorization must not permit increases');
  capped.authorizationCeiling = 1; capped.decks[0].returnEligible = false;
  check(calculateTwoDeckStemHandoff(capped).allocationsByDeck[1] === 0, 'An untouched/ineligible zero must not be introduced');
  capped.decks[0].returnEligible = true;
  check(near(calculateTwoDeckStemHandoff(capped).allocationsByDeck[1], 0.8), 'Eligible automatic zero must remain able to return');
  capped.decks[0].volume = 0.3;
  const physical = calculateTwoDeckStemHandoff(capped);
  check(physical.allocationsByDeck[1] === 1 && near(physical.combinedGain, 0.5) && near(physical.deficit, 0.5),
    'Physical stem limit must cap effective capacity without raising main volume');
  capped.decks[0].volume = 0; capped.decks[0].allocatedLevel = 0.7;
  const muted = calculateTwoDeckStemHandoff(capped);
  check(muted.allocationsByDeck[1] === 0.7 && muted.effectiveGainsByDeck[1] === 0 && near(muted.deficit, 0.8),
    'Zero-volume receiver must remain finite and preserve its inaudible fader');
  capped.decks[0].volume = 1; capped.decks[0].allocatedLevel = 0.8;
  capped.authorizationCeiling = 0.2; capped.directStemLevel = 0.3;
  check(near(calculateTwoDeckStemHandoff(capped).effectiveGainsByDeck[1], 0.7),
    'An existing gain above authorization may decrease without being retroactively clamped');

  const gains = fixture(); gains.decks[0].volume = 0.8; gains.decks[0].allocatedLevel = 0.5;
  gains.decks[1].volume = 0.5; gains.directStemLevel = 0.6;
  const effective = calculateTwoDeckStemHandoff(gains);
  check(near(effective.effectiveGainsByDeck[2], 0.3) && near(effective.allocationsByDeck[1], 0.875),
    'Complement must be calculated in effective gain and converted back to stem allocation');
  gains.decks[1].volume = 0; gains.directStemLevel = 1;
  check(near(calculateTwoDeckStemHandoff(gains).effectiveGainsByDeck[1], 0.8),
    'Raising a zero-volume direct deck must not take gain from another deck (capacity remains bounded)');

  const differentPair = fixture(); differentPair.decks.forEach(deck => { deck.participating = deck.id === 2 || deck.id === 4; });
  differentPair.directDeckId = 4; differentPair.directStemLevel = 0.25;
  check(near(calculateTwoDeckStemHandoff(differentPair).allocationsByDeck[2], 0.75),
    'The pair is selected by participation, not deck number, visibility or loaded songs');
  const invalid = [
    { ...fixture(), relationshipEstablished: undefined }, { ...fixture(), trigger: 'release' },
    { ...fixture(), directDeckId: 3 }, { ...fixture(), directStemLevel: 1.1 },
    { ...fixture(), authorizationCeiling: -1 },
    { ...fixture(), decks: fixture().decks.slice(0, 2) }
  ];
  for (const count of [0, 1, 3, 4]) {
    const unsupported = fixture(); unsupported.decks.forEach(deck => { deck.participating = deck.id <= count; }); invalid.push(unsupported);
  }
  const duplicate = fixture(); duplicate.decks[3].id = 1; invalid.push(duplicate);
  const noEligibility = fixture(); delete noEligibility.decks[0].returnEligible; invalid.push(noEligibility);
  for (const candidate of invalid) {
    const before = JSON.stringify(candidate); let rejected = false;
    try { calculateTwoDeckStemHandoff(candidate); } catch (_) { rejected = true; }
    check(rejected && JSON.stringify(candidate) === before, 'Invalid/unsupported inputs must reject without mutation');
  }
  check(Object.isFrozen(effective) && Object.isFrozen(effective.allocationsByDeck), 'Calculated proposals must be immutable');
  console.log('Two-deck handoff numerical tests passed (including below-unity establishment): reversals, inactive/joining states, authorization, eligibility, physical limits and deficits/excesses');
}
