// Source ownership only; existing complete-song backends and stem DSP/math are unchanged.
function createStemSourceRouter(complete, mixer, nativeActions = null) {
  const deckIds = mixer.deckIds || [1, 2];
  const modes = Object.fromEntries(deckIds.map(id => [id, 'complete']));
  const pending = Object.fromEntries(deckIds.map(id => [id, 0]));
  const isStem = id => modes[id] === 'stems';
  function track(id, operation) {
    if (!deckIds.includes(id)) return operation();
    pending[id]++;
    try { return Promise.resolve(operation()).finally(() => { pending[id]--; }); }
    catch (error) { pending[id]--; throw error; }
  }
  function unavailable(state) {
    return state.loaded || state.loading || state.isPlaying || state.closureBlocked || state.releasePending;
  }
  function canSwitch(id) {
    return deckIds.includes(id) && pending[id] === 0 &&
      !unavailable(complete.getState(id)) && !unavailable(mixer.getDeck(id).getState());
  }
  const router = {};
  for (const operation of ['play', 'pause', 'stop', 'eject']) {
    router[operation] = (id, ...args) => track(id, () => isStem(id)
      ? (operation === 'play' && nativeActions ? nativeActions.play(id) : mixer.getDeck(id)[operation](...args)) : complete[operation](id, ...args));
  }
  router.loadFile = (id, file) => {
    if (isStem(id)) throw new Error('Select four mapped stem files and use Load selected stems.');
    return track(id, () => complete.loadFile(id, file));
  };
  router.loadStems = (id, files) => {
    if (!isStem(id)) throw new Error('Select four-stem source mode first.');
    return track(id, () => mixer.getDeck(id).loadFiles(files));
  };
  router.getState = id => isStem(id) ? mixer.getDeck(id).getState() : complete.getState(id);
  router.setTempo = (id, ...args) => !isStem(id) && complete.setTempo(id, ...args);
  router.getSourceMode = id => modes[id] || 'complete';
  router.canSwitchSource = canSwitch;
  router.setSourceMode = (id, mode) => {
    if (!['complete', 'stems'].includes(mode) || !canSwitch(id)) return false;
    modes[id] = mode; return true;
  };
  // Existing Deck 1 experiment selector/diagnostics retain their API.
  for (const method of ['getMode', 'isPitchPreserving', 'setComparisonLevel', 'setPitchPreserving']) {
    router[method] = (...args) => complete[method](...args);
  }
  router.setMode = mode => !isStem(1) && pending[1] === 0 && complete.setMode(mode);
  return Object.freeze(router);
}
