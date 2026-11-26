# Interface and Customization — Technical Specification

**Status:** Current implemented interface contracts are documented below. Detailed
extraction and reconciliation of the remaining historical design rules are pending.

**Scope:** Responsive views, cue controls and tested design interactions.

## Implemented scrolling waveform

All four shared deck components draw the existing Audio-owned decoded 360-column
minimum/maximum/RMS summary in both their overview and scrolling SVGs. No new
Audio/Behavior module or PCM copy is introduced. Each scrolling playhead stays at
50% of its existing window. Visual moves the SVG viewBox beneath it: at source
position `p` and duration `d`, its left coordinate is `(p - 10) / d * 360` and its
width is `20 / d * 360`. The initial implementation therefore shows 20 source
seconds, centered on the same source position used by the overview and time
readout. Empty space before zero/after duration is intentional; no repeated or
invented audio is drawn. The time window is an implementation choice for review,
not an approved zoom-control design. Former decorative plus/minus placeholders
are removed without changing the container geometry.

The existing 50 ms Audio timeupdate notifications move the viewBox; they do not
rebuild bars. Rendering reuses bar nodes until the Audio summary changes on
Load/Queue/Eject. Tempo changes naturally alter scrolling speed through the source
clock. Cue recalls and Queue swaps update both windows from that same timing and
summary reference. Deck accent colors, themes and view/layout ownership are unchanged.

Both waveform surfaces share one pointer/keyboard seek implementation and one
temporary preview per deck. For scrolling drags, `target = anchor source seconds -
(pointer x - anchor x) / gesture width * 20`, clamped to the source bounds. A
stationary tap does not jump to the point under the finger; the center is the
grabbed source coordinate. Dragging previews both waveforms and the time readout;
release commits through the existing guarded Behavior seek. Actual audio continues
at its current position until release. Playing/paused intent follows existing
seek rules, including paused-at-end. Keyboard arrows seek by five seconds and
Home/End reach the bounds on either surface.

Pointer capture supports primary mouse/touch/pen input. Deliberate pinch zoom
remains available while single-finger page pan is disabled on these surfaces.
Cancellation, lost capture, source change, view/theme change, blur, resize, removal
or hiding/inerting the active phone deck discards unfinished gestures. The stored
anchor and preview are gesture feedback, not a second advancing playback state.

Limits: the reused summary has only 360 columns for the whole song, so long tracks
show coarse blocks at this scale. Detail extraction, zoom controls, beat grids,
continuous audible scratching and sample-accurate alignment are not implemented.
Rendering follows the 50 ms clock notifications rather than a new animation timer.
Physical Safari touch/listening and sustained long-file performance still require
device verification.

## iPhone single-deck layout

**Review status:** Provisionally accepted for the development checkpoint; visual
refinement remains necessary. This is not final visual or release approval and
does not establish physical Safari touch or listening verification.

The shared host mounts the same four deck components and calls the Visual-only
`installDeckSelector` afterward. [Phone navigation](../app/visual/iphone/deck-selector.js)
receives only the mounted deck container, never Behavior/Audio objects or actions.
[Phone CSS](../app/visual/iphone/layout.css) hides unselected decks without removing
or rebuilding them. Hidden phone decks are inert for keyboard/accessibility input;
all decks regain input when the tablet layout returns. Audio continues independently.
Shared controls, library/workspace selections and the three themes are reused.

Implementation choices for physical review (not new musical rules):

- Phone mode uses width at most 600 CSS pixels, or a coarse-pointer viewport at
  most 1000 pixels wide and 500 pixels high for phone landscape. CSS and navigation
  use the same media query. This is a viewport rule, not device-name detection;
  sufficiently narrow tablet split views also use the compact layout.
- Deck 1 is initially selected. Selection and transition expansion are temporary
  Visual state retained through rotation/resizing, not saved preferences.
- Tabs use standard tablist keyboard arrows/Home/End, selected state and roving
  focus. The separate transition handle supports tap/Enter/Space and a vertical
  release displacement of at least 24 CSS pixels, larger than horizontal travel.
  Down opens, up closes. Cancellation, lost capture, blur and resize abandon an
  unfinished gesture. Swipes start only on the handle, never the deck tabs.
- The collapsed handle is 28 pixels high; tabs are 34 pixels high. The empty
  expanded panel is at most 110 pixels or 18dvh. No musical controls, allocation,
  matching, Handoff or transition actions are connected.
- Native stem inputs use vertical writing mode with 100% at the top and 0% below;
  existing names, values, 1% steps, theme materials and shared input actions remain.
  Vertical drags adjust the fader; horizontal pan and deliberate pinch remain
  allowed. Tablet stem orientation and CSS are unchanged.
- Global Load/theme controls wrap only in phone mode to fit the viewport. No
  existing controls are removed. Short landscape phones use one global-control
  row and scroll the performance workspace vertically, including its header, so
  native stem inputs can be brought fully into view. Other viewports retain the
  existing fixed deck header and content scrolling.

The dedicated [phone browser checks](../tests/iphone-layout-tests.html) use real
generated-file playback to verify hidden transports, cues, queues and control
retention, plus theme/resize navigation. Physical Safari touch and listening are
separate verification; Chromium touch emulation does not establish device success.

## Functional cue pads and overview markers

All themes present the same Behavior-owned eight cue positions. Empty pads save
the actual Audio position; assigned pads recall through the existing seek action.
Shift click latches clearing mode; holding the same on-screen Shift control (or
keyboard Shift) clears without latching after use. Pads require a loaded song.
The old theme-only visual assignment behavior is superseded, not retained alongside
the functional implementation. Pad materials, deck colors and layout remain intact.

The overview contains a passive `cue-markers` layer with `cue-marker` lines and
small numbers (`data-cue-number`); pad identities remain `data-cue="1"`–`"8"`.
Line position is cue source seconds / duration × 100%, clamped to the window.
Number labels are kept inside the edges at zero/end. The marker layer and all
children have pointer-events none and remain above the glass/playhead while the
playhead advances. Markers rebuild from Behavior on assignment/deletion/song
changes; they are not maintained by the playback clock. The scrolling waveform
above shares the same seek position. See [cue state/lifecycle contract](controls-settings.md#implemented-song-cues).

## Implemented overview seeking

The existing full-song `waveform-overview` is a keyboard-focusable position slider
when a song with positive duration is available. All themes use the same Visual
handlers and deck-bound Behavior action. Pointer x maps linearly to source seconds,
clamped to 0–duration. Tap/click commits on release. During drag, only the marker,
time readout and accessibility value preview the target; Audio is not scrubbed on
every move. Release invokes the existing seek API, then the display reconciles to
Audio on completion/failure. This preview never advances its own clock.

Primary mouse/touch/pen uses pointer capture. Single-finger page panning is disabled
on the overview (`pinch-zoom` remains available). Pointer cancellation/lost capture,
blur, removal, workspace changes and theme changes discard an unfinished gesture.
Left/Down and Right/Up seek by five source seconds; Home/End select the boundaries.
The Futuristic cover remains noninteractive. Other controls cannot trigger seeking.
Load/Play/Pause/queue operations block new seeks; an active seek batch accepts the
latest new target. Empty/loading decks are not seek targets. Physical iPad seeking
and audible transition quality still require verification; sample accuracy is not claimed.

## Current approved performance layout

Futuristic is an optional Visual theme. Only in that theme, the existing Tempo
range uses a full-surface vertical pointer-captured drag; its approved logarithmic
range and Behavior action are unchanged. Its matching **Pitch demo** roller is
Visual-only travel (0–100%, initially 50%), not pitch units or an Audio action.
Default/Glass keep their existing Tempo interaction and disabled Pitch display.
The shared cue presentation now reads Behavior-owned song positions in every
theme; the earlier theme-only preview is superseded by functional cues.

Touch/viewport safeguard: the new entry retains deliberate pinch zoom, uses a bounded dynamic-viewport shell, and adds targeted second-tap handling for Safari versions with WebKit bug 319664. Native scrolling and dragging remain unblocked. See [gesture contract and verification limits](../docs/CLEAN_PLAYBACK.md#scope-and-limitations). This supersedes the earlier CSS-only assumption; physical iPad verification is outstanding.

The new [Clean Playback entry](../tunetox.html) uses a persistent performance header and two independent sections per deck. [APPROVED-NAMING.md](../docs/visual-verification/APPROVED-NAMING.md) specifies the current names and hierarchy.

- Upper: Wave (scrolling waveform and playback time) or Stems (four existing faders).
- Lower: Cues (pads and loop controls) or Controls (filter, EQ and effects).
- Defaults: Wave + Cues in the Performance workspace for all four decks.
- Each component owns only its two presentation selections and workspace. Changing one section cannot modify the other section, another deck, deck behavior, or audio state.
- Library round trips preserve both selections. View nodes and audio transport identities remain persistent; visibility changes use the existing hidden attribute contract.
- Two keyboard-operable toggle buttons share the original compact performance-header selector slot. performance-upper-toggle switches Wave/Stems; performance-lower-toggle switches Cues/Controls. Their visible labels show the current view; aria-pressed is true for Stems or Controls. There are no selector rows inside either content section and no added header height.
- Original child control names, data-cue, data-frequency-band and data-stem identities remain unchanged. Main Volume is now active at 0% startup with a live percentage; its caption reserves the prior 100% caption width to preserve the fader geometry. Tempo is active in its existing header slot via a transparent native range over the numeric display: 0.5×–2.0× with logarithmic mapping and unity exactly centered. Its display is a ratio, not an invented BPM. Musical Pitch stays disabled; Futuristic alone provides the Visual-only travel demo described above. Stem faders are permanent native range controls (0–100%, 1% steps) backed by Behavior stemLevels; stem audio remains disconnected. Cue pads now assign/recall real song positions; other unfinished musical controls remain inactive. See [control contracts](controls-settings.md).

The Version 1 PDF and its annotated screenshots record the preceding combined layout. Preserve them as historical styling references. The editable guide begins with a current-layout addendum; its original pages are explicitly historical. Playback behavior and audio modules are unchanged by this interface task.

The approved product-level requirements are in [RULES.md](../RULES.md). The full pre-consolidation technical and historical record is preserved in [legacy-rules.md](legacy-rules.md). Before implementing or changing this subsystem, extract its relevant approved details from that record, distinguish superseded experiments and unresolved mechanics, and synchronize code comments and tests. Do not invent missing decisions.
