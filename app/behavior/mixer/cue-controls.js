import { createCuePresentation } from '../../visual/themes/glass-hardware/cue-preview.js';
// The former theme-only preview now presents real Behavior-owned cues in every
// theme. Retain this existing module/Shift button rather than a competing system.
// Only Shift interaction state lives here; no cue positions or transport clock.
export function installCueControls(cues, deck, actions) {
  const view = createCuePresentation(cues,deck), {pads,shift} = view;
  let shifted = false, held = null, keyboardShift = false, suppressShiftClick = false;
  let forwardedTouch = null, secondaryTouch = null, removal;
  const clearing = () => shifted || Boolean(held) || keyboardShift;
  const ready = () => Boolean(deck.song) && !deck.loadingSong && deck.audio.readyState >= 2 &&
    typeof actions.cue === 'function';

  const render = () => view.render({ready:ready(),canSeek:!actions.canSeek || actions.canSeek(),shifted:clearing()});
  function releaseHeld() {
    const previous = held;
    held = null;
    secondaryTouch = null;
    removal?.disconnect();
    if (previous && shift.hasPointerCapture(previous.id)) shift.releasePointerCapture(previous.id);
    render();
  }
  function activate(pad, event) {
    if (!pads.includes(pad) || pad.disabled) return;
    const clear = clearing() || event.shiftKey;
    if (held) held.used = true;
    // The coordinator owns seek errors and presentation notifications.
    Promise.resolve(actions.cue(Number(pad.dataset.cue), clear)).catch(() => {});
  }
  shift.addEventListener('pointerdown', event => {
    if (shift.disabled || held || event.button !== 0) return;
    suppressShiftClick = false;
    held = { id: event.pointerId, used: false };
    shift.setPointerCapture(event.pointerId);
    removal = new MutationObserver(() => { if (!shift.isConnected) releaseHeld(); });
    removal.observe(document, { childList: true, subtree: true });
    render();
  });
  shift.addEventListener('pointerup', event => {
    if (held?.id !== event.pointerId) return;
    const rect = shift.getBoundingClientRect();
    suppressShiftClick = held.used || event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    releaseHeld();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) shift.addEventListener(type, event => {
    if (held?.id === event.pointerId) { suppressShiftClick = false; releaseHeld(); }
  });
  shift.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') suppressShiftClick = false;
  });
  cues.addEventListener('pointerup', event => {
    // A second finger may not produce a compatibility click while Shift is held.
    // Route only that case through the same action, suppressing its later click.
    const pad = secondaryTouch?.id === event.pointerId ? secondaryTouch.pad : null;
    secondaryTouch = null;
    if (held && pad) {
      activate(pad, event);
      forwardedTouch = { pad, time: performance.now() };
    }
  });
  cues.addEventListener('pointerdown', event => {
    const pad = event.target.closest('.cue-pad');
    if (pads.includes(pad)) {
      forwardedTouch = null;
      if (held && event.pointerType === 'touch' && !event.isPrimary)
        secondaryTouch = { id: event.pointerId, pad, x: event.clientX, y: event.clientY };
    }
  });
  cues.addEventListener('pointermove', event => {
    if (secondaryTouch?.id === event.pointerId && Math.hypot(event.clientX - secondaryTouch.x, event.clientY - secondaryTouch.y) > 10)
      secondaryTouch = null;
  });
  cues.addEventListener('pointercancel', () => { secondaryTouch = null; });
  cues.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (target === shift) {
      if (suppressShiftClick) { suppressShiftClick = false; return; }
      shifted = !shifted;
      render();
    } else {
      if (forwardedTouch?.pad === target && performance.now() - forwardedTouch.time < 500) {
        forwardedTouch = null; return;
      }
      activate(target, event);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Shift') { keyboardShift = true; render(); }
  });
  document.addEventListener('keyup', event => {
    if (event.key === 'Shift') { keyboardShift = false; render(); }
  });
  window.addEventListener('blur', () => { keyboardShift = false; suppressShiftClick = false; releaseHeld(); });
  document.addEventListener('tunetox-theme-change', () => { releaseHeld(); });
  return render;
}
