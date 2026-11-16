# TuneTox Phase 1H H1 — compact Design Mode

Open **http://192.168.50.24:8765/development/design-mode/compact/?build=h1**
on the same Wi-Fi. Header: **TUNETOX — DESIGN MODE**, **H1 · NO AUDIO**.
G2 remains unchanged at `http://192.168.50.24:8766/performance-lifecycle?build=1g-g2`.

The current project-root preview server already serves H1. If it is stopped:

```sh
python3 development/design-mode/serve-preview.py --bind 0.0.0.0 --port 8765 --project-root
```

Do not start a second server on an occupied port. No deployment, dependency install,
service worker or changes to the live media server are required.

## Implemented presentation

- Four fixed deck identities: four columns on iPad landscape, **2×2 on phone portrait**.
  G2 currently shows a single selected deck on phones; H1 follows the new explicit
  2×2 request without changing G2 or the original Design Mode's variants.
- Compact top Tempo/Pitch touch pads: drag numbers vertically or use arrow keys.
  Tablet shows all four decks; phone shows the explicitly selected deck. Tap a deck's
  D1–D4 title or the header selector to choose it. Stable-width values; existing
  preview ranges remain Tempo **90–150 BPM / 0.5 step**, Pitch **±6 semitones / 0.1**.
  Existing delta-linked Beat/Tune preview matching is reused, not reimplemented.
  Pitch preview is not pitch-preserving time-stretch; no audio is processed.
- Beat Match, Tune Match and Handoff always stay above per-deck page navigation.
- Play/Main occupies a fixed **36 px** strip (same height as G2's matching row).
  Percentage labels have fixed width. All pages keep exactly the same strip position.
- First page button **Waveform ⇄ / Cue ⇄** toggles in place; returning from another
  page retains the last Waveform/Cue choice. This is Cue, not a song queue.
- Zoomed illustrative waveform moves beneath a stationary playhead while simulated
  playback runs. Full-song overview has a separate moving position indicator.
- Cue contains simulated hot cues, beat jumps, quantize toggle, held beat repeat
  and the existing simulated loop controls moved out of Controls.
- Controls contains four thick horizontal stem faders, Filter/High/Mid/Low knobs
  and three assignable effects. Existing vertical-drag, double-tap neutral and
  long-press/F2 effect assignment interactions are reused.
- Tablet Waveform and Controls share the same mounted stem controls; no duplicate
  stem state. Phone prioritizes waveform space and exposes stems in Controls.
- Existing shared library components retain per-deck Songs/Playlists/Links,
  search/scroll/selection, loading targets and Manage/link/membership navigation.
  All songs are clearly fictional examples; there is no access to G1 stored music.

## Layout laboratory

Tap **Design tools**. Header height, navigation height/spacing, matching row height,
Play/Main height, stem fader height, overview waveform share, Cue pad height, padding
and deck gaps update immediately. **Reset layout defaults** resets only presentation,
not songs, Main/stems, matching, EQ/FX, Cue or library state. Values are temporary and
are not saved. Controls remain separate from ordinary performance pages.

## Measured comparison

Chrome viewport emulation, default settings, CSS pixels. G2 measured without loading
music or initializing playback. H1 uses fictional metadata/illustrations.

| Viewport | G2 deck height / visible decks | H1 deck height / visible decks |
| --- | --- | --- |
| 1194×834 | 730 px / 4 | **720 px / 4** |
| 1024×768 | 664 px / 4 | **654 px / 4** |
| 390×844 | 650 px / 1 | **361 px / 4 (2×2)** |
| 320×568 | 386 px / 1 | **223 px / 4 (2×2)** |

Widths at 1194×834 remain 285.5 px per column, matching G2. H1 does not increase
deck height. Phone figures are a changed presentation, not a like-for-like
single-deck height reduction. Raw bounds are in [measurements.json](review/measurements.json)
and [comparison.json](review/comparison.json).

Review captures: [H1 iPad](review/h1-ipad.png),
[H1 mixed Library/Controls/Cue/Waveform](review/h1-mixed-ipad.png),
[H1 phone 2×2](review/h1-phone.png), [G2 baseline, unloaded](review/g2-ipad-baseline.png).
These are desktop Chrome screenshots, not physical Safari captures.

## Functional versus simulated

Functional UI: touch/keyboard values, matching-preview deltas, page switching,
layout adjustments, fictional library/Manage navigation and visual playback clock.
Everything musical is simulated: transport, waveforms, cues, repeat/loops, EQ/FX,
stems and Handoff. Handoff toggles are state previews, not the real allocator.
No audio-engine globals, media requests, decoding or IndexedDB opening occur.
No new audio scheduling, matching/DSP algorithms or production Cue rules are defined.

## Tests and space questions

- **41 H1 state checks and 70 served-page browser checks passed.** Original Design
  Mode **77 state checks and 1,084 browser checks passed unchanged**. G2 archive and
  all **190 pre-existing source/test/instruction files** were verified unchanged
  (the three master records received documentation appends). `git diff --check`
  passed. No remaining automated failures.
- Tested 1194×834, 1024×768, 390×844 and 320×568: four visible decks, fixed document,
  stable matching/transport/navigation, stable gain track geometry, header gestures,
  existing knob/effects interactions, independent views/library and Manage context,
  Cue hold/release, layout reset and actual no-audio/no-storage sentinels.
- Default tablet Controls fit without vertical scrolling. Phone **Controls, Cue and
  Library scroll only within their deck content area**, leaving performance rows
  stationary. Effects remain reachable with 44 px knobs at 320×568. No touch targets
  in the default performance rows/knobs were shrunk below 36 px / 44 px respectively.
- Phone 2×2 makes fader travel and labels much narrower than G2's single-deck view.
  Waveforms are also short at 320×568. Physical review should decide whether those
  compromises are acceptable. Extreme laboratory settings may further reduce the
  content area; Reset restores the checked defaults.
- Physical iPad/Safari touch comfort, gesture accuracy, safe-area/browser-chrome
  changes and preferences remain to verify; Chrome emulation does not prove them.

Run from repository root:

```sh
osascript -l JavaScript development/design-mode/compact/run-tests.js
osascript -l JavaScript development/design-mode/tests/run-tests.js
python3 development/design-mode/compact/browser-check.py
```

The browser script expects an isolated Chrome CDP session on port 9230 and closes
that test browser. The original Design Mode browser suite is unchanged.

## Isolation / rollback

New H1 files are contained here: entry HTML, compact CSS, state extension, header,
deck, design tools, host and focused tests/review captures. Existing shared Design
Mode modules are imported read-only; no original implementation was edited.
G2 source-only archive before H1: `../../playable/baselines/phase1g-g2.tar.gz`, SHA-256
`382b12b2fb9e99c9e517b6b837f3217997c1194b94d4fc3a96a4cf1f02fefb77`.
JSON records individual source hashes and the user's physical G2 verification.
Extract only into a fresh directory; HEAD alone excludes uncommitted source.

Stop at H1 physical design review. No live integration, audio tests/changes, sampler
redesign, BeatMatch development, persistent settings or future performance features.
