# Phase 1D repair R1

Open http://192.168.50.24:8766/handoff?build=1d-repair-r1 . Confirm the header says
**Phase 1D repair R1**. Existing server remains on port 8766, with no-store responses.
The manual /two-deck and single-song / fallbacks are unchanged. No new media is served.

## Physical retest

1. Close other playback tabs, lower physical speaker volume, and load both songs.
2. For a one-category test, set Transients/Tune/Voice to zero on BOTH decks. While
   stopped, set both Main controls to 100%. Turn both Handoff buttons ON, then set
   both Flow controls to 50%. Press Play on both decks.
3. Raise Deck 1 Flow to 80%: Deck 2 should move to 20%. Reverse by raising Deck 2
   to 80%: Deck 1 should move to 20%. Repeat rapidly; neither transport should pause.
4. Turn Deck 2 OFF: every current allocation must remain unchanged. Its Flow is now
   independent. Raise either Flow control, including testing 100% on both decks.
   Repeat with the opposite participant OFF and then both OFF. Starting/stopping the
   second independent deck must not be blocked by the first deck's stem capacity.
5. Turn participation ON again. Toggling must not jump/normalize gains. If independent
   gains already total above 100%, they remain preserved until the next changing
   participating gesture redistributes that category. Confirm automatic faders follow.
6. Set a receiver Flow exactly to zero, then lower the other deck: the zero must stay
   zero until you explicitly raise it. Pause/Stop retain ownership; Release departs.
7. Main stays locked during playback. Pause both decks before changing Main.

Start quietly and test Flow alone first. Independent audio is intentionally outside
the participating cap. That cap is not a summed-waveform limiter; combined independent
stems/categories can clip. The page's sampled output warning is not a limiter or a
promise to detect every peak. Stop if distorted; adjust Main while both decks pause.

## Changes

- native-stem-handoff.js: explicit capacity membership on snapshots; preserve allocations
  on permission changes; synchronize through the same native snapshot boundary.
- experimental/four-stem-player.js: cohort-aware start/retarget checks, backward-compatible
  strict validation without metadata, 20 ms batch reservation, pre-write expiry check,
  retained scheduling measurements. Native route and 10 ms gain ramps are unchanged.
- handoff.js/html: R1 build label, refreshed toggle guidance, clear accepted-action errors,
  allocation-derived faders, lightweight synchronous refresh, deferred meter reads.
- Regression tests now assert approved behavior instead of characterizing the old faults.
  The pure four-deck allocator was not modified. The server, fallback pages, Design Mode,
  research, recordings and original audio files were not changed by this repair.

## Verification

- Existing full runner: 43 passing result messages; includes 15,454 start checks,
  597,297 retarget envelope checks (maximum 1.000000000000), 66 native integration
  checks, pure allocation/eligibility/authorization and failure/cancellation coverage.
  Obsolete tests expecting independent exclusion rejection were replaced with
  preserve-on-toggle acceptance assertions. Pre-existing macOS service warnings remain.
- Updated handoff-regression-investigation.js: both priority directions, OFF matrices,
  full-level independent starts, 38,404 participating-envelope sample points, physical
  gain-event/target agreement, re-enable preservation and convergence, explicit zeros,
  unchanged high-water on toggles, an 8 ms native batch, pre-write expiry with no native
  writes or pauses, malformed membership and over-cap target rejection, Main rejection,
  and genuine post-write deadline failure retaining failClosed. No regression failures.
- Updated real-host checks: both actual songs decoded, independent OFF/ON combinations,
  fader/state/native AudioParam agreement after settling, 100 rapid DOM input events,
  no transport failure, preserved toggle state, Main lock and stale-error recovery.
  Chrome measured a native retarget finishing before its reserved boundary.
- Original handoff browser checklist passed (29 assertions).
- Phase 1C manual browser checklist passed (37 assertions), including reload/cleanup;
  Phase 1B actual song playback/transport/gain browser checks passed.
- Three server/format/allowlist tests passed. No dependencies added.

The diagnostics still distinguish hardware audibility from internal signal. Browser
checks use Chrome, not iPad Safari. Native AudioParam values agree with the display
following reservation/ramp settling, not instantaneously at the moment of touch.
20 ms scheduling lead plus 10 ms ramp adds bounded intended control latency; extreme
post-write stalls can still invoke safety cleanup. Physical Safari gesture timing,
rapid touch behavior, click-free transitions, interruptions and long-session memory
remain user checks. Decoded PCM estimate remains ~582 MiB at 44.1 kHz (~634 at 48 kHz)
plus browser/decode overhead. No Phase 1E work is started.

### Repair R1 physical verification — Phase 1D.2 starting baseline

The user confirmed Repair R1 authorization tests 1–6 on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers: zero-level protection, joining without
premature normalization, bidirectional redistribution, full-capacity sharing and
authorization-ceiling behavior. This is physical evidence for that two-deck scope.
Independent Handoff-OFF combinations, four-deck handoff and extended stability
remain physically unverified. Phase 1D.2 live Main behavior is not yet verified.
The pre-change source archive and per-file hashes are preserved under
`development/playable/baselines/phase1d-repair-r1.*`.
