# H5.2 — final UI refinement review build

**Open:** http://192.168.50.24:8765/development/design-mode/final-preview/?build=h52

Header: **H5.2 · NO AUDIO**. The user physically reviewed H5.1; H5.2 is a new
separate prototype awaiting review. All musical behavior here is simulated.
G2 audio, production storage/DSP/handoff, research and H1–H5.1 remain unchanged.

## Wave + Cue / Controls

Tablet has exactly two primary sliding positions: **Wave + Cue | Controls**.
Phone keeps colored-deck tap cycling and downward hold/slide selection, now with
three choices: **Wave + Cue, Controls, Transition**. There is no separate Cue view
or permanent phone mode selector. Successful loading selects Wave + Cue.

Wave + Cue retains the large moving zoom, stationary playhead and secondary
full-song overview. Eight cue pads replace the lower stem workspace, with Shift,
Repeat and looping on the compact lower action line. Controls retains the existing
EQ/filter/FX center and the **single** four-stem group in the lower workspace:
horizontal on tablet, vertical on phone. Stems remain the same objects/values and
endpoint-correct controls; they are not duplicated in Wave + Cue. The lower workspace
height adjustment now explicitly names both its cue and stem uses. Cue target size
remains an adaptive minimum; the workspace expands pads when space allows.

The 36px **Play / EMPTY–READY Swap / Main** transport remains directly available in
all performance views. Queueing, guarded occupied-slot behavior, Main/stem values,
matching participation previews, Library and independent orientation presets remain.
Library retains its intentional full-panel takeover and Return behavior.

## Approved cue contract implemented in the prototype

For a loaded deck, whether playing, paused or not yet started:

- Empty pad sets the **exact current preview position**, without quantization.
- Assigned pad jumps to that position, preserving playing/paused state.
- Held Shift + assigned pad deletes only that cue, without seeking or transport change.
- Held Shift + empty pad does nothing.
- Cue actions never delete, replace, consume or change the queued song.

Cue pads show their times; corresponding accent markers appear on the zoom within
the current ±6-second preview window. The decorative waveform is simulated, not
sample-accurate audio analysis. Cue state retains full numeric precision; pad labels
show milliseconds. Session-only cue sets are associated with the deck's current
song: queueing preserves current cues, swapping/loading another song uses that
song's cue set. This is in-memory demonstration state, not persistent cue storage.

Pad pointer actions commit on contact. Shift's captured pointer stays held while a
second finger contacts a pad. A later compatibility click cannot reinterpret deletion
as a jump/set after Shift release. Keyboard activation and Shift-modified keyboard
activation remain supported. Shift visibly highlights; assigned pads show a delete
indicator. No long-press deletion menu is used.

The old **Quantize cue preview** and **Follow BeatMatch** controls and their extra
rows are removed. BeatMatch, TuneMatch and Handoff remain in the same compact
matching popovers. This changes only preview cue semantics; no native matching,
beat-grid, handoff or DSP behavior is changed.

## Phone Transition

Transition fills the available performance workspace below the compact transport,
using the area previously reserved for the primary overview and lower cue/stem panel.
This is how it fits without scrolling; it is not squeezed into the old zoom rectangle.

Two **full-song**, side-by-side overview waveforms show the primary and partner
songs with moving position indicators. They are read-only: no scrubbing, seeking,
nudging or fast navigation. The right header selects the other deck: tap cycles,
vertical drag changes it, and keyboard arrows/Home/End are available. The partner
row is removed; partner selection survives leaving/returning without changing
positions or deck control values.

Each deck has the exact three-column arrangement:

1. Vertical Main.
2. High, Mid, Low EQ.
3. Filter, rectangular FX-type choice, FX amount.

All controls bind to the existing independent deck state. FX uses the same first
assignable slot as that deck's Controls view. Both decks remain visible together.
Knob targets stay **44×44px** down to the tested **320×480** viewport. At that reduced
height, the optional overview title line is hidden and knob labels/readouts share
one compact line, preserving touch sizes. Deck identity, overview, position and
all controls remain visible. Other views can still need inner scrolling at very
short heights; only Transition has the strict no-scroll layout requirement.

Transition Main reuses the proven rail/handle geometry but owns a separate captured
pointer surface. A native range's different touch inset had caused 0% to become 1%
after contact; native pointer adjustment is now excluded for these Main controls.
The range remains keyboard/focus accessible. Direct touch, keyboard and painted
0/100 endpoints agree, with the full handle visible. Existing stem logic is unchanged.

## Direct performance choices and Wave zones

FX type in Controls and Transition, partner selection and beat length share one small
vertical-choice component: upward drag selects later choices, downward earlier,
tap cycles, and keyboard alternatives remain. No native performance dropdowns or
white selection menus remain. Existing knob drags and neutral resets are reused.

Phone skip/nudge zones sit at the actual left/right waveform edges, vertically
centered. Tablet upper positioning is retained. The rest of the waveform scrubs;
**left drag advances, right drag rewinds**. Captured ownership prevents a scrub
crossing a zone from turning into a nudge. Zone presses highlight and do not scrub.
Beat length 1/2/4/8 uses a compact slide/tap choice rather than a dropdown, without
an extra row. H5.1's assumed preview beat clock, next-boundary integer skip and
labeled temporary ±5% nudge remain unchanged; this is not audio scheduling.

## Verification

See [verification](review/verification.json), [viewport measurements](review/measurements.json),
[real-clock Shift trace](review/live-cue-trace.json) and [preservation hashes](review/baseline-sha256.json).

Focused state checks cover both playback states, all four decks, exact cue placement,
queue independence, per-song session cue association, Swap, allowed views and endpoint
math. Served browser checks exercise real simultaneous touch contacts, including
**Shift released before the cue finger**, plus marker visibility, cue jumps, direct
sliding FX/beat/partner choices, Main endpoints, moving/read-only overviews and
no-scroll Transition fitting at 430×932, 390×844, 390×724, 375×667, 320×568 and 320×480.
Tablet checks cover 1194×834, 1024×768, 834×1194 and 768×1024.

The real-clock sequence loads a first song, starts it, queues a second, and deletes
a cue with two fingers while the first song continues playing. Queue and playback
remain unchanged. The test records actual pointer delivery/order, not just state
mutation. Its live phase uses a fresh CDP page to reset the emulated touch device
after the viewport/keyboard matrix; an earlier same-page attempt delivered no
pointer contacts. That was a test-fixture issue, not evidence of a cue algorithm fault.

No AudioContext or IndexedDB opens occurred. Prior Design Mode suites and preservation
checks are recorded separately. Automated Chrome results do **not** establish physical
Safari touch comfort, audio playback, native scheduling or production readiness.

Run state checks:
`osascript -l JavaScript development/design-mode/final-preview/run-tests.js`.
`browser-check.py` uses the existing LAN server and isolated Chrome CDP on port 9230.
Its deterministic clock is injected only for tests; the normal preview runs its own
33ms UI clock. No dependencies were added; fictional metadata stays local and text
is rendered through DOM text, with no external service integrations.

New implementation is isolated here: cue/state rules, deck composition, matching,
navigation, discrete choices, FX presentation, Wave adapter, Transition/Main adapter,
entry page, CSS and focused tests. Frozen H3–H5.1 factories, the clock, Library,
transport actions, endpoint geometry and presets are reused without editing them.
Root `RULES.md` / `TUNEFLOW_DESIGN.md` contain the new approved UI contract and
experimental implementation record. No production integration is authorized here.

## Screenshots and physical review

[Wave + Cue phone](review/h52-wave-cue-phone.png) · [Transition phone](review/h52-transition-phone.png) ·
[Transition 320×568](review/h52-transition-small.png) · [Transition 320×480](review/h52-transition-reduced-height.png) ·
[iPad landscape](review/h52-ipad-landscape.png) · [iPad portrait](review/h52-ipad-portrait.png) ·
[Library](review/h52-library.png)

1. Scrub while paused, set an empty cue, move away and jump back. Repeat while playing.
2. Queue another song, then hold Shift with one finger and delete a cue with another.
   Release Shift first; confirm no reactivation, seek or queue change. Shift+empty
   must do nothing. Try deliberate Swap separately.
3. Open phone Transition. Tap/slide its right header, check both read-only overview
   indicators and all three control columns. Try Main at both endpoints and FX type
   sliding. Review the shortest phone without internal scrolling.
4. Try edge-zone nudge/beat skips and slide the beat length; scrub centrally in both
   BeatMatch states. Confirm tablet has only Wave + Cue / Controls, and Library,
   matching, Main, cues and stem values survive navigation and rotation.

Stop for physical-device review. Do not connect this build to production audio.

Final results: **81 H5.2 state checks and 114 served-browser checks passed**.
Prior suites passed unchanged: H5.1 178 state/143 browser; H5 140 state/106 browser;
H4 77 state/106 browser; H3 38 state/74 browser; H2 44 inherited + 21 state/62 browser;
H1 41 state/70 browser; original Design Mode 77 state/1084 browser. Generated prior
review captures were redirected to `/tmp` to preserve their existing artifacts.
All **203 pre-task protected files** match their hashes, as do **190 G2 protected
files and its archive**. The three evolving root documents are excluded from the
historical G2 manifest comparison. No physical H5.2 Safari success is claimed yet.
