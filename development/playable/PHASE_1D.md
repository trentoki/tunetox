# Phase 1D — real automatic stem handoff

Physical evidence: the user confirmed simultaneous Phase 1C playback on iPad Pro
11-inch M4, iPadOS 26.6.1 Safari, built-in speakers. Phase 1D listening is pending.

Open http://192.168.50.24:8766/handoff . Start server as documented in Phase 1C.
The unchanged manual fallback remains at /two-deck; single-song fallback remains /.
Close other playback tabs before this test. The server adds exact allowlisted code
assets, but no media, directories, arbitrary paths or production application launch.

## First audible handoff (one category)

1. Lower physical speaker volume, load both songs; both Main controls start at 0,
   and both Handoff buttons show OFF. Loading does not authorize a gain increase.
2. While stopped, set Deck 1 Transients, Flow and Tune to 0. Leave Voice at 100%.
   Deck 2 stems start at zero. Set each Main to 100% while stopped. This prepares
   a one-category handoff; do not raise all categories to full.
3. Turn Handoff ON for both decks. On Deck 1 move Voice to 99%, then 100%.
   This qualifying human gesture establishes the effective-gain high-water of 1.
   Set Deck 2 Voice to 10% (explicitly makes it eligible).
4. Press Deck 1 Play, then Deck 2 Play. Deck 2 enters with 10% and Deck 1 should
   allocate 90%. Raise physical speaker volume gradually if needed.
5. Move Deck 2 Voice to 60%: Deck 1's fader should move to 40%. Lower Deck 2 Voice
   to 30%: Deck 1 should restore to 70%, within the authorized ceiling.
6. Set Deck 1 Voice exactly to 0, then lower Deck 2 Voice. Deck 1 must stay at 0.
7. Disable ALL preserves all current allocations and turns effective handoff OFF.
   It retains participation flags; later enabling can rebalance existing participants.
   A per-deck OFF action instead leaves that deck's coefficient fixed but allows
   the remaining participating decks to rebalance, as the production engine specifies.
8. Pause or Stop does not depart ownership or redistribute. Resume/restart retains
   allocations. Release/Eject is a real departure and may redistribute.

Faders show allocated coefficients, alongside requested level and effective
Main×allocation. Sharing flags, authorization ceilings, membership and native
source/stem/main/transport/destination measurements appear in diagnostics. These
measure internal signal, not speaker output. Matching remains disconnected.

## Main-volume limitation and output headroom

Main controls are disabled whenever either deck is playing or a transport start is
pending. Pause both decks to change Main. This intentionally avoids the production
coordinated-retarget restriction; rejected live Main gestures leave state and audio
unchanged. This host does not modify routing or the scheduler to work around it.

The manual fixture's small Main ceilings cannot establish the production unity
sharing relationship, so this host uses the real 0..1 Main domain, initially zero.
The existing cap is per category; it is NOT a summed-waveform limiter across all
four categories. No new limiter or output attenuation routing was added. Test one
category first. The page warns when sampled output peak reaches 0.95, but polling
cannot guarantee detection of every overshoot. Start quietly and stop if distorted.

## Implementation and verification

- app.js creates the existing four-deck appState and participation store; pure domain
  dependencies and native-stem-handoff.js are imported unchanged. No production
  audio-controls, Design Mode state, metadata transport actions or research is loaded.
- Native createNativeStemHandoffActions owns gain decisions and commits. Its callback
  projects actual appState allocations to faders. No second allocator exists here.
- 10 ms native gain ramps and coordinated scheduling are unchanged. Pause/Stop and
  zero eligibility follow existing production behavior, not a new rule.
- Real-song Chrome checks passed loading, default OFF/zero Main, coordinated starts,
  unestablished/established sharing, 0.4/0.6 and 0.7/0.3 allocations, high-water retention,
  zero exclusion, automatic fader movement, disable/leave, Pause/Stop ownership,
  independent transport, live Main rejection, paused Main acceptance, per-category
  caps, no native scheduling failure, destination signal and cleanup.
- Existing regressions: 43 passing result messages, including 67 native handoff checks,
  1,888 four-deck allocator checks, 15,454 coordinated-start checks and 597,297 retarget
  checks. These cover negative/authorization/cap/smoothing cases using test clocks;
  they do not prove click-free physical playback.
- Focused server validation tests also cover /handoff and its production dependency
  allowlist, retaining previous eight-file/path rejection tests.
- An initial browser attempt preceded server readiness after scanning; it could not
  find page controls. After startup completed, the full check passed.

Memory remains approximately 582 MiB decoded at 44.1 kHz or 634 MiB at 48 kHz, plus
browser/decode overhead; loading remains sequential. No physical Safari memory or
click/dropout measurements are claimed. No production algorithm was changed.

Stop here until physical Phase 1D confirmation. No Design Mode integration or matching.
