// Synthetic event regression checks; these do not emulate Safari's zoom recognizer.
export function runTouchGuardChecks(doc) {
  const win = doc.defaultView, root = doc.querySelector(".app");
  const fixture = doc.createElement("div");
  fixture.style.cssText = "position:absolute;visibility:hidden";
  const button = doc.createElement("button"), other = doc.createElement("button");
  const blank = doc.createElement("div"), range = doc.createElement("input");
  range.type = "range";
  fixture.append(button, other, blank, range); root.append(fixture);
  let clicks = 0, otherClicks = 0, clock = 1000;
  button.addEventListener("click", () => clicks++);
  other.addEventListener("click", () => otherClicks++);
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const reset = () => root.dispatchEvent(new win.Event("touchcancel", { bubbles: true }));
  const touch = (x = 30, y = 30, id = 1) => ({ clientX: x, clientY: y, identifier: id });
  function send(target, type, touches, changed, elapsed = 30) {
    clock += elapsed;
    const event = new win.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changed },
      timeStamp: { value: clock } });
    target.dispatchEvent(event);
    return event;
  }
  function tap(target, x = 30, y = 30, duration = 40) {
    const finger = touch(x, y);
    send(target, "touchstart", [finger], [finger]);
    return send(target, "touchend", [], [finger], duration);
  }
  const nativeClick = target => target.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
  try {
    reset();
    assert(!tap(button).defaultPrevented, "First tap was cancelled");
    nativeClick(button);
    assert(tap(button).defaultPrevented && clicks === 2, "Double tap did not cancel zoom and activate once");
    assert(!nativeClick(button) && clicks === 2, "Duplicate compatibility click was not suppressed");
    assert(tap(button).defaultPrevented && clicks === 3, "Rapid third tap lost activation");
    clock += 600;
    assert(!tap(button).defaultPrevented, "Later ordinary tap was cancelled");
    nativeClick(button);
    assert(clicks === 4, "Later ordinary click was lost");

    reset();tap(blank);
    assert(tap(blank).defaultPrevented, "Blank application area allowed double tap");
    reset();tap(button);
    assert(tap(other).defaultPrevented && otherClicks === 1, "Nearby different button lost activation");
    reset();tap(range);
    assert(tap(range).defaultPrevented, "Stationary range double tap was not guarded");

    reset();
    const finger = touch();
    assert(!send(range, "touchstart", [finger], [finger]).defaultPrevented, "Fader start blocked");
    assert(!send(range, "touchmove", [touch(80,30)], [touch(80,30)]).defaultPrevented, "Fader drag blocked");
    assert(!send(range, "touchend", [], [touch(80,30)]).defaultPrevented, "Fader release blocked");
    assert(!tap(range).defaultPrevented, "Drag was mistaken for a previous tap");

    reset();tap(blank);
    send(blank, "touchstart", [finger, touch(60,60,2)], [finger]);
    assert(!send(blank, "touchmove", [finger,touch(80,80,2)], [finger]).defaultPrevented, "Pinch move blocked");
    assert(!send(blank, "touchend", [], [finger]).defaultPrevented, "Pinch release blocked");
    assert(!tap(blank).defaultPrevented, "Pinch was mistaken for a tap");

    reset();tap(blank);root.dispatchEvent(new win.Event("scroll"));
    assert(!tap(blank).defaultPrevented, "Scroll did not reset tap history");
    reset();tap(blank);
    assert(!tap(blank,30,30,450).defaultPrevented, "Long press blocked");
    reset();tap(blank);
    assert(!tap(blank,150,150).defaultPrevented, "Distant tap blocked");
    return "single/double/triple taps, duplicate clicks, blank areas, different buttons, fader drags, pinch, scrolling, long/distant taps";
  } finally { reset();fixture.remove(); }
}

