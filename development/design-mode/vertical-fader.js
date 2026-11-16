// Pointer support for phone vertical range inputs. Same range value/action, no new gain state.
(() => {
  globalThis.TuneToxDesign.attachVerticalFader = function (input, change) {
    let pointer = null;
    function update(event) {
      const rect = input.getBoundingClientRect();
      if (!rect.height) return;
      const value = Math.round(Math.max(0, Math.min(1, (rect.bottom - event.clientY) / rect.height)) * 100) / 100;
      input.value = value; change(value);
    }
    input.addEventListener('pointerdown', event => {
      if (!globalThis.TuneToxDesign.isPhone() || event.button !== 0 || pointer !== null) return;
      event.preventDefault(); event.stopPropagation(); pointer = event.pointerId; input.focus();
      try { input.setPointerCapture(pointer); } catch (_) { /* synthetic test pointer */ }
      update(event);
    });
    input.addEventListener('pointermove', event => {
      if (event.pointerId !== pointer) return;
      event.preventDefault(); event.stopPropagation(); update(event);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => input.addEventListener(type, event => {
      if (pointer === event.pointerId) pointer = null;
    }));
  };
})();
