// Domain state/actions only. Stem/volume two-deck handoff uses the pure calculator; no audio, storage or UI.
const stemCategories = Object.freeze(['transients', 'flow', 'tune', 'voice']);

function requireStemDeckId(deckId) {
  if (!Number.isInteger(deckId) || deckId < 1 || deckId > 4) {
    throw new RangeError('Stem deckId must be an integer from 1 to 4.');
  }
}

function requireUnitGain(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('Gain must be a finite number from 0 to 1.');
  }
}

function createDeckStemState(deckId) {
  requireStemDeckId(deckId);
  const levels = {};
  for (const stem of stemCategories) levels[stem] = deckId === 1 ? 1 : 0;
  return Object.freeze({ requestedLevels: Object.freeze({ ...levels }),
    allocatedLevels: Object.freeze({ ...levels }) });
}

function createStemSessionState() {
  const ceilingsByStem = {};
  // null means no positive gain has been authorized this session. Enforcement is separate.
  for (const stem of stemCategories) ceilingsByStem[stem] = null;
  const eligibilityByDeck = {};
  for (let id = 1; id <= 4; id++) {
    const eligibility = {};
    for (const stem of stemCategories) eligibility[stem] = id === 1;
    eligibilityByDeck[id] = Object.freeze(eligibility);
  }
  const relationshipsByStem = {};
  for (const stem of stemCategories) relationshipsByStem[stem] = null;
  return Object.freeze({
    automaticHandoffEnabled: true,
    eligibilityByDeck: Object.freeze(eligibilityByDeck),
    relationshipsByStem: Object.freeze(relationshipsByStem),
    authorization: Object.freeze({ ceilingsByStem: Object.freeze(ceilingsByStem) }),
    lastChange: Object.freeze({ origin: 'initialization', controlId: null, gestureId: null })
  });
}

// Pair identity derives from the one authoritative participation store.
function getStemHandoffPair(participation) {
  const ids = [];
  for (let id = 1; id <= 4; id++) if (participation.byDeck[id].stemHandoff) ids.push(id);
  return ids.length === 2 ? ids : null;
}

// Participation changes only invalidate relationships. They never restore/normalize levels,
// revoke eligibility, alter authorization or establish a relationship for a newly joined pair.
function reconcileHandoffRelationships(session, participation) {
  const pair = getStemHandoffPair(participation);
  const relationships = { ...session.relationshipsByStem };
  let changed = false;
  for (const stem of stemCategories) {
    const relation = relationships[stem];
    if (relation && (!pair || relation.deckIds[0] !== pair[0] || relation.deckIds[1] !== pair[1])) {
      relationships[stem] = null;
      changed = true;
    }
  }
  return changed ? Object.freeze({ ...session, relationshipsByStem: Object.freeze(relationships) }) : session;
}

// Pure session metadata update; no calculator calls or allocation proposals are applied.
function calculateGestureHandoffState(session, context) {
  const { participation, decks, deck, nextVolume, nextStems, stem, changed } = context;
  let next = reconcileHandoffRelationships(session, participation);
  if (!changed) return next;
  if (stem && nextStems.requestedLevels[stem] > 0 && !next.eligibilityByDeck[deck.id][stem]) {
    const eligibility = Object.freeze({ ...next.eligibilityByDeck[deck.id], [stem]: true });
    next = Object.freeze({ ...next, eligibilityByDeck: Object.freeze({ ...next.eligibilityByDeck, [deck.id]: eligibility }) });
  }
  if (!next.automaticHandoffEnabled) return next;
  const pair = getStemHandoffPair(participation);
  if (!pair || !pair.includes(deck.id)) return next;
  const other = decks.find(candidate => candidate.id === pair.find(id => id !== deck.id));
  const relationships = { ...next.relationshipsByStem };
  let established = false;
  for (const category of stem === undefined ? stemCategories : [stem]) {
    if (relationships[category]) continue;
    const otherGain = calculateEffectiveStemGain(other.volume, other.stems.allocatedLevels[category]);
    const previousGain = calculateEffectiveStemGain(deck.volume, deck.stems.allocatedLevels[category]);
    const proposedGain = calculateEffectiveStemGain(nextVolume, nextStems.allocatedLevels[category]);
    if (proposedGain === previousGain) continue;
    const previousTotal = previousGain + otherGain;
    const alreadyComplementary = Math.abs(previousTotal - 1) <= 1e-12;
    const upwardCrossing = previousTotal < 1 && proposedGain > previousGain && proposedGain + otherGain >= 1;
    if (alreadyComplementary || upwardCrossing) {
      relationships[category] = Object.freeze({ deckIds: Object.freeze([...pair]), established: true });
      established = true;
    }
  }
  return established ? Object.freeze({ ...next, relationshipsByStem: Object.freeze(relationships) }) : next;
}

// A control coefficient, not measured loudness, clipping protection or authorization.
function calculateEffectiveStemGain(deckVolume, allocatedStemLevel) {
  requireUnitGain(deckVolume);
  requireUnitGain(allocatedStemLevel);
  return deckVolume * allocatedStemLevel;
}

// Pure high-water update for an already-qualified gesture. The action layer owns eligibility.
// A deck-wide gesture passes null for stem; an individual gesture passes one category.
function calculateStemAuthorization(authorization, deckVolume, allocatedLevels, stem = null) {
  requireUnitGain(deckVolume);
  if (stem !== null && !stemCategories.includes(stem)) throw new RangeError('Unknown authorization stem.');
  const ceilings = authorization.ceilingsByStem;
  for (const category of stemCategories) {
    if (ceilings[category] !== null) requireUnitGain(ceilings[category]);
  }
  const next = { ...ceilings };
  let changed = false;
  for (const category of stem === null ? stemCategories : [stem]) {
    const effectiveGain = calculateEffectiveStemGain(deckVolume, allocatedLevels[category]);
    const previous = ceilings[category];
    if (effectiveGain > 0 && (previous === null || effectiveGain > previous)) {
      next[category] = effectiveGain;
      changed = true;
    }
  }
  return changed ? Object.freeze({ ceilingsByStem: Object.freeze(next) }) : authorization;
}

function getStemControlId(deckId, stem) {
  requireStemDeckId(deckId);
  if (!stemCategories.includes(stem)) throw new RangeError('Unknown stem category.');
  return 'deck.' + deckId + '.stem.' + stem + '.level';
}

function getDeckVolumeControlId(deckId) {
  requireStemDeckId(deckId);
  return 'deck.' + deckId + '.volume';
}

// One path for future graphical/keyboard/MIDI adapters. Input adapters supply gesture IDs;
// only value-changing direct actions on currently participating decks update authorization.
function createStemActions(applicationState) {
  function findDeck(deckId) {
    requireStemDeckId(deckId);
    const deck = applicationState.decks.find(candidate => candidate.id === deckId);
    if (!deck) throw new RangeError('Deck is missing from application state.');
    return deck;
  }
  function dispatch(action) {
    if (!action || action.type !== 'stemControl.set' || action.origin !== 'direct' ||
        typeof action.gestureId !== 'string' || action.gestureId.trim() === '') {
      throw new TypeError('Expected a direct stemControl.set action with a nonempty gestureId.');
    }
    const match = typeof action.controlId === 'string' && action.controlId.match(
      /^deck\.([1-4])\.(volume|stem\.(transients|flow|tune|voice)\.level)$/);
    if (!match) throw new RangeError('Unknown stem/volume control ID.');
    requireUnitGain(action.value);
    const stem = match[3];
    if (stem && Math.abs(action.value * 100 - Math.round(action.value * 100)) > 1e-8) {
      throw new RangeError('Direct stem levels must use 0.01 increments.');
    }
    const deck = findDeck(Number(match[1]));
    // Prepare and validate every next record before mutating application state.
    let nextStems = deck.stems;
    const nextVolume = stem ? deck.volume : action.value;
    const changed = stem
      ? deck.stems.requestedLevels[stem] !== action.value || deck.stems.allocatedLevels[stem] !== action.value
      : deck.volume !== action.value;
    if (stem) {
      // Preserve the human target. Any automatic proposal is prepared separately below.
      nextStems = Object.freeze({
        requestedLevels: Object.freeze({ ...deck.stems.requestedLevels, [stem]: action.value }),
        allocatedLevels: Object.freeze({ ...deck.stems.allocatedLevels, [stem]: action.value })
      });
    }
    const participating = applicationState.participation.byDeck[deck.id].stemHandoff === true;
    const authorization = changed && participating && applicationState.stemSession.automaticHandoffEnabled
      ? calculateStemAuthorization(applicationState.stemSession.authorization, nextVolume,
        nextStems.allocatedLevels, stem || null)
      : applicationState.stemSession.authorization;
    const lastChange = Object.freeze({ origin: 'direct', controlId: action.controlId,
      gestureId: action.gestureId, value: action.value });
    let nextSession = calculateGestureHandoffState(
      Object.freeze({ ...applicationState.stemSession, authorization, lastChange }),
      { participation: applicationState.participation, decks: applicationState.decks, deck,
        nextVolume, nextStems, changed, stem });
    let automaticDeck = null;
    let automaticStems = null;
    const pair = getStemHandoffPair(applicationState.participation);
    const handoffByStem = {};
    const rejectionsByStem = {};
    if (applicationState.stemSession.automaticHandoffEnabled && participating && pair) {
      automaticDeck = findDeck(pair.find(id => id !== deck.id));
      const automaticLevels = { ...automaticDeck.stems.allocatedLevels };
      const relationships = { ...nextSession.relationshipsByStem };
      for (const category of stem ? [stem] : stemCategories) {
        const previousGain = calculateEffectiveStemGain(deck.volume, deck.stems.allocatedLevels[category]);
        const nextGain = calculateEffectiveStemGain(nextVolume, nextStems.allocatedLevels[category]);
        if (previousGain === nextGain) continue;
        const calculatorInput = {
          decks: applicationState.decks.map(candidate => ({
            id: candidate.id, volume: candidate.volume,
            allocatedLevel: candidate.stems.allocatedLevels[category],
            participating: applicationState.participation.byDeck[candidate.id].stemHandoff,
            returnEligible: nextSession.eligibilityByDeck[candidate.id][category]
          })),
          directDeckId: deck.id, directStemLevel: nextStems.allocatedLevels[category],
          directVolume: nextVolume,
          authorizationCeiling: authorization.ceilingsByStem[category],
          relationshipEstablished: nextSession.relationshipsByStem[category] !== null,
          trigger: 'directGesture'
        };
        // All categories finish before commit. An exception rolls back the entire gesture.
        const result = calculateTwoDeckStemHandoff(calculatorInput);
        const acceptance = assessStemHandoffProposal(calculatorInput, result);
        if (!acceptance.accepted) {
          rejectionsByStem[category] = acceptance.reason;
          continue; // Existing direct-only fallback; never apply a rejected receiver proposal.
        }
        automaticLevels[category] = result.allocationsByDeck[automaticDeck.id];
        handoffByStem[category] = result;
        if (result.relationshipEstablished && !relationships[category]) {
          relationships[category] = Object.freeze({ deckIds: Object.freeze([...pair]), established: true });
        }
      }
      if (stemCategories.some(category => automaticLevels[category] !== automaticDeck.stems.allocatedLevels[category])) {
        automaticStems = Object.freeze({ requestedLevels: automaticDeck.stems.requestedLevels,
          allocatedLevels: Object.freeze(automaticLevels) });
      }
      const details = stem
        ? { ...(handoffByStem[stem] ? { handoff: handoffByStem[stem] } : {}),
            ...(rejectionsByStem[stem] ? { handoffRejection: rejectionsByStem[stem] } : {}) }
        : { ...(Object.keys(handoffByStem).length ? { handoffByStem: Object.freeze(handoffByStem) } : {}),
            ...(Object.keys(rejectionsByStem).length ? { handoffRejectionsByStem: Object.freeze(rejectionsByStem) } : {}) };
      nextSession = Object.freeze({ ...nextSession, relationshipsByStem: Object.freeze(relationships),
        lastChange: Object.freeze({ ...lastChange, ...details }) });
    }
    // Synchronous commit after all validation/calculation. Automatic allocation never passes
    // through dispatch, so it cannot alter requested intent, eligibility or authorization.
    deck.stems = nextStems;
    deck.volume = nextVolume;
    if (automaticStems) automaticDeck.stems = automaticStems;
    // A no-op records direct intent, but cannot grant authorization.
    applicationState.stemSession = nextSession;
    return changed;
  }
  function setDeckVolume(deckId, value, gestureId) {
    return dispatch({ type: 'stemControl.set', controlId: getDeckVolumeControlId(deckId),
      value, origin: 'direct', gestureId });
  }
  function setStemLevel(deckId, stem, value, gestureId) {
    return dispatch({ type: 'stemControl.set', controlId: getStemControlId(deckId, stem),
      value, origin: 'direct', gestureId });
  }
  function getEffectiveGain(deckId, stem) {
    getStemControlId(deckId, stem);
    const deck = findDeck(deckId);
    return calculateEffectiveStemGain(deck.volume, deck.stems.allocatedLevels[stem]);
  }
  return Object.freeze({ dispatch, setDeckVolume, setStemLevel, getEffectiveGain,
    stemControlId: getStemControlId, volumeControlId: getDeckVolumeControlId });
}


// A global permission gate, independent of participation and retained sharing latches.
function createAutomaticStemHandoffActions(applicationState) {
  const controlId = 'global.stemHandoff.enabled';
  function get() { return applicationState.stemSession.automaticHandoffEnabled; }
  function set(value) {
    if (typeof value !== 'boolean') throw new TypeError('Automatic stem handoff permission must be Boolean.');
    if (get() === value) return false;
    applicationState.stemSession = Object.freeze({ ...applicationState.stemSession, automaticHandoffEnabled: value });
    return true;
  }
  function toggle() { return set(!get()); }
  function dispatch(action) {
    if (!action || action.controlId !== controlId || !['stemHandoff.set', 'stemHandoff.toggle'].includes(action.type)) {
      throw new TypeError('Unknown global stem handoff action/control.');
    }
    return action.type === 'stemHandoff.set' ? set(action.value) : toggle();
  }
  return Object.freeze({ get, set, toggle, dispatch, controlId });
}

// Contract/constraint validation only. This does not invent convergence or reject deficits.
function assessStemHandoffProposal(input, result) {
  const reject = reason => Object.freeze({ accepted: false, reason });
  const validGain = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-12;
  if (!result || !result.allocationsByDeck || !result.effectiveGainsByDeck || result.targetGain !== 1 ||
      typeof result.relationshipEstablished !== 'boolean') return reject('Invalid result structure.');
  if (!validGain(result.deficit) || !validGain(result.excess)) return reject('Invalid residual range.');
  const ids = input.decks.map(deck => String(deck.id));
  for (const map of [result.allocationsByDeck, result.effectiveGainsByDeck]) {
    const keys = Reflect.ownKeys(map);
    if (keys.length !== ids.length || keys.some(key => !ids.includes(key))) return reject('Invalid result deck IDs.');
  }
  let total = 0;
  for (const deck of input.decks) {
    const level = result.allocationsByDeck[deck.id], gain = result.effectiveGainsByDeck[deck.id];
    if (!validGain(level) || !validGain(gain) || !near(gain, (deck.id === input.directDeckId && input.directVolume !== undefined ? input.directVolume : deck.volume) * level)) return reject('Invalid allocation/effective gain.');
    if (deck.id === input.directDeckId) {
      if (level !== input.directStemLevel) return reject('Direct human target was changed.');
    } else if (!deck.participating) {
      if (level !== deck.allocatedLevel) return reject('Unrelated deck was changed.');
    } else {
      const previous = deck.volume * deck.allocatedLevel;
      const capacity = deck.returnEligible && input.authorizationCeiling !== null ? Math.min(deck.volume, input.authorizationCeiling) : 0;
      if (gain > Math.max(previous, capacity) + 1e-12) return reject('Automatic increase exceeds eligibility/authorization/physical capacity.');
      if (deck.volume === 0 && level !== deck.allocatedLevel) return reject('Muted receiver fader was changed.');
    }
    if (deck.participating) total += gain;
  }
  const direct = input.decks.find(deck => deck.id === input.directDeckId);
  const other = input.decks.find(deck => deck.participating && deck.id !== input.directDeckId);
  const oldDirect = direct.volume * direct.allocatedLevel, otherGain = other.volume * other.allocatedLevel;
  const directGain = (input.directVolume === undefined ? direct.volume : input.directVolume) * input.directStemLevel;
  const expectedSharing = input.relationshipEstablished || (oldDirect + otherGain < 1 &&
    directGain > oldDirect && directGain + otherGain >= 1);
  if (result.relationshipEstablished !== expectedSharing) return reject('Sharing lifecycle mismatch.');
  const otherResultGain = result.effectiveGainsByDeck[other.id];
  const capacity = Math.max(otherGain, other.returnEligible && input.authorizationCeiling !== null
    ? Math.min(other.volume, input.authorizationCeiling) : 0);
  if (!expectedSharing && result.allocationsByDeck[other.id] !== other.allocatedLevel) return reject('Inactive sharing changed the receiver.');
  if (expectedSharing && (total > 1 + 1e-12 || (total < 1 - 1e-12 && otherResultGain < capacity - 1e-12))) {
    return reject('Established complement has an avoidable deficit or excess.');
  }

  const expectedStatus = !expectedSharing ? 'inactive' : Math.abs(total - 1) <= 1e-12 ? 'balanced' : 'constrained';
  if (result.status !== expectedStatus || !near(result.combinedGain, total) ||
      !near(result.deficit, Math.max(0, 1 - total)) || !near(result.excess, Math.max(0, total - 1))) {
    return reject('Inconsistent result totals/status.');
  }
  return Object.freeze({ accepted: true, reason: null });
}
