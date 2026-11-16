# Phase 1F F1 — four-deck audio expansion

Experimental first build; physical four-deck iPad verification is pending.

Open **http://192.168.50.24:8766/performance-four?build=1f-f1** on the same Wi-Fi.
Header: **TUNETOX — PLAYABLE 1F**, badge **F1 AUDIO**, footer **1F F1**.
Server: `python3 development/playable/serve-hypnotic.py` (port 8766).
P1 fallback remains `/performance?build=1e-p1`; original diagnostic pages remain available.

## Preserved baseline and implementation

User-confirmed P1 evidence: both prepared songs loaded and stem handoff worked
through the integrated UI on iPad. This is initial physical evidence, not an
exhaustive OFF-combination, Main-zero, four-deck or extended-stability pass.
Source-only rollback archive `baselines/phase1e-p1.tar.gz`, SHA-256
`5de0b5a885f2254a777ac2314e55078349ad8d7d3c299ab7bbe9239fdacaa5df`.
Adjacent JSON records individual hashes, including uncommitted source.

F1 enables the existing four native slots instead of P1's two-loaded limit.
Fixed identities, clocks, Main, stem and Handoff states remain independent.
The allocator, native mixer/scheduler, gain envelopes and native actions are
unchanged from P1. No new distribution or authorization algorithm was introduced.
Existing Release-before-replacement, Pause/Stop ownership, native failure protection
and 10 ms ramps remain in effect. Handoff-OFF slots remain independent.

`shared-stem-pool.js` retains read-only-by-contract decoded AudioBuffers by song,
with per-deck ownership. Native `loadDecodedBuffers` validates borrowed PCM and
uses the existing player lifecycle; each slot still creates its own four sources.
The last owner releases the cached song. Close clears ownership. No PCM samples
are copied or modified. Existing `loadFiles` remains the uncached loading path.
Only the same eight explicitly allowlisted WAVs are exposed; no directory browsing,
arbitrary external paths, new dependencies, research or recording changes.

Four prepared song slots are supported, but only TWO distinct prepared songs are
available: testing loads Hypnotic into 1/3 and Cut Me Loose into 2/4. This is four
independent playing decks, not verification with four different song recordings.
F1 shows precise automatic thumb positions and fractional percentages in existing
fixed-width fields. Direct gestures retain production 1% quantization; P1 geometry
and presentation are unchanged. Unsupported controls remain simulated/inactive.

## Main at exactly zero — existing behavior, not a new rule

Effective category gain is Main × allocated stem coefficient. Main=0 mutes that
deck after the scheduled ramp, while transport and ownership continue. Requests,
prepared coefficients, historical eligibility, sharing and session high-water are
retained. Other eligible participants can restore because the muted deck contributes
zero effective gain. Raising Main uses its current coefficients, not old suppressed
requests. A coefficient already reduced automatically to zero can remain zero on
the Main gesture; a later peer gesture can restore it under the existing rules.

Explicit stem zero sets its request to zero, which prevents automatic restoration
until a positive direct stem gesture. The historical eligibility latch can remain
true: it is not itself a mute flag. Main zero does not create an explicit stem-zero
request. Lowering Main does not lower historical authorization. These semantics
were inspected and tested, not changed or newly approved as a product redesign.

## Automated evidence

- 234 deterministic four-deck checks: sharing, priority, all categories, explicit
  zero, Main-zero semantics, mixed participation, rapid gestures, ownership,
  replacement, cancellation, cache cleanup and invalid shared-buffer rejection.
- 120 real Chrome F1 checks passed: loads all four decks, verifies shared PCM identity and 16
  native sources, 2/3/4-way sharing, native/display agreement, ON/OFF patterns,
  rapid gestures, bounded 30-second four-clock soak and lifecycle cleanup.
- Existing audio regression runner: 44 passing groups. P1 controller: 22 checks.
  Design Mode: 77 state and 1,084 browser checks unchanged.
- Existing real-host checks: P1 114, M1 35, R1 29, manual two-deck 37,
  single-song 14; handoff regression host and unit diagnostics passed.
  Three media-server format/allowlist tests passed. No remaining automated failure.
- Browser coverage includes iPad landscape and existing iPhone integrated layouts;
  these are Chrome emulation/results, not Safari hardware or audible verification.

## Timing and memory limits

At 44.1 kHz, unique application PCM for these two recordings is 610,360,736 bytes
(**582.1 MiB**). Four slot references do not mean four PCM copies. This excludes
native sources, decoder/network copies, browser overhead and transient allocations.
Observed native-controller load times were approximately 0.64–0.92 s for each
first song and 1.8–6.3 ms for cached repeats, on this Mac; not iPad guarantees.
Sampled Chrome renderer RSS reached approximately **1.4–1.5 GiB** across runs.
These are sampled process values, not a measured Safari peak or total-system bound.
The desktop soak produced signal and no unintended stops/scheduling failures.
It does not establish physical audibility, long-run stability or Safari memory safety.
Four distinct songs would remove the repeated-song cache saving and remain untested.

## Physical iPad retest

1. Close unnecessary Safari tabs. Open F1 URL and confirm all build labels. Start
   with low device volume. Keep Main at zero during loading.
2. Use each column's Library to load Hypnotic into 1/3, Cut Me Loose into 2/4,
   selecting the corresponding deck loading target. Confirm independent labels and
   loading results. Loading does not autoplay or authorize increases.
3. For a controlled Flow-only test, explicitly zero Transients/Tune/Voice on all
   decks. Enable Handoff on all four. On Deck 1, authorize Flow at Main=1,
   Flow=1 with transport stopped; reduce Flow to .25. Set the others Main=1,
   Flow=.25. Play Decks 1–4 sequentially. Keep physical speaker volume low.
4. Test two-way .5/.5, three-way redistribution, then four-way .25 each. Raise a
   deck to .8: other eligible peers should share the remaining .2, approximately
   .0667 each. Reverse the active gesture. Check native diagnostics against faders.
5. Explicitly zero a peer, then move other faders: that peer must stay silent.
   Directly reintroduce it. Contrast an automatically reduced zero, which may restore.
6. Move Main during playback, including zero then restore. Its clock/ownership must
   persist; that deck's native Main becomes zero after settling. The total mix may
   continue because other decks remain audible. Watch for clicks, jumps or pauses.
7. Lower Main on every deck before OFF-combination tests. Toggle individual/all
   Handoff OFF; current allocations must be preserved and independent decks must
   not consume participating capacity. No mix-wide loudness limiter is implied.
8. Pause/resume and Stop/restart each deck while others continue. Those retain
   ownership; Release departs. Replacement requires Release first and never autoplays.
9. Try rapid fader moves and several minutes of playback. Report reloads, dropouts,
   clicks, UI/audio disagreement and output diagnostics. High memory remains the
   principal device risk; stop if Safari becomes unstable.

Stop at F1 physical review. No matching, DSP, sampler, UI redesign or next phase.
