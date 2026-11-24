const frame = document.querySelector('#application');
const results = document.querySelector('#results');
const run = document.querySelector('#run');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw Error(message); };
async function until(predicate, message) {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await delay(25); }
  throw Error(message);
}
// Small generated source, never original music. Sixty seconds permits switching
// every deck/theme without a natural-end race obscuring the navigation contract.
function tone(win, name) {
  const rate = 8000, count = rate * 60;
  const bytes = new ArrayBuffer(44 + count * 2), data = new DataView(bytes);
  const text = (at, value) => [...value].forEach((char, i) => data.setUint8(at + i, char.charCodeAt(0)));
  text(0, 'RIFF'); data.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, 1, true); data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true); data.setUint16(34, 16, true); text(36, 'data'); data.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) data.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 220 / rate) * 100, true);
  return new win.File([bytes], name, { type: 'audio/wav' });
}
run.addEventListener('click', async () => {
  run.disabled = true;
  results.dataset.result = 'running';
  results.textContent = '';
  const pass = message => { results.textContent += 'PASS ' + message + '\n'; };
  let win, players = [];
  try {
    const source = await (await fetch('../tunetox.html')).text();
    const observer = '<base href="' + new URL('../', location.href).href + '">' +
      '<script>window.__players=[];window.__contexts=[];window.__nodes=[];' +
      'const Target=EventTarget;window.EventTarget=class extends Target{constructor(){super();window.__players.push(this);}};' +
      'const Context=AudioContext;window.AudioContext=class extends Context{constructor(...a){super(...a);window.__contexts.push(this);}};' +
      'const Worklet=AudioWorkletNode;window.AudioWorkletNode=class extends Worklet{constructor(...a){super(...a);window.__nodes.push(this);}};<\/script>';
    frame.srcdoc = source.replace('<head>', '<head>' + observer);
    await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    win = frame.contentWindow;
    const doc = frame.contentDocument;
    await until(() => doc.querySelectorAll('.iphone-deck-tabs button').length === 4, 'Selector did not mount');
    const decks = [...doc.querySelectorAll('.deck')];
    players = [...win.__players];
    const tabs = [...doc.querySelectorAll('.iphone-deck-tabs button')];
    const visible = () => decks.filter(deck => win.getComputedStyle(deck).display !== 'none');
    const input = (deck, selector) => decks[deck].querySelector(selector);
    const set = (deck, selector, value) => { const node = input(deck, selector); node.value = value; node.dispatchEvent(new win.Event('input', { bubbles: true })); };
    const load = async (deck, name) => {
      const picker = doc.querySelectorAll('#audio-loaders input')[deck];
      const transfer = new win.DataTransfer(); transfer.items.add(tone(win, name)); picker.files = transfer.files;
      picker.dispatchEvent(new win.Event('change', { bubbles: true }));
      await until(() => !picker.disabled && players[deck].readyState >= 2, 'Load did not finish');
    };
    assert(players.length === 4 && win.__contexts.length === 1, 'Four persistent transports/one context required');
    assert(visible().length === 1 && visible()[0] === decks[0], 'Phone must default to Deck 1');
    for (let i = 0; i < 4; i++) {
      tabs[i].click();
      await load(i, 'Phone ' + (i + 1) + '.wav');
      set(i, '.main-volume-fader input', String(10 + i));
      set(i, '.tempo-slider input', String(50));
      input(i, '.waveform-overview').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      await until(() => !input(i, '.play-pause-button').disabled && players[i].currentTime >= 5, 'Seek did not finish');
      input(i, '.cue-pad[data-cue="1"]').click();
      input(i, '.play-pause-button').click();
      await until(() => !players[i].paused && !input(i, '.play-pause-button').disabled, 'Play failed');
      await load(i, 'Queue ' + (i + 1) + '.wav');
      input(i, '.performance-upper-toggle').click();
      set(i, 'input[data-stem="beat"]', String(20 + i));
    }
    pass('four loaded/playing decks, independent gains, seeks, cues, prepared queues and stems');
    const sources = players.map(player => player.src), nodes = [...win.__nodes];
    const values = decks.map(deck => [...deck.querySelectorAll('.main-volume-fader input, .tempo-slider input, input[data-stem]')].map(node => node.value).join(','));
    const times = players.map(player => player.currentTime);
    for (const theme of ['default', 'glass-hardware', 'futuristic']) {
      const selector = doc.querySelector('[aria-label="Visual theme"]');
      selector.value = theme; selector.dispatchEvent(new win.Event('change', { bubbles: true }));
      await delay(100);
      for (let round = 0; round < 2; round++) for (let i = 0; i < 4; i++) {
        tabs[i].click();
        assert(visible().length === 1 && visible()[0] === decks[i] && !decks[i].inert, 'Incorrect selected deck');
        assert(tabs[i].getAttribute('aria-selected') === 'true', 'Selected tab not marked');
        assert(decks.every((deck, j) => deck.inert === (j !== i)), 'Hidden decks must be inert');
        assert(win.getComputedStyle(input(i, 'input[data-stem="beat"]')).writingMode === 'vertical-lr', 'Phone stem is not vertical');
        assert(doc.documentElement.scrollWidth <= win.innerWidth, 'Phone horizontal overflow');
        assert(decks.every((deck, j) => [...deck.querySelectorAll('.main-volume-fader input, .tempo-slider input, input[data-stem]')].map(node => node.value).join(',') === values[j]), 'Switch changed controls');
        assert(decks.every(deck => deck.querySelector('.cue-marker[data-cue-number="1"]')), 'Switch lost cue markers');
        assert(decks.every(deck => !deck.querySelector('.queue-button').disabled), 'Switch lost a queue');
      }
      const handle = doc.querySelector('.iphone-transition-handle');
      handle.click(); assert(handle.getAttribute('aria-expanded') === 'true' && !doc.querySelector('.iphone-transition').hidden, 'Expand failed');
      tabs[0].click(); assert(handle.getAttribute('aria-expanded') === 'true', 'Tab collapsed transition');
      handle.click(); assert(doc.querySelector('.iphone-transition').hidden, 'Collapse failed');
      tabs[1].focus(); tabs[1].dispatchEvent(new win.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
      assert(tabs[3].getAttribute('aria-selected') === 'true', 'Keyboard navigation failed');
      pass(theme + ': tab/keyboard navigation, vertical stems, transition taps and retained values');
    }
    assert(players.every((player, i) => player === win.__players[i] && player.src === sources[i] && !player.paused && player.currentTime > times[i]), 'Hidden playback stopped or was recreated');
    assert(win.__contexts.length === 1 && win.__nodes.length === nodes.length && win.__nodes.every((node, i) => node === nodes[i]), 'Switch rebuilt audio processing');
    // Synthetic pointer events have no native active pointer. Stub capture only;
    // native touch dragging is a separate browser/device verification.
    const handle = doc.querySelector('.iphone-transition-handle');
    const capture = handle.setPointerCapture, release = handle.releasePointerCapture, hasCapture = handle.hasPointerCapture;
    let captured = false;
    handle.setPointerCapture = () => { captured = true; };
    handle.releasePointerCapture = () => { captured = false; };
    handle.hasPointerCapture = () => captured;
    const pointer = (type, x, y) => handle.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, pointerId: 77, button: 0, clientX: x, clientY: y }));
    const expanded = () => handle.getAttribute('aria-expanded') === 'true';
    try {
      pointer('pointerdown', 100, 50); pointer('pointerup', 100, 80);
      assert(expanded(), 'Downward release must expand');
      handle.dispatchEvent(new win.MouseEvent('click', { bubbles: true, detail: 1 }));
      assert(expanded(), 'Compatibility click reversed a swipe');
      pointer('pointerdown', 100, 80); pointer('pointerup', 100, 50);
      assert(!expanded(), 'Upward release must collapse');
      pointer('pointerdown', 100, 50); pointer('pointerup', 160, 80);
      assert(!expanded(), 'Horizontal movement must not expand');
      pointer('pointerdown', 100, 50); pointer('pointercancel', 100, 90); pointer('pointerup', 100, 90);
      assert(!expanded(), 'Cancelled movement expanded');
      pointer('pointerdown', 100, 50); win.dispatchEvent(new win.Event('resize')); pointer('pointerup', 100, 90);
      assert(!expanded(), 'Resize committed a stale gesture');
      pointer('pointerdown', 100, 50); pointer('lostpointercapture', 100, 50); pointer('pointerup', 100, 90);
      assert(!expanded(), 'Lost capture committed a stale gesture');
      tabs[1].click(); assert(!expanded(), 'Tab selection expanded the transition area');
    } finally {
      handle.setPointerCapture = capture; handle.releasePointerCapture = release; handle.hasPointerCapture = hasCapture;
    }
    pass('transition swipes, duplicate click suppression, horizontal/cancelled/resize/lost-capture negatives');
    tabs[3].click();
    frame.style.width = '768px'; await delay(150);
    assert(visible().length === 4 && decks.every(deck => !deck.inert), 'Tablet restoration hid or disabled decks');
    assert(win.getComputedStyle(input(0, 'input[data-stem="beat"]')).writingMode === 'horizontal-tb', 'Tablet stems changed');
    frame.style.width = '390px'; await delay(150);
    assert(visible().length === 1 && visible()[0] === decks[3], 'Resize lost phone selection');
    pass('all hidden source clocks advance; transport/context/worklet identities retained; tablet round trip retains selection');
    tabs[0].click();
    input(0, '.play-pause-button').click();
    await until(() => players[0].paused && !input(0, '.play-pause-button').disabled, 'Pause did not finish');
    const pausedAt = players[0].currentTime;
    tabs[2].click(); await delay(100); tabs[0].click();
    assert(players[0].paused && players[0].currentTime === pausedAt, 'Switch changed paused position');
    input(0, '.cue-pad[data-cue="1"]').click();
    await until(() => !input(0, '.play-pause-button').disabled && players[0].currentTime < 6, 'Retained cue recall failed');
    assert(players[0].paused && players.slice(1).every(player => !player.paused), 'Cue recall changed transport state');
    pass('paused position survives switching; retained cue recalls without interrupting other decks');
    input(0, '.queue-button').click();
    await until(() => !input(0, '.play-pause-button').disabled && input(0, '.queue-button').disabled && players[0].src !== sources[0], 'Retained queue did not play');
    assert(!players[0].paused && input(0, '.main-volume-fader input').value === '10', 'Queue lost playback/gain');
    pass('retained READY queue remains functional after switching');
    results.dataset.result = 'pass';
  } catch (error) {
    results.textContent += 'FAIL ' + error.message;
    results.dataset.result = 'fail';
  } finally {
    if (win) { const audio = await win.eval("import('/app/audio/deck-audio.js')"); await Promise.all(players.map(player => audio.ejectAudio(player))); }
    run.disabled = false;
  }
});
