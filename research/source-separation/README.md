# Source separation — experiment 01

Standalone, experimental Python research for the TuneToss workspace. No application
imports, browser integration, production DSP changes, neural networks, external
packages, reference-guided inference, instrument labels or event-parity rules.
Python 3.9+ standard library only; nothing needs installing. This is not a general
blind source separator or a production feature.

## Run

Supply a **copy** of the combined recording under `audio/`, or pass its existing
path read-only. No recording was supplied with this implementation. The kick and
clap originals must be withheld until the separate evaluation step.

From this directory:

```sh
python3 -B experiment_01.py separate audio/combined.wav --output results/run-001
python3 -B experiment_01.py evaluate results/run-001 \
  --references /path/to/original-kick.wav /path/to/original-clap.wav \
  --output results/run-001/evaluation.json
python3 -B -m unittest discover -s tests -v
```

Every separation run requires a new output directory; every file is created
exclusively. An interrupted run leaves its partial directory for inspection; use
a different name to retry. The program never overwrites or deletes existing audio
or results. Git ignores local inputs, outputs and Python caches in this subtree.
No commit or push is performed. Existing working-tree changes remain unrelated.

Input: mono/stereo integer PCM WAV, 8/16/24/32 bit. Maximum four million interleaved
samples and a bounded file size. Compressed audio, AIFF, float input and automatic
resampling are deliberately unsupported. Outputs: full-input-length IEEE float32
WAVs at the original sample rate/channel count. Samples are never peak-normalized,
limited or clipped, including subtraction overshoots above unity. Float32 rounding
is the only output quantization; input PCM is analyzed as float64 Python numbers.
The original file bytes are never written. Float WAV playback support varies;
above-unity samples may clip in playback software, so inspect before listening.

## Mathematical method

1. **Detection.** For each 2 ms block, compute mean squared amplitude across frames
   and channels: `P = sum(x²)/(frames*channels)`. This avoids canceling anti-phase
   stereo. A block is active when `P > peak(P)*threshold²` (default amplitude
   threshold 0.015). Bridge gaps of up to 60 ms, add 10 ms context on either side,
   and prevent overlapping event slices. This is energy segmentation, not a
   musical onset classifier. Report start/end samples, start times, intervals,
   energy, RMS and peak. Eight events are expected only for diagnostics: any
   detected count is accepted and a mismatch produces a warning.
2. **Waveform comparison.** Treat each observed event as a candidate waveform `t`.
   For every target event `y`, search all integer-frame shifts within ±5 ms by
   default. Zero-pad outside support, never wrap. For each shifted vector `T`,
   minimize `||y-gT||²`. Differentiation gives `g=<y,T>/<T,T>`; constrain `g>=0`
   to model repeated observations with positive recording gains. Channels are
   fitted jointly, so stereo balance is preserved. Choose the lag maximizing
   explained energy `g²<T,T>`. This is normalized waveform projection with gain
   estimation; no instrument frequency assumptions are used. Negative polarity
   changes are intentionally not fitted. Precision is one sample frame, not
   fractional-sample precision.
3. **Recurrence.** Explained fraction is `g²<T,T>/||y||²` (zero for silent targets).
   An event supports a candidate at fraction >=0.65. A candidate needs at least
   two supporting events, including itself. Select the largest support count;
   break ties by lowest observed candidate energy. This favors an isolated sound
   when it explains both isolated and combined events, but amplitude alone
   cannot prove isolation. Full candidate-to-event projection tables are exported
   each pass. Timing is used for segmentation, alignment and reported recurrence
   intervals, never to assign alternating events or impose periodicity.
4. **Subtraction.** For supported events, subtract fitted `gT` sample by sample.
   Place these fitted contributions into a full-length anonymous component track.
   Analyze the residual events with exactly the same discovery process, at most
   four passes, stopping when no recurring candidate remains or extracted energy
   is negligible. There is no hardcoded two-source count. Unmatched events remain
   in the residual. A component template is an observed waveform, not an averaged
   or independently proven source estimate.
5. **Conservation.** Compute the final residual globally as `r=x-sum(components)`.
   Thus components plus residual reconstruct the input to floating-point precision,
   including audio outside detected event boundaries. This identity is a bookkeeping
   check, **not evidence of correct source separation**.
6. **Baseline.** Copy the first detected event at every detected event boundary;
   subtract at unity gain with no lag correction. Export both full-length baseline
   component and baseline residual. It deliberately assumes the first event is a
   useful template, and may fail if it is a mixture. The research method does not
   use this first-event assignment.

No source semantics or alternating assignments enter any step. Detection is performed
once on the mixture; residual recurrence is searched within those event windows.
Residual-only events outside those windows are not newly segmented.

## Outputs and post-hoc evaluation

`component_01.wav`, etc., `residual.wav`, `baseline_component.wav`,
`baseline_residual.wav`, and `report.json`. The JSON contains parameters, input
SHA-256, event measurements, all candidate comparisons, inferred membership,
gain/lag estimates, component peaks, residual/baseline energy fractions and warnings.
A missing second component is a result, not silently replaced with a fabricated track.

Only `evaluate` opens reference files. It requires an already completed report and
exports a **new** evaluation JSON, without changing separation outputs. For each
component/event/reference combination it reports the reference projection fraction,
lag and fitted gain plus reference/report hashes. Default evaluation lag search is
±25 ms, configurable up to 50 ms; rates and channel counts must match. Projection
is scale insensitive and can expose similarity/leakage, but it is not full-track
SDR, a source identity assignment or perceptual quality. An isolated reference does
not provide exact full-track ground truth gains/onsets. No reference-driven parameter
tuning, component selection or re-separation is performed automatically.

## Failures and research limits

Blind decomposition is not unique: if two sounds always co-occur, their mixture
can be the only identifiable recurring component. A quieter mixture can also win
the energy tie-break. The method assumes repeated near-identical waveforms and
an informative relatively isolated observation; it does not establish either.
Correlated sources bias least-squares gains and cause leakage. Large gain variation,
weak shared sounds, changing timbre, reverberation, clipping in the input, noise,
long overlapping tails, unequal stereo changes, missed/merged events, sub-sample
phase differences and recording drift can defeat discovery or subtraction. There
is no denoising, time stretching, fractional delay, spectral factorization or
multi-template joint fitting. A 65% gate can miss a real component in a mixture
where it contributes less energy. Residual energy can be low for an incorrect
source decomposition; energy fractions need not add to one for correlated tracks.

Pure Python exhaustive alignment scales with candidate pairs, event lengths and
lag range, and is intended for a short eight-event study. Sample/file limits bound
input size, not runtime guarantees; high-rate/long events may be slow. Defaults
are heuristics, not values validated on the user's recording. No permissions,
network access, telemetry or dependencies are used. No application/browser/device
checks are needed for this isolated command-line program; listening and validation
with the actual recording and original kick/clap files remain outstanding.

## Verification and next step

Synthetic tests cover eight-event discovery, two-component reconstruction with
changing gains and timing jitter, non-alternating order, anti-phase stereo, gain
and signed-lag fitting, silence, singleton/unrelated events, literal baseline and
float export above unity with overwrite refusal. These validate the constructed
case, not real-world blind separation. Tests generate their known sources only
as fixtures and compare against them after calling separation.

Next: run the combined recording alone, inspect event counts/projection tables and
listen to anonymous components/residual, then run reference evaluation. Record
failures before considering a separately scoped algorithm improvement.
