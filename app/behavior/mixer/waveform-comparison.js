import { getWaveformOrientation } from '../settings.js';

// One transient gesture owner; registrations reference existing deck navigation.
// No playback positions or analysis are stored here. Presentation owns geometry.
const waveforms = new Map();
let active = null;
const eligible = entry => entry.navigation.workspace === 'performance-view' &&
  entry.navigation.upperView === 'wave-view' && !entry.node.inert && entry.surface.getClientRects().length > 0;

export function registerWaveformComparison(entry) {
  waveforms.set(entry.surface, entry);
}
export function comparisonBlocksSeeking(surface) {
  return Boolean(active && active.owner !== surface && waveforms.has(surface));
}
export function beginWaveformComparison(surface) {
  if (active || getWaveformOrientation() !== 'vertical' || !matchMedia('(orientation: landscape)').matches) return;
  const owner = waveforms.get(surface);
  if (!owner || !eligible(owner)) return;
  const participants = [...waveforms.values()].filter(eligible);
  const playheadY = owner.presentation.playheadY();
  active = { owner: surface, participants };
  for (const entry of participants) {
    // A second touch may already have grabbed a passive deck before expansion.
    // Cancel its preview, never its transport, before making it noninteractive.
    if (entry !== owner) entry.cancelSeek();
    entry.presentation.expand(playheadY, entry === owner);
  }
}
export function endWaveformComparison(surface) {
  if (!active || active.owner !== surface) return;
  const previous = active;
  active = null;
  for (const entry of previous.participants) entry.presentation.restore();
}
export function validateWaveformComparison() {
  if (!active) return;
  const owner = waveforms.get(active.owner);
  if (!eligible(owner)) { owner.cancelSeek(); return; }
  active.participants = active.participants.filter(entry => {
    if (eligible(entry)) return true;
    entry.presentation.restore();
    return false;
  });
}
