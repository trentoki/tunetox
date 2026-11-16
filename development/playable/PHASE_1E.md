# Phase 1E — initial approved UI integration P1

Open **http://192.168.50.24:8766/performance?build=1e-p1** on iPad Safari.
Header: TUNETOX — PLAYABLE 1E; badge P1 AUDIO; footer **1E P1**.
Existing M1 (/handoff-main), R1 presentation (/handoff), manual (/two-deck) and single
song (/) pages remain accessible. The server reads only the eight selected external
WAVs and explicitly allowlisted code/style assets. No upload, directory browsing,
arbitrary path serving, audio copies or public deployment.

## Preserved baseline / exact physical evidence

- R1 passed user physical two-deck authorization tests 1–6: zero protection, joining
  without premature normalization, bidirectional sharing, full-capacity and ceilings.
- LIVE MAIN M1 **appears to work correctly** in physical Safari testing, including
  Main adjustments. Do not upgrade this wording to an exhaustive pass.
- A small Flow jump remains an unresolved physical observation. Independent OFF
  combinations, four-deck handoff and extended stability were not explicitly confirmed.
- Before edits, M1 plus the approved UI was preserved in baselines/phase1d2-live-main-m1.tar.gz,
  with HEAD/per-file hashes in the adjacent JSON. Archive SHA-256:
  `6aaf3495dc5f2ee31f4a46bae067b0ec9e3e686d9658c0ca969dc3d7476872f5`.
  The archive is source only, 325,930 bytes, no music/research. Extract to a fresh
  directory using the baseline README procedure, not over later work.

## Connected vs inactive

Real native audio: library Load targets; Play/Pause in deck Waveform/Controls surfaces;
Main including phone vertical/Transition controls; Transients/Flow/Tune/Voice;
per-deck Handoff; elapsed/remaining time; actual allocation-derived fader values.
Stop/Release and requested/allocated/effective values, ownership, ceilings, context
state, output and per-path meters are available through Audio diagnostics.

Inactive: Beat/Tune Match, tempo/pitch processing, EQ, filter, effects, loops, sampler,
jog and scrubbing. Controls remain visible but disabled/inert with OFF labels; no fake
audio state changes. Waveform art retains its approved space and is labelled illustrative,
not decoded/scrolling audio. Playlist membership and user links are session-only UI
metadata; no persistence or song-audio linking is implemented. Unknown BPM/key are shown
as unknown, not guessed. Song loading uses only the prepared WAVs, never original AIFFs.

The two prepared songs can load into **any two of four persistent slots**. The initial
host refuses a third loaded deck; use Audio → Release before replacing a loaded song.
This bounds intentional decoded-buffer retention and is a test limit, not a product or
musical rule. Already-loaded same-song requests leave transport untouched. Main starts
at zero; Deck 1 coefficients start at 1, others at 0; Handoff starts OFF in this test
session. Loading never raises gains or authorizes audio. Adjust both Main and desired
stems explicitly. Two full songs retain ~582 MiB PCM at 44.1 kHz (~634 at 48 kHz), plus
browser/decode overhead; Release does not guarantee immediate native memory reclamation.

## Architecture and algorithm preservation

- playable-controller.js: one native mixer/action adapter; load validation, sequential
  native decoding and progress, two-slot resource guard, read-only UI audio projections.
- playable-app.js: mounts existing UI components once; navigation/shared library host,
  feature gates, actual status refresh, diagnostics dialog. No allocation math.
- performance.html, playable-namespace.js, playable-ui.css: standalone entry, shared
  presentation namespace, fixed-width value-label overrides only in this entry.
- serve-hypnotic.py: exact entry/UI asset additions; existing media allowlist unchanged.
- Original Design Mode sources and native/domain algorithm sources are byte-identical
  to the captured baseline (48 checked files). No production app.js/audio-controls
  mounting, second audio engine, DSP, allocator, scheduling, sampler or research edits.
- RULES §21 and existing Phase 1D.2/Phase 2B identifiers remain authoritative. The master
  verification/algorithm checklist is appended in TUNEFLOW_DESIGN.md with those IDs.

## Flow jump investigation

On the actual M1 page at 1194×834, its readout format caused Flow track widths:
0% 168.14 px; 9% 167.78; 10% 155.88; 99% 146.89; 100% 135.25. The layout shrank with
text length. This was measured without audio generation; it confirms a layout defect,
not that the original iPad observation had no audio consequence. A moving range track
can alter pointer-to-value mapping. Do not classify the physical issue visual-only.

P1 reserves five character widths for percentage outputs, using tabular numbers and
fixed track/container dimensions. Native mouse drags across 9/10 and 99/100 boundaries
kept the rectangle fixed (example x=21, y=641, width=271.5, height=44 px). Displayed,
committed and settled native gain values agreed. Phone touch Flow/Main and Transition
controls also passed. Values display rounded percentages; native ramps settle after
the existing 20 ms reservation plus 10 ms or conditional 20 ms transition. Automatic
peer fader motion is intentional allocation, not a layout error. Physical Safari
finger-drag/listening confirmation remains required.

## Exact first iPad retest

1. Close other audio test tabs, lower speaker volume, open the new URL and verify 1E P1.
2. In the leftmost column (Deck 1), choose Library, select Hypnotic, and tap load target
   **1** below its song list. Watch download/decode progress; it must not autoplay.
3. Choose Waveform. Zero Transients, Tune and Voice; leave Flow at 100%. Enable Handoff.
   Choose Controls, press Play, then gradually raise Main. Confirm actual sound and time.
4. In the second column, Library → select Cut Me Loose → load target **2**. In Waveform,
   zero the other three stems, enable Handoff, set Flow 50%. In Controls set Main 100%
   and Play. With Deck 1 Main/Flow explicitly authorized at 100%, expect 50/50 Flow.
5. Drag Deck 1 Flow to 80% and reverse with Deck 2. Track/label geometry must not move;
   peers should redistribute. Sweep Main in Controls; verify sound and coefficients.
6. Set a receiver Flow exactly zero, then lower the other deck's Flow/Main: zero must
   stay zero. Verify joining, authorization limits and ON/OFF preservation as in R1.
   OFF combinations beyond prior physical scope must be recorded as new tests, not
   assumed already passed. Independent sound can exceed the shared cap and clip.
7. Switch landscape layouts, phone deck selection/Controls/Transition/Library, and back.
   Songs, gains, positions and playing status must persist. On phone, stems remain in
   Waveform and Main in Controls/Transition. Inactive controls must not change sound.
8. Use Audio to capture diagnostics, Stop/reset position or Release a deck. Nonzero
   internal meters are not proof of speakers or absence of clicks/dropouts.

No real scrubbing, waveform rendering, effects, persistence or new musical behavior is
part of this build. Stop after physical review; do not proceed to further phases.

## Executed verification — P1

- **114 served UI/browser assertions passed** with both actual songs: load without
  authorization, aligned four-source starts, real transport/Main/Flow, authorization
  high-water and cap, both handoff directions, zero protection, preserved OFF toggle,
  failed-command rollback, fixed native-range drag rectangles, UI/committed/native
  agreement, all four landscape combinations and independent searches.
- Phone checks passed at **320×568, 390×844 and 430×932**: touch Flow and vertical Main,
  both Transition mains, native partner-deck mapping, reachable controls and no whole-
  page scrolling. iPad checks passed at **1194×834 and 1024×768**. Screenshots inspected.
- **22 adapter ownership/negative tests passed**, including lazy context creation,
  actual getters, no fake matching/effects, load/replace resource guards, no autoplay,
  safe rejection, alternative deck-slot identity, Stop/Release and cleanup.
- Existing audio runner: **44 passing result groups**, including the existing continuous
  Main/stem envelope and failure-protection suites. No algorithm source changes.
- Original Design Mode: **77 state checks and 1,084 browser checks passed unchanged**.
- Reference real-audio pages: **M1 35 checks, Phase 1C 37 checks, Phase 1B 14 checks**
  passed. Three expanded media/format/allowlist tests passed, including UI route and
  traversal/baseline/private-file rejection. `git diff --check` passed.
- M1 archive hashes verified. **48 baseline UI/native/domain source files** verified
  byte-identical, including original Design Mode scripts/styles/tests and audio algorithms.

Initial boot/testing caught a renamed namespace asset and a test-only missing clock
mock; both were corrected before the successful final checks. No remaining automated
failures. Existing osascript service-connection warnings still occur. Browser results
are Chrome, not Safari hardware tests; no physical P1 playback pass is claimed.

New/changed integration files: performance.html, playable-namespace.js,
playable-controller.js, playable-app.js, playable-ui.css and serve-hypnotic.py;
tests/playable-ui-browser-check.py, playable-ui-controller-tests.js,
run-playable-ui-controller-tests.js, and the expanded hypnotic-server-tests.py.
Documentation: RULES.md, TUNEFLOW_DESIGN.md, EXPERIMENTAL_AUDIO.md, PHASE_1D2.md,
this report and baselines source/hash records. Design Mode and audio algorithms are
not modified relative to the M1 baseline. No new dependencies, persistence, four-song
loading, actual waveform rendering or unrelated features were added.

### Phase 1F starting baseline — physical Phase 1E P1 result

The user confirmed initial P1 testing on iPad: both prepared songs loaded and stem
handoff worked through the integrated UI. This is not an exhaustive pass for four
decks, OFF combinations, Main-zero behavior or extended stability. The earlier Flow
layout fix has browser evidence; no separate physical drag-jump resolution is assumed.
P1 source/UI/test hashes and a reproducible archive are preserved under
`development/playable/baselines/phase1e-p1.*` before Phase 1F changes.
