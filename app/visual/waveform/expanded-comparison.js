// Temporary DOM geometry only. The same surface/canvas stays captured and draws
// extra source time above/below at its original pixels/second. No musical state is retained.
export function createExpandedComparison({ surface, node, header, lowerSection, redraw }) {
  let original = null;
  return {
    playheadY() {
      return surface.getBoundingClientRect().top + surface.clientTop + surface.clientHeight / 2;
    },
    expand(playheadY, interactive) {
      if (original) return;
      const deckRect = node.getBoundingClientRect();
      original = {
        style: surface.getAttribute('style'),
        lowerInert: lowerSection.inert,
        headerInert: header.inert
      };
      surface.dataset.comparisonAxisLength = surface.clientHeight;
      surface.dataset.comparisonCrossLength = surface.clientWidth;
      surface.dataset.comparisonPlayheadOffset = playheadY - deckRect.top - node.clientTop - surface.clientTop;
      surface.style.setProperty('--comparison-playhead', surface.dataset.comparisonPlayheadOffset + 'px');
      Object.assign(surface.style, {
        top: '0px', left: '0px',
        width: node.clientWidth + 'px', height: node.clientHeight + 'px'
      });
      surface.classList.add('waveform-comparison-expanded');
      surface.classList.toggle('waveform-comparison-passive', !interactive);
      node.classList.add('waveform-comparison-active');
      header.inert = true;
      lowerSection.inert = true;
      redraw();
    },
    restore() {
      if (!original) return;
      if (original.style === null) surface.removeAttribute('style');
      else surface.setAttribute('style', original.style);
      lowerSection.inert = original.lowerInert;
      header.inert = original.headerInert;
      original = null;
      delete surface.dataset.comparisonAxisLength;
      delete surface.dataset.comparisonCrossLength;
      delete surface.dataset.comparisonPlayheadOffset;
      surface.classList.remove('waveform-comparison-expanded', 'waveform-comparison-passive');
      node.classList.remove('waveform-comparison-active');
      redraw();
    }
  };
}
