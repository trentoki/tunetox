import { connectPlaybackButton } from '../app/behavior/mixer/performance-input.js';
// Synthetic event regression checks; these do not emulate Safari's zoom recognizer.
export function runTouchGuardChecks(doc) {
  const win = doc.defaultView, root = doc.querySelector(".app");
  const fixture = doc.createElement("div");
  fixture.style.cssText = "position:absolute;visibility:hidden";
  const button = doc.createElement("button"), other = doc.createElement("button");
  const blank = doc.createElement("div"), range = doc.createElement("input");
  range.type = "range";
  const search=doc.createElement('input'); search.type='search';
  fixture.append(button, other, blank, range, search); root.append(fixture);
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
    const play = doc.createElement('button'); fixture.append(play);
    let activations = 0; connectPlaybackButton(play, () => activations++);
    const down = type => play.dispatchEvent(new win.PointerEvent('pointerdown', {bubbles:true,button:0,pointerType:type}));
    for (const type of ['mouse','touch','pen']) {
      down(type); assert(activations > 0, 'Play waits for release');
      const before = activations; nativeClick(play);
      assert(activations === before, 'Compatibility click toggled twice');
    }
    down('touch'); const before = activations; play.click();
    assert(activations === before, 'Forwarded touch click toggled twice');
    down('touch'); play.dispatchEvent(new win.Event('pointercancel'));
    play.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter'})); play.click();
    assert(activations === before + 2, 'Keyboard after cancelled pointer failed');
    play.disabled = true; const disabledCount = activations; down('touch');
    assert(activations === disabledCount, 'Disabled Play activated');
    play.disabled = false;
    play.dispatchEvent(new win.PointerEvent('pointerdown',{button:2,bubbles:true}));
    assert(activations === disabledCount, 'Secondary mouse button activated');
    play.dispatchEvent(new win.KeyboardEvent('keydown',{key:' '})); play.click();
    assert(activations === disabledCount+1, 'Space activation failed');
    reset();
    tap(search); assert(!tap(search).defaultPrevented,'Text editing double tap blocked');
    for(const type of ['contextmenu','selectstart']) {
      assert(!button.dispatchEvent(new win.Event(type,{bubbles:true,cancelable:true})),'Performance menu/selection allowed');
      assert(search.dispatchEvent(new win.Event(type,{bubbles:true,cancelable:true})),'Input editing blocked');
    }
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

