import { setAudioPlaybackRate } from '../../audio/deck-audio.js';

// Established tempo and temporary nudge remain distinct Behavior-owned values.
// Audio owns the effective rate and continuous source-time scheduling boundary.
export function applyDeckTempo(deck, establishedTempo = deck.tempoRatio) {
  return setAudioPlaybackRate(deck.audio, establishedTempo * (1 + deck.nudgeDirection * deck.nudgePercent / 100));
}
export function setNudgeDirection(deck, direction) {
  if (![-1, 0, 1].includes(direction)) throw new RangeError('Nudge direction must be -1, 0 or 1.');
  if (deck.nudgeDirection === direction) return Promise.resolve();
  deck.nudgeDirection = direction;
  return applyDeckTempo(deck);
}
export function setNudgePercent(deck, percent) {
  if (!Number.isFinite(percent) || percent < 2 || percent > 50) throw new RangeError('Nudge must be 2–50 percent.');
  deck.nudgePercent = Math.round(percent);
  return deck.nudgeDirection ? applyDeckTempo(deck) : Promise.resolve();
}
