// Behavior-owned iOS fallback (WebKit 319664); no deck/audio dependencies.
// Only a second nearby stationary single-finger tap is cancelled. Its button
// click is forwarded once, since cancelling touchend suppresses native clicks.
export function installTouchGuards(root) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const editable = target => target.closest?.('textarea, input:not([type=range]):not([type=color]):not([type=button]):not([type=submit]), [contenteditable=true]');
  for(const type of ['contextmenu','selectstart']) root.addEventListener(type,event=>{if(!editable(event.target))event.preventDefault();});
  let start = null, previous = null, forwarded = null;
  const point = touch => ({ x: touch.clientX, y: touch.clientY });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const reset = () => { start = null; previous = null; forwarded = null; };
  doc.addEventListener("touchstart", event => {
    forwarded = null;
    if (editable(event.target)) { reset(); return; }
    if (event.touches.length !== 1 || !root.contains(event.target)) { reset(); return; }
    start = { ...point(event.touches[0]), id: event.touches[0].identifier, time: event.timeStamp };
  }, { capture: true, passive: true });
  doc.addEventListener("touchmove", event => {
    if (!start || event.touches.length !== 1 || event.touches[0].identifier !== start.id ||
        distance(start, point(event.touches[0])) > 10) reset();
  }, { capture: true, passive: true });
  doc.addEventListener("touchend", event => {
    const first = start, touch = event.changedTouches[0];
    start = null;
    if (!first || !touch || event.touches.length || touch.identifier !== first.id ||
        event.timeStamp - first.time > 300 || distance(first, point(touch)) > 10) {
      previous = null;
      return;
    }
    const current = { ...point(touch), time: event.timeStamp };
    const doubleTap = previous && current.time - previous.time <= 350 && distance(previous, current) <= 24;
    previous = current;
    if (!doubleTap || !event.cancelable || event.defaultPrevented) return;
    event.preventDefault();
    const target = event.target.closest?.("button, a[href], input[type=button], input[type=submit]");
    if (target && root.contains(target) && !target.disabled) {
      forwarded = { target, time: win.performance.now() };
      target.click();
    }
  }, { capture: true, passive: false });
  // Drop only a duplicate compatibility click after a forwarded activation.
  // Keyboard/.click() events have detail=0; the next real touch clears this guard.
  doc.addEventListener("click", event => {
    if (forwarded && event.detail > 0 && win.performance.now() - forwarded.time < 500 &&
        (event.target === forwarded.target || forwarded.target.contains(event.target))) {
      forwarded = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  doc.addEventListener("touchcancel", reset, { capture: true, passive: true });
  doc.addEventListener("scroll", reset, { capture: true, passive: true });
  win.addEventListener("blur", reset);
  win.addEventListener("resize", reset);
}

// Play uses the original deck action on contact. Consume the compatibility click
// (including the iOS double-tap fallback); keyboard activation keeps native clicks.
export function connectPlaybackButton(button, togglePlayback) {
  let pointerActivated = false;
  button.addEventListener('pointerdown', event => {
    if (button.disabled || event.button !== 0) return;
    pointerActivated = true;
    togglePlayback();
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') pointerActivated = false;
  });
  button.addEventListener('click', event => {
    if (pointerActivated) {
      pointerActivated = false;
      event.preventDefault();
      return;
    }
    if (!button.disabled && event.detail === 0) togglePlayback();
  });
}
