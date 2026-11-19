// A short double tap resets; drags and long holds are never counted as taps.
(() => {
  globalThis.TuneToxDesign.attachKnobReset = function (dial, reset) {
    let touch = null, previousTap = null, lastReset = -Infinity;
    function cancel() { touch = null; previousTap = null; }
    function perform() { lastReset = performance.now(); previousTap = null; reset(); }
    dial.title = 'Drag vertically · double-tap to neutral · Enter to reset';
    dial.addEventListener('pointerdown', event => {
      if (event.button !== 0 || globalThis.TuneToxDesign.h531Pointers.owner(dial) !== event.pointerId) return;
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY, start: performance.now(), moved: false };
    });
    dial.addEventListener('pointermove', event => {
      if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 7) touch.moved = true;
    });
    dial.addEventListener('pointerup', event => {
      if (!touch || touch.id !== event.pointerId) return;
      const tap = touch; touch = null; const now = performance.now();
      if (tap.moved || now - tap.start > 300) { previousTap = null; return; }
      if (previousTap && now - previousTap.time <= 330 && Math.hypot(tap.x - previousTap.x, tap.y - previousTap.y) <= 20) perform();
      else previousTap = { time: now, x: tap.x, y: tap.y };
    });
    dial.addEventListener('pointercancel', event => { if (touch?.id === event.pointerId) cancel(); });
    dial.addEventListener('lostpointercapture', event => { if (touch?.id === event.pointerId) cancel(); });
    dial.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation(); if (performance.now() - lastReset > 200) perform();
    });
    dial.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); perform(); } });
    return { cancel };
  };
})();
