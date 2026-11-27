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

## 2. Temporary landscape Vertical comparison (initial 0921da8 checkpoint)

The first experiment activates only in landscape Vertical mode after 3 CSS pixels
of scrolling-waveform movement. Horizontal and portrait seeking remain ordinary.
A tap, overview seek or nudge does not activate comparison. Participating views are
chosen at drag activation; Stems/Library are excluded. Newly opened Wave views wait
for the next gesture. Expansion reveals extra future audio downward, covering only
the existing lower performance area; it does not enlarge decks or the overview.
Playheads retain the owner's original screen height, and normal pixels/source-second
remain fixed. These are provisional presentation choices for physical evaluation.

### Responsibilities and data flow

- New Behavior `app/behavior/mixer/waveform-comparison.js` owns the transient owner,
  participation and passive-seek exclusion. It references existing navigation, not
  copied deck state. It directly asks Visual to expand/restore and cancels passive
  previews through existing seeking. No transport/analysis data is retained.
- Existing Behavior `waveform-seeking.js` still owns pointer capture, original seek
  anchor, preview and canonical seek action. It starts/ends comparison within that
  same lifecycle, including cancellation and hidden-document cleanup.
- New Visual `app/visual/waveform/expanded-comparison.js` owns temporary DOM geometry
  and restoration of inline styles/inert presentation. The same captured surface
  and canvas remain in the DOM. It receives the common playhead screen height.
- Existing Visual `scrolling-waveform.js` supplies shared presentation geometry and
  renders additional visible groups at the original scale; `scrolling-cue-markers.js`
  uses that same geometry with the existing authoritative cue array. Hidden/zero-size
  surfaces conceal cue lines until geometry is available.
- Existing Visual mixer `playback.js` connects the persistent views to those direct
  functions and validates eligibility during rendering. `playback.css` positions the
  temporary surface and conceals covered controls/time/nudges without changing layout
  state. Restoring removes only temporary presentation.
- Settings and Audio remain unchanged in this increment. Source clock, analysis,
  Queue, established tempo, gains and cue state have no comparison copies.

Behavior's existing preview is passed to the renderer/cues as before. Visual derives
pixels/second from the original axis length and one shared zoom preference, extending
the visible source range according to actual canvas height. Release restores normal
presentation and invokes the original seek action only for the owner. Cancel, lost
capture, blur, rotation/resize, zoom/orientation/theme change, hidden document, source
invalidation or owner navigation discards the preview and restores presentation.
A passive view leaving Wave mode is removed from comparison without a musical action.

### Readability and architectural review

The two new small files separate the concrete lifecycle decision from temporary DOM
presentation; neither is a playback layer, adapter or synchronization mechanism.
Registrations refer to the four persistent deck views. Renderer/cue geometry is shared
within the existing rendering module rather than introducing another file or zoom
state. All modified production files retain their existing responsibilities; the
new viewport handling in seeking directly concerns gesture cancellation. No Audio
files or vendored processing are modified. The existing broader Audio readability
review remains deferred. Physical Safari capture, restoration and visual usefulness
still require human testing; automated transport checks are not listening tests.

### Completed verification

- Increment 1 local checkpoint: `9f5edb3`.
- All eleven current suites have passing results: waveform comparison, waveform zoom,
  orientation, iPhone layout, nudging, Library interface, Library storage/management,
  Library analysis, Queue, Visual playback and Glass Hardware.
- Comparison checks cover 1/4/8-second scale/capture/alignment, added continuation
  cues, pre-existing passive seek cancellation, owner-only seek, release/cancel/lost
  capture, blur/resize/zoom/theme/navigation restoration, Stems/Library exclusion,
  Horizontal/portrait nonactivation, active/paused peers and unchanged Audio/analysis
  identities. Zoom tests now keep screen coordinates anchored to the pre-expansion
  rectangle, matching a physical pointer rather than recalculating its location.
- Browser-delivered native Chromium mouse and touch: expansion, uninterrupted capture,
  exact one-second seeks, release/restoration and touch cancellation passed across
  Default, Glass Hardware and Futuristic. Expanded screenshot inspected: aligned
  horizontal playheads, retained overview/header and covered lower controls.
- Initial phone suite caught zero-size hidden-deck cue geometry; corrected and rerun
  passed. Initial nudge Resume timeout passed on fresh rerun without changing Audio
  or nudge code. No unresolved automated failure remains; timing sensitivity noted.
- Editor diagnostics and Git whitespace checks passed. Tracked Audio files are
  unchanged from `bd6fade`. Original analysis research files remain excluded.
- HTTP localhost and existing LAN HTTPS both return 200. Physical iPad Safari,
  listening and comparison with actual music remain human verification tasks.

The three-pixel threshold, future-only downward continuation and landscape-Vertical
activation are provisional. Evaluate these on iPad before extending orientations or
changing comparison geometry. No push or upcoming musical features are included.

## Subsequent physical approval and extension

Both coloring and the initial comparison are physically approved. The later
full-deck increment supersedes the future-only/lower-area presentation described
above: see [current responsibilities and verification](D2-MANUAL-VOLUME-AND-FULL-DECK-COMPARISON.md).
The lifecycle, owner-only seek, original source scale and four-second default remain.
