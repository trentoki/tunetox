# Experimental Waveform theme and shared nudging

Starts from `df0338e`; physical testing approves deck shades and full-deck comparison.
Keep Default, Glass Hardware and Futuristic. Four-second waveform zoom stays default.
No push; stop for physical iPad evaluation.

## Inspection and implementation decisions

Existing `theme-manager.js` selects a root theme attribute and stylesheet. One shared
`createPlaybackDeck` constructs controls once, and existing Behavior navigation owns
view choices. Audio is independent of theme selection. The experiment extends this
mechanism with scoped CSS and a small Visual deck-layout presenter, not a second deck
constructor. Controls and waveform canvas must keep their identities across switches.

## Increment 1 — global amount

- Behavior `mixer/nudging.js`: one authoritative session amount; computes rates from
  existing deck tempo/direction; changing the amount reapplies currently held decks.
- Behavior `mixer/deck.js`: removes the obsolete per-deck percentage property.
- Behavior `mixer/nudge-controls.js`: retains deck-local holds/cancellation; moves
  the existing percentage drag/key lifecycle into one global binding receiving the
  actual four deck references. No per-deck copies or synchronization system exists.
- Visual `waveform/nudge-controls.js`: renders directional pairs and one global
  spinbutton, inserted beside Waveform Zoom. Same 4-pixel/percent drag and keyboard
  bounds; amount is not persisted, preserving the requested startup default.
- Visual mixer `application.js`: connects the global binding once after Settings.
- Visual mixer `playback.css`: global placement and lighter directional backgrounds.
- `tests/nudging-tests.js`: shared amount, independent simultaneous directions,
  changing the amount during two held gestures and existing pitch/rate checks.

Flow: global gesture → shared Behavior amount → original per-deck rate action →
existing Audio processing. Direction release still restores only its own established
Tempo. Audio code, transport limits and human explanatory comments are unchanged.

Increment 1 checks: nudging, Visual Playback and full-deck comparison browser suites
passed. Amount changes during opposite simultaneous holds are checked; existing
real output pitch/rate, release/cancellation and transport checks remain. Editor
and whitespace checks passed. No Audio files changed. Physical Safari feel pending.

## Increment 2 — experimental Waveform theme

The proposed `app/visual/themes/waveform/` folder contains only `deck-layout.js`
and `theme.css`. No separate deck constructor, copied controls or Audio path exists.

- Visual `themes/theme-manager.js` adds the selectable theme to the existing
  stylesheet mechanism. Behavior `settings.js` accepts its saved theme identifier.
- Visual `themes/waveform/deck-layout.js` presents Behavior-supplied section flags
  using the existing elements. It reuses the upper selector and hides the lower one;
  there is no third selector or repeated set of controls.
- Visual `themes/waveform/theme.css` scopes every rule to this theme. The waveform
  fills the existing content area; side pads/faders and transparent Controls overlay
  share that area. Playhead centering uses the same renderer and CSS geometry.
- Behavior `mixer/deck-navigation.js` retains the old two section choices and owns
  one separate, mutually exclusive experimental configuration per deck. Its derived
  presentation keeps the waveform visible in every configuration. The existing
  upper-selector action cycles Cues → Stems → Controls only in this theme. The
  compact selector uses established relative pointer anchoring/capture, continuous
  32px vertical steps, cancellation and duplicate-click suppression. Up advances,
  down reverses; tap cycles; Up/Down keys select. Old theme choices remain intact.
- Behavior `mixer/waveform-seeking.js` rejects new pointer seeks outside the central
  44% of a Waveform theme surface. The visual boundary lines describe those same
  reserved side zones. Once captured, a central drag can continue anywhere normally.
- Visual mixer `playback.js` binds the same selector and supplies the existing
  elements to the theme presenter. Theme changes render current state after cancelling
  transient gestures; they do not load/seek Audio or rebuild anything. Animation and
  comparison use existing navigation visibility, which always includes the waveform
  in this theme. The same comparison lifecycle temporarily hides the overlays.

Cues occupy two pads in each corner-side group as requested; Shift and loop preview
controls remain at the bottom. Stems use two existing vertical faders on each side,
above/below the nudge area. Controls retains the existing Filter/EQ/effect previews,
with no new musical functionality. Header/overview remain in their existing slots;
only the selector slot narrows from 142px to 70px. The global zoom/colors remain
unchanged. Temporary comparison retains its original full-deck geometry and scale;
it is not a second permanent-waveform mode or a second gesture pathway.

Readability/architecture review: related section choices and selector interactions
remain together in Behavior navigation; theme CSS and presentation are together in
the requested theme folder. Presentation receives derived flags instead of deciding
navigation. No new playback state, analysis, adapters or synchronization layers.
No Audio files changed in either increment. Physical layout/touch usability of the
provisional side widths, pad positions and 32px selector travel requires evaluation.
Landscape Vertical is the initial evaluation target; portrait/phone layouts use the
same elements but have not received a dedicated Waveform design pass.

## Verification and remaining limits

All twelve browser suites have passing results: Waveform theme, comparison, zoom,
orientation, iPhone layout, nudging, Library interface, Library storage, Library
analysis, Queue, Visual Playback and Glass Hardware. Focused reruns cover saved
experimental theme reload, session-local 2% restart, nudge availability over Stems
and Controls, and phone layout after global header grouping. Layout measurements
for the original themes matched their pre-theme geometry at 1114×768, 768×1024 and
390×844, and exact theme roundtrips preserve their section layout. No Audio edits.

Native Chromium checks cover touch tap/continuous forward and reverse selector
movement, plus mouse/touch comparison capture, release, cancellation and one-second
seek distances in the new theme. Screenshots of Cues, Stems and Controls were
inspected. The time readout is separated from the bottom loop row; the global nudge
label/button is grouped directly beside Zoom rather than spaced across the header.
These last presentation corrections affect Visual nudge-controls/playback.css too.

The new files are only the two proposed Visual theme files, this report and the
focused theme browser test page/module. Existing tests and specifications retain
shared input/playback responsibilities. No new state/Audio layers, copied controls,
private assets or dependencies. Readability review found no unresolved responsibility
conflict introduced by this pass; the separate Audio readability task remains deferred.

Physical iPad Safari visual/touch usability, selector travel, side-zone widths,
legibility and performance with actual music remain unverified. Portrait/iPhone
Waveform layouts are provisional, with landscape Vertical the primary target.
Stem faders still retain levels without stem audio; Filter/EQ/effects and loop previews
retain their existing implementation status. No new musical functionality is implied.
No pushing or next musical task is included in this checkpoint.

## Physical feedback refinement after 1c674d4

Overall layout, compact selector, cues and stem interaction are provisionally
approved. This refinement supersedes the initial Waveform comparison/Controls layout.

### Responsibilities and decisions

- Visual `themes/futuristic/theme.css` now scopes its existing rules to either
  Futuristic or Waveform with `:is()`. Specificity for Futuristic is unchanged.
  Waveform imports this same stylesheet before its own overrides. Existing theme
  selection remains untouched; no copied Futuristic CSS or second switch exists.
- Behavior `mixer/vertical-roller.js` shares wheel eligibility between those two
  themes. It also owns the existing pitch travel preview value/listener; Visual no
  longer owns that directly relevant interaction state. Visual mixer `playback.js`
  renders the same wheel markings/readout and uses the same installed gestures.
- Pitch investigation: Waveform previously hid/disabled its input and only Futuristic
  enabled the roller. The prior Futuristic pitch wheel was already a UI-only travel
  preview (0–100%), not musical pitch. Waveform now exposes that same preview; no
  Audio pitch command, semitone mapping or independent pitch processing is added.
  Labels/tooltips continue to disclose that no sound change occurs.
- Behavior `mixer/waveform-comparison.js` rejects expansion starts for Waveform only.
  Existing seek preview/capture/central boundaries and release/cancellation are kept;
  Default/Glass/Futuristic retain their comparison lifecycle and presentation.
- Visual `themes/waveform/theme.css` owns marker extents, clean one-pixel playhead,
  vertical thumb centering, side Controls and the Shift-only presentation. No controls
  are recreated/reparented and no musical state changes. Scrolling cue lines use the
  same source-position offsets as before; only their cross-axis extent and clipping
  change. Labels stay inside the marked central 44%. Overview markers are untouched.

Control slots: Low/Mid EQ above the left nudge, High EQ below; Filter/Echo above the
right nudge, Reverb/Delay below. All existing preview status is retained. The old
wrapper groups use layout-only `display:contents` so existing controls occupy those
side slots. The central waveform remains unobstructed. Provisional Shift is compact
at bottom-left of the Cues side area, below pads 3/4 and away from the nudge. Other
loop-strip children are hidden only in this theme; their underlying DOM/Behavior
remains for existing themes. Future loop activation/length design stays undecided.

Vertical stem inputs retain their positions/orientation/0–100 values. Explicit
WebKit track width 6px, border 0 and 22px circular thumb use left margin -8px rather
than the previous right margin. This centers the thumb on the track's cross axis;
Mozilla styling is separate. Safari native rendering still needs physical checking.
No Audio, data, decoding, BPM, source clock, zoom or nudge processing is changed.

Audio already exposes `setAudioPitch` for finite semitones through the existing
Signalsmith processing. What is absent is an approved connected performance control,
range and Behavior state for that operation. The wheel preview percentage must not
be mistaken for semitones; this pass leaves the API and all Audio files unchanged.


Refinement verification: all twelve existing browser suites passed. Focused checks
verify stationary/visible controls through seeks in all three configurations, retained
central seek boundaries, thin bounded playhead/cue labels, Shift-only presentation,
relocated Shift clearing, wheel preview, side Controls spacing, saved theme and
playing theme switches without new Audio/canvas identities. Comparison regression
confirms expansion is retained in the original themes. Their measured layout matches
the previous snapshot in all nine theme/viewport combinations.

Screenshots were inspected for Cues, Stems and Controls with real decoded generated
pulse/tone recordings and frequency summaries visible, not decorative/empty waveforms.
Native Chromium mouse and touch capture/release/seek checks passed in every
configuration without hiding the header or other controls; both shared wheels respond
to native touch. Side knobs use 44px touch targets. Screenshot pixel measurements
of all sixteen stem faders at five levels (0/25/50/75/100%, 80 cases) found identical
thumb and track horizontal centers in Chromium. Safari-specific WebKit CSS is
implemented, but actual iPad native range rendering remains physical verification.
Editor diagnostics/whitespace checks passed. No Audio files or personal library data
are included. No new production files, duplicated controls or routing layers exist.

Remaining limitations: physical iPad Safari alignment, landscape spacing/legibility,
actual-music performance and listening need human confirmation. Portrait/phone
Waveform styling remains provisional. Pitch is preview-only; stem audio and existing
EQ/filter/effect/loop implementation status remain unchanged. Future loop controls
are deliberately undecided. The deferred Audio readability review stays separate.

## Refinement after physically approved 7b2edf1

Futuristic and Waveform are intended selectable layouts for version 1.0. Existing
Default/Glass/Futuristic remain available and unchanged in this pass. No release
version rename or new musical functionality is implied.

### Files, responsibilities and information flow

- Behavior `app/behavior/settings.js`: effective portrait orientation now honors the
  saved H/V preference in Waveform only. Theme changes recompute that presentation
  choice without overwriting the saved preference. Other themes retain tablet H.
- Visual `app/visual/settings.js`: updates the setting label/note to explain the
  exception; it owns no orientation decision or additional preference state.
- Visual `app/visual/themes/waveform/theme.css`: lays out evenly spaced, taller light
  cue pads; fixed bottom nudge pairs; extended vertical stems; left Filter/High/Mid/
  Low and two right effect slots. It defines flat line paint and portrait captions.
  The same existing DOM nodes, events and musical values are retained.
- Visual `app/visual/waveform/scrolling-waveform.js`: owns device-pixel paint alignment
  of the existing playhead, cached by dimensions/orientation/theme. Its small shared
  `pixelAlignedOffset` calculation is also used by the existing cue presenter. It
  changes no logical time-axis center, zoom, source position or analysis.
- Visual `app/visual/waveform/scrolling-cue-markers.js`: keeps source-exact percentages
  and numbering; passes only a final paint offset to the Waveform cue-line pseudo-
  element. The marker/label remains at its authoritative source coordinate. Other
  themes and full-song overview presentation are untouched.
- Existing `tests/waveform-theme-tests.js`: adds all-four-deck portrait H/V seeking,
  orientation preference/restoration, physical-pixel line edges, side-control
  bounds/nonoverlap, larger/light pad faces, bottom nudges and exact control order.

Flow remains saved preference → Behavior effective orientation → existing Visual
rendering, and Audio source position/Behavior cues → shared geometry → final paint.
No playback, cue, nudge or zoom state is copied. No new production files, controls,
adapters, Audio paths, decoding or analysis are introduced. Readability review keeps
paint calculations in the existing waveform folder and actual layout in theme CSS.
The separately deferred Audio readability task remains untouched.

### Paint investigation

Computed styling showed no live playhead shadow/filter/gradient/border or pseudo
ornament, but the line could land on a half-pixel edge. Aligning only that line also
revealed a coincident cue's fractional paint as a faint neighboring row. Final paint
uses the same device-pixel edge for both; a layout-offset pseudo-element avoids the
extra antialiasing seen with a fractional cue transform. Logical cue positions,
numbers, waveform geometry and seek calculations are not rounded. The painted line
center is within half a physical pixel of the original logical center. A screenshot
comparison hiding/showing playhead and cues found exactly one solid band (1 physical
pixel at DPR 1; 2 at DPR 2), including a coincident cue. This is Chromium evidence,
not a claim about untested physical Safari rendering.

### Provisional placement decisions

Bottom nudges reserve 44px of space, at the same left/right positions in every
configuration. Shift moves to the top-left Cues side area above pad 1, in a 30px
button; the cue grid begins at 34px. Four equal cue rows have 6px gaps and fill the
remaining space. Measured pad heights are about 103px landscape and 51px in the
768×1024 four-deck portrait layout, compared with the previous 44px. Unassigned faces
are light rubber, assigned faces use deck accent and active presses remain distinct.

Stems retain their two-per-side order, WebKit alignment and Behavior connections;
a 12px middle gap replaces the unused central nudge gap. Controls uses the existing
nodes with CSS visual ordering: Filter, High, Mid, Low. Portrait puts captions and
readouts beside 44px knobs so four rows fit without collisions. Echo and Reverb are
the two visible right slots; Delay remains hidden only here, not deleted. The
underlying preview controls/DOM order are retained for other themes. No effect-type
menu or processing behavior is invented. Future loop layout is still undecided.

### Verification

All twelve regression suites passed: Waveform theme, comparison, zoom, orientation,
iPhone, nudging, Library interface, Library storage, Library analysis, Queue, Visual
Playback and Glass Hardware. Exact original-theme geometry matches the prior
snapshot in nine theme/viewport combinations. Editor diagnostics and whitespace
checks pass. Tracked Audio is unchanged from `7b2edf1`.

Populated Cues/Stems/Controls screenshots were inspected in landscape and portrait
Vertical, plus portrait Horizontal, using decoded generated pulse/tone recordings.
All four decks and controls remain within their allocated areas. Native touch seeks
retain capture/scale and do not expand or hide the interface. Bottom nudge centers
are hit-testable in every configuration. Tests verify side-area isolation, cue
positioning, configuration changes and theme switching with existing sources/nodes
and playback retained. Existing percentage, cue/Shift and nudge operations are reused.

Remaining limitations: physical iPad Safari must confirm the clean paint, new cue
size, Shift position and portrait spacing/touch usability. Very small/phone Waveform
layouts remain provisional. No new listening or end-to-end latency claim is made;
existing pitch/stem/EQ/filter/effect implementation limitations remain unchanged.
No personal library data, audio files, exports, certificates or temporary proof
scripts/screenshots are committed. Stop for physical testing; no push.
