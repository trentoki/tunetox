# Phase 1D regression investigation — no fixes applied

## History

Earliest preserved handoff implementation containing the documented user Safari pass:
`d67a67c404cff24c7d71afd84632be8fbdd5b25c` (2026-11-08 03:36 -0500).
EXPERIMENTAL_AUDIO.md at this commit describes Flow 100/0 → 50/50 → 0/100 and later
states that the prior isolated handoff passed user listening. The Nov 7 baseline
`89bc117` does not contain these native stem files. Therefore the exact Nov 7 tested
checkout cannot be established from commits alone; d67a67c is the closest preserved
implementation, not proof that its entire checkout was the tested build.

`cd5e6f8` (Nov 8 16:16) is a later pre-coordinated reference. Both use the legacy
createStemHandoffAudioBridge, two-participant domain actions and ordinary native
play/gain ramps. The isolated host disables participation for Decks 3/4. Historical
main-page defaults included all four; exactly two were needed for the old pair path.

`d142490` (Nov 8 16:30) added coordinated starts. `c022f0d` (16:40) added retarget
corrections. `b7441ec` (Nov 10) introduced the current native action adapter and
protected scheduling restrictions into the main integration. Its docs explicitly
say independent/OFF cohorts and live Main changes remain unsupported. Those are
implementation limitations, not the approved behavior in the current user request.

A read-only isolated JXA replay of d67a67c source reproduced Flow [.5,.5], [0,1],
[1,0], independent [1,1], and a live Main change to .5 without stopping either mock
transport. This is a deterministic historical code check, not new Safari listening.

## Confirmed causes

1. **Allocator/scheduler capacity mismatch.** The pure four-deck allocator includes
   only active participating members and honors the direct priority request. The
   coordinated scheduler sums ALL playing decks, without participation or global
   permission. With either/both decks OFF, an independent .5 plus a requested .8
   is rejected as 1.3 > 1. Likewise independent [1,1] cannot start the second deck.
   This is the production native scheduling boundary, not a range-input maximum
   or failure of the allocator's direct-priority arithmetic.
2. **Blocked slider appearance.** Domain proposals commit only after scheduling.
   A rejected proposal leaves requested and allocated state at [.5,.5]. The host's
   refresh writes those unchanged allocations into the input, visibly snapping it
   back. With both participants ON, [.5,.5] → [.8,.2] → [.2,.8] succeeds in both
   deterministic tests and the served real-song host.
3. **Unexpected pauses: confirmed mechanism, Safari event not proven.** Live
   retargets reserve only 128/sampleRate seconds (2.90 ms at 44.1 kHz; 2.67 ms at
   48 kHz). If native writes run past that boundary, retargetSnapshot throws and
   failClosed pauses all playing decks. Injecting a native-call delay reproduced
   both transports pausing with unchanged domain proposals, plus an explicit
   lastSchedulingFailure. A 100-DOM-input Chrome burst did NOT pause playback;
   200 deterministic rapid gestures also remained playing. Need the iPad failure
   snapshot to confirm whether its pauses have this cause. Capacity preflight alone
   did NOT pause existing playback in the reproduced cases.
4. **Main lock.** The host intentionally disables Main whenever either deck plays.
   Underlying prepareRetarget rejects a changed playing Main before writes. This
   safety lock is deliberate and must remain pending a separately verified gain
   retarget plan. Rejection preserved both transport and state in tests.
5. **Per-deck toggle policy mismatch.** setParticipation invokes rebalance for a
   retained owner. At [.5,.5], high-water 1 and Deck 1 request 1, excluding Deck 2
   proposes raising Deck 1 to 1 while Deck 2 independently stays .5. Native total
   1.5 rejects; participation rolls back. Even when allowed while paused, immediate
   rebalance can change other allocations, contrary to preserve-on-disable intent.
   Global setEnabled(false) preserves all allocations but leaves participant flags.
   The host labels effective global+per-deck permission OFF; enabling one button
   calls global enable first and can reactivate previously flagged decks. That
   host sequencing is an additional issue, not hidden Decks 3/4 participation.
6. **Stale errors.** Host input handlers set message on failure but do not clear it
   after a successful gesture. In the host test, valid [.8,.2] and [.2,.8] allocations
   still displayed the preceding capacity error. This can obscure recovery.

Decks 3 and 4 were false in every current host case and never owned or played audio.
They are not the current regression. No evidence of an extra allocation state store,
incorrect deck identity, zero-eligibility failure, or ordinary direct-priority
failure with both participants ON was found in this examined scope. High-water
limits constrain automatic receiver increases; they do not explain the direct .8
rejection here, because the scheduler rejected the otherwise valid independent plan.

## Reproduction results (mains 1, Flow only)

| Scenario | Observed | Approved expectation |
|---|---|---|
| Both ON: D1 .5→.8 | [.8,.2] | Same |
| Both ON: D2→.8 reversal | [.2,.8] | Same |
| D1 ON/D2 OFF: D1→.8 from [.5,.5] | Reject, stays [.5,.5] | [.8,.5] |
| D1 OFF/D2 ON: D1→.8 | Reject, stays [.5,.5] | [.8,.5] |
| Both OFF: D1→.8 | Reject, stays [.5,.5] | [.8,.5] |
| Start D2 at 1 against D1 at 1, independent | D2 rejected; D1 continues | Both play |
| Main changes while playing | Safe preflight rejection | Keep safety lock for now |
| Scheduling crosses retarget deadline | Both playing decks paused | Gestures must not interrupt transport |

Actual host runs fetched and decoded both real songs, then invoked the existing DOM
input handlers/actions. Opposite-participation and injected-deadline matrices also
used the production native mixer with existing deterministic mock clocks. Synthetic
clock cases do not establish hardware audibility or iPad timing.

## Minimal corrective work proposed, NOT implemented

1. Pass explicit handoff-cap membership/permission with coordinated plans. Enforce
   unity only for the participating cohort in BOTH starts and retargets, while
   keeping unit/finite gain validation and smoothing for every deck. Independent
   decks must not consume that cohort's budget. Do not merely delete cap checks.
2. Make participation/global disable preserve allocations, eligibility, high-water
   and ownership; avoid immediate normalization. Have the host set the intended
   per-deck permission before enabling the global gate, without unexpectedly
   reactivating other flags. Use the existing authoritative store, not UI math.
3. Prepare/validate before native writes, reserve sufficient measured scheduling
   lead for a full gain batch (compare existing 20 ms start lead), and test deadline
   handling. Keep fail-closed protection for genuine partial native failures; do
   not hide them or blindly retry partially written automation. Reduce duplicate
   synchronous diagnostic refresh work; do not drop qualifying high-water gestures.
4. Clear stale host errors on accepted gestures and show global permission separately
   from per-deck participation. Leave Main locked until its ramp-product/cap behavior
   is independently verified. No full Main-volume redesign is needed for this fix.

Acceptance tests must assert the approved outcomes above (current defects must then
turn from known failures into passes), sample participating cohort sums through rapid
ramp reversals, preserve independent contributions, ensure neither transport pauses,
verify OFF toggles retain all coefficients, retain explicit zeros/high-water rules,
keep Decks 3/4 excluded, and preserve Pause/Stop ownership versus Release departure.
Also test global-OFF → enable one deck, failed/cancelled starts, Main rejection without
writes, paused Main acceptance and true partial scheduling failures. Physical iPad
validation is required after automated tests; no audible success is inferred here.

## Test artifacts and preservation

Added only diagnostic files:
- tests/handoff-regression-investigation.js (deterministic characterization assertions)
- tests/handoff-regression-host-check.py (served real-song host assertions)
- this report

Commands: `osascript -l JavaScript tests/handoff-regression-investigation.js` and
`python3 -B tests/handoff-regression-host-check.py` (isolated Chrome CDP port 9230).
The characterization assertions deliberately verify current known defects; their
completion is NOT a claim that the approved acceptance scenarios pass.
Production, handoff host, manual fallback, Design Mode, research, music and serving
configuration were not modified or reverted. No historical checkout was activated.

Earlier Phase 1D checks covered only a supported participating path, retained zeros,
and Main preflight. They did not establish independent-OFF behavior or deadline-safe
Safari dragging; the prior readiness report understated these restrictions.
