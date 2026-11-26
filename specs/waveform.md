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
  visible detailed groups to a canvas, with the same amplitude scale and accent.
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

At source position p, the window is [p − 2, p + 2] seconds. Group x is
(group index × group seconds − window start) × canvas CSS width / 4. Its width
is group seconds × canvas CSS width / 4. These quantities never depend on BPM or
Tempo; increasing Tempo only advances Audio's p faster. The playhead stays at 50%.
Regions before zero/after the recording are blank, never repeated data.

The renderer visits floor(window start / group interval) through
ceil(window end / group interval), clamped to the summary array. This is roughly
800 groups regardless of song length. Min/max peaks and RMS use two batched canvas
paths, no per-group DOM, and no scan of off-screen groups. Native canvas clipping
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
