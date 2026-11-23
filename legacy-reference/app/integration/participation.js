// Shared domain state only: no DOM, audio, matching algorithm, or storage side effects.
function createParticipationState() {
  const byDeck = {};
  for (let deckId = 1; deckId <= 4; deckId++) {
    byDeck[deckId] = Object.freeze({ beatmatching: true, tuneMatching: true, stemHandoff: true });
  }
  return Object.freeze({ schemaVersion: 1, byDeck: Object.freeze(byDeck) });
}

// Initialization metadata only; participation values remain solely in applicationState.participation.
// A second action adapter for the same application cannot reopen initialization.
const participationInitializationClosed = new WeakSet();

// Pure boundary for decoded JSON defaults. Never coerce values or partially apply a record.
function validateParticipationDefaults(input) {
  function requireFields(record, fields, path) {
    if (record === null || typeof record !== 'object' || Array.isArray(record) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(record))) {
      throw new TypeError(path + ' must be a plain record.');
    }
    const keys = Reflect.ownKeys(record);
    if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) {
      throw new TypeError(path + ' must contain exactly: ' + fields.join(', ') + '.');
    }
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(record, field);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new TypeError(path + '.' + field + ' must be an ordinary JSON field.');
      }
    }
  }
  try {
    requireFields(input, ['schemaVersion', 'participationByDeck'], 'defaults');
    if (input.schemaVersion !== 1) throw new TypeError('Unsupported participation defaults schema version.');
    const deckIds = ['1', '2', '3', '4'];
    const capabilities = ['beatmatching', 'tuneMatching', 'stemHandoff'];
    requireFields(input.participationByDeck, deckIds, 'defaults.participationByDeck');
    const participationByDeck = {};
    for (const deckId of deckIds) {
      const record = input.participationByDeck[deckId];
      const path = 'defaults.participationByDeck.' + deckId;
      requireFields(record, capabilities, path);
      for (const capability of capabilities) {
        if (typeof record[capability] !== 'boolean') {
          throw new TypeError(path + '.' + capability + ' must be a Boolean.');
        }
      }
      participationByDeck[deckId] = Object.freeze({ ...record });
    }
    const defaults = Object.freeze({ schemaVersion: 1,
      participationByDeck: Object.freeze(participationByDeck) });
    return Object.freeze({ valid: true, defaults, error: null });
  } catch (error) {
    return Object.freeze({ valid: false, defaults: null, error: String(error.message || error) });
  }
}

// These identifiers describe behavior, never a screen position or input device.
function getParticipationControlId(deckId, capability) {
  if (!Number.isInteger(deckId) || deckId < 1 || deckId > 4) {
    throw new RangeError('Participation deckId must be an integer from 1 to 4.');
  }
  if (!['beatmatching', 'tuneMatching', 'stemHandoff'].includes(capability)) {
    throw new RangeError('Unknown participation capability: ' + capability);
  }
  return 'deck.' + deckId + '.participation.' + capability;
}

// Pure transition. Frozen snapshots can be inspected/serialized without accidental mutation.
function reduceParticipation(state, action) {
  if (!state || state.schemaVersion !== 1) throw new TypeError('Unsupported participation schema version.');
  if (!action || !['participation.set', 'participation.toggle'].includes(action.type)) {
    throw new TypeError('Expected a participation.set or participation.toggle action.');
  }
  const match = typeof action.controlId === 'string' && action.controlId.match(
    /^deck\.([1-4])\.participation\.(beatmatching|tuneMatching|stemHandoff)$/);
  if (!match) throw new RangeError('Unknown participation control ID.');
  if (action.type === 'participation.set' && typeof action.value !== 'boolean') {
    throw new TypeError('Participation value must be a Boolean.');
  }
  const deckId = Number(match[1]);
  const capability = match[2];
  const current = state.byDeck[deckId];
  const value = action.type === 'participation.toggle' ? !current[capability] : action.value;
  if (current[capability] === value) return state;
  const nextDeck = Object.freeze({ ...current, [capability]: value });
  const byDeck = Object.freeze({ ...state.byDeck, [deckId]: nextDeck });
  return Object.freeze({ schemaVersion: state.schemaVersion, byDeck });
}

// One application-owned snapshot; actions never keep a second copy of participation.
function createParticipationActions(applicationState) {
  function initialize(defaultsInput) {
    if (participationInitializationClosed.has(applicationState)) {
      return Object.freeze({ initialized: false, source: null,
        error: 'Participation initialization is closed; session settings were preserved.' });
    }
    const validation = defaultsInput === undefined ? null : validateParticipationDefaults(defaultsInput);
    let next = createParticipationState();
    if (validation && validation.valid) {
      const byDeck = {};
      for (let deckId = 1; deckId <= 4; deckId++) {
        byDeck[deckId] = Object.freeze({ ...validation.defaults.participationByDeck[deckId] });
      }
      next = Object.freeze({ schemaVersion: 1, byDeck: Object.freeze(byDeck) });
    }
    const nextStemSession = applicationState.stemSession
      ? reconcileHandoffRelationships(applicationState.stemSession, next) : null;
    applicationState.participation = next;
    if (nextStemSession) applicationState.stemSession = nextStemSession;
    participationInitializationClosed.add(applicationState);
    return Object.freeze({ initialized: true, source: validation?.valid ? 'provided' : 'factory',
      error: validation && !validation.valid ? validation.error : null });
  }
  function dispatch(action) {
    const current = applicationState.participation;
    const next = reduceParticipation(current, action);
    const nextStemSession = applicationState.stemSession
      ? reconcileHandoffRelationships(applicationState.stemSession, next) : null;
    applicationState.participation = next;
    if (nextStemSession) applicationState.stemSession = nextStemSession;
    // Even a valid no-op session action closes initialization before delayed defaults can arrive.
    participationInitializationClosed.add(applicationState);
    return next !== current; // false means the requested setting was already applied.
  }
  function get(deckId, capability) {
    getParticipationControlId(deckId, capability); // Validate both arguments consistently.
    return applicationState.participation.byDeck[deckId][capability];
  }
  function set(deckId, capability, value) {
    return dispatch({ type: 'participation.set', controlId: getParticipationControlId(deckId, capability), value });
  }
  function toggle(deckId, capability) {
    return dispatch({ type: 'participation.toggle', controlId: getParticipationControlId(deckId, capability) });
  }
  return Object.freeze({ get, set, toggle, dispatch, initialize, controlId: getParticipationControlId });
}
