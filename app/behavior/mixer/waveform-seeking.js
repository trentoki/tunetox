import { beginWaveformComparison, endWaveformComparison, comparisonBlocksSeeking } from './waveform-comparison.js';
import { getWaveformOrientation, getWaveformWindowSeconds } from '../settings.js';
// Behavior owns overview/scrolling pointer interpretation and transient seek
// preview. Audio remains the only advancing source clock. Visual reads position.
export function connectWaveformSeeking({ deck, node, overview, scrolling, actions, getBusy, isVisible, changed }) {
  let seekGesture = null, seekPreview = null, previewSource, seekRequest = 0, seekRemoval;
  const canSeek = () => Boolean(deck.song) && Number.isFinite(deck.audio.duration) && deck.audio.duration > 0 &&
    typeof actions.seek === 'function' && (actions.canSeek ? actions.canSeek() : !getBusy());
  function cancelSeekGesture() {
    const previous = seekGesture;
    seekGesture = null;
    seekRemoval?.disconnect();
    window.removeEventListener('blur', cancelSeekGesture);
    window.removeEventListener('resize', cancelSeekGesture);
    if (previous && previous.surface.hasPointerCapture(previous.id)) previous.surface.releasePointerCapture(previous.id);
    seekPreview = null;
    endWaveformComparison(scrolling);
    changed();
  }
  function previewSeek(coordinate) {
    const surface = seekGesture.surface;
    const rect = surface.getBoundingClientRect();
    previewSource = deck.audio.src;
    // Overview is absolute. The scrolling window is a grabbed piece of the same
    // source timeline: pulling right/down rewinds; pulling left/up advances.
    const seconds = surface === overview ? (coordinate - rect.left) / rect.width * deck.audio.duration :
      seekGesture.anchorTime - (coordinate - seekGesture.anchorCoordinate) / seekGesture.axisLength * getWaveformWindowSeconds();
    seekPreview = Math.max(0, Math.min(deck.audio.duration, seconds));
    changed();
  }
  function commitSeek(seconds) {
    const request = ++seekRequest;
    previewSource = deck.audio.src;
    seekPreview = seconds;
    changed();
    // A requested marker is temporary feedback, never another advancing clock.
    // Reconcile to Audio after completion/failure; older replies cannot clear it.
    Promise.resolve(actions.seek(seconds)).finally(() => {
      if (request === seekRequest && !seekGesture) { seekPreview = null; changed(); }
    }).catch(() => {}); // The host/coordinator owns error reporting.
  }
  for (const surface of [overview, scrolling]) {
    surface.addEventListener('pointerdown', event => {
      if (event.target.closest('[data-waveform-control]')) return;
      if (comparisonBlocksSeeking(surface) || !canSeek() || seekGesture || !event.isPrimary || event.button !== 0) return;
      const vertical = surface === scrolling && getWaveformOrientation() === 'vertical';
      const axisLength = surface.getBoundingClientRect()[vertical ? 'height' : 'width'];
      if (!axisLength) return;
      event.preventDefault();
      surface.focus({ preventScroll: true });
      seekGesture = { id: event.pointerId, source: deck.audio.src, surface,
        vertical, anchorCoordinate: vertical ? event.clientY : event.clientX, anchorTime: seekPreview ?? deck.audio.currentTime, axisLength };
      surface.setPointerCapture(event.pointerId);
      previewSeek(seekGesture?.vertical ? event.clientY : event.clientX);
      window.addEventListener('blur', cancelSeekGesture);
      window.addEventListener('resize', cancelSeekGesture);
      seekRemoval = new MutationObserver(() => {
        if (!surface.isConnected || node.inert || surface.closest('[hidden]')) cancelSeekGesture();
      });
      seekRemoval.observe(document, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['hidden', 'inert', 'data-iphone-selected'] });
    });
    surface.addEventListener('pointermove', event => {
      if (seekGesture?.id !== event.pointerId || seekGesture.surface !== surface) return;
      if (!canSeek() || deck.audio.src !== seekGesture.source) { cancelSeekGesture(); return; }
      event.preventDefault();
      const coordinate = seekGesture.vertical ? event.clientY : event.clientX;
      if (surface === scrolling && Math.abs(coordinate - seekGesture.anchorCoordinate) >= 3) beginWaveformComparison(surface);
      previewSeek(coordinate);
    });
    surface.addEventListener('pointerup', event => {
      if (seekGesture?.id !== event.pointerId || seekGesture.surface !== surface) return;
      const allowed = canSeek() && deck.audio.src === seekGesture.source;
      if (allowed) previewSeek(seekGesture?.vertical ? event.clientY : event.clientX);
      const target = seekPreview;
      cancelSeekGesture();
      if (allowed) commitSeek(target);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) surface.addEventListener(type, event => {
      if (seekGesture?.id === event.pointerId && seekGesture.surface === surface) cancelSeekGesture();
    });
    surface.addEventListener('keydown', event => {
      if (event.target.closest('[data-waveform-control]') || comparisonBlocksSeeking(surface) || !canSeek()) return;
      const current = seekPreview ?? deck.audio.currentTime;
      const target = { ArrowLeft: current - 5, ArrowDown: current - 5,
        ArrowRight: current + 5, ArrowUp: current + 5, Home: 0, End: deck.audio.duration }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      commitSeek(Math.max(0, Math.min(deck.audio.duration, target)));
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelSeekGesture(); });
  document.addEventListener('tunetox-waveform-orientation-change', cancelSeekGesture);
  document.addEventListener('tunetox-waveform-zoom-change', cancelSeekGesture);
  return {
    canSeek,
    cancel: cancelSeekGesture,
    get position() {
      if (seekPreview !== null && (!deck.song || previewSource !== deck.audio.src)) seekPreview = null;
      return seekPreview ?? deck.audio.currentTime;
    },
    validate() {
      if (seekGesture && (!canSeek() || deck.audio.src !== seekGesture.source || !isVisible(seekGesture.surface))) cancelSeekGesture();
    }
  };
}
