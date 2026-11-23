// A stationary hold opens assignments; vertical movement keeps the original knob gesture.
(() => {
  globalThis.TuneToxDesign.attachEffectAssignment = function (wrapper, control, select) {
    const ui = globalThis.TuneToxDesign.components, dial = control.node.querySelector('.knob-dial');
    const menu = ui.element('div', 'effect-assignment-menu'); menu.hidden = true;
    menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', select.getAttribute('aria-label'));
    [...select.options].forEach(option => menu.append(ui.button('effect-assignment-option', option.textContent, 'Assign ' + option.textContent, () => {
      select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); menu.hidden = true; dial.focus();
    })));
    menu.append(ui.button('effect-assignment-cancel', 'Cancel', 'Close effect assignments', () => { menu.hidden = true; dial.focus(); }));
    wrapper.append(menu); dial.setAttribute('aria-haspopup', 'true');
    let hold = null, start = null;
    function cancel() { clearTimeout(hold); hold = null; start = null; }
    function open() { cancel(); control.cancelDrag(); menu.hidden = false; menu.querySelector('button').focus(); }
    dial.addEventListener('pointerdown', event => {
      if (event.button !== 0) return; cancel(); start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      hold = setTimeout(open, 550);
    });
    dial.addEventListener('pointermove', event => {
      if (start && (event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7)) cancel();
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => dial.addEventListener(type, cancel));
    dial.addEventListener('contextmenu', event => { event.preventDefault(); open(); });
    dial.addEventListener('keydown', event => { if (event.key === 'F2' || event.key === 'ContextMenu') { event.preventDefault(); open(); } });
    wrapper.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { event.stopPropagation(); menu.hidden = true; dial.focus(); } });
    return { close() { cancel(); control.cancelDrag(); menu.hidden = true; } };
  };
})();
