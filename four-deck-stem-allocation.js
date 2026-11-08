// Phase 1 only: pure one-category allocation. Not loaded by the application.
// active means retained membership after first Play (including Pause), not isPlaying.
// Caller supplies post-event membership/requests and pre-event allocated levels.
// Authorization/eligibility and relationship establishment remain caller-owned.
function calculateFourDeckStemAllocation(input) {
  const { decks, enabled, relationshipEstablished, authorizationCeiling, trigger, priorityDeckId = null } = input;
  if (!Array.isArray(decks) || decks.length !== 4) throw new TypeError('Supply four deck snapshots.');
  if (typeof enabled !== 'boolean' || typeof relationshipEstablished !== 'boolean') throw new TypeError('Supply explicit permission and sharing state.');
  if (!['entry', 'directGesture', 'departure', 'rebalance', 'preparation', 'preserve'].includes(trigger)) throw new TypeError('Unknown allocation trigger.');
  if (authorizationCeiling !== null) requireUnitGain(authorizationCeiling);
  const ordered = [...decks].sort((a, b) => a.id - b.id);
  const seen = new Set();
  for (const deck of ordered) {
    requireStemDeckId(deck.id);
    if (seen.has(deck.id)) throw new RangeError('Duplicate deck ID.');
    seen.add(deck.id);
    for (const value of [deck.volume, deck.requestedLevel, deck.allocatedLevel]) requireUnitGain(value);
    for (const value of [deck.active, deck.participating, deck.returnEligible]) {
      if (typeof value !== 'boolean') throw new TypeError('Membership, participation and eligibility must be Boolean.');
    }
  }
  const hasPriority = ['entry', 'directGesture', 'preparation'].includes(trigger);
  if (hasPriority) requireStemDeckId(priorityDeckId);
  else if (priorityDeckId !== null) throw new TypeError('This trigger has no priority deck.');
  const priority = hasPriority ? ordered.find(deck => deck.id === priorityDeckId) : null;
  const members = ordered.filter(deck => deck.active && deck.participating);
  if (trigger === 'entry' && !members.includes(priority)) throw new RangeError('Entering deck must be an active participant.');
  if (trigger === 'preparation' && priority.active) throw new RangeError('Preparation requires an inactive deck.');
  const allocations = {}, requests = {};
  for (const deck of ordered) {
    allocations[deck.id] = deck.allocatedLevel;
    requests[deck.id] = deck.requestedLevel;
  }
  if (priority) allocations[priority.id] = priority.requestedLevel;
  const redistribute = enabled && !['preparation', 'preserve'].includes(trigger) &&
    (!priority || members.includes(priority));
  if (redistribute) {
    const priorityGain = priority ? priority.volume * priority.requestedLevel : 0;
    const receivers = members.filter(deck => deck !== priority);
    const rows = receivers.map(deck => {
      const current = calculateEffectiveStemGain(deck.volume, deck.allocatedLevel);
      // Existing gain can be retained or reduced even above authorization/ineligible.
      const authorized = deck.returnEligible && authorizationCeiling !== null
        ? Math.min(deck.volume, authorizationCeiling) : 0;
      const weight = deck.volume * deck.requestedLevel;
      return { deck, weight, cap: Math.max(current, authorized), gain: 0 };
    });
    const budget = Math.max(0, 1 - priorityGain);
    // Before sharing, honor requests up to capacity. Established sharing fills capacity,
    // potentially above requests, but never above physical/authorization increase limits.
    for (const row of rows) if (!relationshipEstablished) row.cap = Math.min(row.cap, row.weight);
    let remaining = budget;
    let pending = rows.filter(row => row.weight > 0 && row.cap > 0);
    // At most four passes: each capped pass removes at least one receiver.
    while (pending.length && remaining > 0) {
      const totalWeight = pending.reduce((sum, row) => sum + row.weight, 0);
      const capped = pending.filter(row => remaining * (row.weight / totalWeight) >= row.cap);
      if (!capped.length) {
        for (const row of pending) row.gain = remaining * (row.weight / totalWeight);
        break;
      }
      for (const row of capped) { row.gain = row.cap; remaining = Math.max(0, remaining - row.cap); }
      pending = pending.filter(row => !capped.includes(row));
    }
    for (const row of rows) {
      if (row.deck.volume > 0) allocations[row.deck.id] = Math.min(1, row.gain / row.deck.volume);
      // Muted members retain their prepared faders; their effective contribution is zero.
    }
  }
  const effectiveGains = {};
  for (const deck of ordered) effectiveGains[deck.id] = calculateEffectiveStemGain(deck.volume, allocations[deck.id]);
  const combinedGain = members.reduce((sum, deck) => sum + effectiveGains[deck.id], 0);
  return Object.freeze({ allocationsByDeck: Object.freeze(allocations), requestedLevelsByDeck: Object.freeze(requests),
    effectiveGainsByDeck: Object.freeze(effectiveGains), activeDeckIds: Object.freeze(members.map(deck => deck.id)),
    combinedGain, deficit: Math.max(0, 1 - combinedGain), excess: Math.max(0, combinedGain - 1),
    relationshipEstablished, status: !redistribute ? 'preserved' : Math.abs(combinedGain - 1) <= 1e-12 ? 'balanced' : 'constrained' });
}
