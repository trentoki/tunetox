# H5.3.1 — touch and gesture stabilization

Open **http://192.168.50.24:8765/development/design-mode/touch-preview/?build=h531**
from the same Wi-Fi network. Header must read **H5.3.1 · NO AUDIO**. This is a
separate simulated Design Mode build, not a production/audio integration.
H5.3's physical visual review is recorded; this build still needs device review.

## Changes, without a layout redesign

- Each continuous knob/fader owns its initiating pointer until up/cancel/lost capture.
  Another pointer can control another surface, but cannot steal that held control.
  Window blur/hidden-document cleanup releases continuous-control ownership.
- Knobs retain their existing vertical-drag math and model-neutral double-tap reset.
  Nudge pointers no longer release merely because another control takes focus.
- Main and stem faders use pointer-owned surfaces, preserving the 24px handle and
  original endpoint mapping. An invisible 4px expansion on each side improves
  acquisition where surrounding clipping permits. Track touches work; touches near
  the handle preserve the grip offset instead of making an acquisition jump.
  Native range inputs remain focusable and keyboard-accessible. Transport Main
  retains its existing visible range appearance and uses the same deck callback.
- Zoom prevention combines viewport configuration, `touch-action`, overscroll rules,
  scoped non-passive Safari gesture handlers and multi-touch browser-default guards.
  Noneditable labels disable selection/callouts. Search fields remain editable and
  selectable; single-finger Library swipes still scroll independently. No blanket
  single-touch cancellation or root `touch-action:none` is used.
- FX: quick tap cycles once with no picker. Hold **280ms**, slide and release selects
  from the existing deck-colored body portal. Amount knobs remain independent.
  A held picker survives another finger adjusting a knob. Cancel commits nothing.
  **Enter/Space** cycles; **Arrow Down** opens choices; arrows, Enter, Escape and Tab
  operate/dismiss the picker. Partner selection keeps H5.3's separate tap/hold policy.

All song, cue, queue, matching, stem, Main and performance values still live in the
existing simulated model. No storage, DSP, audio engine, production allocator,
research, dependency, layout-dimension or phone-landscape changes were made.

## Files and responsibilities

- `index.html`: separate entry/build marker; imports frozen earlier state/layout modules.
- `ownership.js`: transient pointer/control ownership and cancellation.
- `performance-controls.js`, `knob-reset.js`: local copies with pointer-safe knob handling.
- `faders.js`: shared pointer-owned fader surfaces, original geometry/model actions.
- `browser-guards.js`, `touch.css`: scoped browser gesture/selection policy and invisible hits.
- `popover.js`, `effects.js`: local themed FX tap/hold policy; partner API remains compatible.
- `overview-nudge.js`: independent held pointers survive unrelated focus changes.
- `run-tests.js`, `state-checks.js`, `browser-check.py`, `touch-check.py`,
  `geometry-check.py`: focused checks plus inherited H5.3 regressions.
- Root `RULES.md`, `TUNEFLOW_DESIGN.md`: appended prototype/verification context only.

## Verification

State runner: `osascript -l JavaScript development/design-mode/touch-preview/run-tests.js`.
Browser runners use installed Chrome with CDP on port 9230 and the existing 8765 LAN
server, following the earlier preview runners. No new dependency is required.

Executed:

- **102 state checks**, including all 90 H5.3 checks and ownership negative cases.
- **109 served-page browser regressions**, retaining H5.3 layout/navigation scenarios
  with the intentionally revised FX tap semantics; keyboard/hold opens the picker.
- **48 focused multi-touch/gesture checks** using actual CDP touch contacts, plus
  targeted synthetic Safari gesture cancellation. Two knobs on one/different decks,
  Main+EQ, two Transition Mains, two stems, background second touch, independent
  nudges, cancel/lost capture, double-tap reset, touch FX tap/hold/cancel, keyboard
  activation, editable search and real Library finger scrolling are exercised.
- **16 direct geometry comparisons** with frozen H5.3 (0.1px tolerance). Visible deck,
  workspace, transport, knob and custom-fader rectangles match at 1194×834, 834×1194,
  390×844, 375×667, 320×568 and 320×480, for the applicable views.
- Unchanged H1–H5.3 state suites pass. Unchanged browser suites pass:
  H1 **70**, H2 **62**, H3 **74**, H4 **106**, H5 **106**, H5.1 **143**, H5.2 **114**,
  H5.3 **108**. Their generated artifacts were redirected to `/tmp`, preserving the
  historical screenshots/reports.
- **254 pre-task files** unchanged by SHA-256; **190 protected G2 files** and its archive
  match the G2 manifest. Historical document exceptions are listed in `review/preservation.json`.
  Existing unrelated working-tree changes were preserved; no commit/reset was performed.

Browser regressions assert no AudioContext creation, storage opening or script errors.
`review/` contains measurements, verification records, preservation hashes and screenshots.
This evidence establishes simulated UI behavior in desktop Chrome, not Safari device
reliability, physical sound, accessibility approval or production readiness.

## Safari limits and physical review

Safari can override viewport zoom restrictions for accessibility. WebKit specifically
[documents that viewport scale restrictions alone are insufficient](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/).
The scoped gesture handlers follow Apple's
[Safari event documentation](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html).
These primary references explain the layered strategy; they do not certify iPadOS 26
behavior. OS accessibility magnification and browser-controlled text-entry UI cannot
be guaranteed suppressed. We do not continuously force viewport scale or disable focus.

On physical iPhone and iPad Safari:

1. Open the URL and confirm **H5.3.1 · NO AUDIO** (reload if necessary).
2. In Controls, drag two EQ knobs, then Main+EQ. Add a finger on empty background;
   the original drag should continue without page movement, zoom or text selection.
3. In phone Transition, move both Main faders simultaneously from track/handle to
   0%/100%; hold both overview nudges and release separately. Check partner selection.
4. Double-tap a knob to neutral; try background double-taps and a missed-control pinch.
   Check both portrait phone sizes and iPad Controls without layout movement.
5. FX tap should cycle immediately without a menu. Hold briefly, slide to another
   choice and release: exactly one selection, with amount unchanged. Try another
   knob with the other finger while holding the picker.
6. Scroll Library song rows and Manage content; search, select/edit text, dismiss the
   keyboard and return. Cue deletion must not affect Queue/Swap.

Report any Safari zoom/callout/cancellation path that remains. Stop for physical review;
no production integration, sampler, additional features or layout redesign is included.
