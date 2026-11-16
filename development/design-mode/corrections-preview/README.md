# H5.1 — correction review build

**Open:** http://192.168.50.24:8765/development/design-mode/corrections-preview/?build=h51

Header identifies **H5.1 · NO AUDIO**. All behavior remains simulated. G2 audio,
production storage, research and H1–H5 are unchanged. The user physically reviewed
H5; its successful portions remain the base, with the reported corrections below.

## Corrections

- **Transport:** one 36px row with Play, a 44px EMPTY/READY queue button and the
  original shared native Main slider. No queue title/artist panel, no additional
  queue row. READY deliberately swaps and starts the queued song; EMPTY is inert.
  Main is directly available in all performance views on both devices. The approved
  full-panel Library still temporarily replaces the performance workspace.
- **Load route:** one explicit simulated action validates the destination/song,
  checks playing state and guards an occupied queue before changing anything.
  Playing loads change only the queued ID and destination's Wave presentation;
  current song, position, playing flag, Main and stems are preserved. Empty or
  loaded-but-nonplaying decks load without autoplay. Swap inherits levels and consumes
  the queue. Repeating the same queued selection is idempotent; a different occupied
  entry is rejected rather than overwritten.
- **Tablet:** Wave/Cue/Controls only, with H4 orientation presets and expanded
  center layouts. Transition is neither offered nor accepted on tablet. Resizing
  a phone Transition workspace into a tablet layout shows Controls; song, transport,
  gains and partner choice are retained. No extra Main/Transition header in Controls.
- **Phone navigation:** no permanent mode badge/selector beside the song. A tap on
  the selected colored deck button cycles Wave→Cue→Controls→Transition→Wave. Tapping
  another deck selects it without cycling. A downward movement over 12px opens the
  existing vertical menu; highlight commits on release. A stationary hold of 450ms
  or longer does not accidentally cycle. Cancel does not commit. Enter/Space can
  activate the same deck buttons; Arrow Down opens the menu and Escape closes it.
  The current mode remains subtle text inside each colored deck button.
- **Wave:** adaptive zones overlay the upper left/right of the moving waveform,
  highlight when pressed and consume no layout row. BeatMatch ON retains the compact
  1/2/4/8-beat distance control and next-boundary preview scheduling. OFF retains held
  ±5% temporary nudging, released/cancelled back to the unchanged tempo value.
  Lower-wave scrubbing owns its pointer even when crossing a zone. Zone/step-control
  interactions cannot start scrubbing. LEFT drag now advances; RIGHT drag rewinds.
  The moving waveform, overview, stationary playhead and deck position indicators
  remain. The lower scrub surface and zone controls retain separate keyboard roles.
- **Stem endpoints:** explicit DOM rails/24px handles replace reliance on native
  thumb painting. The native range remains the accessible input with full track
  touch coverage and at least 44px phone hit width. For length L, handle centers
  travel from 12 to L−12; the rail endpoints use the same geometry. Vertical direction
  is inverted, horizontal is not. Input mapping uses that exact 24px visual diameter,
  so numeric 0/100, painted endpoints and touch endpoints agree. The full handle
  stays visible, and pointer capture prevents drifting into a neighboring stem.
  Keyboard changes update the same state and rendering. Horizontal tablet / vertical
  phone arrangements, permanent stem placement and dimension tools remain.

H5 Library slide sorting, direction arrow, Manage/membership workflow, SVG Back and
Settings icons, selection backgrounds and independent scrolling remain frozen imports.
No production handoff, quantization, DSP or audio lifecycle behavior changed.

## Queue regression evidence and uncertainty

The explicit first-load → Play → second-load sequence was exercised using the **real
preview clock**, through Library buttons rather than direct state mutation. H5.1
kept the first song playing, its position advancing and its gains intact; READY
appeared. Third-song load was rejected while occupied. Swap started the queued song
at zero with inherited levels. A 10ms observer sampled no false playing flag during
loading; this is programmatic preview evidence, not audible playback verification.

The same real-clock sequence also passed against **unchanged H5**. Therefore the
reported physical H5 replacement/pause has **not been reproduced or causally explained**.
H5.1 makes its load route explicit and adds focused regression coverage; it does not
claim a proven root-cause repair of an unobserved failure. Retest that sequence on
physical Safari, using the H5.1 identifier, before calling it resolved.

## Verification / compromises

State checks include inherited H4/H5 behavior, playing-load/occupied-queue/Swap cases,
phone-only Transition guards, and round-trip endpoint math for both axes. Served-page
browser checks exercise actual touch gestures, long holds, Main track interaction,
zone ownership, next-boundary timing, both scrub directions, endpoint bounds and
captured drift. Tablet/phone sizes: 1194×834, 1024×768, 834×1194, 768×1024,
390×844, 390×724, 375×667 and 320×568.

Short phones still need inner scrolling in dense Cue/Controls/Transition content.
The page, transport, overview and stems remain fixed. Phone Main's track is compact
at 320px but remains reachable; physical ergonomics are pending. Safe-area/visible-
viewport code and independent phone/tablet presets are unchanged imports. Beat-grid
and timing logic remain H5's assumed, uniform preview clock, not real audio analysis
or scheduling. ±5% remains a labeled prototype amount, not a production rule.

Run state checks:
`osascript -l JavaScript development/design-mode/corrections-preview/run-tests.js`.
Browser checks use `browser-check.py` with isolated Chrome CDP on port 9230, the LAN
served page and a deterministic clock for boundary math, followed by the normal
preview timer for queue verification. AudioContext/IndexedDB instrumentation verifies
neither is initialized. Native audio regressions are not claimed for this UI task.

[Verification](review/verification.json) · [Measurements](review/measurements.json) ·
[Pre-task preservation hashes](review/baseline-sha256.json)

[Phone](review/h51-phone.png) · [Small phone](review/h51-phone-small.png) ·
[Phone endpoint](review/h51-endpoints-phone.png) · [Queue READY](review/h51-queue-ready.png) ·
[iPad landscape](review/h51-ipad-landscape.png) · [iPad portrait](review/h51-ipad-portrait.png)

All implementation is new under this directory: corrected deck, navigation, Wave,
stem geometry, load guard, host, CSS and entry page, plus focused tests. Unchanged
H3/H4/H5 state, clock, Library, presets, icons, controls and Transition components are
reused. No dependencies, remote services, audio imports or persistent data were added.
Root documentation received the H5.1 experiment record only; existing unrelated work
was preserved.

## Physical retest

1. Check H5.1 in the header. Load a first example, press Play, then load another
   into that same deck. Confirm the original title/wave keeps moving and READY
   appears, with Main/stems unchanged. Try a third load; it must not overwrite.
2. Tap READY: queued song starts with inherited stems. Test Main directly in Wave,
   Cue, Controls and phone Transition; confirm the row stays compact.
3. Tap the selected phone deck to cycle; tap another to select; hold/slide down and
   release on a mode. Try a long stationary hold without changing modes.
4. Drag the lower wave left/right, then use each upper zone with BeatMatch OFF/ON.
   Check highlight, release restoration, step choices and pending-beat execution.
5. Set every stem to 0%/100% and inspect both ends; drag slightly sideways. Rotate
   iPad and confirm no Transition access and unchanged Cue/Controls proportions.

Stop for physical review. Do not integrate into G2.

Pointer activation is handled once on pointer-up (deck navigation) or pointer-down
(Wave zones). Native click handlers are reserved for keyboard/assistive activation;
delayed pointer compatibility clicks are ignored. Focused tests inject delayed clicks
to guard against double-cycling and duplicate beat skips. This does not replace the
requested physical iOS Safari gesture review.

Final results: **178 state checks and 143 served-browser checks passed**. Preserved
suites passed: H5 140 state/106 browser; H4 77 state/106 browser; H3 38 state/74
browser; H2 44 inherited + 21 state/62 browser; H1 41 state/70 browser; original
Design Mode 77 state/1084 browser. Prior generated captures were redirected to `/tmp`.
All **182 pre-task files**, **190 G2 protected files and the G2 archive** match
preservation hashes. The three evolving root documents are excluded from the
historical G2 manifest comparison. Physical H5.1 Safari review remains pending.
