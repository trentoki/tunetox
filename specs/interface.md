# Interface and Customization — Technical Specification

**Status:** Current implemented interface contracts are documented below. Detailed
extraction and reconciliation of the remaining historical design rules are pending.

**Scope:** Responsive views, cue controls and tested design interactions.

## Implemented scrolling waveform

The scrolling view uses a shared 1–8-source-second window (default 4) beneath a stationary centered
playhead. Its detailed minimum/maximum/RMS summary groups approximately 5 ms of
decoded audio, independently of the unchanged 360-column full-song overview.
Canvas renders only visible groups; requestAnimationFrame reads authoritative
Audio source timing. Tempo changes move the waveform faster without changing its
source-time shape or scale. See the [waveform analysis/rendering contract](waveform.md)
for data ownership, calculations, memory, animation and verification limits.

Both surfaces retain one shared seek preview and Behavior seek action. For a
scrolling drag, target source seconds = anchor source seconds - travel along the
effective time axis / gesture axis length × shared visible duration, clamped to the
song. Right/down moves backward; left/up moves forward.
A stationary tap does not jump. Preview updates both views and the time readout;
release commits while retaining playing/paused intent. Arrow keys still seek by
five seconds; Home/End reach the bounds. No BPM, zoom controls or audible scratching
behavior is introduced. Empty space outside the source bounds is intentional.

Pointer capture supports primary mouse/touch/pen, with deliberate pinch zoom
available. Cancellation, capture loss, source/view/theme change, blur, resize,
removal or hiding/inerting the active phone deck discards unfinished gestures.
Gesture anchors and renderer caches do not create another advancing playback state.
Deck colors, all three themes, overview cues, Queue and layout geometry remain.

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

## Scrolling waveform cue markers — approved refinement

The zoomable scrolling waveform displays passive numbered cue lines
using the same Behavior cuePositions as the overview. A line's percentage is
100 × (cue source seconds − (visible source position − 2)) / 4. This remains fixed
in source time, independent of Tempo/BPM. Lines outside [0,100]% are hidden.
The visible source position includes the existing seek preview. Cue removal and
song replacement hide corresponding markers immediately. Labels may shift inward
or apart at edges/coincident positions; lines remain anchored exactly. Marker color
uses the existing deck accent; the stationary white playhead remains above them.
These overlays have no pointer interaction, playback state or cue values of their own.

### D2 tablet portrait stem layout

At portrait widths 601–1100 CSS pixels, the same four stem inputs are vertical,
side by side, top=100%, within their existing allocated upper section. Landscape
remains horizontal; the existing <=600-pixel phone rules are unchanged. This is a
responsive layout condition, not platform detection or a second deck component.

### D2 isolated waveform orientation

Settings retains theme/color preferences and a global saved Horizontal/Vertical
choice (version-1 device-local settings). Horizontal is the default. Vertical
rotates only scrolling waveform drawing and cue geometry inside the original box;
forward playback moves upward through a centered horizontal playhead. Drag up seeks
forward; down seeks backward. Overview, four-second source window, nudge hit areas,
cues and lower sections remain. Settings is nonmodal and never changes transport.


### Global waveform zoom and tablet portrait orientation

The top strip provides Waveform Zoom out/in and visible source duration outside
Settings. One saved duration applies to all decks/orientations: 1–8 seconds in
0.5-second steps, default 4. Tablet portrait in the existing 601–1100-pixel layout
always shows horizontal waveforms; the saved orientation is retained for landscape.
This supersedes the earlier always-use-preference experiment in tablet portrait.
Waveform allocation and horizontal overview are unchanged. On phone widths the compact group omits the long visual label while retaining its
accessible name and duration/buttons, preserving the normal header height without
crowding deck controls. Very narrow screens may wrap. Physical device review remains necessary.
