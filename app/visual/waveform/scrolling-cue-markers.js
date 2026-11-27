import { getScrollingGeometry } from './scrolling-waveform.js';

// Passive presentation of the existing Behavior cuePositions array. The eight DOM
// markers are reused; no cue values, playback position or seek state are retained.
export function createScrollingCueMarkers(surface) {
  const overlay = document.createElement('div'); overlay.className = 'scrolling-cue-markers';
  overlay.setAttribute('aria-hidden', 'true');
  const markers = Array.from({ length: 8 }, (_, index) => {
    const line = document.createElement('span'), label = document.createElement('span');
    line.className = 'scrolling-cue-marker'; line.dataset.cueNumber = index + 1; line.hidden = true;
    label.textContent = String(index + 1); line.append(label); overlay.append(line); return line;
  });
  surface.append(overlay);
  return function render(positions, sourceSeconds, valid) {
    const { vertical, visibleAxis: width, playheadOffset, pixelsPerSecond } = getScrollingGeometry(surface);
    markers.forEach((line, index) => {
      const position = positions[index];
      const percent = ((position - sourceSeconds) * pixelsPerSecond + playheadOffset) / width * 100;
      line.hidden = !width || !valid || position === null || !Number.isFinite(position) || percent < 0 || percent > 100;
      if (line.hidden) return;
      line.style.left = vertical ? '0' : percent + '%';
      line.style.top = vertical ? percent + '%' : '0';
      // Labels may move inward or apart at edges/coincident cues. The vertical
      // line never shifts away from its exact source-song position.
      let count = 0, ordinal = 0;
      for (let cue = 0; cue < positions.length; cue++) {
        if (positions[cue] !== position) continue;
        count++; if (cue < index) ordinal++;
      }
      const x = percent / 100 * width;
      line.firstChild.style.top = vertical ? '0' : '';
      line.firstChild.style.left = vertical ? ordinal * 12 + 'px' : (Math.max(1 - x, Math.min(-count * 6, width - x - count * 12 - 1)) + ordinal * 12) + 'px';
    });
  };
}
