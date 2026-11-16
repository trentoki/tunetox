# Phase 1G G2 — live handoff lifecycle

**Experimental first G2 build; physical Safari review pending.**

Open **http://192.168.50.24:8766/performance-lifecycle?build=1g-g2**.
Confirm **G2 AUDIO / 1G G2**. Same origin/database as G1: existing stored songs
remain available without reimport. G1 remains `/performance-storage?build=1g-g1`;
F3 remains `/performance-first-play?build=1f-f3` with their original semantics.

## Preserved physical baseline

User confirms two imported songs survived an iPad Safari reload, loaded locally
without stem retransfers, and continued playback/handoff. F2 gestures and F3 first
entry are physically verified. No broader restart/retention/stability claims follow.
G1 source-only rollback: `baselines/phase1g-g1.tar.gz`, SHA-256
`16ad2e7b988937c88331fe3481b9ebc18995981cb0f237d5615e5b17cbc0ce6c`.
Adjacent JSON records HEAD, per-file hashes and physical scope, including uncommitted
source. Extract only into a fresh directory. F3's existing archive is preserved.

## Reproduction before correction

Both deterministic tests failed before changes. Real G1 storage-host tests then
reproduced the problems using actual cached songs, with media endpoints blocked:

- Pause D3 at 0/70/30: faders remain correct. Raising paused D3 to 100 then changes
  D2 to zero. The action layer uses retained ownership as live membership.
- Release silent D3 from Playing OR Paused: **0/100/0 -> 50/50/0**.
- Release nonzero D3 from Playing OR Paused: **0/70/30 -> 50/50/30**.
  The unloaded deck's retained coefficient is not an audible source after Release.

Release invokes `allocate(...,'departure')`, the legacy request-weighted peer
recalculation. That resurrects an automatically zeroed peer with positive request.
The original physical transport state was unknown; both states reproduced it here.
Native gain/UI agreement and continuing peer playback were checked. This was not
inferred from a screenshot or an assumed volume-label problem.

## Small, opt-in correction

`native-stem-handoff.js` derives live membership from retained ownership AND native
`isPlaying`, with a proposed entrant temporarily included while its coordinated
start is prepared. This derived predicate is shared by allocator snapshots and
native capacity targets; no competing participation store was introduced.

- Pause keeps coefficients/requests and does not allocate or restore peers.
- Paused stem/Main gestures prepare that deck only. Other paused decks are neither
  donors nor restoration recipients. Direct stem touch history and qualifying
  high-water authorization retain the existing rules; Pause is not an authority reset.
- Resume uses F3's incremental entry with prior live contribution zero and the
  displayed prepared coefficients. It never reintroduces a suppressed historical
  request. Only currently playing, enabled donors give up necessary effective gain.
- Stop/end are likewise not playing. Their prepared edits are isolated; a later
  start enters safely. Position/reset behavior remains the native transport's own.
- Release removes retained membership and applies unchanged peer targets, skipping
  legacy departure allocation. Silent/nonzero, Playing/Paused/empty Release never
  automatically raises peers. History, explicit-zero requests and authorization
  are retained. Song replacement shares the same safe departure handling.

The historical `ownsAllocation` diagnostic still records prior-start ownership;
new derived `liveParticipant` identifies live capacity. Prepared paused faders may
sum above 100% with playing faders: those paused values are not live contributions.
Resume applies cap-safe incremental redistribution before the deck becomes audible.
The same scheduler, 10 ms ramps, validation and fail-closed protections apply.

G2 is a new host/controller flag plus this action-layer lifecycle gate. F2/F3
calculator mathematics, Main scaling/high-water rules, first-held-touch guard,
IndexedDB schema/import/deduplication/restore, player/graph/decoder/buffering, UI CSS
and Safari double-tap protection are unchanged. Main redistributes only among live
peers under the new membership rule; its gain mathematics are not redesigned.

## Verification

- New native-fixture deterministic suite: **1,447 checks**. Covers each stem and
  every subject deck with three/four participants; Pause, prepared Resume, Stop,
  zero provenance, recipients/authorization, OFF independence, Main zero/restore,
  two paused decks, native agreement and Release in both transport states at
  zero/nonzero levels. Release preserves all peer requests/allocations and history.
- New real cached-song browser suite: **43 checks**. Exercises paused/Resume across
  all categories, four playing decks, silent/nonzero Playing/Paused Release, exact
  peer-state preservation, continued transport and blocked media transfers.
- Existing full audio runner: 44 passing groups. F3 deterministic 672, F2 native
  218, F2 pure 1,522, F1 expansion 234 and P1 controller 22 checks passed.
- Browser regressions: G1 storage 22 (including 19 deterministic real-IDB checks),
  G1 actual-song/restart 15, F3 92, F2 38, F1 120, P1 114, M1 35, R1 29,
  manual 37 and single-song 14 checks passed. Three media allowlist tests passed.
  Earlier builds keep the G2 lifecycle flag off. No remaining automated failures.
- G1 archive hash and 59 protected instructions/UI/storage/audio/math sources
  verified byte-identical. Controller load/import/assignment/release workflow bodies
  are unchanged; only build/options wiring differs. `git diff --check` passed.
- Tests caught an incorrect bounded-authorization fixture: Main=1 had been set
  before clearing initial Deck 1 stems, legitimately authorizing 100%. Fixed test
  preparation order (zero before Main), not production authorization logic.

Commands: `osascript -l JavaScript tests/run-live-lifecycle-tests.js`; browser with
existing isolated Chrome CDP 9230/server: `python3 tests/live-lifecycle-browser-check.py --fixed`.
Omit `--fixed` to reproduce G1 (requires the two actual prepared songs in that Chrome
profile's G1 local library). Browser test uses real UI controls and closes Chrome.
Desktop Chrome cannot verify Safari physical audibility or long-term stability.
Two recordings are repeated across four independent slots; not four unique songs.
Existing Safari storage/eviction, HTTP page-server and decoded-memory limits remain.

## Physical iPad checklist

1. Open G2 at the same LAN address, confirm build labels. Existing G1 songs should
   appear in Storage/Library; do not reimport. Keep speaker/Main levels low initially.
2. Isolate Tune, enable Handoff and play D1/D2/D3. Set D1=100, then D2=100, then
   D3=30: expect **0/70/30**. D1 is an automatic zero, not explicitly muted.
3. Pause D3: expect **0/70/30**. Raise paused D3 to 100: expect **0/70/100**.
   D2 must keep playing at 70%. Resume D3: expect **0/0/100**, no unrelated return.
4. Repeat for all categories and multiple paused decks. A paused automatic zero
   must not be restored by gestures elsewhere. Resume without editing that zero
   must keep it silent. Explicitly zeroed stems retain manual-zero protection.
5. With D1/D2 at 0/100, Release loaded D3 at zero from Playing and Paused. Expect
   D1/D2 unchanged. Repeat D3 at 30 with D1/D2 0/70: Release must leave **0/70**,
   not restore to 100 or normalize to 50/50. Empty Release must remain inert.
6. Repeat with D4 participating, OFF combinations, Main adjustments and independent
   category gestures. Observe `liveParticipant` in Audio diagnostics. Watch for clicks,
   gain jumps, unexpected pauses or UI/native disagreement; report exact sequence.

Stop at G2 for physical review. The future compact mixer, Waveform/Cue, beat repeat,
looping and matching improvements are recorded only; none was implemented here.

## Exact implementation files

Changed `native-stem-handoff.js` for the derived live-capacity gate, prepared Resume
and preserve-only departure; `playable-controller.js` / `playable-app.js` pass the
opt-in flag/build label; `serve-hypnotic.py` adds the exact G2 route. Added
`performance-lifecycle.html` and the lifecycle fixture, JXA runner and browser tests.
Expanded the server route test. Appended RULES/design/audio verification records,
G1 physical result, this report and baseline manifest/README. Existing storage source,
UI styling and musical calculators were not changed; no new dependencies or research,
recording, beatmatching or future UI work.
