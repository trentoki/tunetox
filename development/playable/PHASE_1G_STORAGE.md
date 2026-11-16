# Phase 1G G1 — persistent audio storage checkpoint

**Storage workstream only. Physical iPad review pending.** As authorized by the
request's large/risky-work clause, complete and review storage before changing
paused handoff and Release. Those two known F3 lifecycle problems are NOT fixed
in G1. The deferred handoff-preview concept is recorded only, not implemented.

Open **http://192.168.50.24:8766/performance-storage?build=1g-g1**.
Confirm **G1 STORAGE / 1G G1**. F3 remains `/performance-first-play?build=1f-f3`.
The existing allowlisted Mac server serves the page. The user explicitly chose
this existing-address checkpoint over trusted HTTPS/offline-shell setup.

## Preservation / verified starting point

User confirms F3 first Play correction on physical iPad Safari. Paused Tune gestures
still redistribute playing decks, and releasing a loaded silent Deck 3 caused
0/100 -> 50/50. These observations are recorded, not retested or fixed in G1.
F3 source-only archive: `baselines/phase1f-f3.tar.gz`, SHA-256
`1ea7039621d9aa943d0b1e0a6e096c478fb886d4c0d9ec5bfd86ef5dcd54e68e`.
JSON records per-file hashes and physical scope; includes uncommitted source, so
Git HEAD alone is not the rollback point. Extract only into a fresh directory.
No original recordings or generated research audio are included or changed.

## Measured bottleneck and choice

Before storage changes, a fresh actual native-engine load on the Mac transferred
all eight stems again: about 610 MB (582 MiB). Hypnotic total load 982.3 ms,
Cut Me Loose 666.6 ms. Summed ResourceTiming request durations were 419.6 ms and
325.0 ms. Total minus network duration includes decode, UI and scheduling overhead;
it is NOT an isolated decoder benchmark. The timing browser allowed autoplay to
avoid waiting on activation; user-gesture behavior is tested separately.
These loopback/LAN-host timings do not represent the slower physical iPad Wi-Fi.

Encoded Blob storage in versioned IndexedDB avoids repeat transfer without keeping
all songs decoded in RAM. The native sequential decoder, shared decoded pool,
transport, gains and graph are reused unchanged. Metadata listing, import and
assignment restore hints do not initialize an AudioContext or decode audio.

## Implemented

- Import four files per song (transients/flow/tune/voice) or song folders. Local
  folder import ignores original.aif and unrelated files; stems are sufficient.
  File inputs are read-only. Optional buttons import the existing two allowlisted
  LAN test songs once. No expanded external-drive access or arbitrary paths.
- Existing bounded WAV parser validates headers, mono/stereo float32, 44.1/48 kHz,
  equal frame count/rate and complete files before a write. Supplied common export
  origin remains an assumption; equal lengths do not prove musical alignment.
  Temporary G1 limit: 512 MiB encoded per stem (up to 2 GiB per song).
- Song metadata plus four blobs commit atomically. Quota/write errors roll back
  the entire new song. No partial visible imports. Original files remain untouched.
- Exact duplicate detection compares bytes in bounded 1 MiB slices; titles, sizes
  and modification times alone never establish equality. Identical reselected
  files reuse the stored song; different contents stay distinct. Duplicate checks
  reread local encoded data but never decode. Use one importing tab at a time;
  simultaneous cross-tab deduplication is not guaranteed in this first checkpoint.
- Stored songs appear in the same shared library and a Storage panel with four
  direct Load targets. Loading retrieves one encoded stem at a time from IDB,
  then uses native `loadFiles`; repeated loaded songs still share decoded PCM.
  Cache loading never silently falls back to a server transfer.
- Deck assignments persist as IDs. After reload/restart they are manual Restore
  targets in Storage: no automatic decode, playback, Main restoration or authorization.
  Main remains zero initially. No claim of full-session/playlist/link persistence.
- Storage panel reports encoded usage, origin, quota estimate/persistence where
  available. Missing keys mark a song unavailable; missing/corrupt-size blobs fail
  Load with reimport guidance. Remove unavailable entries before reimporting.
  Explicit removal deletes only browser copies, never original music.
- Import requires releasing loaded decks first to bound memory pressure. This is
  a temporary storage-fixture safeguard, not a musical rule or native-engine change.
- Targeted `touch-action:manipulation` on performance targets suppresses accidental
  double-tap zoom while retaining pinch zoom and existing child gesture rules.
  No `user-scalable=no`, maximum-scale limit, global touchmove cancellation, back
  trapping or library-scroll prohibition. Best-effort beforeunload warning while
  playing cannot reliably prevent Safari/OS swipe navigation or process termination.

## Storage / offline limitations

On the selected HTTP LAN origin, audio is read locally after import; the app HTML,
JS and CSS still need the Mac server when opening/reloading. No full offline-app
claim is made. The user chose this scope explicitly. Reopening without the server
requires a later trusted secure-origin offline shell; no certificates, trust settings,
service workers or public deployment were installed for this checkpoint.

Storage is per exact origin (scheme + host + port), device and Safari profile.
Keep this address stable; another IP/port is a different library. Normal browser
restart persistence was tested in Chrome, not guaranteed on iPad. Private browsing,
user-cleared website data, low disk space, quota changes and Safari eviction can
remove it. Persistence can be requested, never promised. Keep original files as
backup. Browser-managed storage is not a backup or cross-device sync feature.
HTTP remains a trusted-LAN development limitation, not a release security claim.

## Verification

- Real IndexedDB deterministic tests: 19 checks, zero decodes. Four distinct songs,
  exact duplicate/different-content handling, invalid/missing/misaligned stems,
  injected quota failure and atomic rollback, assignment validation, reopen,
  missing assets and removal. A simulated quota exception is not an actual full
  physical iPad disk test.
- Storage UI/browser: 22 checks. Import four distinct generated WAV sets, reload,
  load all four without media requests or autoplay; assignments survive; metadata
  boot does not create audio. Fixed 1194×834, 1024×768, 390×844 and 320×568 viewports.
- Full Chrome restart retained all four fixture songs and assignments. Two actual
  songs were then imported from the allowlisted server with no decoding on import.
  After reload, both media and catalog endpoints were blocked. Four deck slots
  loaded/played those real stored songs (two distinct recordings repeated), with
  nonzero native destination and no scheduling failure: 15 checks passed.
- Measured local load durations: 510 ms / 321.5 ms for first two real decodes;
  reused decks 2.1 / 3.0 ms. Zero media requests after reload. Unique decoded PCM
  stays 610,360,736 bytes, excluding native/browser overhead. Prior 1.4–1.5 GiB
  sampled renderer memory risk remains; storage does not remove decode memory.
- Existing audio runner: 44 groups passed; F3 672, F2 native 218, F2 pure 1,522,
  F1 expansion 234 and P1 controller 22 checks passed. Browser regressions also
  passed: F3 92, F2 38, F1 120, P1 114, M1 35, R1 29, manual 37 and single-song 14.
  Three expanded allowlist tests and `git diff --check` passed. No remaining automated
  failures. F3 archive and 56 protected instruction/UI/audio/algorithm source hashes
  were verified. Existing JXA macOS service warnings do not establish audio failure.

Tests initially targeted a Load button below the Storage panel viewport; corrected
scroll-into-view automation, then all four actual Load gestures passed. Initial
baseline timing stalled on browser activation; the benchmark was repeated with
explicit autoplay permission. These were test setup issues, not hidden fixes to
the audio engine. All results are Chrome evidence, not physical Safari output.

## Physical iPad acceptance

1. Keep F3 bookmarked. Open G1 and confirm build labels. Tap **Storage**.
2. With decks released, enter a title and select all four aligned WAV stems using
   Files, then **Import selected stems once**. Repeat for four songs, or use folder
   import where Safari offers it. Originals need not move into the repository.
   The two prepared LAN song buttons are an optional first convenience test.
3. Confirm stored-song count. Select the same files again: count should not increase.
   Request retained storage if available; lack of a grant is clearly reported.
4. Reload. Stored songs should appear with no audio transfer. Load them explicitly
   onto Decks 1–4; Main starts at zero and nothing plays until you press Play.
5. Quit/reopen normal Safari and revisit the exact address. Confirm stored songs
   and manual Restore targets. The Mac page server must remain available for G1;
   audio assets should not retransmit. Check Wi-Fi transfer behavior and load times.
6. Test performance controls, pinch zoom, deliberate library/Storage scrolling and
   rapid taps. Double-tap on performance targets should not zoom the page; fader
   dragging and first-touch priority should remain intact. OS navigation cannot be
   guaranteed blocked; local audio remains stored even if a session is lost.
7. Report quota/persistence messages, unexpected reloads, missing assets, startup
   failures or clipping. Do not use this storage checkpoint to validate paused or
   Release corrections: those workstreams remain pending.

Future only: an Advanced resume-preview indicator showing proposed donor changes.
No preview UI, paused-ownership rewrite, Release fix, BeatMatch or DSP work was done.

## Source / references

Added `local-audio-store.js`, `local-audio-panel.js`, `local-audio.css`,
`performance-storage.html`, plus three focused storage test files. Changed only
opt-in branches in `playable-controller.js` / `playable-app.js`, exact asset routes
in `serve-hypnotic.py`, server route tests and appended documentation/baseline records.
Native player, decoding/buffering, allocator/actions, audio bridge and original
Design Mode were verified byte-identical against F3. No new dependencies.

Browser restrictions were checked against primary documentation:
[WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/),
[service worker secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).
These explain why browser-managed storage cannot promise permanent retention and
why the chosen HTTP checkpoint is not a fully offline application shell.

### Physical G1 checkpoint

User confirms two songs retained across Safari reload, loaded without retransfers
and continued playback/handoff. G1 storage is the current approved baseline. See
PHASE_1G_G2.md for the separately opt-in lifecycle correction and preservation.
