// Futuristic changes pointer operation only, reusing the native range's input
// action and keyboard support. 360px covers the full range (180px per octave
// for Tempo). The anchor is gesture state, never another stored Tempo value.
export function installVerticalRoller(surface, input) {
  const rollerTravelPixels = 360;
  let drag = null;
  let removal;
  function cancel() {
    const previous = drag;
    drag = null;
    removal?.disconnect();
    window.removeEventListener('blur', cancel);
    delete surface.dataset.dragging;
    if (previous && surface.hasPointerCapture(previous.id)) surface.releasePointerCapture(previous.id);
  }
  surface.addEventListener('pointerdown', event => {
    if (document.documentElement.dataset.theme !== 'futuristic' || input.disabled ||
      drag || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); // Suppress the native horizontal range jump.
    input.focus({ preventScroll: true });
    drag = { id: event.pointerId, y: event.clientY, value: Number(input.value) };
    surface.setPointerCapture(event.pointerId);
    surface.dataset.dragging = 'true';
    window.addEventListener('blur', cancel);
    removal = new MutationObserver(() => { if (!surface.isConnected) cancel(); });
    removal.observe(document, { childList: true, subtree: true });
  }, true);
  surface.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (input.disabled || document.documentElement.dataset.theme !== 'futuristic') { cancel(); return; }
    event.preventDefault();
    const min = Number(input.min), max = Number(input.max);
    const value = Math.round(Math.max(min, Math.min(max,
      drag.value + (drag.y - event.clientY) * (max - min) / rollerTravelPixels)));
    if (Number(input.value) !== value) {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => { if (drag?.id === event.pointerId) cancel(); });
  }
  return cancel;
}

