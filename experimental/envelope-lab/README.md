# TuneToss Envelope Analysis Lab

Experimental, isolated analysis for future original pitch-preserving time-stretch research.
No playback, synthesis, BPM inference, beat alignment, production imports, uploads, storage,
or original-file writes. No new dependencies. Frequency-band analysis is deferred; these
full-band curves cannot identify instruments or establish pitch preservation.

## Method and retained data

Browser `OfflineAudioContext.decodeAudioData` decodes the selected file at 48 kHz;
this may resample the original. The waveform is decoded PCM, not compressed-file bytes
or a claim of native-rate preservation. Supported containers depend on the browser.
Analysis uses non-overlapping rectangular windows of round(sampleRate × ms / 1000)
frames for selectable 1, 5, 10, 20 ms resolutions. Actual duration is displayed.
Each timestamp marks the window start, not the exact attack location or window center.
The partial last window uses its actual sample count. No smoothing or normalization.
RMS = sqrt(sum of squared samples across all channels / (frames × channels)).
Positive onset = max(0, current RMS − previous RMS), with first onset set to zero.
This is an energy-rise proxy, not spectral flux or an instrument/beat detector.
Resolution changes change onset magnitudes; they are not normalized derivatives.
An attack can only be located within its analysis window; window alignment affects results.

The current worker result retains separate Float64 timestamp, RMS and onset arrays;
PCM remains available for waveform inspection. Changing resolution replaces the current
analysis, and selecting another file clears it. Nothing persists across reloads.
Tempo mapping is t_visual = t_source / multiplier, 0.5–2×, leaving amplitude arrays intact.
All plots share the transformed axis. The viewport is specified in source seconds, so
its time labels/duration change with tempo while its shape stays fixed. This mapping is
not waveform resynthesis and makes no claim about audible time stretching.

The waveform uses per-pixel min/max across decoded channels; envelopes use per-pixel
min/max bins so zoomed-out attacks remain visible. At close zoom, bins are held across
their window. Plot amplitude scales are fixed (waveform −1…1, envelopes 0…1); values
outside those limits are clipped visually, but the numerical inspection is not clipped.

## Reference gap

The supplied request refers to an existing BPM estimator and Beat Match harness. Neither
was found in this checkout's tracked source; current docs describe manual BPM entry.
No estimator algorithm was copied or changed, and parity with that absent implementation
is unverified. RMS plus positive energy difference is an explicit provisional research
method. Compare it against the intended estimator when its source is available.

## Safety and scope

Files are read through the browser file picker only. Encoded input is capped at 32 MiB;
decoded input at 120 seconds and 8 channels. Decode can allocate before decoded limits
are known; these limits are not a guarantee against hostile files or browser memory pressure.
Worker analysis avoids calculation on the UI thread; rendering still scans visible PCM
and has not been performance-qualified on iPhone/iPad. No network requests beyond local
static assets, microphone permissions, audio output, external fonts, or dependencies.
Band filters, exports, automatic attack/decay segmentation and original stretching DSP
remain unimplemented. Use short clips for this experiment.

## Safari verification

From the repository root run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/experimental/envelope-lab/index.html .
Load a short local audio file. Confirm three plots, silence, and decoded-rate reporting.
Select all four resolutions; verify actual window duration and distinct RMS/onset values.
Set source span to 0.1 seconds and move source start to an attack, then inspect the rise
and decay by clicking and by typing inspection time. Compare PCM and window values.
At 0.5× visual timestamps double; at 2× they halve; amplitude values remain identical.
Fit entire file, resize the window, select another file and try an unsupported file.
Check keyboard access and narrow-screen controls; test Safari/macOS and mobile separately.

Browser automated fixture: http://127.0.0.1:8000/tests/envelope-analysis-tests.html .
Click Run: tests include real generated-WAV decoding and a worker round trip.
Pure/syntax checks: `osascript -l JavaScript tests/run-envelope-tests.js`.
Existing regressions: `osascript -l JavaScript tests/run-tests.js`.

Verification recorded 2026-11-10: 57 pure assertions and syntax checks passed.
Browser fixture, Safari visual interaction, codec coverage, device ergonomics and memory/
render performance remain unverified. Automated arithmetic does not establish audio quality.
Existing full macOS regression suite also passed; git diff --check passed. The macOS
runner emitted host XPC connection diagnostics but returned exit status 0 with all test
suites reporting success. These are script checks, not browser execution.
