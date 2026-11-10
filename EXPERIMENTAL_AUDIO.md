# Deck 1 pitch-preserving prototype (B2.2)

This is a single-deck experiment, not a production synchronization engine. The original
`audio-engine.js` and `app.js` are unchanged. Decks 2–4 and Normal Playback use the original
four-deck engine, including its unrestricted positive rate ratios.

## Run in Safari

From the project folder, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` in Safari. Keep that terminal running. Stop it with Control-C.
Use localhost instead of double-clicking index.html: AudioWorklet modules need a trustworthy
origin and working module fetches. No internet, CDN, npm installation, or build step is needed.
Files selected through the picker remain local and are decoded into memory.

1. With Deck 1 empty, select **Pitch-Preserving Playback**. Load a mono or stereo WAV/MP3
   supported by Safari. The file-picker gesture wakes the experimental context, but loading
   must not start playback. If Safari refuses initialization, select the file again.
2. Enter original BPM 120 and target BPM 96. Apply tempo and Play: expect 0.8× speed with
   original pitch. Try 120 and 144 (1.2×). Listen with a steady tone, vocals, drums, and full music.
3. Adjust BPM while playing. The same DSP instance stays alive; existing queued output drains
   before new-tempo output. Listen for transients, pitch wobble, gaps, and clicks. Smoothness
   is not guaranteed or verified by the automated tests.
4. Pause, wait, then Resume. Sound should stop after already-submitted device audio clears,
   then resume the retained DSP output without skipping the buffered source. The PCM and
   DSP-consumed counters must freeze. The audible estimate may settle briefly during Pause.
5. Stop then Play: start at the beginning, retaining applied tempo. Eject while playing or
   loading: stop experimental output, clear file/BPM/position, and prevent late playback.
6. Reload, let a short file finish, and Play again. Listen for missing or extra tail audio.
   Final-window padding and trimming use the nominal source map; exact transient/tail
   alignment is a manual acceptance check.
7. Try ratios outside 0.8–1.2 and invalid BPMs: reject without changing applied settings.
   Eject, select **Normal Playback**, reload, and apply 120 → 180: normal mode must still
   accept 1.5× and change pitch. Play Decks 2–4 concurrently and verify their controls still work.
8. Disconnect internet access and reload the localhost page. Repeat playback and confirm no
   remote requests in Safari's Network inspector. The local server must remain running.

Mode switching is intentionally allowed only when Deck 1 is empty. Eject first. No automatic
handoff or position transfer between the normal and experimental transports is implemented.

## Implementation boundary

- `experimental/deck-one-transport.js`: lazy experimental AudioContext, worklet setup,
  file decode, message acknowledgements, cancellation, mode routing, and timing estimates.
  A separate context isolates this prototype from the existing normal context. It is not
  suspended for Pause, so other playback is unaffected. The experiment allocates one PCM copy.
- `experimental/deck-one-processor.js`: owns original PCM, feeds the existing SoundTouch
  WSOLA stage on demand, retains state on Pause, replaces state on Stop, and releases it on
  Eject. Commands take effect between render callbacks. Processing work per callback is bounded.
- `vendor/soundtouchjs-2.1.1/`: pinned published AudioWorklet bundle and licenses.
  `soundtouch-export.js` adds only an export to the original self-contained bundle.
  The processor uses the bundle's existing `Stretch` class directly at unity pitch, changing
  its existing `tempo` property. No overlap, transient-search, interpolation, or stretching
  algorithm has been rewritten. The standard upstream pitch-compensation processor is unused.

Tempo messages are applied to future DSP generation, not retroactively to queued output.
Pause retains read-ahead, overlap history, and queued output; resuming does not construct
another source or re-read the song. Stop discards all DSP buffers and resets original PCM
read position to zero. Eject disconnects output immediately and posts disposal before closing
the port. Audio already queued in the operating system cannot be recalled.

## Timing definitions and limits

All source positions are seconds in the decoded original-song timeline. Decode resamples to
the AudioContext sample rate; tempo changes never rewrite that PCM timeline.

- **PCM read/source position:** original frames copied into the DSP input, including read-ahead.
- **DSP-consumed/processed position:** frames removed from the DSP input FIFO, excluding
  zero padding beyond the file. Some consumed material remains in DSP overlap/output buffers.
- **Rendered map:** a nominal source position associated with output frames already emitted
  by the worklet. Each generated output batch is mapped across the source frames consumed
  while creating it. This mapping accounts for queued DSP output, but WSOLA's selected and
  overlapping source windows mean it is not an exact per-sample provenance map.
- **Estimated audible position:** rendered mapping interpolated at context time minus
  `baseLatency + outputLatency` where available. Missing browser latency values contribute
  zero. Reports arrive every eight render blocks and may lag if the main thread is busy.
  Hardware latency, Bluetooth, interruption, and browser timestamp accuracy are unverified.

These counters must not be substituted for future sample-accurate synchronization. The
experiment does not claim sample-accurate timing, seamless mode switching, click-free tempo
changes, or verified four-deck stretching performance. It is not a beat/transient analyzer.

## Automated tests

On this Mac, from the project folder:

```sh
osascript -l JavaScript tests/run-tests.js
```

Expect the existing Cue, Parent-scale, Pentatonic, Play Cue, Tempo, and Audio engine success
messages, plus `Experimental transport and real SoundTouch DSP tests passed` for both
44100 and 48000 Hz. The runner simulates AudioWorklet messaging and time but executes the
actual vendored DSP. It checks 440 Hz pitch within 3 Hz, stretched duration within 40 ms,
FIFO pause/resume continuity, end/restart, range guards, unchanged musical state, and disposal
and cancellation. The simulated deadline does not establish real-time CPU capacity.

For real module loading and browser transport checks, open
`http://127.0.0.1:8000/tests/experimental-browser-tests.html` and click **Run tests**.
This briefly plays a quiet generated tone. Expect a success message or a visible error.
This browser test is provided for Safari verification; it was not run in Safari during
implementation. Its waiting intervals are smoke checks, not precision timing measurements.

The original `tests/audio-engine-tests.html` still runs the normal engine tests unchanged.

## Licensing and offline assets

SoundTouchJS AudioWorklet 2.1.1 is MPL-2.0. Keep the included LICENSE, copyright notices,
readable covered source, and modifications available when distributing. The published bundle
inlines its core, worklet-base, and Lanczos dependencies; no bare package imports or network
assets are used. See `vendor/soundtouchjs-2.1.1/UPSTREAM.md` for archive provenance, checksum,
and the exact export-only extension. No package manager or application framework was added.

Local-server offline operation is supported by local assets. Installed-PWA caching and
persistent music storage remain future work. Tablet testing from a Mac's LAN address requires
an appropriate HTTPS origin; plain LAN HTTP does not gain the localhost trust exception.

## Future synchronization constraints (not implemented)

Preserve original source-timeline coordinates for later analysis of transient patterns and
recurring musical activity. The highest-level incoming stem (transients, flow, tune, or voice)
will determine meaningful entrance; isolated early sounds must not override a later sustained
or recurring start. Future beat-aware scheduling will align that entrance with the outgoing
endpoint and choose direct entry or pre-roll for accuracy and continuity. This prototype adds
no entrance analysis, beat matching, stem processing, or synchronization decisions.

## B2.5 — Signalsmith comparison

The user confirmed all seven SoundTouch Safari playback tests and the real AudioWorklet
browser smoke test passed. SoundTouch quality was judged less smooth than historical V40.
Those passed checks remain the baseline; they do not establish Signalsmith browser behavior.

Empty Deck 1 now selects **Normal / SoundTouchJS / Signalsmith**. Eject before changing modes.
Both stretch modes retain the 0.8–1.2× range and zero pitch transposition. Normal playback and
Decks 2–4 keep their existing behavior. No musical matching, cue, stem, or sync code changed.

### Local assets and unchanged library

`vendor/signalsmith-stretch-1.3.2/SignalsmithStretch.mjs` is the exact inspected npm release,
including embedded WASM/worklet code. It is not patched. MIT notices, README, package
metadata, integrity, and source provenance are alongside it. The wrapper's `moduleUrl`
property points to this same local file. No runtime network dependencies or build are needed.

### Transport differences

`experimental/signalsmith-transport.js` is a separate backend. It caches original decoded
PCM and copies it into the library, keeping source coordinates available for future analysis.
It maintains an explicit source/context-time schedule; it never uses periodic `inputTime`
read-ahead as a pause bookmark. Its positions are planned/estimated, not sample-accurate.

Pause mutes the comparison output immediately, saves the planned source coordinate, and
schedules inactive processing. Signalsmith processes silence rather than freezing its FIFO.
Resume schedules active processing from that saved coordinate, with zero semitone shift,
and a lead interval obtained from `node.latency()`. A short restart delay is therefore expected.

Stop mutes/disconnects and closes the dedicated AudioContext, retaining original PCM/BPM
for the next Play. Play creates fresh DSP at source zero. Eject also releases original PCM
and BPM. Closing the dedicated context avoids depending on a missing wrapper dispose API;
other audio contexts/decks are unaffected. Pending reads, decode, initialization, and Play
are generation-checked; Eject cancels them and late-created nodes are disconnected.

Natural completion is predicted from the active source-time/rate schedule. A native gain
schedule permits one additional reported DSP-latency interval for residual output, then
mutes. The UI's periodic state poll closes the context and marks the source at its endpoint.
Tail preservation and the adequacy of that allowance remain listening checks. Background-tab
polling may delay context cleanup, although the scheduled audio gain still reaches zero.

Live tempo commands retain the same library node and its input/output buffers. The wrapper
handles the transition; applied source-timeline estimates do not prove exact audible timing
or click-free output. All schedule calls specify zero semitone transposition.

### Honest measurements and levels

The Signalsmith display distinguishes cached source duration/saved coordinate, the library's
raw read-ahead report, and estimated audible position. DSP-consumed position, rendered sample
provenance, FIFO depth, and underrun counts are **unavailable** and are not invented. The
reported library DSP latency is distinct from estimated browser/device latency.

Both experimental paths now share `comparison-output.js`: identical 0.25 gain (-12.04 dB)
and sampled peak/RMS meters. Normal playback gain is unchanged. This supplies conservative
headroom and an observable level comparison, not perceptual normalization or a limiter.
Meters sample recent windows, so they can miss short peaks. Arbitrary music can still exceed
headroom; if a clipping warning appears, reduce the Comparison output level trim. The trim only
attenuates below the shared maximum, and can also match perceived loudness between modes. No claim is made that all sources are guaranteed unclipped or equally loud. Use the same
file, section, rate, browser/output volume and route; listen at matched perceived levels.

### Tests and Safari procedure

Run `osascript -l JavaScript tests/run-tests.js` from the project folder. Existing suites remain.
New adapter tests use simulated library acknowledgements and context time to cover range,
zero pitch, pause bookmarks, output muting, Stop/restart, natural completion, replacement
failure, repeated loads, cancellation during initialization, and closing all contexts.

Additional tests execute the **unchanged Signalsmith wrapper and embedded WASM** with a
simulated worklet clock at 48 kHz. The JXA harness uses synchronous WASM compilation because
it has no browser event loop; playback/DSP code and binary are unchanged. It checks 440 Hz
pitch at 0.8/1/1.2×, generated-tone headroom, post-Stop residual decay, and dropBuffers.
These do not establish Safari render-thread CPU performance, browser loading, or hardware timing.

Start the server as above and open:

- `http://127.0.0.1:8000/tests/signalsmith-browser-tests.html` — new generated-tone smoke
  test for real local module/WASM loading, pause residuals, Stop/restart, completion, and context closure.
- `http://127.0.0.1:8000/tests/experimental-browser-tests.html` — SoundTouch regression check.
- `http://127.0.0.1:8000/tests/audio-engine-tests.html` — normal-engine regression checks.

The new Signalsmith browser test is supplied but has not been run in Safari during implementation.
On the main page, compare the same full music files in SoundTouchJS and Signalsmith at
0.8, 0.9, 1, 1.1 and 1.2×. Test stable settings first, then live changes. Check chords, bass,
vocals, percussion, stereo image, onset/tail, pause/resume, repeated Stop/reload/Eject, and
all other deck controls. Repeat without internet, reloading while localhost stays running.
Record perceived loudness, sampled levels, clicks, latency and CPU/glitches. Start with one
stretcher on Mac, then test iPad; four simultaneous Signalsmith stretchers are outside B2.5.

## B2.6 — Loading diagnostics and bounded recovery

Only the Signalsmith adapter's reliability handling has changed. Upstream Signalsmith,
SoundTouch, Normal Playback, and Decks 2–4 are unchanged. A Signalsmith-only file-picker
reset allows selecting the same file after a failed load without needing a different file.

Loading now logs `[TuneToss Signalsmith]` JSON records with attempt ID, stage, start/complete/
error/abandoned events, elapsed milliseconds, file name/size/type, context state, requested
and actual context rate, decoded channels/rate/duration/frame count, and PCM-copy size.
No audio samples are logged. File names appear only in the local console; redact them before
sharing logs if necessary. The latest attempt record is also in `audioEngine.getState(1).diagnostic`.

Deadlines are: context resume/import 15 s, file read 30 s, decode 60 s, worklet/WASM ready
20 s, buffer acknowledgement 15 s, latency/update/schedule acknowledgements 10 s. Context
closure has a 5 s reporting deadline. Session construction is protected by the same cleanup
path. A resolved resume is checked for a running context, including before worklet creation.
Candidate processor errors reject outstanding adapter waits once the wrapper exposes a node.
A pre-ready processor is hidden inside the unchanged wrapper, so its deadline remains the
fallback if the wrapper never returns it. Startup also fails visibly if the audio clock
never reaches its scheduled start within 15 s (observed on the next UI state poll).

A timeout abandons the adapter's wait; it does NOT prove the browser read/decode/import or
WASM operation stopped. Late results cannot become the active deck; late-created nodes are
disconnected. Cleanup is requested separately, and `contextsClosing` retains unconfirmed
closures. An old close failure is logged without poisoning a new file's error state. Closing
one candidate context cannot affect other decks. Eject clears visible state immediately and
cancels adapter waits even when browser closure remains unresolved.

Failed or abandoned imports are removed from the adapter's promise cache. Retries use the
same immutable local module URL and a fresh context: there is no cache-busting, registration
loop, or retry on an existing failed context. The browser may still deduplicate an unresolved
ES-module fetch; a genuinely stuck browser/module loader can require reloading the page or
restarting the local server. The new attempt will time out visibly rather than remain stuck.
Main-thread blocking work can delay timers, so deadlines are not hard real-time cancellation.

### Exact Safari steps for the reported AIFF

1. Keep the localhost server running; open `http://127.0.0.1:8000/` and reload the page to
   load this change. Open Safari Web Inspector (Develop → Show Web Inspector), select Console,
   clear it, and filter for `TuneToss Signalsmith`. Enable console log messages if filtered out.
2. Select Signalsmith on empty Deck 1. Choose `JOYRYDE - THE BOX (Original Mix).aiff` once.
   Do not press Play or Eject while collecting the first failure, unless intentionally testing
   cancellation. A successful load ends with `stage:"ready", event:"committed"`.
3. If it stalls, wait for a stage-specific error. Capture the final `start` record, matching
   `error` record, decode metadata (if reached), and any Safari processor/decoder errors.
   Each loading stage has its own deadline; there is no single total-load deadline.
4. Interpret the stage: `read` concerns file access; `decode` concerns browser decoding;
   `import` concerns the local module; `ready` concerns worklet/WASM readiness; `buffers`,
   `latency`, or `updates` means readiness was reached but an acknowledgement did not return.
   A decode metadata record proves decoding finished; the filename extension alone does not.
5. Check that the loading flag clears and the file picker/mode selector recover when no file
   was committed. Select the same AIFF again; the failed picker selection is now cleared.
   If replacing an existing file failed, the previous file remains loaded and Eject is available.
6. Test Eject during a second AIFF attempt, then immediately select a small known-good WAV.
   The WAV should reach `ready/committed` with a new attempt ID. Old `abandoned` or close logs
   must not change the new file's state. Save both attempts' logs for comparison.
7. Record Safari/macOS version, file size, whether this was a fresh page or replacement,
   and whether the file works in Normal or SoundTouch mode. Test those separately after Eject.
   No claim is made yet about this AIFF's specific failing stage or codec validity.

Run `osascript -l JavaScript tests/run-tests.js`. New deterministic tests inject constructor
and resume errors; stalls at every loading stage; processor errors during candidate preparation;
late nodes; abandoned cached imports; pending browser close; Play scheduling timeout; and
successful recovery. Existing adapter, real Signalsmith wrapper/WASM, SoundTouch DSP, and
musical/normal tests remain. These regressions simulate failures, not this AIFF file or Safari.

## B2.6 temporary user-activation experiment

Signalsmith alone now uses two steps: select a file, then click **Load selected file**.
Selection retains the File object without constructing/resuming a context or starting file
reads. The button synchronously calls the existing adapter; context creation and resume
occur before its first await. This is a diagnostic experiment, not a finalized product UI.
Normal, SoundTouchJS, and Decks 2–4 still load immediately on selection.

A failed attempt retains the selected File for another explicit Load click. Eject discards
that selection and cancels adapter work; switching modes also discards pending selection.
Existing loading protection, deadlines, cleanup, and diagnostic logs remain.

Logs now include userActivationSupported, userActivationActive, and
userActivationHasBeenActive, alongside contextState. Unsupported activation APIs report
null flags rather than assuming permission. These flags are evidence, not proof of Safari's
internal audio policy.

Safari verification:
1. Reload localhost and open Web Inspector → Console. Filter for `TuneToss Signalsmith`.
2. On empty Deck 1 choose Signalsmith. Select the previously failing JOYRYDE AIFF.
   Expect “Selected: … Click Load selected file”, with no new context/resume/decode logs yet.
3. Click Load selected file directly. Capture context/start and resume/start records,
   including activation flags and contextState. Success continues through read/decode and
   ends in ready/committed. If it fails, retain the stage/error record; do not assume AIFF decoding.
4. Test playback if loading succeeds. Eject and repeat with a known-good WAV.
5. Repeat after leaving the picker open for at least 15 seconds before selecting the file.
   The subsequent explicit button click should provide a fresh user action in either case.
6. Test Eject before Load and during loading, then select and load the WAV. Retry the same
   AIFF using the Load button after a failure. Confirm the button is absent in other modes/decks.

`tests/signalsmith-selection-tests.js` executes the actual controls against a DOM stub to
verify selection, synchronous click dispatch, retry/cancellation, and unchanged immediate
loading elsewhere. Adapter tests additionally check synchronous context creation/resume
before reading. These tests do not establish actual Safari user activation or AIFF success.

## B2.6 experimental Signalsmith startup smoothing

The user confirmed the explicit Load button resolved the reported AIFF loading failure in
Safari. The subsequent Stop → Play click is being investigated separately; its cause is
not established by this experiment.

Signalsmith alone now applies a linear output-gain ramp from zero to the existing comparison
level over **4 ms**. It starts at the same intended audio start time, with the same source
coordinate and tempo. No intentional playback delay is added. The first few milliseconds
are attenuated; this is not an acoustically neutral change to the attack.

The envelope is scheduled before awaiting Signalsmith's playback acknowledgement. Completion
planning preserves its endpoint if that acknowledgement arrives early, mid-ramp, or late.
Pause → Play uses the same opening envelope. Stop/Eject clear the old automation; a superseded
Play acknowledgement or failure cannot change a newer session/request's output automation.
The upstream wrapper, DSP, SoundTouch, Normal Playback, and other decks are unchanged.

Adjust `startupRampSeconds` near the top of `experimental/signalsmith-transport.js` from
`0.004` to `0.003` or `0.005` for comparison, then reload Safari. `0` disables the experiment
for a control comparison. The constructor option of the same name supports automated tests.
Logs include `stage:"startup-gain", event:"scheduled"`, intended audio/ramp-end times,
duration, and target gain. Existing activation/loading diagnostics remain enabled.

Run `osascript -l JavaScript tests/run-tests.js`. New tests verify zero gain at scheduled
start, the target/ramp endpoint before acknowledgement, mid-ramp continuity, no second fade
on late acknowledgement, Stop/restart and Pause/resume coordinates, configurable duration,
and cancellation/supersession across both fresh and reused sessions. Existing test doubles
now support the native linear-ramp operation; previous suites remain intact.

Safari listening procedure:
1. Reload localhost. Select Signalsmith, choose the previously failing AIFF, and click
   Load selected file. Confirm normal loading still succeeds.
2. At a consistent listening level, repeat Play → Stop → Play at least five times.
   Listen specifically for the startup click, separately from any sound when pressing Stop.
3. Repeat Pause → Play at different musical positions and at 0.8, 1, and 1.2× tempo.
   Check the displayed source position is preserved on resume and resets on Stop.
4. Compare 3/4/5 ms settings, reloading between edits. A zero-duration comparison can help
   judge the effect. Listen for softened attacks as well as click reduction.
5. Repeat with a known-good WAV, preferably one with a quiet opening, and check a rapid
   Stop/Eject does not allow delayed output to reappear. Verify Normal and SoundTouch playback.

These are unperformed Safari acceptance checks for the new ramp. No claim is made that the
click has been fixed, that its cause was proved, or that a hardware/context-start pop will
respond to this output envelope. Immediate Stop/Pause muting is not a fade-out experiment.

## B2.6 independent completion scheduling

Playback acknowledgement now leaves the original 4 ms gain envelope untouched. The
Signalsmith adapter records its scheduled completion cutoff per session. Tempo changes
cancel the obsolete cutoff at its own timestamp (or now if it has passed), then schedule
the replacement using the same source-endpoint plus DSP-latency calculation. Completion
remains a hard cutoff, not a new fade-out. Acknowledgements arriving after the deadline
mute output without setting a positive gain. Pause/Stop/Eject clear cutoff tracking along
with gain automation; existing request-generation guards remain in place.

Explicit comparison-level changes still own gain adjustments: during startup they reshape
only the remaining ramp to the new target at its original endpoint; afterwards they apply
the selected level immediately. They restore the completion cutoff after changing gain.
This intentionally preserves trim behavior; acknowledgement itself no longer rebuilds it.
No audio nodes, delay, context reuse, DSP, or upstream-wrapper changes were introduced.

Run `osascript -l JavaScript tests/run-tests.js`. Regression checks include acknowledgements
before/at/during/after startup and after completion; obsolete cutoff replacement during a
BPM change; trim including zero; short PCM; an advancing mock clock; and cancellation or
supersession across retained and replaced sessions.

For browser-rendered automation testing, open
`http://localhost:8000/tests/signalsmith-gain-render-tests.html` and click Run rendered gain
tests. Expected: six PASS lines. This uses real OfflineAudioContext rendering with a
constant signal and the actual adapter, controlled acknowledgement timing, and a stub
processor. It checks every output sample against the unchanged ramp and cutoff. It does
not exercise Signalsmith DSP, real-time message delivery, or output-device transients.

Safari listening: run `python3 -m http.server 8000` from the project folder and reload
`http://localhost:8000`. Select Signalsmith, choose AIFF, and use Load selected file. Repeat
Stop → Play at least 30 times at a fixed level, distinguishing startup clicks from Stop
sounds. Repeat with WAV, then Pause → Play, 0.8/1/1.2× tempo, output trim (including zero),
natural completion, and rapid Stop/Eject. Verify rewind/resume positions and that cancelled
audio never returns. Keep the 4 ms setting unchanged. This scheduling improvement is not
proof of the intermittent click's cause or its resolution.

The initial completion cutoff is scheduled before waiting for playback acknowledgement,
so delayed acknowledgement cannot postpone silence at the existing endpoint.
Automated verification: the macOS suite passed, and all six browser-rendered gain cases
passed in headless Chrome. Safari rendering and audible listening remain manual checks.

## B2.6 opt-in synchronized startup recorder

This is measurement instrumentation, not another click correction. The original audible
route remains Signalsmith → comparison Gain → Analyser → destination. A separate two-input
AudioWorklet branches from Signalsmith and from the Gain output; its own output is always
zero. DSP, wrapper, 4 ms ramp, explicit Load button, transport scheduling, and context
creation/closure behavior are retained. The shared comparison-output module is unchanged.

Enable **Capture startup** in the temporary diagnostics panel before loading a Signalsmith
file. The recorder initializes asynchronously during preparation, without becoming a playback
readiness requirement. Initialization failure or a three-second diagnostic deadline leaves
ordinary playback available. A late recorder may miss pre-roll; such captures are incomplete.
Disabling diagnostics detaches the recorder; enable before a fresh load to attach it again.

Each Play requests 100 ms before scheduled start through 500 ms after it. The worklet stores
a two-second rolling buffer, actual render-block start frames/lengths and input channel counts.
No render-thread console logging occurs. Completed windows are transferred once, not messaged
sample by sample. At most ten captures and 500 lifecycle/automation events per session are
retained. At 48 kHz a full capture has 28,800 frames in each of four float channels. Memory
scales with the context sample rate but is bounded by these time/count limits.

**Refresh captures** creates local download links for JSON and a four-channel 32-bit float
WAV. Channel order is pre-gain left, pre-gain right, post-gain left, post-gain right. The first
WAV frame corresponds to JSON `firstFrame`; frame time is `(firstFrame + sampleIndex) /
sampleRate`. There is no normalization, resampling, or encoding loss. JSON includes block
boundaries, requested/actual ranges, scheduled source/start/ramp/cutoff data, acknowledgement
observation, gain changes, available latency/output timestamps, and context state/closure
records. Missing browser properties are null. Main-thread acknowledgement observation is not
the exact instant the processor received its request. Render-frame indexing does not imply
sample-accurate musical source provenance or measured hardware output.

Pause, Stop, Eject, disabled diagnostics, and initialization failure mark unfinished captures
incomplete. Stop/Eject never wait for recorder data. Partial PCM is best effort: closure may
prevent its delivery, in which case JSON remains available with the incomplete reason. Full
capture data is normally delivered 500 ms after startup; wait one second before Stop when
collecting a complete startup. Closing the context records lifecycle events but cannot expose
host/device underruns or sound beyond this digital graph. Compare diagnostic-enabled and
-disabled listening because recording adds render-thread work.

### Exact Safari collection procedure

1. From the project directory run `python3 -m http.server 8000`. Open
   `http://localhost:8000` in Safari and reload the page.
2. Select Signalsmith on empty Deck 1. In the separate diagnostics panel, check **Capture
   startup** before selecting/loading a file. Select the failing AIFF and click the existing
   **Load selected file** button. Keep rate 1× and output trim fixed.
3. Press Play. Listen for the startup click and wait at least one second. Press Stop.
   Click **Refresh captures**. The attempt should say complete; download BOTH Metadata JSON
   and 4-channel float WAV with the same capture number. Mark whether you heard a click.
4. Repeat Stop → Play, waiting one second each time, for ten attempts. Export before exceeding
   ten stored captures. Repeat with WAV after Eject. Capture numbers identify attempts;
   record the file, Safari/macOS version, output device, and whether the click was heard.
5. Collect several Pause → Play attempts as a context-retained comparison. For cancellation
   checking, press Stop/Eject immediately after Play: an incomplete capture is expected and
   playback controls must remain usable. Do not interpret missing partial PCM as silence.
6. Repeat a few listening attempts with Capture startup unchecked. Eject and load anew when
   re-enabling it. Keep the ramp at 4 ms; do not adjust tempo/trim during initial measurements.

Verification: `osascript -l JavaScript tests/run-tests.js` includes alignment, captured gain
envelope, silent output, bounded storage, cancellation, cleanup, initialization failure,
and float-WAV layout checks. Open
`http://localhost:8000/tests/signalsmith-recorder-browser-tests.html` and click Run recorder
test for real AudioWorklet/OfflineAudioContext rendering. Expected: one PASS line for stereo
alignment, gain envelope, render boundaries and unchanged audible-route samples. This browser
check passed in headless Chrome; Safari and the actual failing recordings remain manual.
No conclusion about the click's origin is drawn until exported results are inspected.

A headless-Chrome live smoke test also exercised the actual app/Signalsmith graph with a
locally generated mono WAV: all 28,800 requested frames were captured, and post-gain PCM
matched pre-gain PCM times the scheduled envelope within 1.4e-9 maximum absolute error.
This validates the recording path on that browser; it does not diagnose the Safari clicks.

## B2.6 reversible context-closure serialization experiment

Signalsmith now defaults `serializeContextClosure` to true in its adapter. Stop/Eject still
mute, disconnect and return without waiting. The actual browser close promise remains tracked;
Load/Play reject immediately while it is pending. They neither allocate/resume a replacement
context nor queue a retry. The temporary UI disables just Signalsmith's Load and Play actions
and reports closure status. Other decks and playback backends retain their behavior.

After actual closure resolution, controls become available on the next refresh (100 ms UI
poll). A fresh click is required: context construction/resume still occur synchronously in
that click, with no await-before-resume introduced. There is no intentional playback delay
or change to playback coordinates, buffering, gain/ramp, DSP, or context reuse.

The existing five-second close deadline now reports a blocked closure timeout. It does not
release the guard or claim the browser stopped working. If the original promise later
resolves, the guard clears. Rejection or synchronous close failure keeps replacement blocked;
reload the page to recover. Eject does not erase closure failure. Normal/SoundTouch modes and
other decks remain available. No timeout-driven replacement attempt is made.

Logs retain the existing stage/event names and now include wallTimeMs, contextTime and
performanceTimeMs where available. Look for `stop/requested`, `context-close-requested`,
`close/complete` with outcome `resolved` (or `close/error`, outcome `rejected`), then the next
`context/start`, `context/complete`, and `resume/start`. Existing recorder JSON also retains
these lifecycle records. Early new-session `context/start` logs have no contextTime yet.

To revert the experiment alone, change the adapter's `options.serializeContextClosure ?? true`
fallback to false, or construct it with `{ serializeContextClosure: false }`, and reload.
Closure tracking/logging remains available, but replacement is then allowed while closing.
The disabled-option regression preserves coverage of the earlier behavior.

Verification: run `osascript -l JavaScript tests/run-tests.js`. Controlled unresolved close
promises verify no new creation or resume; actual resolution requires a fresh click; timeout,
late resolution, rejected/synchronously throwing close, and Eject are covered. DOM-stub tests
verify Load/Play gating, no queued load, and unaffected Deck 2. Existing suites are retained.

Safari: reload localhost, select Signalsmith, enable diagnostics before loading, and use the
existing Load selected file button. Play the same WAV to about five seconds; Stop, observe
any closure status, then click Play when available. Repeat ten times and compare stale
fragment frequency with prior results. Export each completed capture plus metadata. Repeat
Eject → select file → Load without pressing Play, listening for the earlier Load pop. Test
AIFF loading as well. Closure can finish too quickly for the UI message to be visible; use
timestamps to verify ordering. This experiment does not prove pending closure caused the
fragment or guarantee that resolved closure clears downstream device buffers.

## B2.6 Load-only and Stop diagnostic extension

With diagnostics enabled before loading, every new Signalsmith session now creates a `load`
export entry immediately, even if initialization fails. Once the parallel recorder attaches,
it automatically exports its first available 500 ms of pre/post-gain PCM. No Play request is
needed. A context rebuilt by Play after Stop also receives this initial Load/resume window.
The separate `startup` window remains −100/+500 ms around scheduled Play. Both windows can
coexist; beginning Play does not overwrite the initial Load window.

Every event includes a diagnostic session ID and timestamps. Each export also includes a
bounded cross-session `lifecycle` history (latest 1,000 events), so previous Stop/Eject and
actual close resolution can be compared with new context creation/resume, processor-creation
request/readiness, and `diagnostic-tap-ready`. Each session keeps its latest 500 events.
Context creation is observed after constructor return; processor creation is bracketed by
request and upstream factory readiness, not an invented exact worklet-constructor timestamp.
A Stop/Eject action with no current session is explicitly recorded with null session ID.
Context times restart per session: compare wall/performance timestamps across sessions.

Stop asks the worklet to export its latest available 100 ms as `stop-snapshot` before ordinary
disposal, without awaiting any response. Eject records its own request and invokes that same
Stop path. Snapshot delivery is best effort: disconnecting/closing the context or port can
prevent delivery, leaving a clearly incomplete metadata-only entry. Snapshot PCM, if received,
ends at the recorder's last processed frame, not a promise of capturing final output/device
samples. No diagnostic handshake, timer delay, or change to context closure was introduced.

Coverage is explicit in JSON: `firstFrame`/`endFrame` and `coverage.observedContextInterval`
identify exported digital samples; `coverage.unobservedContextInterval` identifies earlier
context time absent from that export. The recorder cannot observe context creation/resume
before it exists, early processor output before tap attachment, or browser/system/device
output after graph retirement. A complete Load window means complete **from its earliest
available tap frame**, not complete coverage of the Load operation. Missing PCM never means
silence. No capture from a retired context survives closure. Independent continuous output
recording is still needed to measure the pre-tap period and possible downstream replay.

### Safari: collect Load-only evidence without Play

1. Run `python3 -m http.server 8000` from the TuneToss folder. Open
   `http://localhost:8000` in Safari and reload.
2. Select Signalsmith on empty Deck 1. Check **Capture Load / startup / Stop (enable before
   loading)** before loading any audio. Keep the current 4 ms ramp and closure experiment.
3. Choose the same WAV and click **Load selected file**. Do NOT press Play. Listen during
   loading, wait at least one second after Loaded, then click **Refresh captures**.
4. Download the JSON and four-channel float WAV for the row labelled `(load)`. If initialization
   or capture delivery failed, export JSON and retain its incomplete reason. Note whether
   audio was heard during Load; silent recorded PCM cannot exclude pre-tap output.
5. To reproduce old-session replay, Play the file to about five seconds, Stop or Eject, and
   wait for closure (optionally the reported ten-second interval). Refresh and save the old
   session's startup and stop-snapshot JSON/WAV where available.
6. Eject if still loaded, choose the WAV again, and click Load selected file. Do NOT press
   Play. Wait one second, refresh, and download the NEW `(load)` JSON/WAV. Its session ID and
   cross-session lifecycle identify the previous Stop/Eject/close and new resume/tap events.
7. Repeat a few times, writing down audible fragment timing and the Stop position. Export
   each cycle: the ten-entry limit now includes Load, startup, and Stop snapshots. Compare
   against Chrome. An external continuous recording should span the entire transition if
   pre-tap/system audio needs to be identified.

Focused tests cover earliest Load frames, independent concurrent startup windows, snapshot
PCM, explicit coverage gaps, Load export without Play, and previous-session lifecycle history.
Run `osascript -l JavaScript tests/run-tests.js`. The real recorder browser page additionally
checks both windows against native offline rendering; it passed in headless Chrome. Safari
captures and their actual audio content remain unverified. No playback-quality correction
is part of this extension.

The extended real-browser recorder test passed in headless Chrome with simultaneous initial
Load and startup windows. A separate actual-app/Signalsmith smoke test exported a Load-only
window without Play: 22,050 frames at the browser's 44.1 kHz context rate, with zero post-gain
peak. This verifies that export path on Chrome, not Safari's pre-tap/system output or the
origin of the recognizable fragment.

## B2.6 corrected frame validity and pre-Stop checkpoints (current format)

This section supersedes the earlier generic `render-frame gap` label and on-demand Stop
snapshot delivery. Playback, DSP, gain, source coordinates, closure serialization and context
lifecycle are unchanged. Only the diagnostic branch, metadata and export handling changed.

Each exported window now has `frameAnomalies`: exact half-open `[startFrame,endFrame)` missing
ranges, leading uncovered ranges, internal gaps, trailing uncovered ranges, duplicates,
intersections with previously recorded ranges, and backward callback jumps. Duplicate blocks
are classified separately from overlaps; a duplicate of an older block may also be a backward
jump. A late but contiguous first Load block alone is not a gap. The first Load window still
begins at the earliest available recorder frame; the period before it remains unobserved.
Repeated/overlapping frames use the latest callback's samples and remain explicitly ambiguous.

Frame tags and per-channel masks prevent unwritten or overwritten ring positions from being
exported as recorded silence. `recordedRanges` identifies observed render frames, while the
four `validRanges` lists identify actual supplied PCM per channel. Missing input channels are
unknown, not assumed silent. Unknown samples are NaN in the four-channel float WAV, never
verified zeros. Inspect JSON validity before processing these WAVs: some audio tools may
reject nonfinite float samples. Use valid ranges for numerical analysis; do not replace
unknown regions with zeros and then treat them as measured silence. Existing valid four-channel
WAV exports retain the same channel order and sample values.

While diagnostics are enabled, the worklet periodically transfers its most recent 100 ms,
approximately ten times per second (rounded to actual callback boundaries). The main thread
keeps only the latest checkpoint per active session. Checkpoints do not create export rows
or lifecycle logs at that cadence. Worklet storage remains two seconds; block metadata also
has a 2,048-entry cap to bound repeated/backward-frame scenarios. Export history remains ten
entries and lifecycle history 1,000 events.

Stop immediately exports the cached `pre-stop-checkpoint`; it no longer requests PCM from a
worklet whose port is about to close. `checkpointAtStop` reports the Stop-request frame,
checkpoint frame range, signed age in frames/seconds, receive wall time and window completeness.
`exactStopSnapshot` is always false. A negative age flags inconsistent timing, not silently
clamped accuracy. This is pre-Stop data, not the last exact sample rendered at Stop. Delivery
can lag, so its age is measured rather than assumed to be 100 ms. If no checkpoint arrived,
metadata explicitly reports unavailable PCM and a null age. Stop/Eject and disposal never
wait. Received checkpoints cannot be lost merely because the old port closes immediately.

Lifecycle metadata distinguishes constructor-return/context-created, resume request/completion,
processor-creation request/factory-ready, tap connection request (`diagnostic-tap-ready`),
first recorder callback (`diagnostic-tap-first-render-block`), first block carrying pre-gain
processor channels (`first-observed-processor-output`, including zero PCM), first observed
nonzero processor block, and Play scheduling. Worklet timing records include render-frame and
context coordinates plus main-thread observation timestamps. Processor factory readiness is
not an exact worklet constructor timestamp. First observed output cannot establish whether
the processor emitted earlier audio before the tap existed; that interval and downstream
browser/device output remain unobserved. No delays or playback changes were added to make
these measurements succeed.

Safari procedure remains: enable diagnostics before Load; collect the `(load)` JSON/WAV
without pressing Play. Then play to the reproduction position, Stop/Eject and refresh. Save
`(pre-stop-checkpoint)` JSON/WAV and its displayed age, along with the new Load export and
whether old audio was heard. Download JSON even if PCM is unavailable. Export every cycle to
avoid the ten-entry limit. The new exact anomaly fields should replace interpretation of
older generic gap labels. No correction to the audible stale fragment is included.

Checkpoint delivery additionally uses acknowledgements: only one PCM checkpoint may be in
flight. If the main thread stalls, the worklet continues recording into its bounded ring
but does not queue further checkpoints until acknowledged. Stop reports the age of whichever
checkpoint actually arrived. Coverage interval endpoints describe an envelope only, not
continuous valid audio; `validRanges`, `recordedRanges`, and anomaly ranges define validity.
Automated tests also cover nonadjacent duplicates, stale ring-slot reuse after a large frame
jump, recorded zero versus missing input, checkpoint age and unavailable data, and bounded
checkpoint delivery during a main-thread stall.

Validation of this revision: the full macOS automated suite passed. Headless Chrome's real
AudioWorklet rendering test passed Load/startup alignment, unchanged output-route samples,
periodic checkpoints, and first-output timing. The actual Signalsmith app smoke test also
produced a Load-only export and a cached pre-Stop export without waiting on disposal. Safari's
new anomaly ranges and audible fragment have not yet been measured with this revision.

## B2.6 opt-in persistent AudioContext experiment

Default/control behavior is unchanged: Signalsmith recreates its context after Stop/Eject,
with serialized closure. The new **Signalsmith Safari context experiment** panel contains an
unchecked **Keep one running AudioContext** checkbox. Eject before changing it. No choice is
persisted across page reload. Selecting the checkbox alone does not allocate or resume audio.
The first explicit Load click still synchronously constructs/resumes the context before file
operations. The same running context is then reused through Stop, Eject, natural completion,
and later Load. Safari interruption may still require resume from a subsequent user gesture;
this code never adds a silent source or forces the browser to keep hardware active.

Each newly prepared session gets a fresh upstream Signalsmith processor, its own existing
comparison output and diagnostics. Stop disposes those session resources, closes message
ports, removes persistent-session diagnostic state listeners, and rewinds source state, but
cannot close the separately owned persistent context. Pause retains the same session and its
saved source coordinate as before. Existing gain automation, rate, pitch, DSP latency and
playback scheduling are unchanged. No master gain, artificial delay or new DSP is included.

Uncheck the option while empty to explicitly close the retained context and restore the
control behavior. Switching waits for actual closure (with the existing bounded failure
reporting), then requires a fresh Load click. There is no automatic playback. The separate
**Shut down Signalsmith engine** button ejects audio and closes its owned contexts; reload
before using Signalsmith again. Normal/SoundTouch and the other decks are not shut down.
Page exit also requests Signalsmith shutdown without blocking navigation. Returning from a
browser back/forward cache may therefore require reload. A pending/rejected owner closure
blocks replacement; it must not silently abandon a live context and create another.

API: `createSignalsmithPlayer({ persistentContext: true })`,
`setPersistentContext(boolean)` while empty, and terminal `shutdown()`. Logs and state include
context IDs and session IDs. A repeated context ID with new session IDs is expected in the
experiment. Actual context closure is reserved for disabling/shutdown; per-session disposal
logs `contextRetained: true`. The original serialized-closure option remains enabled.

Tests: `osascript -l JavaScript tests/run-tests.js` covers twenty repeated sessions, one context
identity, distinct processor instances, output/port/diagnostic cleanup, source reset,
pause/resume, cancelled late initialization, switching back to control mode, and idempotent
full shutdown. The real wrapper test at
`http://localhost:8000/tests/signalsmith-context-browser-tests.html` creates ten successive
processors on one actual context and closes it on disable. It passed in headless Chrome.
These establish explicit graph/port cleanup, not deterministic native WASM garbage collection.
Use the production app (not the browser test, which retains node references for assertions)
to watch CPU and memory over longer sessions. Native reclamation and Safari's sound remain
manual checks; do not claim that the experiment fixes the fragment yet.

### Exact Safari control/experiment comparison

1. Run `python3 -m http.server 8000` from the project directory. Open
   `http://localhost:8000` in Safari, reload, and select Signalsmith on empty Deck 1.
2. Leave Keep one running AudioContext unchecked. Use the explicit Load selected file button,
   play the known WAV to about five seconds, Eject, wait 10–14 seconds, then Load again without
   Play. Confirm the baseline fragment. Keep volume, output device and tempo at the same values.
3. Eject and wait for closure. Check Keep one running AudioContext. It must remain at context
   ID none until Load. Choose the WAV and click Load selected file; note the context ID.
4. Play to five seconds, Eject, wait the same interval, select the WAV and click Load without
   Play. Listen throughout Load. Context ID must remain unchanged. Repeat twenty times.
5. Repeat with AIFF and twenty Stop → Play attempts. Check zero-position restarts, pause/resume,
   natural completion and tempo/output controls. Diagnostics may be enabled before the first
   Load; do not vary diagnostic settings between the two comparison modes.
6. Eject, uncheck the experiment, and repeat the baseline. Confirm context closure and a new
   context ID at the next Load. Compare audible fragment counts and attack quality.
7. During repeated production-app cycles, check CPU/memory for sustained growth. Then Eject
   and uncheck, or use Shut down Signalsmith engine. Verify resource use settles; reload after
   terminal shutdown. A persistent context uses resources/power while idle by design.

If the fragment persists or processor resource use accumulates, stop the experiment and retain
the default mode. No native-only comparison or additional workaround has been implemented.

Implementation verification completed: the full existing/new automated suite passed with no
remaining failures. Headless Chrome passed the ten-session test with the actual local
Signalsmith wrapper, including native node disconnection and message-port closure. Safari
fragment behavior, power use and long-run native processor reclamation remain unverified.

## B2.6 isolated Signalsmith release-envelope experiment

Signalsmith Pause and playing Stop/Eject now schedule a **5 ms linear output-gain release**.
`releaseSeconds` near the top of the adapter defaults to `0.005`; set it to `0` and reload
for the former immediate-mute control. The constructor option supports the same comparison.
Persistent AudioContext remains separately opt-in and OFF by default. No DSP, upstream wrapper,
startup-ramp duration, tempo/pitch algorithm, other backend, or synchronization logic changed.

The release holds current gain using native cancelAndHoldAtTime when available. The fallback
reconstructs the known in-flight startup envelope's instantaneous value, or reads the current
AudioParam value outside startup, then ramps to zero on the existing context clock. No old
completion cutoff or startup opening can reopen the release. The session stays connected and
DSP stays active through the release. Cleanup polls the audio clock, first observing a time
past the endpoint and then a further clock advance. The 4 ms polling interval is not proof
of completion and is not an inserted playback delay; the evidence is clock advancement.
The gain envelope is audio-clock scheduled; main-thread cleanup and hardware silence are
not sample-accurate guarantees.

Pause bookmarks sourceAt(releaseEnd), using the existing piecewise source timeline and actual
rate. This avoids replaying the faded tail on Resume. For example, at 1.2× a fully active 5 ms
release advances source position by 6 ms. Pause before the scheduled start does not advance the
source prematurely. After release confirmation, the same session is muted and deactivated;
Resume retains its existing DSP-latency scheduling. These coordinates remain nominal source
estimates, not exact DSP sample provenance.

Stop resets application position immediately, retains PCM/BPM as before and retires the old
session after release. Eject immediately clears application PCM/metadata as before; the old
processor owns its existing transferred data only until retirement. A release-pending state
blocks new Play/Load and shows a fresh-click message. No action is queued. Repeated commands
do not extend the endpoint; Stop/Eject can escalate a pending Pause release to disposal.
Every callback captures the original release/session/command identity. Old callbacks cannot
mute a newer session. Shutdown waits for retirement before closing the persistent owner.

An interrupted/nonrunning context, scheduling failure, or 750 ms render-confirmation watchdog
falls back to immediate mute and independent resource cleanup. Controls recover and an error
explicitly says rendered completion was not verified. A failed Pause release bookmarks the
observed source coordinate rather than claiming an unrendered future endpoint. This failure
path may click; it prioritizes cancellation and recovery. It is not successful fade evidence.
When already paused/stopped, empty, or still initializing, cancellation retains immediate
cleanup instead of pretending a release was rendered.

Tests: `osascript -l JavaScript tests/run-tests.js` retains prior immediate-mute contracts with
releaseSeconds:0 and adds enabled-release tests for native hold and fallback, mid-startup gain,
rate-aware bookmarks, clock confirmation, rapid Pause/Stop/Eject/Play/Load, stale callbacks,
interrupted/frozen clocks and failed gain cleanup. Existing real-browser transport tests now
wait on release/closure state rather than assuming await Stop means immediate disconnection.

### Exact Safari release listening check

1. Run `python3 -m http.server 8000`, open `http://localhost:8000`, and reload. Enable Keep one
   running AudioContext BEFORE the first explicit Load, retaining the successful workaround.
2. Load the same WAV using Load selected file. Keep output level fixed. At several musical
   positions, repeat Play → Pause → Play twenty times; listen specifically at Pause and verify
   Resume continues after the faded tail. Repeat at 0.8×, 1× and 1.2×.
3. Repeat Play → Stop → Play twenty times. Position must reset to zero immediately; Play is
   briefly unavailable while release finishes, then requires a fresh click. Check that the
   recognizable old-audio fragment remains absent.
4. Repeat Eject → Load without Play, including the prior 10–14-second wait. Test rapid Pause
   → Stop, Stop → Play and Eject → Load. There must be no queued playback or stale session audio.
5. Repeat WAV/AIFF with the same diagnostics setting. Check release/scheduled and
   release/render-confirmed events; report release/abandoned, timeouts, or unexpected silence.
6. For a control comparison, set releaseSeconds to 0, reload, and enable persistence before
   the first Load again. Restore 0.005 afterwards. Do not change startup smoothing or other
   settings in the same comparison. Listen for lost/softened endings as well as click reduction.

The release intentionally adds about 5 ms of audible stopping time, plus the existing output
latency. It does not add a continuous processing delay. Main-thread cleanup can occur later
while gain is already zero. Native memory reclamation and Safari click elimination remain
unverified; no claim of a confirmed click fix is made.

The release explicitly inserts a gain event at its start after hold/cancellation, so the new
linear ramp cannot interpolate from an older startup automation event. Permanent browser
regression coverage is at `tests/signalsmith-release-browser-tests.html`: two native offline
renders check a mid-startup and a steady-playback release using a controlled adapter clock,
corresponding gain getter, and stub processor. Both passed in headless Chrome. A separate
live check through actual Signalsmith and the existing recorder measured 221 release frames
at 44.1 kHz, with about 1.3e-9 maximum absolute gain-envelope error. It also checked the
release-end bookmark, Stop retirement and shutdown. These validate digital behavior on
Chrome, not elimination of Safari's faint click or exact hardware/source provenance.
An already-started replacement Load waits for any intervening release before committing its
new session; newly requested Load/Play during a release are rejected rather than queued.

Final automated verification passed with no remaining failures: full macOS suite, both
native-rendered release cases, and ten repeated real-wrapper sessions. Delayed playback
acknowledgements retain their planned source mapping for release-end bookmarks; late results
cannot overwrite resumed state. The immediate-mute control tests remain available at duration
zero. All JavaScript watchdog recovery depends on the browser allowing tasks to run; a frozen
main thread cannot execute cleanup until it resumes. Safari listening remains outstanding.

## Isolated native two-deck four-stem prototype

Open `/experimental/four-stem-player.html` through localhost. This separate page does not
instantiate the existing application, Signalsmith or SoundTouch transports, change domain
stem state, or integrate automatic handoff. Implementation: `four-stem-player.js` and its
small controls adapter. Each deck has four native sources with one start time/offset. Both decks share one context,
with independent source positions and four stem gains per deck. Each deck sums through a
separate main-volume gain and then a transport gain before reaching the destination. Starts are scheduled one
128-frame render quantum ahead; this is a scheduling allowance, not measured device latency.
No additional stretching, separation, limiting or normalization is applied.

Validation is deliberately conservative: all four explicitly mapped categories are required;
nonempty mono/stereo decoded buffers must have identical sample rates and exact frame counts.
There is no duration tolerance, trimming or stretching. Decoding can resample to the shared
context rate; original file sample rates need not match. Equal decoded lengths do **not** prove
musical alignment: use exports with the same original timeline start, including leading silence.
Offsets, shifted musical content and incorrect category assignments cannot be detected here.
Failed replacement stops playback but retains the previous validated set; errors are shown.

Main volume and stem levels start at 1 for this isolated fixture (not application startup state). They remain intact
through replacement/eject. Each change retargets a provisional 10 ms linear ramp from the
tracked current envelope value. Pause stops all paths immediately and resumes at one saved
source position; Stop resets that position. No new Pause/Stop release envelope is added.
Consequently transport-edge clicks remain possible and require listening. All sources/gains
are disconnected on retirement; Close all audio also releases both decks’ buffers and closes the shared context. Individual
deck disposal never closes that shared context.
Decode already underway cannot be forcibly cancelled; stale results are discarded. Loading
uses sequential reads/decodes but retains fully decoded stems, so long-file memory capacity
still requires measurement. No claim is made about native memory reclamation.

### Safari listening procedure

1. From the project directory run `python3 -m http.server 8000 --bind 127.0.0.1`.
2. Open `http://127.0.0.1:8000/experimental/four-stem-player.html` in Safari.
3. In each deck panel select matching local exports for Transients, Flow, Tune and Voice. Lower device volume
   initially: summed stems can clip. Click **Load selected stems**, then **Play / Resume**.
4. Set three levels to 0; listen to the remaining category. Repeat for all four to verify labels
   and independent paths. Restore the intended levels and listen for synchronized attacks.
5. Play both decks at different times. Pause, resume, stop and eject one; confirm the other
   continues uninterrupted at its own position. Test each main volume independently.
   Move a level rapidly back and forth, including reversing during movement. Listen for clicks
   and confirm the other paths remain unchanged. These controls use 10 ms gain smoothing.
6. Pause/resume repeatedly, then Stop/Play. Verify common position, beginning reset, and no old
   audio. Replace all four files and confirm levels stay unchanged. Try a missing file, a corrupt
   file, and a different-length stem; expect a clear rejection without starting the invalid set.
7. During loading click **Eject / Cancel load**, then load another set. Confirm the stale set
   does not return. Finally click **Close all audio**; playback must stop and further playback is
   disabled until page refresh.

Automated entry points: full macOS runner and `/tests/four-stem-player-tests.html` (**Run tests**).
The browser page checks real generated WAV decoding, native-source scheduling, OfflineAudioContext
path amplitudes/10 ms envelope, real-time clock progress and transport cleanup. It does not
replace actual Safari listening, device latency measurement or long-running memory/CPU tests.

The two-deck extension reuses `createFourStemPlayer` with explicit borrowed-context ownership;
`createTwoDeckStemPlayer` owns final shutdown. All transport cleanup remains deck-local.
The user reported successful listening for the earlier one-deck fixture; repeat the checklist
for both decks before treating the extension as Safari-validated. There is still no automatic
handoff integration. Transport-edge clicks, eight-stem memory/CPU capacity and device latency
remain manual checks. No listening was performed by the automated browser tests.


### Automatic handoff integration — current prototype listening checklist

The prototype now runs shared domain actions through `stem-handoff-audio-bridge.js`. The earlier
standalone fixture defaults described above are historical: the integrated page starts both
main volumes at 0, Deck 1 stems at 1, Deck 2 stems at 0, with Decks 1/2 participating and Decks
3/4 excluded. Other pages retain their existing behavior. Both independent decks previously
passed user Safari listening; this newly connected handoff has not yet been listened to.

1. Serve localhost as above and open `/experimental/four-stem-player.html`. Load aligned sets
   into both panels, then Play independently. Initially both decks are silent (main volumes 0).
2. Raise both main volumes to 1. Deck 1's eligible stems sound; Deck 2's stems are still at 0.
3. Raise Deck 2 Flow to 0.50: Flow effective gains should become [0.50,0.50]. Raise to 1:
   expect [0,1]. Reverse to 0 without releasing: Deck 1 Flow should return. Verify other
   categories remain unchanged and compare requested/allocated/origin labels immediately.
4. Test rapid reversals, then main-volume gestures. Main volume affects all nonzero categories;
   restoration may be constrained by receiver volume/authorization, as shown by domain results.
5. Disable one participation checkbox: levels must stay unchanged, subsequent gestures remain
   independent. Re-enable: no immediate normalization. The next eligible gesture follows the
   approved relationship rules. Test replacement and Pause/Stop/Eject while the other plays.
6. Close all audio when finished. Report unexpected loudness, clicks, display lag, timing changes,
   or old audio. Summed categories can clip; keep device volume conservative.

Gain targets use shared-time 10 ms ramps; no handoff math is performed in audio callbacks.
Native scheduling failure is reported after the committed state and is not claimed to roll back
partially scheduled AudioParams. Listening and hardware-output latency are not verified by the
rendered tests. Separate stem/main ramps can have intermediate effective values different from
the final state coefficient. The previous transport-edge/memory limitations still apply.

### Main-page opt-in stem integration

`index.html` now offers Complete song / Four stems on Decks 1–2. Complete song remains the
startup choice. Existing normal, SoundTouchJS and Signalsmith implementations are unchanged.
Decks 3–4 retain complete-song playback. All four handoff participation checkboxes start ON;
explicitly uncheck Decks 3 and 4 for the tested two-participant calculator path. With three/four
participants, musical controls remain direct-only. Merely switching source does not synchronize,
reset participation or authorize gain. Complete-song volume behavior remains unchanged; the
new musical gain controls apply to native stems only.

Use Eject before switching sources. Both backends must be empty, no release/closure blocked,
and all tracked load/transport promises settled. A browser decode may remain pending after
Eject; switching stays locked until it resolves/rejects. No retry/delay or fake cancellation is
introduced. Select four files and click Load selected stems, then use the existing deck transport
buttons. Native stem tempo fields are disabled. Four-stem errors/status appear in the mounted
stem panel; requested levels and allocated faders update immediately through the shared bridge.
Replacement retains levels and authorization; loading does not synthesize a gesture.

The main page uses appState/appActions; it does not copy the prototype's Deck 3/4 exclusions.
`experimental/stem-controls.js` is the same mounted component on both pages. The main page uses
its existing single polling timer for transport refresh; gain/fader updates are synchronous.
Page exit closes the shared stem context. Existing backends retain their own context ownership.
The standalone prototype still has its own Close all audio control and host-owned timer.

Safari check: open main index via localhost, confirm four participation checks ON; opt Decks 1/2
into stems, load aligned exports, Play, raise main volumes, then explicitly exclude Decks 3/4
and repeat the Flow handoff checklist. Verify Eject is required before returning to complete
songs and retest Normal/SoundTouchJS/Signalsmith (including the explicit Signalsmith Load button).
The prior isolated handoff passed user Safari listening. Main-page integration has not yet had
Safari listening; native gain scheduling errors and resource limits remain documented limitations.

### Batch stem selection (main page and standalone prototype)

Use **Select stem files together** to select a four-file export. Matching is case-insensitive:
drums/drum -> Transients, bass -> Flow, others/other -> Tune, vocals/vocal -> Voice, anywhere
in each filename. Review the four **Assigned file** dropdowns before clicking the existing Load.
Selection does not decode or start playback. Individual file pickers remain available.

Ambiguous/unknown names or duplicate-category matches require manual assignment. Conflicting
batches retain existing mappings; explicitly choose replacement dropdown values. To swap files,
unassign one first, then reassign; the same file cannot occupy two categories. **Clear selected
files** resets the selection pool, not audio, gains or domain state. Extra candidate files are
not loaded unless assigned. A cancelled picker leaves mappings and loaded audio intact.

Duplicate checks use filename, size, modification time and type, not content hashes. Separate
files with identical metadata are conservatively treated as the same candidate; propose an approved workspace-copy rename if
needed. Musical alignment still requires aligned exports and the existing decoded-length checks.
Batch UI passed Chrome automation; verify Safari multi-selection, cancellation, dropdown
correction and a real replacement load before accepting the new UI on Safari.

### Four-deck native playback verification

Every main-page deck now offers Four stems, retaining the same batch assignment and explicit
Load flow. All sixteen stem sources use one native context. Deck timelines remain independent;
there is no beatmatching or pitch processing. The standalone prototype intentionally remains
two decks and uses the same generalized context-owner implementation.

Safari checklist: use short aligned exports first; select Four stems on all four main-page
decks, load separate sets, and start them at different times. Raise volumes/stems deliberately.
Solo paths, pause/resume/stop/eject/replace one deck, and verify the others continue. After Eject
and completion of pending work, switch one deck back to Complete song and verify coexistence.
To test handoff involving Decks 3/4, explicitly exclude Decks 1/2, introduce Deck 3 Flow through a
positive gesture, raise both volumes, then raise Deck 4 Flow through 0.5 to 1 and reverse. With
all four participating, changes remain direct-only; no hidden participation changes occur.

Automated Chrome coverage includes sixteen actual sources/one context, rendered sixteen-stem
sums/isolation, and arbitrary-pair handoff. New pages: tests/four-deck-stem-browser-tests.html;
rendering remains in tests/four-stem-player-tests.html. Four-deck Safari listening has not been
performed by the agent. Decoded PCM memory is substantial (~1.84 GB for sixteen five-minute
stereo 48 kHz stems, before overhead). Long-file memory, sustained CPU, native reclamation,
transport clicks and clipping remain manual measurements. No limiter or memory cap was added.
