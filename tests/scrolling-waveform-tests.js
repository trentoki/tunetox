const assert = (value, message) => { if (!value) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message) {
  for (let i = 0; i < 200; i++) { if (test()) return; await delay(25); }
  throw Error(message);
}

// Both surfaces must describe one source position. Comparing their SVG mapping
// avoids treating a 50 ms Audio notification as sample-accurate live rendering.
export function assertScrollingAligned(doc) {
  for (const deck of doc.querySelectorAll('.deck')) {
    const overview = deck.querySelector('.waveform-overview');
    const scrolling = deck.querySelector('.scrolling-waveform');
    const position = Number(overview.getAttribute('aria-valuenow'));
    const duration = Number(overview.getAttribute('aria-valuemax'));
    assert(position === Number(scrolling.getAttribute('aria-valuenow')), 'Waveforms show different positions');
    const [left, , width] = scrolling.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
    if (duration > 0) assert(Math.abs((left + width / 2) / 360 * duration - position) < .00001,
      'Scrolling center does not map to the overview position');
    if (scrolling.getClientRects().length) {
      const center = scrolling.getBoundingClientRect().left + scrolling.clientLeft + scrolling.clientWidth / 2;
      assert(Math.abs(scrolling.querySelector('.playhead').getBoundingClientRect().left - center) < 1,
        'Scrolling playhead moved from its CSS center');
    }
  }
}

export async function checkScrollingWaveforms(doc, win, players) {
  const surfaces = [...doc.querySelectorAll('.scrolling-waveform')];
  const key = (surface, value) => surface.dispatchEvent(new win.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const pointer = (surface, type, fraction, id = 1) => {
    const rect = surface.getBoundingClientRect();
    surface.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true,
      pointerId: id, pointerType: id === 2 ? 'touch' : 'mouse', isPrimary: true, button: 0,
      clientX: rect.left + rect.width * fraction }));
  };
  const restorers = surfaces.map(surface => {
    const names = ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'];
    const originals = names.map(name => surface[name]);
    let capture = false;
    surface.setPointerCapture = () => { capture = true; };
    surface.hasPointerCapture = () => capture;
    surface.releasePointerCapture = () => { capture = false; };
    return () => names.forEach((name, index) => { surface[name] = originals[index]; });
  });
  const settled = (surface, seconds) => until(() => Math.abs(Number(surface.getAttribute('aria-valuenow')) - seconds) < .01 &&
    !surface.closest('.deck').querySelector('.play-pause-button').disabled, 'Scrolling seek did not settle at ' + seconds);
  try {
    for (const [index, surface] of surfaces.entries()) {
      assert(surface.querySelectorAll('svg rect').length === 720, 'Scrolling graphic must use actual 360-column peak/RMS data');
      assert(win.getComputedStyle(surface).touchAction === 'pinch-zoom', 'Scrolling drag blocks pinch or permits page panning');
      key(surface, 'Home'); await settled(surface, 0);
      key(surface, 'ArrowRight'); await settled(surface, 5);
      key(surface, 'ArrowRight'); await settled(surface, 10);
      const others = players.filter((_, i) => i !== index).map(player => player.currentTime);
      pointer(surface, 'pointerdown', .5);
      pointer(surface, 'pointermove', .75);
      assert(players[index].currentTime === 10, 'Drag preview changed Audio before release');
      assert(Math.abs(Number(surface.getAttribute('aria-valuenow')) - 5) < .001, 'Right drag did not move backward');
      assertScrollingAligned(doc);
      pointer(surface, 'pointerup', .75); await settled(surface, 5);
      pointer(surface, 'pointerdown', .75, 2); pointer(surface, 'pointermove', .5, 2); pointer(surface, 'pointerup', .5, 2);
      await settled(surface, 10);
      assert(players[index].paused && players.filter((_, i) => i !== index).every((player, i) => player.currentTime === others[i]),
        'Paused drag started playback or changed another deck');
      for (const type of ['pointercancel', 'lostpointercapture']) {
        pointer(surface, 'pointerdown', .5); pointer(surface, 'pointermove', .75); pointer(surface, type, .75); pointer(surface, 'pointerup', .75);
        assert(players[index].currentTime === 10 && Number(surface.getAttribute('aria-valuenow')) === 10, 'Cancelled scrolling seek committed');
      }
      for (const action of [() => doc.dispatchEvent(new win.Event('tunetox-theme-change')),
        () => win.dispatchEvent(new win.Event('resize')),
        () => surface.closest('.deck').querySelector('.library-button').click(),
        () => surface.closest('.deck').querySelector('.performance-upper-toggle').click()]) {
        pointer(surface, 'pointerdown', .5); pointer(surface, 'pointermove', .75); action(); pointer(surface, 'pointerup', .75);
        assert(players[index].currentTime === 10, 'View/theme/resize committed unfinished scrolling drag');
        const card = surface.closest('.deck');
        card.querySelector('.back-to-performance-button').click();
        if (card.querySelector('.performance-upper-toggle').textContent !== 'Wave') card.querySelector('.performance-upper-toggle').click();
      }
      pointer(surface, 'pointerdown', .5); pointer(surface, 'pointerup', 3); await settled(surface, 0);
      pointer(surface, 'pointerdown', .5); pointer(surface, 'pointerup', -3); await settled(surface, players[index].duration);
      assert(players[index].paused, 'Scrolling to the end did not pause');
      key(surface, 'Home'); await settled(surface, 0);
    }
    assertScrollingAligned(doc);
  } finally { restorers.forEach(restore => restore()); }
}
