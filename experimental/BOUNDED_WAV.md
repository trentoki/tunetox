# Isolated bounded WAV / AIFF playback experiment

Open `/experimental/bounded-wav-player.html` through localhost. This page has no imports from
main application state, native stem playback, handoff, source routing, Signalsmith or SoundTouch.
Only the macOS test runner additionally imports the new reader/player/test files.

## Supported input and bounded storage

One deck, four aligned RIFF/WAVE files: mono/stereo integer PCM (tag 1, 8/16/24/32-bit)
or IEEE float32 (tag 3), including standard WAVE_FORMAT_EXTENSIBLE PCM/float subformats.
Chunk headers are inspected through tiny slices, including unknown chunks and odd-byte padding;
payload regions are converted in at most 250 ms chunks. No file.arrayBuffer(), decodeAudioData(),
full-recording AudioBuffer or compressed decoder is used. AIFF and AIFF-C are supported as described below. RF64/BW64, RIFX, float64,
compressed audio codecs and resampling remain unsupported.
Extensible valid bits must be positive and within the integer container (float requires 32);
PCM precision is left-aligned. Mono masks 0/1/2/4 and stereo masks 0/3 are accepted.
Custom subtype GUIDs and other speaker layouts are rejected explicitly. Files must match the actual
AudioContext rate and have identical source frame counts. Equal length cannot verify musical
alignment; exports must retain the same original start and leading silence.

Each enabled stem holds at most 1/2/5 seconds of scheduled PCM (two seconds by default), rounded
through 250 ms chunks. A recording shorter than the selected window naturally fits entirely in
that window. Source nodes are released as chunks expire. The logical PCM peak additionally
counts the current conversion arrays alongside their AudioBuffer copy. The encoded in-flight
read is reported separately. These counters measure application references/capacity, not total
browser/process memory or proven garbage/native reclamation. Test fixtures generate whole WAV
byte arrays solely to provide repeatable input; those fixture allocations are outside player PCM.

## Timeline and transport

One deck source-frame anchor and AudioContext anchor determine all stems' positions. Prepared
chunks start at times derived from their frame indices, never from four independent timers.
Loading now asynchronously prepares one 250 ms chunk per enabled stem at the selected position.
Ready means those chunks cover the exact selected sample. Ready Play reuses them immediately;
the rest of the rolling window is refilled after scheduling. The provisional common lead is
10 ms, with a selectable 50 ms fallback. Preparation and context resume are separate from that
lead and the unchanged 10 ms gain-opening fade. Pause disconnects sources and retains a covering
chunk; Stop resets position and retains/replenishes a start chunk. Paused seek prepares without
moving its bookmark. Playing seek changes the timeline immediately; late streams join at the
current position instead of freezing the deck while preparing.
Generation and stem-activation identifiers reject obsolete asynchronous results. Underlying Blob
reads cannot be forcibly cancelled; new preparation is serialized behind them, while already
Ready playback can use cached PCM without waiting for old unrelated reads.

Voice starts dormant: no payload reads, buffers or sources, but its virtual position follows the
same deck timeline. Enable its checkbox while playing to prepare from a future current-position
coordinate and open its gain over 10 ms when ready. After preparation, scheduling recomputes the current source frame at the future onset and
uses a buffer offset to skip elapsed source samples. An entirely obsolete chunk is discarded
rather than replayed; the timeline never rewinds or pauses to accommodate a late stem. Manual deactivation is immediate.
There is no standby scheduler, readiness-aware handoff, looping, rate change or DSP.

The scheduler polls every 25 ms and converts PCM on the main thread. It is intentionally a
native-chunk feasibility test, not a render-thread/ring-buffer streaming implementation. Deadline
misses increment `underruns`; these are detected scheduling gaps, not hardware-output captures.
On a storage error playback retires its graph and reports the failure. Interrupted contexts,
background throttling, busy UI work and slow storage may cause stalls or gaps.

## Measurements

The page reports configured capacity, logically held PCM/peak PCM, encoded in-flight read bytes,
per-stem queued frames and remaining occupancy, latest region preparation time, activation
preparation/scheduling/fade details, source position and detected underruns. The default Voice
state has zero PCM occupancy until enabled. At 48 kHz stereo, four enabled stems need 1.536,
3.072 or 7.68 MB of scheduled PCM for 1/2/5 seconds, plus one bounded conversion/read and browser
buffers. Three enabled stems use three quarters of those scheduled capacities.

## Safari procedure

1. Run `python3 -m http.server 8000 --bind 127.0.0.1` from the project directory.
2. Open `http://127.0.0.1:8000/experimental/bounded-wav-player.html`.
3. Select four supported matching-rate WAV/AIFF/AIFF-C stems. Click Load headers & prepare.
   Confirm transport stays stopped and position fixed while audio changes from Preparing to Ready.
   If the rate is rejected, the error reports the context rate: use matching exports for this
   experiment. No silent resampling is performed.
4. Play with device volume low. Voice is dormant. Confirm its occupancy is zero, listen beyond
   two seconds, and watch occupancy/underruns. Activate Voice mid-song: it should join at the
   current musical position, not from zero. Report preparation time separately from fade quality.
5. Adjust each gain independently, including during activation. Compare `lastStartup` for Ready
   versus unprepared Play. Pause/resume; rapidly repeat Stop/Play; seek
   while stopped and playing. Check alignment, clicks, gaps and old audio. Transport edges may
   click: no extra release-envelope correction was included.
6. Stop, compare windows 1, 2 and 5 seconds over the same files, and repeat. Also compare
   10 ms scheduling with the 50 ms fallback, watching underruns and listening for startup gaps. Try CPU/UI pressure
   and slow local storage separately. Do not assume Files/iCloud items are offline without testing.
7. Close audio. The existing TuneToss main page/player are unaffected.

## Tests and limits

`tests/bounded-wav-tests.js` runs in the full macOS suite. `/tests/bounded-wav-browser-tests.html`
adds OfflineAudioContext render checks and real-time Chrome refill checks. Offline suspension
times are measured from the actual context clock because suspend rounds to render boundaries.
Tests cover sliced conversion/header validation, bounded windows, shared sample alignment,
continuous refills, Voice activation, seek, pause/resume, cancellation, read failure and cleanup.
No Safari listening, hardware loopback capture, worker implementation, long-run CPU/memory study,
or production-readiness claim follows from these tests.

## Safari file-picker compatibility correction

The original picker hint was `accept=".wav,audio/wav"`, which omitted `.wave`. WAVs were reported
greyed out in Safari before the reader ran. The prototype now omits `accept` entirely (not
`*/*`), allowing Files/Finder selection without depending on native MIME/type mappings.
`.wav`, `.wave`, uppercase variants, empty MIME and unexpected MIME therefore reach the same
unchanged RIFF/WAVE/format-tag validation on Load headers. Renaming an unsupported file does
not make its encoding supported. Selection alone does not read/decode audio or start playback.

`audio/wav`, `audio/x-wav`, `.wav` and `.wave` are valid HTML accept tokens, but validity does
not establish consistent native Safari filtering. This session did not exercise Safari's
native picker or identify the exact OS/type-mapping failure. Chrome programmatic selection
checks verify the absence of a filter, mixed MIME/extension handling and explicit rejection of
unsupported PCM encodings; they do not automate the macOS/iPadOS picker UI.

In Safari, refresh this standalone page, open Choose File, and verify that your original WAVs
and a `.wave` file can be selected. Click Load headers: supported integer PCM should load;
compressed/unsupported/non-WAV content should show a specific error. Matching-context-rate restrictions and
all bounded streaming behavior remain unchanged. No main-application pickers were changed.


## RIFF/WAVE format diagnostics and float/extensible support

The old generic container error was raised only when byte markers were not RIFF at 0 or WAVE
at 8. It did not establish an encoding: valid RIFF float/extensible files failed a later check.
New diagnostics include filename, a stable error code, observed container/form markers and the
first 12 bytes for container errors. RF64/BW64 and RIFX get specific unsupported-container errors;
FORM is identified as non-RIFF (e.g. AIFF). Truncated/malformed headers/chunks, missing format/data,
compression tags, unsupported bit widths and extensible GUID/valid-bit/layout errors are separate.

The reader now supports float32 and standard extensible integer/float variants using bounded
header reads (at most 40 bytes per fmt read) and existing quarter-second payload slices. It never
rewrites, normalizes or fully decodes source recordings. Finite float values above unity are
preserved and may clip when mixed; NaN/Infinity are rejected when encountered during a bounded
payload read, not claimed to be pre-scanned at Load headers. Reduced valid-bit integer PCM is
interpreted as left-aligned. Successful Load shows per-stem encoding, bit depth, valid bits,
channels, sample rate and frame count in the status JSON.

Without the failing file or new signature diagnostic, the exact Safari container failure cannot
be identified. General native playback supports more formats than this bounded reader. Retry
Load headers and retain the complete filename/error code/first-byte message if it still fails.
Float/extensible support is independently tested; it is not asserted to fix a non-RIFF signature.


## Header-detected AIFF / AIFF-C extension

The user's new diagnostic establishes FORM/AIFC rather than RIFF/WAVE; filename and MIME were
misleading. `inspectBoundedAudioFile` now dispatches on actual bytes. WAV-only inspection stays
available for its regression tests; existing RIFF PCM/float/extensible support is preserved.
The common bounded sample reader uses parsed byte ordering and signedness; its historical
`readPcmWavFrames` name remains for compatibility, without a separate playback engine.

Supported:
- AIFF signed integer PCM, big-endian, mono/stereo, sample precision 1–32 bits packed into
  ceil(bits/8)-byte containers; non-byte-sized precision is left-aligned.
- AIFF-C NONE (same big-endian PCM) and sowt (little-endian PCM).
- AIFF-C fl32/FL32 (big-endian IEEE float32), using the existing finite-float sample path.
- COMM before or after SSND, unknown chunks with odd-byte padding, nonzero SSND sample offsets,
  SSND block-size metadata and extra SSND padding beyond the COMM-declared frame count.

FORM/chunk lengths, COMM, FVER and SSND are inspected with small bounded reads; SSND payloads
are skipped during header parsing. COMM's 80-bit extended sample rate is interpreted explicitly;
only positive whole-number rates are accepted and they must match the context. COMM frame count
is authoritative and checked against available SSND bytes. SSND offset moves the sample start;
blockSize is disk-alignment metadata, not compressed block decoding. No source files are changed.

Standard AIFF-C requires a valid FVER (0xA2805140) and a structurally valid Pascal compression-name
field. Missing/unsupported versions, truncated fields, invalid offsets/rates, excess channel counts,
unknown FORM types and insufficient sample data produce explicit filename/error-code diagnostics.
Other encodings (including ima4, ulaw/alaw, and fl64) remain unsupported. Compression codes are
case-sensitive; fl32 and FL32 are explicitly recognized. This is not general AIFF-C decompression.

Load status now reports container, compression code, endian flag, encoding, container bits,
valid bits, channel count, rate and frame count for each stem. For the user's file, FORM/AIFC
alone does not identify its compression code: retry Load headers and inspect the new metadata
or encoding error. Re-exporting/renaming is unnecessary for supported variants.

Tests in tests/bounded-aiff-tests.js cover byte order, signed 8-bit, 20-bit-in-24-bit PCM, 80-bit
rates, chunk ordering/padding, SSND offsets, malformed and unsupported files. Browser rendering
runs both the original WAV fixtures and mixed WAV/AIFF/NONE/sowt/fl32 fixtures through identical
sample-by-sample continuity, seek and dormant-activation checks; real-time refill also runs WAV
and AIFF-C. No Safari listening was performed. The parser does not depend on Safari's native
codec support, but local storage access, matching device/context rate, timers, main-thread CPU
and scheduling behavior still require Safari verification. Existing buffering/latency and
resource limitations remain. Main application and existing playback engines are unchanged.


## Ready-to-play, startup timing and authoritative timeline milestone

Transport (`stopped`, `paused`, `playing`, plus pending-start flag), source-frame timeline and
PCM readiness/preparation are independent. All stems expose the same derived musical position,
including dormant or unprepared stems. Only the Render checkbox changes a stem's enabled flag;
seeking, pausing and stopping do not make stems dormant. A playing seek starts its new timeline
without awaiting file I/O. Dormant/late audio uses source frames derived from its eventual output
time; offsets trim preparation delay from a still-useful chunk. Generation and per-stem epoch
checks reject stale buffers and callbacks. Tick work is shared to avoid accumulating timer jobs.

While paused/stopped, readiness holds at most one covering 250 ms AudioBuffer per enabled stem.
It can reuse a buffer with a source offset, preserving the exact selected frame. Stop keeps
zero-position chunks where available; otherwise it starts background preparation. At 48 kHz
stereo the four-stem ready cache is at most 0.384 MB of PCM. No extra permanent start cache is
pinned while streaming: all PCM remains within the selected rolling capacity plus bounded
conversion/read temporaries. No complete recording is decoded. Underlying browser reads are
not claimed to be forcibly cancelled; Stop releases control state immediately and stale work
cannot schedule sources or commit loaded metadata.

Instrumentation now separates latest PCM file-read time, PCM conversion, AudioBuffer create/copy,
preparation wait, context-resume wait and scheduling work. `lastStartup` records Ready status,
read count/stage durations, selected source frame, scheduling context time, lead, and predicted
command-to-onset time. `actualAudibleLatencyMs` is null: these are wall-clock/context-clock
estimates, not an acoustic/loopback measurement. Float timer precision can report sub-resolution
work as 0 ms; it is not zero-cost processing. The 10 ms opening ramp follows scheduled onset.
Logical PCM counters are not native/browser memory measurements. Preparation totals describe
accepted PCM preparations; header inspection and stale discarded reads are not startup PCM work.

### Chrome before/after measurements

Measured in headless Chrome on the same machine using generated local File/Blob-backed silent
10-second, 48 kHz stereo WAVs, three enabled stems, eight Stop/Play trials. This is warm generated
input, not measured SSD/HDD/iCloud latency and not a Safari performance claim.

| Path | Command work | Lead | Predicted command-to-scheduled-onset |
| --- | --- | --- | --- |
| Previous implementation | 5.0–7.4 ms | 50 ms | 55.0–57.4 ms |
| New Ready path | 0–0.1 ms (timer resolution) | 10 ms | 10.0–10.1 ms |
| New unprepared example | 0.9 ms | 10 ms | 10.9 ms |

Ready trials performed zero PCM reads/conversions/buffer allocations on Play. The unprepared
example measured 0.3 ms reads, 0.5 ms conversion, 0.1 ms buffer preparation (three chunks),
with context/queue overhead included separately. The 50 ms Ready fallback measured 50 ms
predicted onset without new PCM work. Tests separately exercised continuous refills and rendered
WAV/AIFF/AIFF-C streams with zero detected scheduling underruns under their controlled conditions.
The under-20-ms target is demonstrated for Ready scheduling in this Chrome setup only.

### Additional regression coverage and remaining risks

`tests/bounded-ready-tests.js`: asynchronous prewarming, cache reuse, repeated Stop/Play,
Pause/Resume, paused and playing seeks, four-stem common scheduling, 40 ms delayed activation,
delayed seek, cancellation during resume/header/payload reads, all-dormant advancing timeline,
stage counters and bounded cache cleanup. `tests/bounded-ready-browser-tests.js` measures actual
browser startup estimates; existing browser tests retain per-sample render comparisons for WAV
and mixed AIFF/AIFF-C plus continuous refill checks.

The user reported smooth Safari continuous playback before this milestone. New readiness and
10 ms scheduling still need Safari listening, startup/seek/reversal checks and stressed-device
measurement. Use 50 ms if 10 ms is unreliable. AudioContext interruption can freeze its clock;
background timers, main-thread conversion, slow storage and context resume can add latency.
Ready does not imply OS audio permission or hardware output readiness. Playing-seek/dormant
preparation can leave a gap until valid PCM is ready; no outgoing-audio hold, handoff policy,
release fade, worker/worklet engine or waveform UI was added. Main application remains unchanged.
