# H5.3 — portrait refinement review

**Open:** http://192.168.50.24:8765/development/design-mode/portrait-preview/?build=h53

Header: **H5.3 · NO AUDIO**. H5.2 was physically reviewed; H5.3 is a separate,
simulated correction build. H1–H5.2, production/G2 audio, storage, DSP, handoff and
beat analysis are untouched. The completed section 6 supplied in chat is included
in the transport behavior below. No phone landscape or sampler redesign was made.

## Corrections

**iPad Controls lock.** Controls is an unscrollable clipped workspace with scoped
pan suppression; knobs, faders and selectors still receive their pointer gestures.
Library remains independently scrollable. Its scrolling was checked with actual
emulated touch, not only scrollTop assignment. Main transport, matching and presets
remain the existing components. On the tight 768×1024 portrait defaults only,
Tempo/Pitch height adapts to 40px, the overview to 24px and gaps to 2px, keeping the
44px knobs visible rather than hiding overflow. Larger iPad defaults keep the
approved arrangement with a small inner-padding correction. Preset values remain
independent; extreme experimental dimensions are not a guarantee of a usable fit.

**FX popovers.** Tap a selector to open; tap an effect to choose. Hold for 220ms,
or begin a deliberate vertical slide, to reveal the same choices, slide to highlight
and release to commit. Selection does not change until commit. The closed selector
shows the selected effect and its amount knob remains independent. Transition's FX
selector is 40px high. The original Echo/Reverb/Delay/Chorus/Flanger/None assignments
and per-deck values are reused; no new audio effects were implemented.

One dark, accent-colored body-level portal sits outside locked Controls containers
and is clamped to the visible viewport. It does not move the underlying panel or
get clipped by it. Context/visibility changes dismiss stale choices, preventing an
old selection from targeting a different deck. Keyboard Enter/Space opens; arrows,
Home/End, Enter, Escape and Tab provide direct access/dismissal. Accessible FX labels
identify the current deck. No native white dropdowns are used. Normal tap deliberately
opens rather than cycling; selecting is a separate tap on a choice.

**Phone Transition.** Both approved three-column strips remain:
Main | High/Mid/Low | Filter/FX type/FX amount. No extra partner row is present.
The central portion of the right full-song overview now selects its partner: tap
cycles other decks, hold/vertical slide reveals a themed selector, release commits.
The primary deck is excluded. The selected partner survives view changes; selection
does not seek or change playback state. Each overview carries an in-wave deck label,
song title, entire-song graphic and moving position indicator. These remain overviews,
not zoomed/scrubbable waveforms.

**Independent overview edge nudges.** Each overview has its own 36px-wide edge zones
and captured pointer ownership. With BeatMatch off, hold left/right to apply the
same labeled ±5% temporary preview nudge used by Wave; release/cancel/blur restores
the original rate without changing Tempo. Both decks can be nudged independently,
including opposite directions simultaneously. A gesture keeps its original target
if the partner/view changes, and clears its old nudge. With BeatMatch on, the same
existing per-deck next-beat skip scheduler/distance is used; no new grid is introduced.
Markers stay visible above the active deck-colored highlights. Central partner
selection never triggers an edge nudge; edge contact never cycles the partner.
Left overview center remains inert; neither overview supports seeking/scrubbing.

**Reclaimed redundant transport Main.** In phone Transition only, the existing
transport Main is hidden and the existing Play/Queue buttons form a narrow stack
beside taller paired overviews. This merges the redundant transport-Main space
into the waveform/nudge workspace, without an extra row or duplicated controls.
Both per-deck mixer Main faders remain visible and use the endpoint-correct H5.2
mapping. All Main views use the same deck.volume value. Outside Transition,
Wave + Cue / Controls and all iPad layouts retain the original compact
Play / EMPTY–READY Swap / Main row unchanged.

## Retained behavior

H5.2 cue placement, playing/paused cue jumps, Shift deletion and queue independence,
Wave scrubbing direction, stem endpoints, matching popovers, Library navigation /
Manage / slide sorting / icons, beat-distance choice, colored-deck navigation and
session-only presets are reused unchanged. Audio remains entirely simulated. No
persistence, external services, audio analysis, native scheduling or production
beatmatching behavior has been added.

## Verification and limitations

[Verification](review/verification.json) · [Measurements](review/measurements.json) ·
[Partner touch trace](review/partner-gesture-trace.json) · [Preservation hashes](review/baseline-sha256.json)

Focused checks cover panel locking under touch/wheel/programmatic attempts, continued
knob/FX gestures, Library touch scrolling, FX tap/hold/keyboard selection and visible
portal bounds, partner-only central contact, opposite simultaneous nudges, restored
rates and unchanged tempo values, established beat skips, both Main endpoints,
restored outside-Transition transport and cue/queue isolation.

The partner-gesture test caught an inherited `.h1-app button` touch-action rule
winning the cascade, producing pointercancel during vertical movement. A scoped
`.h53-app .h53-choice` rule fixes that source-level ownership without blocking Library
scrolling or suppressing genuine cancellation. No allocator or audio guard was altered.

Tablet: 1194×834, 1024×768, 834×1194, 768×1024. Phone Transition: 390×844,
375×667, 320×568, 320×480. At the shortest size, H5.2's compact readouts are retained;
both decks/44px knobs remain visible without internal scrolling. Popup overlays
intentionally cover underlying controls temporarily. The narrower waveform centers
are still separate from edge zones; physical Safari hit comfort needs review.

Chrome automation is not physical Safari or audible-audio verification. Native audio
regressions are not claimed from this UI task; protected source/archive hashes are
checked separately. No dependencies were installed. Fictional metadata remains local
and is rendered as text. The portal handles only validated local choices, not remote
HTML or service integration.

Run state checks:
`osascript -l JavaScript development/design-mode/portrait-preview/run-tests.js`.
`browser-check.py` targets the served LAN page through an isolated Chrome CDP session
on port 9230, with a deterministic preview clock for nudge/beat assertions. Normal
preview uses the unchanged H5 clock. AudioContext/IndexedDB instrumentation catches
unintended initialization; neither is part of this build.

New source here: `popover.js`, `effects.js`, `overview-nudge.js`, the focused Transition
adapter, scoped CSS and entry page, plus tests. H5.2 deck, cue, navigation, Main mapping,
Wave, Library, clock and state modules remain frozen imports. Root `RULES.md` and
`TUNEFLOW_DESIGN.md` receive only the H5.3 implementation/approval record.

## Screenshots / physical review

[iPad portrait](review/h53-ipad-portrait.png) · [iPad landscape](review/h53-ipad-landscape.png) ·
[Tablet FX popover](review/h53-fx-popover-ipad.png) · [Phone FX popover](review/h53-fx-popover-phone.png) ·
[Transition FX popover](review/h53-fx-popover-transition.png) · [Partner popover](review/h53-partner-popover.png) ·
[Both nudges active](review/h53-nudges-active.png) · [Phone Transition](review/h53-transition-phone.png) ·
[320×568 Transition](review/h53-transition-small.png) · [320×480 Transition](review/h53-transition-reduced-height.png)

1. On iPad Controls, drag blank space and each control: the panel must stay fixed.
   Open Library and confirm its list still scrolls normally.
2. Try FX tap→option, then hold→slide→release, on tablet, phone Controls and Transition.
   Confirm the popover is unclipped and FX amount does not change with type selection.
3. In Transition, tap the right waveform center to cycle, or hold/slide to select.
   Confirm edges nudge rather than selecting a partner; try opposite nudges together.
4. Review Play/Queue beside the taller overviews, both Main endpoints and both mixer
   strips on a short phone. Return to Wave + Cue / Controls and confirm normal Main,
   cues, queue and saved values remain.

Stop for physical-device review. Do not begin production audio integration.

Final results: **90 H5.3 state checks and 108 served-browser checks passed**.
Preserved suites passed: H5.2 81 state/114 browser; H5.1 178 state/143 browser;
H5 140 state/106 browser; H4 77 state/106 browser; H3 38 state/74 browser;
H2 44 inherited + 21 state/62 browser; H1 41 state/70 browser; original Design Mode
77 state/1084 browser. Prior generated captures were redirected to `/tmp`.
All **230 pre-task files** match preservation hashes, as do **190 G2 protected files
and its archive**. The three evolving root documents are excluded from the historical
G2 manifest comparison. H5.3 physical Safari verification remains pending.
