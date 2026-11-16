# Playable 0.1 — Phase 1C: manual two-deck test

Physical evidence supplied by the user: Phase 1A tone and Phase 1B Hypnotic playback,
independent stems, pause/resume and Stop/restart worked on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers. Phase 1C physical verification is pending.

Start `python3 -B development/playable/serve-hypnotic.py` from the repo root.
Open http://192.168.50.24:8766/two-deck on the same trusted LAN. Phase 1B remains
unchanged at http://192.168.50.24:8766/ . No directory browsing, AIFF, arbitrary paths,
external-drive access or additional songs are exposed. This is unauthenticated HTTP
for local development, not public hosting. Close the fallback tab before this test.

1. Lower physical speaker volume. Load Deck 1 (Hypnotic), wait for Loaded, press Play.
2. Load Deck 2 (Cut Me Loose) while Deck 1 plays. Wait for Loaded, then Play Deck 2.
3. Adjust each main and stem control. Confirm the other deck's controls stay unchanged.
4. Pause/resume each deck while the other plays. Stop/restart each independently.
5. Release unloads only its deck. Reload is then available; it does not autoplay.
6. If anything is silent, freezes, clicks or reloads Safari, note which action triggered
   it and capture Diagnostics, including context state, positions and destination meters.

One shared native mixer owns Decks 1–4; this host uses Decks 1 and 2 only. Each song's
four sources start at one native start time and offset. The songs do not share a beat
or start time and remain at native rate 1. No allocator, participation state or handoff
adapter is initialized; automatic handoff is explicitly OFF in this host. This does
not change the production handoff implementation. No matching/FX/looping or Design
Mode integration is present. Gains use existing native gain ramps and direct actions;
production coordinated scheduling is not changed.

Each song has a worst-case output budget 0.4, so simultaneous worst-case source-rate
summing is <=0.8 at full allowed controls. Main ceilings derive from scanned absolute
sample peaks: Deck 1 0.1; Deck 2 approximately 0.108889. Initial mains are 0.075 and
stems 0.5. No normalization, limiter or changes to original PCM. Equal source and
decoded frame/rate alignment is checked; musical start alignment relies on exports.

Memory estimates at 44.1 kHz: Deck 1 328.125 MiB, Deck 2 253.960 MiB; total 582.085 MiB.
At 48 kHz, total is approximately 633.6 MiB. Only one load/decode sequence is allowed
at a time. Engine sequential decoding avoids a full eight-file encoded cache; one
additional encoded file and decoder/network temporaries can still be live. Reloading
a loaded deck is disabled; Release first avoids retaining an old replacement set.
Release removes engine buffer references, but browser reclamation timing is unknown.
Chrome-only JS heap diagnostics are explicitly not total audio/process memory.
Actual peak physical iPad memory and playback under Safari memory pressure remain
unmeasured. Internal meters cannot establish physical output or dropout-free audio.

Verification commands:
- `python3 -B tests/hypnotic-server-tests.py`: format/finite PCM/mismatch rejection,
  per-song gain budget, eight-file allowlist and traversal/AIFF rejection.
- `osascript -l JavaScript tests/run-tests.js`: 43 passing result messages, with the
  pre-existing macOS service-connection warnings.
- `python3 -B tests/two-deck-playable-check.py`: Chrome CDP port 9230, actual two-song
  loading, no autoplay, loading while playing, simultaneous native eight-source playback,
  independent gains/transport, release/reload, owner cleanup and fallback serving.
  This uses existing stdlib CDP infrastructure; no dependencies installed.

Stop after this checkpoint; wait for physical two-song confirmation before integration.

Executed results: all three server tests passed; all two-deck browser assertions
passed, including unload/reload while the opposite deck continued and explicit owner
cleanup. The Phase 1B fallback was served successfully. Chrome reported 612,287,957
used JS-heap bytes after both songs loaded (~583.9 MiB), not total process memory;
this number is browser-specific and must not be treated as an iPad peak-memory result.
An initial test run stopped on an unsupported `performance.memory.toJSON()` call in
the test reporter; the reporter was corrected to read explicit fields and the full
check reran successfully. No engine correction was needed.
