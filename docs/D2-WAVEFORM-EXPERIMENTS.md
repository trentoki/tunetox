# D2 waveform shading and temporary comparison experiments

Starts from physically approved `bd6fade`; global zoom retains its four-second default.
Both increments are local experiments, with physical iPad evaluation still required.
Audio, crossover frequencies, analysis arrays, BPM and source files are unchanged.

## 1. Deck shades

Behavior Settings owns the saved `shades`/`hues` preference; missing/invalid values
use shades for this experiment. Visual Settings presents the choice. Both waveform
renderers use the same frequency palette and unchanged relative-energy fractions,
quantized to eighths as before. Overview aggregation still uses its existing cache.

Shading implementation choices: Low retains the deck hue, saturation at least 75%
for chromatic colors and lightness clamped to 35–50%; Mid mixes that base 50% toward
white; High mixes it 95% toward white. Neutral accents stay neutral. These provisional
endpoints make bass more concentrated in deck color and treble consistently pale.
No per-section normalization or automatic section/drop classification is introduced.
The prior +90°/+180° hue palette remains unchanged as the selectable alternative.

Files: Behavior `settings.js` validates/persists mode and notifies views; Visual
`settings.js` presents its select; Visual waveform `frequency-colors.js` builds both
palettes; `scrolling-waveform.js` and mixer `playback.js` include mode in draw caches;
`overview-waveform.js` accepts the same mode while retaining aggregation and geometry.
No new production files or analysis dependencies are added.

Frequency tests cover endpoints/monotonic lightening for multiple deck colors,
unchanged hue palette and overview geometry. Zoom browser tests cover default/mode
switching, four-deck canvas recoloring and saved preference reload alongside zoom.

Verification: Visual Playback and Waveform Zoom browser suites passed in Chromium,
including frequency tests, four-deck transports, seeking/cues/Queue, shared scales,
rotation and preference reload. Editor diagnostics were clear. Physical Safari
color evaluation remains pending. Readability review: no duplicate energy/state,
no Audio edits, and preference decisions remain in Behavior.
