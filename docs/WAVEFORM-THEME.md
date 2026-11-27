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
