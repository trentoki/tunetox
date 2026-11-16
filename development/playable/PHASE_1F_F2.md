# Phase 1F F2 — incremental, history-aware stem gestures

Experimental build, awaiting physical iPad review.

**URL:** http://192.168.50.24:8766/performance-incremental?build=1f-f2
Header badge **F2 AUDIO**; footer **1F F2**. F1 remains `/performance-four?build=1f-f1`.
The existing allowlisted LAN server on port 8766 serves both builds.

## Reproduction and cause

Before implementation, a failing pure regression produced exactly
`{1:0.495,2:0.495,3:0.01,4:0}` from allocated `1/0/0`, with Deck 2 retaining
request=1 and eligibility from earlier interaction. The F1 allocator rebuilds all
peer gains using Main × requested-level weights and the remaining capacity. A
positive historical request on an automatically suppressed peer resurrects it,
independent of the 1% size of the direct gesture. Explicit request=0 is excluded;
there is no evidence that F1 bypassed that protection. The historical latch alone
is not the defect. Repeated equalization is in allocation math, not slider geometry,
transport, decoding or an audio-only mismatch.

## F2 implementation and scope

The pure calculator has an opt-in incremental direct-stem branch. Only F2 enables
it through native actions. Main gestures, Play entry, Release/departure, sharing
establishment, participation preserve behavior and the legacy calculator branch
remain unchanged. This is deliberately a stem-gesture experiment, not a new Main
or lifecycle algorithm. Those other paths can still redistribute under F1 rules.

Let current effective gain be `Main × allocated coefficient`. The direct gesture
sets its target and computes the change from its previously committed effective
gain, not from its stale requested value.

- Increase: use existing headroom first. At capacity, reduce the needed amount
  from positive current peer gains in their current proportions. Zero allocations
  do not become donors or magically return from historical request weights.
- Decrease: after sharing is established, return only the freed gain, most recently
  directly touched eligible peer first. Offer remainder to the next older peer
  when physical/Main or existing global authorization limits cap the recipient.
- Positive requests and eligibility are both required for restoration. A deliberate
  zero remains excluded; an automatic zero can restore. OFF/inactive peers are
  excluded. Main-zero peers retain their prepared coefficient and receive no gain.
- Direct inputs remain in 0.01 increments; automatic coefficients remain continuous.
  At unequal Main values, 1 coefficient percentage point transfers Main × .01 in
  effective gain; recipients' coefficient changes reflect their own Main values.
- Recency is separate per category in `stemSession.nativeHandoff.touchOrder`.
  Touch without movement records order without authorization/gain changes. Main
  does not change stem recency. Initial positive allocations seed a category's
  order until actual touches establish history. History itself never grants gain.
- User explicitly approved first-held-touch priority for the same category.
  F2's input guard ignores competing same-category touches until the first ends;
  other categories are independent. Up/cancel/lost capture/blur release the guard.
  No geometry, blanket touch restriction or library scrolling change.

No forced equalization or one-owner restriction: existing arbitrary equal/unequal
splits are retained; donors transfer only the needed amount. Repeated direct moves
can build multi-deck distributions; F2 does not automatically seek thirds/quarters.

The same native coordinated validation, reservations, fail-closed handling and
10 ms gain ramps apply. Audio commits precede UI/history publication. Failed plans
roll back allocation/history/authorization. No PCM/cache/graph/transport changes.
Original Design Mode, sampler, research and music are untouched.

## Constrained exceptions

If recipients are ineligible, manually zeroed, at authorization/physical limits,
or sharing is not established, the freed amount need not be fully restored. It
remains headroom rather than introducing an unrelated source. Diagnostics record
`delta`, `transferred`, `unreturnedGain`, `deficit` and `preexistingExcess` per category
under `nativeHandoff.transfers`. These are effective-gain units.

Preserve-on-enable can leave an existing over-cap mismatch. F2 will not conceal it
by a large normalization on a tiny gesture: if the proposed endpoint is still over
cap, it rejects atomically and reports an allocation mismatch. Lower independent
levels before rejoining, or make a sufficient safe reduction; no authorization
exception or hidden convergence policy is introduced. Main/lifecycle paths retain
their existing safety rules. This is a reported constraint, not successful 1-for-1
transfer. No authorization override was added.

## Evidence

- Initial deterministic reproduction failed with 49.5/49.5/1 before the change.
- 1,522 incremental allocation/priority checks pass, including 500 alternating
  gestures with per-peer change bounded by direct effective delta, 0.01 precision,
  equal/unequal splits, reverse history, recipient ceilings, explicit/automatic
  zero, OFF peers, Main weighting and unresolved pre-existing excess.
- 218 native-action checks pass: four loaded mock-native decks, exact reproduction,
  reverse restoration, independent category histories, touch-without-motion,
  rapid gestures without pause, settled native gain agreement, Main history
  preservation and atomic unsafe-mismatch rejection.
- 38 actual-song Chrome F2 checks pass: four loaded/playing slots, real AudioParam
  agreement, observed-defect repair, reverse restoration, zero protection,
  first-held-touch guard on rendered controls, rapid alternating moves, fixed
  fader geometry and 1194×834 / 1024×768 / 390×844 / 320×568 viewports.
- Full existing audio runner: 44 passing groups; F1 deterministic expansion: 234;
  P1 controller: 22. Existing F1/P1/M1/R1/manual/single browser regression results
  passed: F1 120, P1 114, M1 35, R1 29, manual 37, single 14; the
  handoff regression real-host test also passed. Three expanded media
  allowlist tests passed.

Tests caught a missing new script include in the first browser boot and an incorrect
unit-test assumption that other categories had no preparation history. Both were
corrected before passing final tests; neither was an audio-engine failure.
Chrome automation does not establish audible Safari smoothness, physical multitouch
or extended stability. F1's roughly 1.4–1.5 GiB sampled desktop renderer memory risk
still applies; F2 does not change buffering or claim a memory improvement.

## Rollback and changed sources

Before edits: `baselines/phase1f-f1.tar.gz`, SHA-256
`f312cbc71ee5488cd063b70f23e9af0a0b18d8cf8ca23aaa11b5166cafa41f1b`.
Adjacent JSON records individual source hashes and the physical F1 defect report.
It is a source-only snapshot of uncommitted work, not a newly created Git commit.
Extract into a fresh empty directory, never over the active checkout; stop the
current port-8766 server before starting the archived server.

Changed: `four-deck-stem-allocation.js`, `native-stem-handoff.js`, playable controller,
host and server. Added: `performance-incremental.html`, `stem-touch-priority.js`,
allocation/native/browser F2 tests and two JXA runners. Expanded server tests;
updated RULES/design/audio records and baseline README. F1 HTML, UI CSS, native
player, audio bridge, authorization, participation and two-deck math stay unchanged.

## Physical iPad procedure

1. Open F2 URL; confirm **F2 AUDIO / 1F F2**. Low device volume; Main zero while
   loading. Load Hypnotic on Decks 1/3 and Cut Me Loose on 2/4 as in F1.
2. Isolate Tune by explicitly zeroing the other categories. Set Main=1 with low
   speaker volume. Start Decks 1–3; Handoff ON for 1–3, OFF for 4.
3. Set D1 Tune=100, then D2=100, then D1=100. D2 is now automatically zero with
   a positive request. Raise D3 from zero to 1: expect **99 / 0 / 1**, not 50/50.
4. Explicitly zero D3, set D1=100, raise D2=100 then lower D2=60. Expect **40/60**.
   Explicitly zero D1 and lower D2 further: D1 must remain zero until reintroduced.
5. Introduce Decks 3/4 and test small moves from intentional unequal/equal splits.
   Existing donors should lose only the needed amount; lowering should restore
   the most recently touched eligible peer. Test all four categories independently.
6. Touch a recipient without moving it, then lower another: confirm recipient order.
   Hold two faders of the same category: first held touch has priority. Different
   categories should remain independent. Listen for clicks/pauses and watch native
   gains/transfer diagnostics in Audio. Real physical multitouch remains to verify.
7. At low Main levels test OFF combinations, Main zero/restore, Pause/Stop/Release
   and restart. Compare against F1: those Main/lifecycle rules were not redesigned.
   Do not create an over-cap join at loud levels. A rejected mismatch should leave
   values and playback intact, with a clear error, not trigger normalization.

Stop at F2 physical review; no authorization overrides or further features.

Reproduce deterministic checks from the repository root:

```sh
osascript -l JavaScript tests/run-incremental-stem-tests.js
osascript -l JavaScript tests/run-incremental-native-tests.js
osascript -l JavaScript tests/run-tests.js
osascript -l JavaScript tests/run-four-deck-expansion-tests.js
osascript -l JavaScript tests/run-playable-ui-controller-tests.js
python3 tests/hypnotic-server-tests.py
```

Browser checks use existing Chrome CDP port 9230 and the running allowlisted
server: `python3 tests/incremental-playable-browser-check.py`. This test closes
its Chrome instance; use an isolated browser profile, not a personal session.
All 50 protected Design Mode/native loading/graph/authorization/legacy sources
and the F1 archive hash were verified unchanged. No research files were edited.

### Physical review and successor

User confirms F2 smooth three/four-deck incremental handoff, zero protection,
independent categories, first-held touch and no observed clicks/dropouts. First-Play
redistribution remained a reported concern. See PHASE_1F_F3.md; F2 is preserved.
