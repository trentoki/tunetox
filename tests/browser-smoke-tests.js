(() => {
  const frame = document.getElementById('application');
  const runRouting = document.getElementById('run-routing');
  const results = document.getElementById('results');
  let bootChecks = [];

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  function report(lines, className = '') {
    results.textContent = lines.join('\n');
    results.className = className;
  }

  function applicationWindow() {
    const application = frame.contentWindow;
    check(application && application.document, 'The application frame is unavailable.');
    return application;
  }

  function applicationState(application) {
    // appState is intentionally a top-level lexical binding, not a window property.
    // Evaluate in the application realm so the smoke test does not add a production API.
    return application.eval('appState');
  }

  function applicationActions(application) {
    return application.eval('appActions');
  }

  function runBootChecks() {
    const application = applicationWindow();
    const document = application.document;
    const state = applicationState(application);
    const decks = [...document.querySelectorAll('#h1-decks .h3-deck')];
    check(decks.length === 4, 'Expected four visible deck elements.');
    check(decks.map(deck => deck.dataset.deck).join(',') === '1,2,3,4', 'Deck IDs are not 1, 2, 3, 4.');
    check(state?.decks?.length === 4, 'Authoritative appState does not contain four decks.');
    check(typeof application.TuneToxLiveDiagnostics === 'function', 'Live diagnostics API was not installed.');
    check(document.getElementById('h531-files-open'), 'Audio files control did not start.');
    bootChecks = [
      'PASS — root page started',
      'PASS — four visible decks rendered',
      'PASS — authoritative four-deck state exists',
      'PASS — live diagnostics API exists'
    ];
    report([...bootChecks, '', 'Click “Run live routing checks” to exercise native action routing.'], 'pass');
    runRouting.disabled = false;
  }

  function findMatchingToggle(document, label) {
    return [...document.querySelectorAll('.h3-menu button, .h2-menu button')]
      .find(button => button.textContent.trim() === label);
  }

  function runRoutingChecks() {
    try {
      const application = applicationWindow();
      const document = application.document;
      const state = applicationState(application);
      const main = document.getElementById('h1-main-1');
      check(main, 'Deck 1 main-volume control is missing.');

      main.value = '0.25';
      main.dispatchEvent(new Event('input', { bubbles: true }));
      check(state.decks[0].volume === 0.25,
        'Deck 1 main-volume input did not reach appState.');

      const matchingButton = document.querySelector('.h3-deck[data-deck="1"] .h3-deck-id');
      check(matchingButton, 'Deck 1 matching menu control is missing.');
      matchingButton.click();
      const handoff = findMatchingToggle(document, 'Handoff');
      check(handoff, 'Deck 1 Handoff control is missing.');
      const before = state.participation.byDeck[1].stemHandoff;
      handoff.click();
      check(state.participation.byDeck[1].stemHandoff === !before,
        'Handoff control did not reach authoritative participation state.');

      // Restore only this fresh test frame; production state is never touched.
      applicationActions(application).participation.set(1, 'stemHandoff', before);
      main.value = '0';
      main.dispatchEvent(new Event('input', { bubbles: true }));
      check(state.decks[0].volume === 0,
        'Deck 1 main-volume control could not be restored in the test frame.');
      report([...bootChecks,
        'PASS — main-volume control reached authoritative appState',
        'PASS — Handoff control reached authoritative participation state',
        '',
        'Routing checks passed. This does not verify audible output.'], 'pass');
    } catch (error) {
      report([...bootChecks, 'FAIL — ' + (error.stack || error)], 'fail');
    } finally {
      runRouting.disabled = true;
    }
  }

  frame.addEventListener('load', () => {
    try { runBootChecks(); }
    catch (error) { report(['FAIL — ' + (error.stack || error)], 'fail'); }
  });
  runRouting.addEventListener('click', runRoutingChecks);
  frame.src = '../index.html';
})();
