// Native mouse double-click and stationary touch double-tap share one reset.
// Dragging and single taps retain the existing native range/roller behavior.
export function connectTempoControls(surface, input, setTempo) {
  // Shared logarithmic established-tempo action; reset never edits a second value.
  input.addEventListener('input', () => setTempo(2 ** (2 * Number(input.value) / 1000 - 1)));
  const reset = () => setTempo(1);
  let start = null, previous = null, ignoreDoubleClickUntil = 0;
  surface.addEventListener('dblclick', event => {
    if (performance.now() < ignoreDoubleClickUntil) return;
    event.preventDefault(); reset();
  });
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary) { start = null; return; }
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
  }, true);
  surface.addEventListener('pointermove', event => {
    if (start?.id === event.pointerId && Math.hypot(event.clientX-start.x,event.clientY-start.y) > 10) { start = null; previous = null; }
  }, true);
  surface.addEventListener('pointerup', event => {
    const tap = start; start = null;
    if (!tap || tap.id !== event.pointerId || event.timeStamp-tap.at > 300 || Math.hypot(event.clientX-tap.x,event.clientY-tap.y) > 10) return;
    if (previous && event.timeStamp-previous.at <= 350 && Math.hypot(tap.x-previous.x,tap.y-previous.y) <= 24) {
      previous = null; ignoreDoubleClickUntil = performance.now()+600; reset();
    } else previous = { x:tap.x, y:tap.y, at:event.timeStamp };
  }, true);
  surface.addEventListener('pointercancel', () => { start = previous = null; });
  window.addEventListener('blur', () => { start = previous = null; });
}
