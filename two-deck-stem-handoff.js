// Pure one-category proposal calculator, used by individual-stem domain actions and numerical tests.
// Callers retain returned sharing state. Below-unity upward crossing can establish sharing;
// return eligibility and other activation/convergence rules are never inferred.
function calculateTwoDeckStemHandoff(input) {
  const { decks, directDeckId, directStemLevel, authorizationCeiling,
    relationshipEstablished, trigger } = input;
  if (!Array.isArray(decks) || decks.length !== 4) throw new TypeError('Supply four deck snapshots.');
  if (typeof relationshipEstablished !== 'boolean') throw new TypeError('Sharing must be explicitly established or inactive.');
  if (!['directGesture', 'participationChange'].includes(trigger)) throw new TypeError('Unknown handoff trigger.');
  requireStemDeckId(directDeckId);
  requireUnitGain(directStemLevel);
  if (authorizationCeiling !== null) requireUnitGain(authorizationCeiling);
  const seen = new Set();
  for (const deck of decks) {
    requireStemDeckId(deck.id);
    if (seen.has(deck.id)) throw new RangeError('Duplicate deck ID.');
    seen.add(deck.id);
    requireUnitGain(deck.volume);
    requireUnitGain(deck.allocatedLevel);
    if (typeof deck.participating !== 'boolean' || typeof deck.returnEligible !== 'boolean') {
      throw new TypeError('Participation and return eligibility must be explicit Booleans.');
    }
  }
  const participants = decks.filter(deck => deck.participating);
  if (participants.length !== 2) throw new RangeError('Two-deck calculator requires exactly two participants.');
  const direct = participants.find(deck => deck.id === directDeckId);
  if (!direct) throw new RangeError('Direct deck must participate in the pair.');
  const other = participants.find(deck => deck.id !== directDeckId);
  const allocationsByDeck = {};
  for (const deck of decks) allocationsByDeck[deck.id] = deck.allocatedLevel;

  // Sharing is latched in caller-carried state: reversals, zero and gesture boundaries
  // cannot clear it. Only an explicit inactive input disables an established relationship.
  let nextRelationshipEstablished = relationshipEstablished;
  if (trigger === 'directGesture') {
    // Direct input takes priority, regardless of whether sharing is established.
    allocationsByDeck[direct.id] = directStemLevel;
    const previousDirectGain = calculateEffectiveStemGain(direct.volume, direct.allocatedLevel);
    const currentOtherGain = calculateEffectiveStemGain(other.volume, other.allocatedLevel);
    const directGain = calculateEffectiveStemGain(direct.volume, directStemLevel);
    // Use spare effective-gain capacity first. Crossing unity during an upward gesture
    // establishes sharing, including when one event jumps past the exact boundary.
    if (!relationshipEstablished && previousDirectGain + currentOtherGain < 1 &&
        directGain > previousDirectGain && directGain + currentOtherGain >= 1) {
      nextRelationshipEstablished = true;
    }
    if (nextRelationshipEstablished) {
      const desiredOtherGain = 1 - directGain;
      // Authorization limits increases, not pre-existing levels or reductions. An ineligible
      // recipient may decrease or stay unchanged, but cannot automatically become louder.
      const authorizedCapacity = other.returnEligible && authorizationCeiling !== null
        ? Math.min(other.volume, authorizationCeiling) : 0;
      const maximumOtherGain = Math.max(currentOtherGain, authorizedCapacity);
      const nextOtherGain = Math.min(desiredOtherGain, maximumOtherGain);
      // A muted deck has no effective capacity. Preserve its fader instead of dividing by zero
      // or silently moving a currently inaudible control.
      if (other.volume > 0) {
        allocationsByDeck[other.id] = Math.min(1, nextOtherGain / other.volume);
      }
    }
  }
  // Participation changes never apply a proposed direct value or normalize allocations.
  const effectiveGainsByDeck = {};
  for (const deck of decks) {
    effectiveGainsByDeck[deck.id] = calculateEffectiveStemGain(deck.volume, allocationsByDeck[deck.id]);
  }
  const combinedGain = participants.reduce((total, deck) => total + effectiveGainsByDeck[deck.id], 0);
  const deficit = Math.max(0, 1 - combinedGain);
  const excess = Math.max(0, combinedGain - 1);
  const status = trigger === 'participationChange' ? 'preserved' : !nextRelationshipEstablished ? 'inactive' :
    Math.abs(combinedGain - 1) <= 1e-12 ? 'balanced' : 'constrained';
  return Object.freeze({ allocationsByDeck: Object.freeze(allocationsByDeck),
    effectiveGainsByDeck: Object.freeze(effectiveGainsByDeck), combinedGain, deficit, excess,
    targetGain: 1, status, relationshipEstablished: nextRelationshipEstablished });
}
