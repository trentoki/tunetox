// Pure preview sampler state. Attenuation is global per parent stem, NOT allocation.
(() => {
  const design = globalThis.TuneToxDesign;
  function createState() {
    return { open: false, deckId: 1, stemIndex: 0, attenuation: [1, 1, 1, 1], outputVolume: .7,
      session: null, lastPad: null,
      kits: [1, 2, 3, 4].map(() => ({ songLocked: false, songId: null,
        stems: [0, 1, 2, 3].map(() => ({ locked: false, songId: null, pads: [] })) })) };
  }
  function validSource(state, deckId, stemIndex) {
    return state.decks.some(deck => deck.id === deckId) && Number.isInteger(stemIndex) && stemIndex >= 0 && stemIndex < 4;
  }
  function restoreSession(sampler) {
    if (sampler.session) sampler.attenuation[sampler.session.stemIndex] = sampler.session.entry;
    sampler.session = null;
  }
  function open(state, deckId, stemIndex) {
    if (!validSource(state, deckId, stemIndex)) return false;
    const sampler = state.sampler;
    if (!sampler.open || sampler.stemIndex !== stemIndex) {
      restoreSession(sampler);
      sampler.session = { stemIndex, entry: sampler.attenuation[stemIndex] };
    }
    sampler.deckId = deckId; sampler.stemIndex = stemIndex; sampler.open = true; sampler.lastPad = null;
    return true;
  }
  function close(state) { restoreSession(state.sampler); state.sampler.open = false; }
  function setLevel(state, key, value) {
    if (!Number.isFinite(value) || value < 0 || value > 1 || !state.sampler.open) return false;
    if (key === 'attenuation') state.sampler.attenuation[state.sampler.stemIndex] = value;
    else if (key === 'outputVolume') state.sampler.outputVolume = value;
    else return false;
    return true;
  }
  function trigger(state, pad) {
    if (!state.sampler.open || !Number.isInteger(pad) || pad < 0 || pad >= 25) return false;
    state.sampler.lastPad = pad; return true;
  }
  // Placeholder kit identity follows loads unless the corresponding lock is set.
  // Locks are state-only; no new locking gestures or assignment editor are introduced.
  function syncKits(state) {
    state.decks.forEach((deck, index) => {
      const kit = state.sampler.kits[index];
      if (!kit.songLocked) kit.songId = deck.songId;
      kit.stems.forEach((stem, stemIndex) => {
        if (!kit.songLocked && !stem.locked && (stem.songId !== deck.songId || !stem.pads.length)) {
          stem.songId = deck.songId;
          stem.pads = Array.from({ length: 25 }, (_, pad) => ({ id: pad, label: 'Sample ' + String(pad + 1).padStart(2, '0'),
            sourceSongId: deck.songId, stemIndex }));
        }
      });
    });
  }
  design.samplerModel = { createState, open, close, setLevel, trigger, syncKits };
})();
