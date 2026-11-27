import { setAudioPlaybackRate } from '../../audio/deck-audio.js';

let nudgePercent = 2;
export const getNudgePercent = () => nudgePercent;

// Established tempo and temporary nudge remain distinct Behavior-owned values.
// Audio owns the effective rate and continuous source-time scheduling boundary.
export function applyDeckTempo(deck, establishedTempo = deck.tempoRatio) {
  return setAudioPlaybackRate(deck.audio, establishedTempo * (1 + deck.nudgeDirection * nudgePercent / 100));
}
export function setNudgeDirection(deck, direction) {
  if (![-1, 0, 1].includes(direction)) throw new RangeError('Nudge direction must be -1, 0 or 1.');
  if (deck.nudgeDirection === direction) return Promise.resolve();
  deck.nudgeDirection = direction;
  return applyDeckTempo(deck);
}
export function setNudgePercent(percent, decks = []) {
  if (!Number.isFinite(percent) || percent < 2 || percent > 50) throw new RangeError('Nudge must be 2–50 percent.');
  nudgePercent = Math.round(percent);
  return Promise.all(decks.filter(deck => deck.nudgeDirection).map(deck => applyDeckTempo(deck)));
}
