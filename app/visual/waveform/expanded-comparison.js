// Temporary DOM geometry only. The same surface/canvas stays captured and draws
// extra source time at its original pixels/second. No musical state is retained.
export function createExpandedComparison({ surface, content, lowerSection, redraw }) {
  let original = null;
  return {
    playheadY() {
      return surface.getBoundingClientRect().top + surface.clientTop + surface.clientHeight / 2;
    },
    expand(playheadY, interactive) {
      if (original) return;
      const rect = surface.getBoundingClientRect(), parent = content.getBoundingClientRect();
      original = { style: surface.getAttribute('style'), inert: lowerSection.inert };
      surface.dataset.comparisonAxisLength = surface.clientHeight;
      surface.dataset.comparisonPlayheadOffset = playheadY - rect.top - surface.clientTop;
      surface.style.setProperty('--comparison-playhead', surface.dataset.comparisonPlayheadOffset + 'px');
      Object.assign(surface.style, {
        top: rect.top - parent.top - content.clientTop + content.scrollTop + 'px',
        left: rect.left - parent.left - content.clientLeft + content.scrollLeft + 'px',
        width: rect.width + 'px', height: Math.max(rect.height, parent.bottom - rect.top) + 'px'
      });
      surface.classList.add('waveform-comparison-expanded');
      surface.classList.toggle('waveform-comparison-passive', !interactive);
      content.classList.add('waveform-comparison-active');
      lowerSection.inert = true;
      redraw();
    },
    restore() {
      if (!original) return;
      if (original.style === null) surface.removeAttribute('style');
      else surface.setAttribute('style', original.style);
      lowerSection.inert = original.inert;
      original = null;
      delete surface.dataset.comparisonAxisLength;
      delete surface.dataset.comparisonPlayheadOffset;
      surface.classList.remove('waveform-comparison-expanded', 'waveform-comparison-passive');
      content.classList.remove('waveform-comparison-active');
      redraw();
    }
  };
}
