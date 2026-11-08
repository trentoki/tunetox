// Executes the real controls against a small DOM stub; no browser activation is fabricated.
async function runSignalsmithSelectionTests(controlsSource) {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pump = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  function element() {
    return { value: '', files: [], listeners: {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
      fire(name) { return this.listeners[name](); }, setAttribute() {} };
  }
  const sections = [];
  function section() {
    const elements = new Map();
    return { querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    }, setAttribute() {} };
  }
  const template = { content: { firstElementChild: { cloneNode: section } } };
  const document = { getElementById: id => id === 'audio-deck-template' ? template :
    { appendChild(item) { sections.push(item); } } };
  let mode = 'signalsmith';
  let inClick = false;
  const calls = [];
  const states = [1, 2, 3, 4].map(() => ({ loaded: false, loading: false, isPlaying: false,
    position: 0, duration: 0, comparisonLevel: 0.25, outputPeak: 0, outputRms: 0 }));
  const engine = {
    getMode: () => mode, isPitchPreserving: () => mode !== 'normal',
    setMode(next) { mode = next; return true; },
    getState: id => states[id - 1],
    loadFile(id, file) {
      const state = states[id - 1]; state.loading = true;
      return new Promise((resolve, reject) => calls.push({ id, file, inClick,
        resolve() { state.loading = false; state.loaded = true; resolve(true); },
        reject() { state.loading = false; reject(new Error('controlled failure')); } }));
    },
    eject(id) { Object.assign(states[id - 1], { loaded: false, loading: false }); }
  };
  const run = new Function('createMainStemIntegration', 'document', 'createDeckOneExperimentRouter', 'createAudioEngine',
    'createPitchPreservingPlayer', 'createSignalsmithPlayer', 'setInterval', 'console', controlsSource);
  let refresh;
  run(undefined, document, () => engine, () => ({}), () => ({}), () => ({}), callback => { refresh = callback; }, { error() {} });
  const first = sections[0];
  const picker = first.querySelector('input[type="file"]');
  const load = first.querySelector('[data-action="load-selected"]');
  const eject = first.querySelector('[data-action="eject"]');
  const status = first.querySelector('[data-display="status"]');
  const file = { name: 'diagnostic.aiff' };
  picker.files = [file]; picker.fire('change');
  check(calls.length === 0 && status.textContent.includes('Selected:'), 'Selection must not start audio initialization');
  check(!load.hidden && !load.disabled && !eject.disabled, 'Signalsmith selection must enable Load and cancellation');
  states[0].closureBlocked = true;
  states[0].closureStatus = 'Signalsmith context is still closing';
  states[1].loaded = true;
  refresh();
  check(load.disabled && first.querySelector('[data-action="play"]').disabled,
    'Signalsmith Load/Play must be unavailable during closure');
  check(!sections[1].querySelector('[data-action="play"]').disabled, 'Other decks must remain usable');
  load.fire('click');
  check(calls.length === 0, 'Pending closure must not queue a load from the controls');
  states[0].closureBlocked = false; states[1].loaded = false; refresh();
  check(!load.disabled && calls.length === 0, 'Closure completion must require a fresh click');
  inClick = true; load.fire('click'); inClick = false;
  check(calls.length === 1 && calls[0].inClick, 'Actual controls must invoke loader in the synchronous click stack');
  check(load.disabled, 'Duplicate load clicks must be disabled while pending');
  calls[0].reject(); await pump();
  check(!load.disabled, 'Failed load must allow explicit retry of the retained selection');
  inClick = true; load.fire('click'); inClick = false;
  check(calls.length === 2 && calls[1].file === file, 'Retry must use the selected file');
  calls[1].resolve(); await pump();
  check(load.disabled && status.textContent.includes('Loaded:'), 'Successful load must clear the pending selection');
  await eject.fire('click');
  picker.files = [file]; picker.fire('change');
  await eject.fire('click');
  check(load.disabled, 'Eject before loading must discard pending selection');
  picker.files = [file]; picker.fire('change'); load.fire('click');
  await eject.fire('click'); calls[2].resolve(); await pump();
  check(status.textContent === 'No audio file loaded.', 'Late completion must not overwrite Eject status');
  states[0].loaded = false;
  picker.files = [file]; picker.fire('change');
  const selector = first.querySelector('[data-input="playback-mode"]');
  selector.value = 'normal'; selector.fire('change');
  check(load.hidden && load.disabled, 'Leaving Signalsmith must clear and hide the pending load');
  for (const nextMode of ['normal', 'soundtouch']) {
    mode = nextMode;
    const before = calls.length;
    picker.files = [file]; picker.fire('change');
    check(calls.length === before + 1, nextMode + ' selection must retain immediate loading');
    calls[calls.length - 1].resolve(); await pump();
  }
  mode = 'signalsmith';
  for (let index = 1; index < 4; index++) {
    const input = sections[index].querySelector('input[type="file"]');
    const button = sections[index].querySelector('[data-action="load-selected"]');
    const before = calls.length;
    input.files = [file]; input.fire('change');
    check(calls.length === before + 1 && calls[calls.length - 1].id === index + 1,
      'Other decks must retain immediate file loading');
    check(button.hidden, 'Other decks must never show diagnostic Load');
    calls[calls.length - 1].resolve(); await pump();
  }
  console.log('Signalsmith selection/click sequence, retry, cancellation, and other-deck controls tests passed');
}
