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
