async function runCleanupChecks(frame, check) {
  const win = frame.contentWindow, doc = win.document;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const state = () => win.TuneToxDesign.preview.getSnapshot();
  function key(dial, value) { dial.dispatchEvent(new win.KeyboardEvent('keydown', { bubbles: true, key: value })); }
  let pointerId = 1100;
  async function doubleTap(dial) {
    for (let i = 0; i < 2; i++) {
      const id = pointerId++;
      dial.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: id, button: 0, clientX: 100, clientY: 200 }));
      dial.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, pointerId: id, clientX: 100, clientY: 200 }));
      if (!i) await pause(80);
    }
  }
  for (const [width,height] of [[320,568],[390,844],[1024,768],[1194,834]]) {
    frame.width = width; frame.height = height; await pause(100); win.TuneToxDesign.viewport.refresh(); doc.querySelector('#reset-demo').click();
    const phone = width < 600, card = doc.querySelector('.design-deck[data-deck="1"]');
    if (phone) doc.querySelector('.phone-tab[data-tab="library"]').click(); else card.querySelector('[data-mode="library"]').click();
    const library = card.querySelector('.column-library'), list = [...library.querySelectorAll('.panel-list')].find(n => n.clientHeight > 0), previousScroll = list.scrollTop;
    library.querySelector('.song-manage').click();
    const body = () => library.querySelector('.context-body');
    check(body().querySelectorAll('.manage-playlist-row').length === state().playlists.length && !body().textContent.includes('Playlist memberships') && !body().querySelector('.manage-browse-playlist'), 'one clean Manage playlist list on both devices ' + width);
    const slow = () => body().querySelector('[data-playlist-id="slow"]');
    slow().querySelector('input').click();
    check(state().playlists.find(p => p.id === 'slow').songIds.includes('neon') && !state().columnLibraries[0].context.trail, 'checkbox changes membership without navigating ' + width);
    slow().querySelector('.manage-playlist-name').click();
    check(library.querySelector('.context-source').textContent.includes('Neon Departure') && body().textContent.includes('Slow burn'), 'playlist name opens songs with original source ' + width);
    const candidate = [...body().querySelectorAll('.manage-link-candidate')].find(n => n.textContent.includes('After the Rain')); candidate.click();
    check(state().userLinks.neon.includes('after'), 'playlist browsing still creates source link ' + width);
    library.querySelector('.context-back').click();
    check(slow().querySelector('input').checked, 'Back preserves membership ' + width);
    const disclosure = body().querySelector('details'); disclosure.open = true; disclosure.dispatchEvent(new win.Event('toggle'));
    check(body().querySelector('.management-choice input').checked, 'existing links remain available ' + width);
    body().querySelector('.management-choice input').click();
    check(!state().userLinks.neon.includes('after') && body().querySelector('details').open, 'link removal preserves disclosure context ' + width);
    slow().querySelector('input').click(); check(!state().playlists.find(p => p.id === 'slow').songIds.includes('neon'), 'unchecking membership works ' + width);
    const lastName = [...body().querySelectorAll('.manage-playlist-name')].at(-1); lastName.scrollIntoView({ block: 'nearest' });
    check(win.scrollY === 0 && win.getComputedStyle(body()).overflowY === 'auto', 'management remains reachable in independent scroller ' + width);
    library.querySelector('.context-back').click(); check(list.scrollTop === previousScroll, 'Back preserves library scroll ' + width);
    if (phone) doc.querySelector('.phone-tab[data-tab="controls"]').click(); else card.querySelector('[data-mode="controls"]').click();
    for (const name of ['filter','high','mid','low']) {
      const dial = card.querySelector('.performance-knob[data-control="' + name + '"] .knob-dial'); key(dial, 'End');
      await doubleTap(dial);
      const value = name === 'filter' ? state().decks[0].performance.filter : state().decks[0].performance.eq[name];
      check(value === win.TuneToxDesign.model.getPerformanceNeutral(name), 'double tap uses model neutral for ' + name + ' ' + width);
    }
    const filter = card.querySelector('[data-control="filter"] .knob-dial'), originalNeutral = win.TuneToxDesign.model.getPerformanceNeutral;
    try {
      win.TuneToxDesign.model.getPerformanceNeutral = name => name === 'filter' ? .5 : originalNeutral(name);
      key(filter, 'End'); await doubleTap(filter); check(state().decks[0].performance.filter === .5, 'reset reads neutral instead of assuming zero ' + width);
    } finally { win.TuneToxDesign.model.getPerformanceNeutral = originalNeutral; }
    key(filter, 'Home');
    filter.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: 1201, button: 0, clientY: 200 }));
    filter.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1201, clientY: 180 }));
    filter.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, pointerId: 1201 }));
    check(state().decks[0].performance.filter === -.75, 'vertical drag is not interpreted as reset ' + width);
    const effect = card.querySelector('.performance-effects .effect-control'), dial = effect.querySelector('.knob-dial');
    key(dial, 'Home'); for (let i = 0; i < 9; i++) key(dial, 'ArrowUp');
    const nine = dial.getBoundingClientRect(); key(dial, 'ArrowUp'); const ten = dial.getBoundingClientRect(); key(dial, 'End'); const hundred = dial.getBoundingClientRect();
    if (phone) check(nine.left === ten.left && nine.left === hundred.left && nine.width === hundred.width, 'FX position stable at 9 10 100 percent ' + width);
    await doubleTap(dial); check(state().decks[0].performance.effects[0].value === originalNeutral('effectValue'), 'FX double tap resets amount ' + width);
    key(dial, 'End'); dial.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: 1202, button: 0, clientY: 200 })); await pause(620);
    dial.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, pointerId: 1202 }));
    const menu = effect.querySelector('.effect-assignment-menu');
    check(!menu.hidden && state().decks[0].performance.effects[0].value === 1, 'long press still assigns without neutral reset ' + width);
    menu.dispatchEvent(new win.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    if (phone) {
      doc.querySelector('.transition-controls-option').click(); doc.querySelector('.transition-fx-target[data-target="primary"]').click();
      const transitionDial = doc.querySelector('.transition-single-fx .knob-dial');
      key(transitionDial, 'Home'); for (let i = 0; i < 9; i++) key(transitionDial, 'ArrowUp');
      const start = transitionDial.getBoundingClientRect(); key(transitionDial, 'ArrowUp'); const finish = transitionDial.getBoundingClientRect();
      check(start.left === finish.left && start.width === finish.width, 'Transition FX readout does not shift dial ' + width);
      await doubleTap(transitionDial); check(state().decks[0].performance.effects[0].value === 0, 'Transition FX double tap shares reset behavior ' + width);
      doc.querySelector('.normal-controls-option').click();
    }
    if (phone) doc.querySelector('.phone-tab[data-tab="waveform"]').click(); else card.querySelector('[data-mode="waveform"]').click();
    const center = card.querySelector('.waveform-navigate'), cursor = card.querySelector('.waveform-preview-cursor');
    const before = JSON.stringify(state().decks[0]);
    center.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerId: 1203, button: 0, clientY: 100 })); center.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerId: 1203, clientY: 300 })); key(center, 'End');
    check(JSON.stringify(state().decks[0]) === before && cursor.style.top === '50%' && center.getAttribute('role') !== 'slider' && center.tabIndex < 0, 'playhead remains stationary and not scrubbable ' + width);
  }
  // The older fixed sidebar uses this same cleaned Manage component, not a phone-only branch.
  frame.width = 1194; frame.height = 834; await pause(100); win.TuneToxDesign.viewport.refresh(); doc.querySelector('#reset-demo').click();
  for (const [id,value] of [['preview-layout','sidebar'],['preview-arrangement','quadrants']]) { const input = doc.getElementById(id); input.value = value; input.dispatchEvent(new win.Event('change')); }
  const sidebar = doc.querySelector('.library'); sidebar.querySelector('.song-manage').click();
  check(sidebar.querySelectorAll('.manage-playlist-row').length === 4, 'iPad fixed sidebar also uses clean playlist list');
  sidebar.querySelector('.manage-playlist-name').click(); check(sidebar.querySelector('.manage-search'), 'iPad sidebar playlist names navigate');
  sidebar.querySelector('.context-back').click(); check(sidebar.querySelectorAll('.manage-playlist-row').length === 4, 'iPad sidebar Back restores Manage');
  sidebar.querySelector('.context-back').click(); doc.querySelector('#reset-demo').click();
}
