# Playable 0.1 — Phase 1B

Phase 1A was physically confirmed audible by the user on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers. Phase 1B music audibility is pending.

Run from the repository root:

```sh
python3 development/playable/serve-hypnotic.py
```

Open `http://192.168.50.24:8766/` on the same trusted LAN (adjust the IP if the
Mac address changes). This separate port preserves the existing port-8765 preview.
The server has no directory browsing, generic path mapping, uploads or CORS access.
Only the page, two JS assets, manifest and four exact WAV routes are exposed.
It is plain HTTP without authentication: use only the intended trusted local network.
Original AIFFs, other songs, repository files and external-drive browsing are excluded.

1. Lower iPad speaker volume, then tap **Load Song**. Loading resumes the context
   from that gesture but does not play. Four progress stages download/decode sequentially.
2. Wait for **Loaded**, then tap **Play**. All four BufferSources use one native
   start time/offset. Raise physical speaker volume gradually if needed.
3. Adjust each stem; main is separate. Test one stem at a time by muting the others.
4. Tap **Pause**, then **Play** to resume; **Stop** resets all stems to time zero.
5. If silent, expand Diagnostics and record context state, destination peak/RMS and
   per-path live meters. Nonzero measurements are not physical audibility confirmation.

## Validation and safety

Startup parses RIFF chunks and validates float32 mono/stereo 44.1/48 kHz layout,
finite PCM, equal source frames/rates and durations. Reads are bounded to 1 MiB.
Native decode additionally validates equal decoded frame counts/rates and channels.
Equal lengths cannot prove acoustic alignment; the supplied aligned export origin is
assumed. There is no trimming, normalization, resynthesis or hidden synchronization.

Actual Hypnotic files: 10,752,001 frames each, stereo 44.1 kHz float32, 243.809546 s.
Each has maximum absolute sample 1.0. The server derives a main ceiling of 0.2 from
0.8 / sum(stem peaks). With each stem slider <=1, the source-rate worst-case absolute
sum is <=0.8. This leaves resampling headroom; it is not an added limiter. Main starts
at 0.15, stems at 0.5. Existing engine gain ramps are retained.

Retained decoded PCM: 344,064,032 bytes = 328.125 MiB at 44.1 kHz, approximately
357.1 MiB at 48 kHz. Sequential fetch/decode avoids an explicit four-file encoded
cache or Blob/File copies. One encoded file is about 82 MiB; decoder temporaries,
network buffers and browser memory add overhead. Total process/physical iPad memory
has not been measured. Reloading a loaded song is disabled to avoid replacement peaks.
Errors eject incomplete audio and leave a retryable Load button.

## Verification

- `python3 tests/hypnotic-server-tests.py`: WAV validation, nonfinite/malformed input,
  mismatch rejection, conservative ceiling and route/traversal allowlist checks.
- Existing `osascript -l JavaScript tests/run-tests.js`: 43 passing result messages;
  macOS service-connection warnings are still emitted.
- `python3 tests/hypnotic-browser-check.py` with isolated headless Chrome on debug port
  9230: actual song fetch/decode, no autoplay, four-source start, nonzero destination,
  pause/resume, Stop, four independent gain changes, live main gain and 1194x834 fit passed.
- Physical iPad memory, Safari interruption handling and audible music remain for user
  confirmation. No second song, Design Mode adapter, matching, handoff, EQ, FX or loops.

The test uses unprotected native `player.play()`/gain actions, as no allocation or
handoff is exercised. It does not alter the production coordinated-scheduler rules.
