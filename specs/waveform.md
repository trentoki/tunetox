# Waveform analysis and rendering

## Ownership and modules

Audio owns immutable summaries for each accepted source. Behavior continues to
own transport decisions; neither waveform owns playback state. Source audio is
read-only and is neither normalized, rewritten nor uploaded by this analysis.

- [Overview analysis](../app/audio/waveform/overview-waveform.js) preserves the
  preceding 360-column minimum/maximum/RMS calculation and data shape exactly.
- [Scrolling analysis](../app/audio/waveform/scrolling-waveform.js) computes three
  Float32 arrays in consecutive groups of round(sample rate × .005) samples.
- [Overview rendering](../app/visual/waveform/overview-waveform.js) retains the
  existing full-song SVG and fixed visual gain.
- [Scrolling rendering](../app/visual/waveform/scrolling-waveform.js) draws only
  visible detailed groups to a canvas, with the same amplitude scale and frequency colors described below.
- The existing [Audio loader](../app/audio/deck-audio.js) analyzes decoded PCM
  before accepting a source, exposes read-only waveformPeaks and scrollingWaveform,
  and clears both on Eject. The existing Visual host refreshes on emptied as well
  as source metadata so canvas caches release old summaries. Queue candidate
  failures leave the outgoing data intact; source acceptance replaces both together.

The former app/audio/waveform-summary.js moved to the overview analysis module;
active imports are updated. Historical references identify the old location.
No new routing/coordinator layer or copied playback implementation is introduced.

## Detailed analysis

Each group retains the minimum and maximum sample over all channels; signs are
not averaged together, preserving opposite-polarity stereo peaks and single-sample
transients. RMS is sqrt(sum of squared samples / actual sample count across all
channels). The final partial group uses its actual denominator. There is no
per-group normalization, decimation before peak detection or retained PCM copy.
The group interval is samplesPerGroup / sampleRate (5.011 ms at 44.1 kHz with
221 samples, exactly 5 ms at 48 kHz with 240 samples). Duration/sample-rate metadata
travels with the arrays; waveform timing remains source seconds, independent of BPM.

Storage is 12 × ceil(source frames / samplesPerGroup) bytes, about 144 kB/minute
or 8.64 MB/hour per deck at exact 5 ms spacing, excluding decoded PCM/DSP memory.
The summaries do not make long-file playback memory negligible. Both analysis
passes currently run once on the main thread during source preparation; they are
outside the time-critical AudioWorklet. Loading analysis can still delay UI frames.

## Visible rendering and animation

At source position p and shared visible duration W (default 4 seconds), the window
is [p − W/2, p + W/2]. A group’s time-axis coordinate is
(group index × group seconds − window start) × time-axis CSS length / W. Its width
along that axis is group seconds × time-axis CSS length / W. The time axis is
canvas width in Horizontal and height in Vertical. These quantities never depend on BPM or
Tempo; increasing Tempo only advances Audio's p faster. The playhead stays at 50%.
Regions before zero/after the recording are blank, never repeated data.

The renderer visits floor(window start / group interval) through
ceil(window end / group interval), clamped to the summary array. This is roughly
800 groups at the default 4 seconds (200–1600 at 1–8 seconds), regardless of song length. Min/max peaks and RMS use two batched canvas
paths for accent-only fallback, or two colored rectangles per visible group. There
is no per-group DOM and no scan of off-screen groups. Native canvas clipping
handles partially visible boundary groups. ResizeObserver and devicePixelRatio
keep pixel dimensions appropriate; the canvas has no layout effect or hit surface.
The existing parent retains seek gestures, keyboard access and fixed dimensions.

Visible playing Wave views use requestAnimationFrame; each frame reads Audio's
currentTime again, then updates the canvas, overview and readout together. There
is no elapsed-frame integration, new transport timer or separate waveform clock.
Each deck has at most one pending frame. Frames stop for paused, hidden, inert,
removed, background-document, Stems or Library views. Existing Audio notifications,
view rendering, resize and visibility events reconcile paused/hidden transitions
and restart animation when needed. Hidden views retain operational decks but do
not draw. Renderer reference/position/color caches only skip duplicate painting;
they never feed seeks or advance time and are cleared when hidden or emptied.

Both waveforms retain the shared preview and guarded seek-on-release action.
Right drag moves backward and left moves forward at four seconds per window.
Keyboard steps remain unchanged. This is not continuous audible scratching.

## Verification and limits

The [detail checks](../tests/waveform-detail-tests.js) cover channel polarity,
single-sample boundary peaks, RMS, partial groups, 8/44.1/48 kHz grouping, unchanged
overview size, fixed source-time shape, visible-only drawing and one-hour summary
storage. Browser playback tests cover directional/cancelled/playing/paused seeks,
animation, cues, Tempo and Queue/source changes. Device and real-music performance
results are recorded in [Clean Playback](../docs/CLEAN_PLAYBACK.md).

Canvas antialiasing, display refresh and browser scheduling still affect visual
smoothness. A 5 ms group limits transient-position precision; this is not a
sample-accurate audio editor or beat grid. Physical Safari listening/touch,
sustained mobile memory/CPU and very long real recordings remain unverified.

## Provisional shared frequency energy (26 November 2026)

[Frequency analysis](../app/audio/analysis/frequency-energy.js) reads the same
original decoded samples once during load and returns three Float32 energy arrays:
low, mid, high. Each group has the detailed summary's samplesPerGroup and
groupSeconds; source time is index × groupSeconds. Values are mean-square sample
amplitudes averaged across all channels and the actual final group length. Opposite
stereo polarities do not cancel. These are source characteristics, unaffected by
Main, Tempo or future playback EQ. No BPM calculation is performed.

Bands use fourth-order Linkwitz-Riley filters: low-pass 200 Hz; high-pass 200 Hz
followed by low-pass 4,000 Hz; high-pass 4,000 Hz. Each edge is two Butterworth
biquads, Q = 1/√2. Filter state persists between groups and is independent for
each channel. Edges roll off gradually, with neighboring bands approximately equal
at crossover. This is energy classification, not stems, isolated instruments or
an exactly additive spectral partition. Filter startup/phase delay affects the
first samples and transient colors; no delay compensation or pre-roll is applied.
At sample rates ≤8 kHz High is zero; other cutoffs are clamped below Nyquist.

The async analysis yields approximately every 12 ms of work (checked every 64
groups); cancellation rejects without publishing partial data. Scheduling/individual
chunk duration is browser-dependent. All three arrays are accepted atomically with
the waveform/source and exposed through the existing audio.frequencyEnergy getter.
Failed Queue preparation retains outgoing summaries; Eject clears them. Future
BPM analysis can consume this shared object without decoding/filtering again.
No retained PCM copies or extra transport state are introduced. Extra summary
storage is 12 bytes per group, approximately 144 kB/minute or 8.64 MB/hour/deck.

Visual rotates accent HSL hue by 0°, 90°, 180°, preserving saturation/lightness.
Per-group mean-square energy fractions blend the three colors in RGB, quantized to
eighths into a 45-color palette rebuilt only when the accent changes. This blending
is visually approved for the scrolling waveform; overview appearance remains under evaluation. Near-silence uses the accent.
Each visible group draws the original signed peak silhouette and RMS body; geometry,
fixed source-time scale, centered playhead, overview and seek interactions are
unchanged. Only visible groups are visited; color draws two rectangles per group.

[Frequency tests](../tests/frequency-energy-tests.js) cover isolated 80/1,000/10,000 Hz
at 44.1/48 kHz, opposite polarity channels, crossover balance, silence, mixed tones,
pre-cancellation, shared-grid alignment, palette rotations and colored rendering.
Physical Safari appearance, listening and sustained mobile resource usage require
human evaluation; these checks do not establish a production performance guarantee.

## Overview frequency colors (26 November 2026)

Scrolling colors are visually approved, preserved in local checkpoint `ea66195`.
Both views now import [one shared color mapping](../app/visual/waveform/frequency-colors.js).
The original palette calculation is moved unchanged; energy quantization and silence
fallback are shared too. No second palette, decoding or frequency analysis exists.

`summarizeFrequencyEnergy(energy, columns)` aggregates the existing arrays using
sample-weighted overlaps with the overview's original integer sample boundaries.
For each column and band: sum(group mean-square × overlapping sample count) /
column sample count. Partial groups and the final short group are weighted by their
actual overlap. This approximates within-group energy as uniform; resolution is
still ~5 ms, not a new sample-level frequency measurement. Average energies first,
then map to color; never average already-quantized colors. Input arrays are read-only.

Overview rendering caches aggregated energy by the original energy object in a
WeakMap. Changing deck accent/theme reuses those column arrays; source replacement
uses the new source's arrays. Weak keys allow removed sources to be collected.
The SVG viewBox, rectangle count, x/y/width/height/opacity, original peaks and RMS,
playback indicator, cue overlays and absolute-seek actions remain unchanged.
Only the SVG rectangle fill changes. Source/accent changes rebuild the SVG; ordinary
playback updates only the existing indicator, without repeating aggregation.


## D2 global zoom refinement

The preceding four-second geometry now describes the default, not a fixed zoom.
Behavior Settings owns one saved duration (1–8 source seconds, 0.5-second steps).
Scrolling rendering, passive cue placement and relative dragging all read its
getter. Only visible summary groups are drawn; decoded summaries and frequency
energy are reused. Zoom does not alter waveform amplitude, tempo or playback time.

Tablet portrait (601–1100 CSS pixels) uses horizontal presentation in the original
three themes; Waveform now honors the saved H/V preference in portrait as well.
Landscape uses the saved orientation in every theme. The waveform occupies the same allocated box. Orientation
and zoom changes cancel uncommitted seek previews without seeking. See
[implementation and verification](../docs/D2-WAVEFORM-ZOOM.md).

## D2 shading and temporary comparison experiments

Both waveform views offer a saved shared coloring mode. Deck shades is the default
for this experiment: Low is a saturated deck hue, Mid mixes it 50% toward white,
High 95% toward white. Chromatic saturation is at least 75%, base lightness 35–50%;
neutral accents stay neutral. The established relative-energy blend and eighth-step
quantization are unchanged. Complementary hues remains selectable in Settings.
No Audio analysis, crossover, amplitude or BPM calculations change.

Initial expanded comparison is limited to landscape with effective Vertical
orientation. A scrolling seek movement of at least 3 CSS pixels activates it; a tap,
nudge gesture, overview seek, Horizontal or portrait drag does not. Behavior selects
currently visible Wave views at activation. Library and Stems views are excluded;
views opened later wait for the next comparison. Following physical approval of the initial comparison, participants now reveal
extra earlier and later audio across the complete deck interior rectangle. All
other deck elements, including the overview and header, are temporarily concealed
and their controls made inert. Original pixels per source second and playhead
screen height are retained. Comparison playheads align to the gesture owner's screen height.

The original surface/canvas stays in place in the DOM with its pointer capture.
Its temporary absolute position covers the deck interior without reparenting it;
header/lower controls are concealed and inert, and nudge controls/time text concealed.
Normal amplitude scale is retained even though the drawing surface now covers the
deck padding. The normal DOM layout remains allocated for exact restoration. Renderer and cue placement share
presentation geometry: start = source position − playhead offset / pixels per second;
visible duration = expanded axis length / pixels per second. Amplitude is unchanged.
The seek action retains its original pointer anchor and original axis length, so
expansion causes no discontinuity or new seek pathway. Passive scrolling surfaces
cannot initiate seeking, and existing passive seek previews are cancelled; their
Audio transport and authoritative source positions continue normally.

Release restores the normal UI and commits only the existing owner seek. Cancellation,
lost capture, blur, resize/rotation, hidden document, zoom/orientation/theme change,
source invalidation or owner navigation restores the UI without committing a stale
preview. A passive participant leaving Wave view is removed from the presentation.
No comparison playback state or analysis is created. See the
[experiment report](../docs/D2-WAVEFORM-EXPERIMENTS.md) for responsibilities and checks.


## Waveform clean-line painting

Waveform keeps source geometry independent of final pixel alignment. The original
rendered playhead could have a fractional device-pixel edge; a coincident cue painted
on a different fractional edge could leave a faint neighboring row. After inspecting
inherited backgrounds, borders, filters, shadows and pseudo-elements (none contributed
a remaining glow), the renderer now paints a flat line at a device-pixel-aligned edge.
Thickness is round(devicePixelRatio) physical pixels (at least one), approximately
one CSS pixel. Paint edge = round((surface origin + logical center − thickness/2)
× devicePixelRatio) / devicePixelRatio − surface origin. Logical source centers,
source-time window, cue values and seek calculations are not rounded.

Existing cue marker elements retain their exact percentage positions and labels.
Waveform alone paints the cue line through an offset pseudo-element using the same
pixel calculation. This avoids fractional transformed layers creating a secondary
row, without another cue store or changed source positions. The pixel helper lives
with existing Visual scrolling geometry; no analysis or Audio changes occur.
Other themes keep their existing line presentation and comparison behavior.
