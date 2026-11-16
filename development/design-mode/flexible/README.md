# TuneTox Phase 1H H2 — flexible performance layout

Open **http://192.168.50.24:8765/development/design-mode/flexible/?build=h2**
on iPad Safari, same Wi-Fi. Header/title identify **H2 · NO AUDIO**.
H1 comparison remains `/development/design-mode/compact/?build=h1` on port 8765.
G2 remains `/performance-lifecycle?build=1g-g2` on port 8766. Neither was modified.

## Interaction changes

- Tap the larger **D1–D4** label for that deck's matching popover. BeatMatch,
  TuneMatch and Handoff toggle independently. Tiny B/T/H indicators show their
  enabled states. The overlay occupies no layout space; outside tap/focus closes
  it, Escape returns focus, and keyboard opening focuses its controls. Each deck
  owns its own menu state. Tapping another deck is also an outside tap.
- H1's Tempo/Pitch vertical-drag and keyboard controls, fixed-width values, ranges
  and simulated linked-delta semantics are imported unchanged.
- A compact full-song overview now sits **above** the horizontal zoomed waveform.
  One **Wave+Stems ⇄ / Cue ⇄** button changes the area below the overview.
  Waveform + Stems includes the four horizontal stem controls on every device;
  Cue replaces that combined area with hot-cue/loop/repeat/quantized-jump prototypes.
- There is exactly one overview and one stem group per deck. The overview and its
  moving position marker stay mounted in the same position in both modes. Play,
  Main, navigation and header remain stationary. The primary playhead remains
  stationary while the illustrative waveform scrolls during simulated playback.
- Controls keeps EQ/FX above stems aligned toward the bottom. The simpler arrangement
  is intentional: no separate Cue switch embedded in Controls. Its existing first
  page button returns to the last combined mode, then toggles that one mode.
- **Design tools → Show full-song overview on Controls** compares overview/no-overview
  without moving transport. Library organization, navigation, Manage, search and
  selection reuse the existing components. No sampler page was added.

## Design tools

H1's live layout controls and reset remain. The former matching-row dimension now
controls popover button size; it does not recreate a permanent row.
New controls adjust overview height, main waveform height, stem section height,
section spacing, and Controls-overview visibility. Cue pad height/spacing adjust
Cue density. Changes preview immediately and never reset musical/library state.

Default waveform height automatically fills the remaining area. Moving its height
slider activates an explicit pixel height; this may leave spare space or require
scrolling. Reset restores automatic fill. Stem section height cannot go below four
minimum-height faders; this constraint is stated in the tools. Settings are temporary.

## Geometry comparison

Default Chrome CSS-pixel measurements, same viewport and fictional example state.
"Usable area" is the vertical region below page navigation, including the overview,
waveform and stem/Cue area. It is not a claim that overflowing phone content is all
simultaneously visible. Raw bounds: [comparison.json](review/comparison.json).

| Viewport | H1 → H2 deck height | H1 → H2 usable area | H1 → H2 zoom height |
| --- | --- | --- | --- |
| 1194×834 | 720 → 720 | 563 → **590 (+27)** | 241.4 → **334** |
| 1024×768 | 654 → 654 | 497 → **524 (+27)** | 188.6 → **268** |
| 390×844 | 361 → 361 | 204 → **231 (+27)** | 135.2 → 80* |
| 320×568 | 223 → 223 | 66 → **93 (+27)** | 12 → 80* |

Removing the 36 px matching row, enlarging the name row by 12 px and removing one
3 px gap recovers **27 px per deck**. Tablet overview height is now 44 px rather
than H1's percentage-based ~99–113 px, further increasing zoom space. Transport
remains 36 px. Four tablet columns and phone portrait 2×2 identities are unchanged.

*H1 phone Waveform omitted stems. H2 pairs the waveform and stems in the same view;
its 80 px minimum waveform and full-size faders **scroll together below the pinned
overview**. All four stems cannot fit simultaneously on short phones. At 320×568,
the default 44 px overview leaves only a 46 px content window; reducing overview
height in Design tools helps, but does not remove that 2×2 tradeoff. Controls/Cue
also scroll independently as needed. No document scrolling or tiny replacement
faders were introduced. Physical phone comfort remains a review question.

Review images: [H2 default tablet](review/h2-ipad.png),
[H2 mixed pages + matching popover](review/h2-mixed-ipad.png),
[H2 phone](review/h2-phone.png). H1's [unchanged comparison](../compact/README.md)
retains its earlier arrangement and screenshots. These are desktop Chrome captures,
not physical iPad screenshots.

## Simulation and implementation boundary

All musical behavior is simulated. UI gestures, local preview values, matching
flags, example library navigation and layout controls work; there is no audio,
real handoff allocation, stem processing, EQ/FX DSP, real Cue scheduling or storage.
H2 loads no production engine or media and opens no IndexedDB database.

H1 header, state/actions, tools and host are imported read-only. `deck-base.js` is a
small H1 renderer derivative with one functional change: phone Waveform keeps its
stem group in place too. This avoids repeated DOM reparenting during gestures.
`flexible.js` adds the matching overlay, pinned overview, bottom-stem placement and
extra tool controls. CSS is local to this entry. No four separate applications,
state copies, new dependencies, audio/server changes or unrelated refactoring.

## Verification / preservation

- **62 H2 browser checks passed.** State tests passed **44 inherited H1 checks
  under H2's extended parameter set + 21 H2 checks**. Unmodified H1 passed its
  standalone **41 state / 70 browser checks**; original Design Mode passed
  **77 state / 1,084 browser checks**. No remaining automated failures.
- Covered: no-resize popovers, independent toggles/indicators, outside/Escape/keyboard
  focus, unchanged Tempo/Pitch drag, fixed overview/transport, one mode selector,
  bottom stems, optional overview, live dimensions/reset, library/Manage retention,
  all four viewport sizes, stable stem DOM and audio/storage request sentinels.
- H1 browser regression review outputs were redirected to /tmp so its comparison
  images and measurements were not overwritten. Existing source hashes are recorded
  in [baseline-sha256.json](review/baseline-sha256.json) and verified after testing.
- One test setup issue was corrected: expanded tools require scrolling before
  clicking Reset/Return. Complete Enter events were also needed for the keyboard
  automation. Final results do not hide unresolved source failures.

From repository root:

```sh
osascript -l JavaScript development/design-mode/flexible/run-tests.js
python3 development/design-mode/flexible/browser-check.py
```

Browser checks use the existing isolated Chrome CDP port 9230 helper and close the
test browser. Chrome geometry/interaction checks do not establish Safari touch
comfort, accessibility approval or real audio readiness. No new public deployment.
Stop at H2 for physical review; no live integration or other features.
