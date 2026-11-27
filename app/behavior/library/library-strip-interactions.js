// Pointer capture follows the same drag pattern as existing waveform/fader controls.
// This module interprets strip gestures; the supplied Behavior action owns choices.
// A pointer activates on contact and on crossing each option. Keyboard clicks work
// through the same action. Returning across an option does not reverse sort order.
export function connectLibraryStrip(strip, choose) {
  const buttons = [...strip.querySelectorAll('button')];
  let pointer = null, previous = -1, ignoreClickUntil = 0, lastPointerType = '';
  function indexAt(event) {
    const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('button');
    return button?.parentElement === strip && !button.disabled ? buttons.indexOf(button) : -1;
  }
  function finish() {
    const id = pointer; pointer = null; previous = -1;
    if (id !== null && strip.hasPointerCapture(id)) strip.releasePointerCapture(id);
  }
  strip.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
    const index = indexAt(event); if (index < 0) return;
    event.preventDefault(); lastPointerType = event.pointerType; pointer = event.pointerId; previous = index;
    ignoreClickUntil = performance.now() + 600;
    if (event.isTrusted) strip.setPointerCapture(pointer);
    buttons[index].focus({ preventScroll: true }); choose(index, true);
  });
  strip.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    const index = indexAt(event);
    if (index < 0 || index === previous) return;
    previous = index; ignoreClickUntil = performance.now() + 600; choose(index, false);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    strip.addEventListener(type, event => { if (event.pointerId === pointer) { ignoreClickUntil = performance.now() + 600; finish(); } });
  window.addEventListener('blur', finish);
  strip.addEventListener('keydown', () => { ignoreClickUntil = 0; });
  buttons.forEach((button, index) => button.addEventListener('click', event => {
    if ((event.detail || lastPointerType === 'touch') && performance.now() < ignoreClickUntil) return;
    choose(index, true);
  }));
}
