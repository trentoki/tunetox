# Phase 1H H3 — physical review build

Open on the same Wi-Fi: **http://192.168.50.24:8765/development/design-mode/fixed/?build=h3**

Design Mode only: example songs, simulated playback and controls. No AudioContext,
production allocator, IndexedDB, real quantization or audio integration is started.
H1 (`../compact/`), H2 (`../flexible/`) and G2 playable routes remain comparison builds.

## Interaction

- Tablet: four compact columns. Phone portrait: one full-width deck, selected with
  Deck 1–4 buttons; all four deck objects and simulated playback remain alive.
- Beside the song title, tap **Wave / Cue / Controls**, or hold and slide continuously
  across them. Changes happen during the gesture, not on release; ends clamp.
  Keyboard arrows, Home/End and ordinary button activation are also supported.
- All modes occupy one fixed central region. Overview, transport, Main, local
  Tempo/Pitch and the single permanently mounted four-fader stem section stay fixed.
- Cue: eight pads in two rows, looping, held Repeat and held Shift. Shift + Cue
  deletes a preview cue; tapping an empty pad sets it. No saved cue data is changed.
- D1–D4 opens the matching popover with independent indicators/toggles. Its secondary
  cue-timing preview follows BeatMatch by default, can be disabled, or returned to
  Follow BeatMatch. This explores an idea, not a production quantization rule.
- **Library** beside Tempo/Pitch takes over the full deck workspace, including
  transport and stems. **Performance** returns to the previous mode. Playback,
  song/search/navigation state survive; the shared browser retains Manage/loading.
- Design tools adjust overview, center, stems, cue density, headers, selector and
  transport spacing. **Reset to H3 defaults** resets dimensions, not deck values.

## Space comparison (CSS pixels at defaults)

| Viewport | H2 deck height | H3 deck height | H3 visible decks | H3 center |
| --- | ---: | ---: | ---: | ---: |
| 1194×834 | 720 | 528 | 4 | 168 |
| 1024×768 | 654 | 528 | 4 | 168 |
| 390×844 | 361 | 528 | 1 | 168 |
| 320×568 | 223 | 446 | 1 | 86 |

H2 phone displayed four half-width decks; its phone heights are not like-for-like
usable-area comparisons. H3 gives one deck 380px width at 390px (310px at 320px).
Overview is 40px; four stems occupy 176px, each fader row 44px. Tablet H2 allocated
334/268px to zoom at the two tested sizes; H3 deliberately starts with a smaller
168px center and leaves background below compact panels. Increase central height
in Design tools to use that space. Library independently expands to the full usable
height. See [measurements](review/measurements.json).

Tradeoffs: the 320×568 center contracts to 86px to keep all four stems visible.
Cue/Controls use inner scrolling when their content exceeds the center; the page
and fixed performance rows do not scroll. Narrow tablet titles truncate beside the
selector. Physical Safari ergonomics and continuous gesture feel still need review.
There is no actual scrolling audio waveform or scrub behavior.

## Verification

- H3: 38 state checks; 74 served-browser checks at 1194×834, 1024×768, 390×844,
  375×667 and 320×568.
- Native Chrome touch dispatch verified Wave→Cue→Controls→Wave before lifting,
  reversed direction, clamped endpoints, retained capture and unchanged fixed rows.
  Short-phone held touch was also checked. [Event trace](review/slide-trace.json).
  Test moves allow 25ms for browser event processing; this is not a Safari latency
  measurement or physical-device verification.
- Constructor instrumentation found no audio context or storage opens.
- Preserved comparison regressions and source hash checks are recorded alongside
  this report. No G2 audio tests are claimed from this UI-only run.

[Tablet mixed modes](review/h3-mixed-ipad.png) · [Tablet Wave](review/h3-ipad.png) ·
[Phone](review/h3-phone.png) · [Short phone](review/h3-phone-small.png)

New implementation modules: `state.js`, `selector.js`, `matching.js`, `deck.js`,
`layout.js`, `fixed.css`, `index.html`; focused checks in `state-checks.js`,
`run-tests.js`, `browser-check.py`. Existing shared factories are reused unchanged.

Physical review: slide back/forth without lifting on iPad and iPhone; compare the
fixed faders in all modes; try Shift+Cue; open Library and Return during simulated
playback; switch phone decks; check short-screen center scrolling and Design tool
adjustments. Stop here before audio integration or further layout experiments.

Preserved regressions: H1 41 state / 70 browser checks; H2 44 inherited + 21 H2
state / 62 browser checks; original Design Mode 77 state / 1084 browser checks.
All passed. Generated comparison-test captures were redirected to `/tmp` so H1/H2
review artifacts remain unchanged. All 111 pre-task protected files match their
hashes. G2's archive and 190 protected files also match (the three evolving root
documents excluded from the historical G2 manifest comparison). Evidence:
[verification](review/verification.json), [pre-task hashes](review/baseline-sha256.json).
