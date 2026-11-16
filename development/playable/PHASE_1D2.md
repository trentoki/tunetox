# Phase 1D.2 — LIVE MAIN M1

URL: http://192.168.50.24:8766/handoff-main?build=1d2-m1
Header: **Phase 1D.2 LIVE MAIN M1**. Only this new page enables live Main controls.
The R1 presentation at /handoff keeps its lock; /two-deck and / remain unchanged.

## Baseline / rollback

The user physically passed R1 authorization tests 1–6 on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers: zero-level protection, joining without
premature normalization, bidirectional redistribution, full-capacity sharing and
ceiling behavior. Independent OFF combinations, four-deck handoff and extended
stability remain physically unverified. This does not verify new live Main behavior.

Before source changes, R1 was archived in baselines/phase1d-repair-r1.tar.gz with
per-file hashes and current HEAD in the adjacent JSON. Archive SHA-256:
`db219ce3a6f9a8d2aae4b09dc60f4ee0e34e002b637c7ad88b8df4cabed197ed`.
See baselines/README.md for isolated extraction/reproduction. This captures actual
uncommitted R1 source, not just a Git commit. No audio/research is in the archive.
Do not extract over later work. Production changes are narrow and no engine revert
was performed.

## Main math and action semantics

Effective coefficient E[d,k] = Main[d] × allocatedStem[d,k]. Main remains a physical,
independent native GainNode; stem coefficients remain four physical GainNodes.
A Main gesture keeps the priority deck's allocated stem coefficients, while allowing
other participating receivers to redistribute according to the existing requests,
eligibility, cap and high-water. Retained stem requests are not silently restored by
a Main move. A qualifying Main increase may explicitly raise the high-water to its
new effective endpoint; lowering Main never lowers that session high-water. OFF decks
are independent and do not authorize automatic participating increases.

A source at its reservation time has main M0 and folded stem S0; targets are M1,S1.
Naive concurrent linear ramps give E(u)=M0*S0 + (M0*deltaS+S0*deltaM)*u +
deltaM*deltaS*u². Endpoint checks alone are insufficient: the test transition
[1×.2, .8×1] → [.5×1, 1×.5] has capped endpoints but peaks at 1.125 mid-ramp.

The scheduler analytically checks the quadratic maximum for each individual gain
and the participating sum. If safe, all gains ramp concurrently in 10 ms. Otherwise:
- Stage 1: decreasing Main/stem factors ramp for 10 ms; increases hold.
- Stage 2: increasing factors ramp for 10 ms; decreased factors hold.
Every product decreases in stage 1 and is bounded by its endpoint in stage 2. This
prevents both individual endpoint/high-water overshoot and participating cap overshoot.
It can produce a short dip instead of a gain boost. No new nodes, equalization,
normalization, waveform replacement or limiter is introduced.

The reservation stays 20 ms ahead. Expected response is that lead plus a 10 ms normal
or 20 ms staged transition. Rapid gestures cancel pending stages, preserve the current
ramp at the new boundary, and reschedule continuously. Main at zero and stem at zero
are valid exact mutes. Before-write expiry/validation leaves playback and committed
state unchanged. Actual partial native failure still invokes failClosed.

## Physical retest — one category first

1. Close other audio test tabs. Start speaker volume low; open the exact new URL and
   verify LIVE MAIN M1. Load Deck 1. Set Transients/Tune/Voice to zero, leave Flow at
   100%. Turn its Handoff ON and Play while Main is zero.
2. Move Main to 50%, then 20%, then 80%, then 0 and back to 50%. Confirm actual sound
   follows smoothly, transport advances, and Flow stays at 100%. Main zero must mute.
3. Load Deck 2 while Deck 1 continues. Zero its other three stems, set Flow to 50%,
   Main to 50%, and Play. Turn its Handoff ON. Set Deck 1 Flow to 50%, then each Main
   to 100%. Both Flow allocations should be 50/50.
4. Lower Deck 1 Main to 50%. Its Flow coefficient should stay 50% (effective 25%).
   With sufficient previously authorized ceiling, Deck 2 can restore the remaining
   effective budget. If authorization is only 50%, it must stop at that ceiling.
   To explicitly authorize full restoration first, move Deck 1 Flow to 100%, then
   Deck 2 Flow to 50%, producing 50/50 with a full high-water; repeat Main lowering.
5. Raise Deck 1 Main to 100%, then alternate both Main and Flow controls rapidly.
   Check automatic receiver faders, sound continuity, position, and no spontaneous pause.
6. Set a receiver Flow exactly to zero; reduce the other Main. Zero must stay zero.
   Repeat Main tests with one Handoff OFF and then both OFF; confirm independence.
   Those OFF combinations are still awaiting physical verification, not an R1 claim.
7. Pause/resume and Stop/restart; confirm positions/ownership remain consistent. If an
   error occurs, capture Diagnostics including lastSchedulingFailure and reservation.

The capacity cap is not a whole-waveform limiter. Independent sources and simultaneous
categories can clip; keep the first check to Flow alone and monitor destination peaks.
Physical speaker volume does not prevent internal clipping. No automatic attenuation
is added. Memory estimate is unchanged: ~582 MiB decoded at 44.1 kHz (~634 at 48 kHz),
plus browser/decode overhead. Four-deck capacity, long-run Safari memory, interruptions,
actual click-free playback and subjective dip audibility remain unverified.

## Source and verification

- experimental/four-stem-player.js: actual Main sampling/ramping, quadratic peak
  validation, staged plan, held-envelope cancellation and diagnostics.
- native-stem-handoff.js: preserve priority deck coefficients on a Main gesture.
- handoff.js: page-scoped live-Main capability; disable controls during pending starts,
  project committed values after rejection; same shared state and components.
- handoff-main.html + allowlisted server route: separate build-labelled entry point.
- tests/live-main-tests.js integrated into tests/run-tests.js: single/two-deck, all
  participation combinations, mixed rapid Main/stem ramps, full interval sampling,
  separate multi-stem coefficients, zero/high-water, suppressed requests, rejected
  Main rollback, 1.125 counterexample, individual sub-unity peak guard, interrupted
  staged increases and partial Main failure cleanup.
- Prior negative tests now reject out-of-range Main rather than treating all valid
  live Main changes as unsupported. Existing handoff tests preserve their other checks.
- tests/live-main-browser-check.py: actual songs, enabled live sliders, actual native
  Main/receiver values, no playback-position reset, high-water, zero, rejected pending
  gesture UI recovery, OFF combinations, 200 rapid mixed inputs and cleanup.

No Design Mode, sampler, research, music, matching, EQ, FX or looping changes. Stop at
this checkpoint. Do not begin Phase 1E until physical verification.

### Executed results — M1

- Full existing runner plus new suite: **44 passing result messages**, no final failures.
  New live Main suite: **199,720 checks**, maximum participating effective sum
  **1.000000000000**. Existing retarget suite: 597,297 checks, maximum also 1.0.
- New real-song Main browser test: **35 assertions passed**. All four participation
  combinations passed. Native AudioParam values matched committed Main/stem controls
  after settling; 200 mixed input events preserved playback. A rejected pending
  gesture restored the displayed committed value and the next successful action
  cleared its error. The final measured reservation completed before its deadline.
- Existing Phase 1D browser suite: **29 assertions passed**; repaired real-host
  regression checks also completed successfully.
- Phase 1C manual fallback: **37 assertions passed**; Phase 1B song playback:
  **14 assertions passed**. Both use actual song buffers. Their pages were unchanged.
- Three server/format/allowlist tests passed, including the exact new page route.
- R1 archive and all **63 file hashes** verified; `git diff --check` passed.

Earlier negative tests that expected every valid live Main change to fail were
updated to reject invalid/out-of-range gains instead; protected write guards,
capacity checks, pre-write rejection and genuine partial-write cleanup remain tested.
The old R1 page still deliberately locks its Main UI. Initial runs hit the obsolete
"Main must reject" test expectations; final updated acceptance tests all pass.
Mac osascript continues to emit its pre-existing service-connection warnings.

Changed-file groups: production native player/action adapter; shared isolated handoff
host plus new handoff-main.html and server route; tests/live-main-tests.js and
live-main-browser-check.py; tests/run-tests.js, coordinated-stem-retarget-tests.js,
native-stem-handoff-tests.js, handoff-regression-investigation.js,
handoff-regression-host-check.py, handoff-playable-check.py and hypnotic-server-tests.py;
scoped verification entries in RULES.md, TUNEFLOW_DESIGN.md, EXPERIMENTAL_AUDIO.md and
PHASE_1D_REPAIR.md; this checkpoint report and the source baseline archive/manifest.
No public deployment, Git revert, full UI integration or Phase 1E changes occurred.

### Phase 1E starting verification record

R1 remains the physically verified two-deck handoff/authorization baseline (tests
1–6 reported). LIVE MAIN M1 appears correct in physical iPad Safari testing, including
live Main adjustments. A small Flow fader jump was reported; percentage-driven
geometry is a hypothesis, not yet proof of a visual-only issue. Specific independent
OFF combinations, four-deck handoff and extended stability have not been explicitly
physically confirmed. Phase 1E integration is unverified. The complete M1 source and
approved UI are archived with SHA-256 hashes in playable/baselines/phase1d2-live-main-m1.*.
