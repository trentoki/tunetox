import { getWaveformOrientation } from '../settings.js';
// Behavior owns overview/scrolling pointer interpretation and transient seek
// preview. Audio remains the only advancing source clock. Visual reads position.
export function connectWaveformSeeking({ deck, node, overview, scrolling, windowSeconds, actions, getBusy, isVisible, changed }) {
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
    changed();
  }
  function previewSeek(clientX) {
    const surface = seekGesture.surface;
    const rect = surface.getBoundingClientRect();
    previewSource = deck.audio.src;
    // Overview is absolute. The scrolling window is a grabbed piece of the same
    // source timeline: pulling it right moves backward, pulling left moves ahead.
    const seconds = surface === overview ? (clientX - rect.left) / rect.width * deck.audio.duration :
      seekGesture.anchorTime - (clientX - seekGesture.anchorX) / seekGesture.width * windowSeconds;
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
      if (!canSeek() || seekGesture || !event.isPrimary || event.button !== 0) return;
      const vertical = surface === scrolling && getWaveformOrientation() === 'vertical';
      const width = surface.getBoundingClientRect()[vertical ? 'height' : 'width'];
      if (!width) return;
      event.preventDefault();
      surface.focus({ preventScroll: true });
      seekGesture = { id: event.pointerId, source: deck.audio.src, surface,
        vertical, anchorX: vertical ? event.clientY : event.clientX, anchorTime: seekPreview ?? deck.audio.currentTime, width };
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
      previewSeek(seekGesture?.vertical ? event.clientY : event.clientX);
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
      if (event.target.closest('[data-waveform-control]') || !canSeek()) return;
      const current = seekPreview ?? deck.audio.currentTime;
      const target = { ArrowLeft: current - 5, ArrowDown: current - 5,
        ArrowRight: current + 5, ArrowUp: current + 5, Home: 0, End: deck.audio.duration }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      commitSeek(Math.max(0, Math.min(deck.audio.duration, target)));
    });
  }
  document.addEventListener('tunetox-waveform-orientation-change', cancelSeekGesture);
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
