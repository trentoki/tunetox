// Jog remains a view-only preview. The center playhead is deliberately stationary.
(() => {
  const design = globalThis.TuneToxDesign, ui = design.components;
  design.createWaveformNavigation = function (id, actions) {
    const node = ui.element('div', 'waveform-interactions');
    const left = ui.button('waveform-jog', '− Jog', 'Preview backward nudge on deck ' + id, () => actions.waveform(id, 'nudge', -1));
    const right = ui.button('waveform-jog', '+ Jog', 'Preview forward nudge on deck ' + id, () => actions.waveform(id, 'nudge', 1));
    const center = ui.element('div', 'waveform-navigate');
    center.setAttribute('role', 'img'); center.setAttribute('aria-label', 'Stationary playhead — scrubbing not implemented');
    const marker = ui.element('span', 'waveform-preview-cursor'), hint = ui.element('span', 'waveform-gesture-hint');
    marker.style.top = '50%'; center.append(marker, hint); node.append(left, center, right);
    return { node, render(deck) { hint.textContent = 'Fixed playhead · jog preview ' + deck.waveformPreview.nudge; } };
  };
})();
