// Pure one-category allocation. F2 opts into incremental direct-stem transfers;
// existing callers retain the F1 request-weighted path.
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
  let transfer = null;
  if (redistribute && input.incremental && ['directGesture','entry'].includes(trigger)) {
    transfer = allocateIncrementalStemGesture({ ...input, ordered, members, priority, allocations });
  } else if (redistribute) {
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
    transfer, combinedGain, deficit: Math.max(0, 1 - combinedGain), excess: Math.max(0, combinedGain - 1),
    relationshipEstablished, status: !redistribute ? 'preserved' : Math.abs(combinedGain - 1) <= 1e-12 ? 'balanced' : 'constrained' });
}

// F2 opt-in: preserve committed peer gains; transfer only the direct effective-gain
// delta. Main actions and lifecycle allocations deliberately retain their old path.
function allocateIncrementalStemGesture(input) {
  const { members, priority, allocations, authorizationCeiling, relationshipEstablished } = input;
  const { previousGain, history } = input.incremental;
  requireUnitGain(previousGain);
  if (!Array.isArray(history) || new Set(history).size !== history.length ||
      history.some(id => ![1,2,3,4].includes(id))) throw new TypeError('Invalid stem touch history.');
  const peers = members.filter(deck => deck !== priority);
  const gains = new Map(peers.map(deck => [deck.id, deck.volume * deck.allocatedLevel]));
  const totalBefore = previousGain + [...gains.values()].reduce((sum,gain)=>sum+gain,0);
  const delta = priority.volume * priority.requestedLevel - previousGain;
  let transferred = 0;
  if (delta > 0) {
    // Available headroom is used first. Only existing positive allocations donate;
    // stale requests and automatically zeroed peers cannot suddenly appear here.
    const needed = Math.min(delta, Math.max(0,totalBefore + delta - 1));
    const donors = peers.filter(deck => gains.get(deck.id)>0);
    const available = donors.reduce((sum,deck)=>sum+gains.get(deck.id),0);
    transferred = Math.min(needed,available);
    if (available>0) for (const deck of donors) {
      const gain=gains.get(deck.id);
      gains.set(deck.id,Math.max(0,gain-transferred*(gain/available)));
    }
  } else if (delta < 0 && relationshipEstablished) {
    let remaining=Math.min(-delta,Math.max(0,1-(totalBefore+delta)));
    for (const id of [...history].reverse()) {
      const deck=peers.find(peer=>peer.id===id);
      if (!deck || !deck.returnEligible || deck.requestedLevel===0 || deck.volume===0 || authorizationCeiling===null) continue;
      const current=gains.get(id), ceiling=Math.min(deck.volume,authorizationCeiling);
      const amount=Math.min(remaining,Math.max(0,ceiling-current));
      gains.set(id,current+amount);remaining-=amount;transferred+=amount;
      if (remaining<=1e-12) break;
    }
  }
  for (const deck of peers) if (deck.volume>0) allocations[deck.id]=Math.min(1,gains.get(deck.id)/deck.volume);
  return Object.freeze({ previousGain, delta, transferred,
    unreturnedGain: delta<0 ? Math.max(0,-delta-transferred):0,
    preexistingExcess:Math.max(0,totalBefore-1) });
}
