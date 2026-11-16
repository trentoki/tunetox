async function runNavigationChecks(frame, check) {
  const win = frame.contentWindow, doc = win.document;
  const snapshot = () => win.TuneToxDesign.preview.getSnapshot();
  const wait = () => new Promise(resolve => setTimeout(resolve, 100));
  const tab = name => doc.querySelector('.phone-tab[data-tab="' + name + '"]').click();
  const card = id => doc.querySelector('.design-deck[data-deck="' + id + '"]');
  for (const [width,height] of [[390,844],[375,667],[430,932],[320,568]]) {
    frame.width = width; frame.height = height; await wait(); win.TuneToxDesign.viewport.refresh(); doc.querySelector('#reset-demo').click();
    check(doc.querySelectorAll('.phone-tab').length === 4 && !doc.querySelector('.phone-mode'), 'four tabs replace primary phone modes ' + width);
    const top = n => n.getBoundingClientRect().top;
    check(top(doc.querySelector('.slice-header-tuning')) < top(doc.querySelector('.phone-deck-selectors')) && top(doc.querySelector('.phone-deck-selectors')) < top(doc.querySelector('.phone-tabs')), 'phone slider/selector/tab ordering ' + width);
    const wave = card(1).querySelector('.waveform-matching');
    check(wave.getBoundingClientRect().height > 0 && [...wave.querySelectorAll('button')].map(n => n.textContent).join('/') === 'Beat Match/Tune Match/Handoff', 'clearly labeled Waveform matching ' + width);
    const before = snapshot().decks[0];
    card(1).querySelector('.waveform-jog').click();
    check(snapshot().decks[0].waveformPreview.nudge === -1 && snapshot().decks[0].position === before.position, 'nudge changes preview only ' + width);
    const center = card(1).querySelector('.waveform-navigate'), bounds = center.getBoundingClientRect();
    center.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: 930, button: 0, clientY: bounds.top + bounds.height / 4 }));
    center.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 930, clientY: bounds.top + bounds.height * .75 }));
    center.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, pointerId: 930 }));
    check(snapshot().decks[0].waveformPreview.navigation === before.waveformPreview.navigation && snapshot().decks[0].position === before.position && snapshot().decks[0].tempo === before.tempo, 'stationary playhead ignores drag and preserves transport/matching ' + width);
    wave.querySelector('[data-control="beatMatch"]').click(); wave.querySelector('[data-control="tuneMatch"]').click();
    tab('controls');
    check(wave.getBoundingClientRect().height === 0 && win.getComputedStyle(card(1).querySelector('.stem-controls')).display === 'none', 'phone Controls has no matching or stems ' + width);
    check(snapshot().decks[0].beatMatch && snapshot().decks[0].tuneMatch, 'matching flags survive tab switch ' + width);
    const overlay = card(1).querySelector('.slice-controls-overlay');
    if (height >= 667) check(overlay.scrollHeight <= overlay.clientHeight + 1, 'comfortable phone Controls fits without scroll ' + width);
    check(card(1).querySelector('.performance-eq .knob-dial').getBoundingClientRect().width >= 44, 'phone knobs remain touch size ' + width);
    doc.querySelector('.transition-controls-option').click();
    check(snapshot().phone.pair[0] === snapshot().phone.selectedDeckId && [...doc.querySelectorAll('.transition-partner')].filter(n => !n.hidden).length === 3, 'Transition anchors selected deck plus other ' + width);
    check([...doc.querySelectorAll('.transition-card')].every(n => !n.querySelector('.stem-controls')), 'no stems in Transition');
    doc.querySelector('.transition-partner[data-deck="4"]').click();
    check(snapshot().phone.pair.join(',') === '1,4', 'other Transition deck selectable');
    doc.querySelector('.normal-controls-option').click(); check(snapshot().phone.mode === 'decks', 'Transition returns inside Controls');
    tab('library'); const library = card(1).querySelector('.column-library'), search = library.querySelector('.column-search');
    search.value = 'Glass'; search.dispatchEvent(new win.Event('input')); const savedSearch = snapshot().columnLibraries[0].songQuery;
    tab('sampler');
    const attenuation = doc.querySelector('#sampler-attenuation'); attenuation.value = '.4'; attenuation.dispatchEvent(new win.Event('input'));
    doc.querySelector('.phone-deck-select[data-deck="2"]').click();
    check(snapshot().phone.selectedDeckId === 2 && snapshot().sampler.deckId === 2 && snapshot().sampler.attenuation[0] === .4, 'deck selector changes shared sampler source without new session');
    const source = doc.querySelector('#sampler-source-deck'); source.value = '3'; source.dispatchEvent(new win.Event('change'));
    check(snapshot().phone.selectedDeckId === 3 && snapshot().sampler.deckId === 3, 'sampler source selector stays aligned with phone deck selector');
    check([...doc.querySelectorAll('.sampler-pad')].filter(n => !n.hidden).length === 20, 'phone shared sampler still 20 pads');
    doc.querySelector('.sampler-close').click();
    doc.querySelector('.phone-deck-select[data-deck="1"]').click();
    check(snapshot().decks[0].columnMode === 'library' && search.value === savedSearch, 'source changes preserve previous deck library context');
    tab('waveform');
    check(card(1).querySelector('.stem-controls').getBoundingClientRect().height > 0 && snapshot().decks[0].stems.join(',') === before.stems.join(','), 'Waveform restores unchanged stems');
    check(doc.documentElement.scrollWidth <= width && doc.documentElement.scrollHeight <= height, 'revised phone viewport fit');
  }
  for (const [width,height] of [[1024,768],[1194,834],[1366,1024]]) {
    frame.width = width; frame.height = height; await wait(); win.TuneToxDesign.viewport.refresh(); doc.querySelector('#reset-demo').click();
    card(1).querySelector('[data-mode="waveform"]').click();
    check(card(1).querySelector('.waveform-matching').getBoundingClientRect().height >= 36, 'iPad Waveform matching visible');
    card(1).querySelector('[data-mode="controls"]').click();
    const overlay = card(1).querySelector('.slice-controls-overlay');
    check(card(1).querySelector('.waveform-matching').getBoundingClientRect().height === 0 && card(1).querySelector('.stem-controls').getBoundingClientRect().height > 0, 'iPad Controls keeps stems but moves matching');
    check(overlay.scrollHeight <= overlay.clientHeight + 1, 'essential iPad Controls fit without vertical scrolling ' + width);
    check([...overlay.querySelectorAll('.knob-dial')].every(n => n.getBoundingClientRect().width >= 44), 'iPad knob sizes preserved');
  }
  doc.querySelector('#reset-demo').click();
}
