// Domain state/actions only. Individual-stem two-deck handoff uses the pure calculator; no audio, storage or UI.
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
    const authorization = changed && participating
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
    const effectiveGainChanged = stem && calculateEffectiveStemGain(deck.volume, deck.stems.allocatedLevels[stem]) !==
      calculateEffectiveStemGain(nextVolume, nextStems.allocatedLevels[stem]);
    if (stem && participating && pair && effectiveGainChanged) {
      const result = calculateTwoDeckStemHandoff({
        decks: applicationState.decks.map(candidate => ({
          id: candidate.id, volume: candidate.volume,
          allocatedLevel: candidate.stems.allocatedLevels[stem],
          participating: applicationState.participation.byDeck[candidate.id].stemHandoff,
          returnEligible: nextSession.eligibilityByDeck[candidate.id][stem]
        })),
        directDeckId: deck.id, directStemLevel: action.value,
        authorizationCeiling: authorization.ceilingsByStem[stem],
        relationshipEstablished: nextSession.relationshipsByStem[stem] !== null,
        trigger: 'directGesture'
      });
      automaticDeck = findDeck(pair.find(id => id !== deck.id));
      const automaticLevel = result.allocationsByDeck[automaticDeck.id];
      if (automaticLevel !== automaticDeck.stems.allocatedLevels[stem]) {
        automaticStems = Object.freeze({
          requestedLevels: automaticDeck.stems.requestedLevels,
          allocatedLevels: Object.freeze({ ...automaticDeck.stems.allocatedLevels, [stem]: automaticLevel })
        });
      }
      const relationships = { ...nextSession.relationshipsByStem };
      if (result.relationshipEstablished && !relationships[stem]) {
        relationships[stem] = Object.freeze({ deckIds: Object.freeze([...pair]), established: true });
      }
      nextSession = Object.freeze({ ...nextSession, relationshipsByStem: Object.freeze(relationships),
        lastChange: Object.freeze({ ...lastChange, handoff: result }) });
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
