# Phase 1F F3 — first-Play correction

**Experimental; physical F3 verification pending.**
Open http://192.168.50.24:8766/performance-first-play?build=1f-f3
on the same Wi-Fi. Confirm **F3 AUDIO / 1F F3**.
F2 remains at `/performance-incremental?build=1f-f2` with its original behavior.

## Physical F2 baseline

User confirms the 1%-to-50% gesture jump is resolved, smooth three/four-deck
incremental history-aware handoff, manual-zero protection, independent categories,
and first-held-touch priority. No clicks or dropouts were observed during that test.
This does not certify extended stability or all lifecycle combinations. A possible
first-Play redistribution was observed but not reliably reproduced on the iPad.

Before edits, F2 source/tests/UI/docs were archived in
`baselines/phase1f-f2.tar.gz`, SHA-256
`708f8663267c90c61d0b78be8fe66c254186ceb34aaff8013a25057487efa210`.
The adjacent JSON records file hashes, HEAD and the exact physical scope. It includes
uncommitted source; HEAD alone is not this rollback point. Extract only into a new
empty directory. No music or research output is included.

## Reproduced cause

The unchanged F2 deterministic test and real-song Chrome test both reproduced
**0 / 100 / 0 -> 50 / 50 / 0** on first Play of silent Deck 3, when Deck 1 had
been reduced automatically to zero but retained a positive request. Real native
AudioParam values matched the displayed jump. With Deck 3 prepared at 30%, F2
produced **35 / 35 / 30**, rather than **0 / 70 / 30**.

Loading an unowned deck does not invoke allocation or reset peer requests. Initial
first Play adds ownership and calls `allocate(...,'entry',id)` in
`createNativeStemHandoffActions`. F2 used incremental transfer only for direct
stem gestures; entry still used the legacy full request-weighted recalculation.
That path resurrected the automatically zeroed peer. Manual request=0 prevented
that resurrection. OFF entry skipped allocation. Subsequent Pause/Resume and
Stop/restart retained ownership and did not invoke entry allocation.

## Small correction

Only the opt-in F3 entry supplies the existing incremental calculator with
`previousGain=0`: before starting, a new owner contributes zero effective gain.
A silent entrant therefore leaves peers untouched. A nonzero entrant retains its
requested-level priority, uses spare capacity, and reduces positive current donors
only as needed in their existing proportions. Main × coefficient units and all
physical/authorization limits remain unchanged. First Play creates neither direct
touch history nor authorization. Scheduled start and audio protection are unchanged.

Sources: `native-stem-handoff.js` selects incremental entry; the gate in
`four-deck-stem-allocation.js` permits that input for `entry`. The existing incremental
helper's calculation is unchanged. F3 is enabled only by its new HTML entry, passed
through playable host/controller flags; the server adds one exact route.
F1/F2/P1 retain their prior gates. UI layout/styles, first-touch guard, direct-stem
history behavior, Main, participation, Pause/Stop/Release/replacement paths,
scheduler, gain ramps, decoding/cache/buffers/graph and authorization are unchanged.

## Verification

- Before correction: failing deterministic test captured 50/50; unchanged F2 real-song
  browser matrix reproduced automatic-zero failures and confirmed manual-zero/OFF
  and subsequent transport cases. 63 browser checks completed (including reproduction).
- F3: 672 deterministic checks across 48 scenarios: manual/automatic peer zero;
  prepared 0%, 1%, 30%; entrant ON/OFF; fourth unloaded, loaded, independent-playing,
  or participating with a retained positive request and automatic zero. Native modeled
  gains, history/authorization preservation and subsequent transport are checked.
- Actual-song F3 browser matrix: 92 checks passed across eight scenarios, including
  an independent or participating fourth deck already playing. Observed F3 results
  were 0/100/0 for silent entry and 0/70/30 for a 30% entrant.
- Existing F2 pure 1,522, F2 native 218, F1 expansion 234, P1 controller 22 checks
  and the complete audio runner (44 passing groups) passed.
- Browser automation is Chrome, not physical Safari audibility/stability. Repeated
  loads use the same two prepared recordings, not four unique songs. Prior memory
  limitations remain; no memory optimization or new memory claim is made.

Tests: `tests/first-play-handoff-tests.js`, JXA runner
`tests/run-first-play-handoff-tests.js`, and `tests/first-play-browser-check.py`.
The browser script defaults to the unchanged F2 reproduction; `--fixed` tests F3.
It uses the existing isolated Chrome CDP port 9230 helper and closes its browser.
The first browser attempt targeted a hidden Play button; corrected to use the visible
Controls tab. Fourth-deck test setup also required a genuine value-changing gesture
instead of a no-op preserved over-cap join; no engine fix was made for test setup.

## Short physical checklist

1. Open F3 and confirm both build labels. Use low device volume, Main zero while
   loading. Prepare Decks 1/2 as before and isolate Tune (other stems zero).
2. Enable Handoff on 1/2; play both. Set D1 Tune=100 then D2=100: D1 is automatically
   zero with a positive request, D2=100.
3. Load D3, set Tune=0, enable Handoff and first Play: expect **0 / 100 / 0**.
4. Release D3, reload it, prepare Tune=30% and Main=1, first Play: expect
   **0 / 70 / 30**. Entering must not move the unrelated zeroed D1.
5. Pause/Resume and Stop/restart D3: allocations should remain unchanged. Repeat
   after explicitly zeroing D1; repeat with D3 Handoff OFF (D1/D2 stay 0/100).
6. Repeat with D4 loaded or already playing, first independent at low Main, then
   participating. Verify only necessary donors move for a nonzero entrant; a silent
   entrant must not redistribute other decks. Listen for clicks/dropouts and verify
   faders against Audio diagnostics. Existing direct-gesture history and first-held
   touch behavior should feel identical to F2.

## Final regression / preservation record

F2 browser 38, F1 browser 120, P1 integrated browser 114, M1 live-Main browser 35,
R1 handoff browser 29, manual two-deck browser 37 and single-song browser 14 checks
passed. Three media format/allowlist tests passed, including the new F3 route.
`git diff --check` passed. No remaining automated failures. JXA emits existing
macOS service-connection warnings; those are not reported as physical audio evidence.
The F2 archive hash and 52 protected sources were verified: original Design Mode,
F1/F2/P1 entry HTML, UI CSS, native player/graph/bridge, decoding pool, touch guard,
authorization, participation and legacy two-deck mathematics remain byte-identical.
The body of the F2 incremental helper is also byte-identical. No research or music
files were edited. The narrow source change is an opt-in first-entry selector, not
an allocator rewrite. New tests, route/HTML and appended verification records are
listed above; the server allowlist test also gained an F3-page assertion.

Stop at F3 physical review. No matching, UI redesign or unrelated development.
