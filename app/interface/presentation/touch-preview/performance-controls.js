// Shared simulated controls: one per-deck value store, multiple presentation surfaces.
(() => {
  const design = globalThis.TuneToxDesign, ui = design.components;
  design.performanceProgress = function (deck) {
    const song = design.model.findSong(deck.songId);
    const parts = (song?.duration || '0:00').split(':').map(Number), duration = parts[0] * 60 + parts[1];
    const position = Math.min(duration, Math.max(0, deck.position || 0));
    const time = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
    return { fraction: duration ? position / duration : 0, text: time(position) + ' / −' + time(duration - position), remaining: duration - position };
  };
  function knob(label, min, max, step, change, dragThreshold = 0, neutral = null) {
    const node = ui.element('div', 'performance-knob');
    const caption = ui.element('span', 'knob-label', label);
    const dial = ui.element('div', 'knob-dial'); dial.tabIndex = 0; dial.setAttribute('role', 'slider');
    dial.setAttribute('aria-label', label); dial.setAttribute('aria-valuemin', min); dial.setAttribute('aria-valuemax', max);
    const needle = ui.element('span', 'knob-needle'), output = ui.element('output', 'knob-value'); dial.append(needle);
    node.append(caption, dial, output);
    let value = 0, drag = null;
    function set(next) { change(Math.round(Math.max(min, Math.min(max, next)) / step) * step); }
    const gesture = design.h531Pointers.bind(dial, {
      start(event) { drag = { id: event.pointerId, y: event.clientY, value }; dial.focus({ preventScroll: true }); },
      move(event) { if (drag && Math.abs(drag.y - event.clientY) >= dragThreshold) set(drag.value + (drag.y - event.clientY) * (max - min) / 160); },
      end() { drag = null; }
    });
    dial.addEventListener('keydown', event => {
      const delta = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 10, PageDown: -step * 10 }[event.key];
      if (delta !== undefined) { event.preventDefault(); set(value + delta); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); set(event.key === 'Home' ? min : max); }
    });
    const resetGesture = design.attachKnobReset(dial, () => { gesture.cancel(); drag = null; if (neutral) set(neutral()); });
    return { node, cancelDrag() { gesture.cancel(); drag = null; resetGesture.cancel(); }, render(next, accessibleName = label) {
      if (gesture.active() && !dial.getClientRects().length) gesture.cancel();
      value = next; dial.setAttribute('aria-label', accessibleName); dial.setAttribute('aria-valuenow', next);
      const text = min === -12 ? next.toFixed(1) + ' dB' : min < 0 ? next.toFixed(step < .1 ? 2 : 1) : Math.round(next * 100) + '%';
      dial.setAttribute('aria-valuetext', text); output.value = text;
      needle.style.transform = 'rotate(' + (-135 + (next - min) / (max - min) * 270) + 'deg)';
    } };
  }
  design.createEffectsRow = function (getDeck, actions, indices = [0, 1, 2]) {
    const effects = ui.element('div', 'performance-effects');
    const effectKnobs = indices.map(index => {
      const wrapper = ui.element('div', 'effect-control');
      const assignment = ui.element('select'); assignment.setAttribute('aria-label', 'Assign simulated effect ' + (index + 1));
      ['Echo', 'Reverb', 'Delay', 'Chorus', 'Flanger', 'None'].forEach(name => { const option = ui.element('option', '', name); option.value = name; assignment.append(option); });
      assignment.title = 'Tap to change effect assignment';
      assignment.addEventListener('change', () => actions.performance(getDeck().id, 'effectAssignment', assignment.value, index));
      const control = knob('FX ' + (index + 1), 0, 1, .01, value => actions.performance(getDeck().id, 'effectValue', value, index), 7, () => design.model.getPerformanceNeutral('effectValue'));
      wrapper.append(assignment, control.node);
      const assignmentUI = design.attachEffectAssignment(wrapper, control, assignment);
      effects.append(wrapper); return { index, assignment, control, assignmentUI };
    });
    let previousDeckId = null;
    return { node: effects, render() {
      const deck = getDeck(); if (!deck) return;
      if (previousDeckId !== deck.id) effectKnobs.forEach(({ assignmentUI }) => assignmentUI.close());
      previousDeckId = deck.id;
      effectKnobs.forEach(({ assignment, control, index }) => {
        assignment.value = deck.performance.effects[index].assignment;
        control.render(deck.performance.effects[index].value, 'Effect ' + (index + 1) + ' amount for deck ' + deck.id);
      });
    } };
  };
  design.createPerformanceControls = function ({ scope, getDeck, actions, id }) {
    const node = ui.element('section', 'performance-controls'); node.setAttribute('aria-label', 'Simulated performance controls');
    const strip = ui.element('div', 'vertical-mixer-strip'); node.append(strip);
    const transport = ui.element('div', 'performance-transport');
    const play = ui.button('performance-play', '▶', 'Play simulated deck', () => actions.play(getDeck().id));
    const main = ui.slider('MAIN', scope === 'overlay' ? 'overlay-main-' + id : scope + '-main', value => actions.level(getDeck().id, null, value));
    transport.append(play, main.node); strip.append(transport);
    design.attachVerticalFader(main.node.querySelector('input'), value => actions.level(getDeck().id, null, value));
    const eq = ui.element('div', 'performance-eq');
    const eqKnobs = ['low', 'mid', 'high'].map(key => {
      const control = knob(key[0].toUpperCase() + key.slice(1), -12, 12, .5, value => actions.performance(getDeck().id, key, value), 0, () => design.model.getPerformanceNeutral(key)); control.node.dataset.control = key; eq.append(control.node); return { key, control };
    }); strip.append(eq);
    const middle = ui.element('div', 'performance-middle');
    const filter = knob('Filter', -1, 1, .01, value => actions.performance(getDeck().id, 'filter', value), 0, () => design.model.getPerformanceNeutral('filter')); filter.node.dataset.control = 'filter'; middle.append(filter.node);
    const looping = ui.element('div', 'performance-loop');
    const loopValue = ui.element('span', 'loop-length');
    const halve = ui.button('loop-half', '−½', 'Halve simulated loop length', () => actions.performance(getDeck().id, 'loopBeats', Math.max(.25, getDeck().performance.loopBeats / 2)));
    const enable = ui.button('loop-on', 'ON', 'Toggle simulated loop', () => actions.performance(getDeck().id, 'loopEnabled', !getDeck().performance.loopEnabled));
    const double = ui.button('loop-double', '×2', 'Double simulated loop length', () => actions.performance(getDeck().id, 'loopBeats', Math.min(32, getDeck().performance.loopBeats * 2)));
    looping.append(loopValue, halve, enable, double); middle.append(looping); strip.append(middle);
    const effects = design.createEffectsRow(getDeck, actions); node.append(effects.node);
    return { node, render() {
      const deck = getDeck(); if (!deck) return;
      main.render(deck.volume); main.node.querySelector('input').setAttribute('aria-orientation', design.isPhone() ? 'vertical' : 'horizontal'); play.textContent = deck.playing ? 'Ⅱ' : '▶'; play.disabled = !deck.songId;
      play.setAttribute('aria-label', 'Play/pause simulated deck ' + deck.id); play.setAttribute('aria-pressed', String(deck.playing));
      eqKnobs.forEach(({ key, control }) => control.render(deck.performance.eq[key], key + ' EQ for deck ' + deck.id));
      filter.render(deck.performance.filter, 'Filter for deck ' + deck.id);
      enable.setAttribute('aria-pressed', String(deck.performance.loopEnabled)); loopValue.textContent = deck.performance.loopBeats + ' beats · preview';
      effects.render();
    } };
  };
})();
