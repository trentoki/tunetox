# Experiment 4C — independent waveform-shape diagnostic

Standard-library-only research. No 1C imports, separation run, audio writes,
production changes, instrument model, scale model or expected family count.
The diagnostic shares only the separately preserved 4B decoding, FFT and
periodicity utilities. Recording results and figures are documented at
`../results/experiment-04c-majorsaw-shapes/README.md`.

Run from repository root with a NEW output directory:

```sh
python3 -B -m unittest discover -s research/source-separation/diagnostic_04c -p 'test_*.py' -v
python3 -B research/source-separation/diagnostic_04c/analysis.py research/source-separation/audio/Majorsaw.aif --sha256 5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134 --output research/source-separation/results/new-04c-run
python3 -B research/source-separation/diagnostic_04c/plots.py research/source-separation/results/new-04c-run
```

The CLI can inspect other mono/stereo AIFC fl32 inputs with their explicit hash,
subject to the retained four-million-interleaved-sample decoder limit. No quality
or runtime guarantee is established for unfamiliar files. No dependencies were
added. Seven synthetic tests passed; real multi-source controls remain untested.

## Transparent method

1. Estimate local periodicity on 2048-sample windows every 10 ms using the 4B
   autocorrelation utility (60–2000 Hz search, simple 4-sample pre-decimation
   average). Retain frames, activity and periodicity evidence. Choose the stronger
   channel for boundary detection, preserving both channels for geometry.
2. Interpolate rising crossings of that channel's recording-wide mean. Adjacent
   crossings are only candidate cycles. Mark unreliable when activity is below
   4% of maximum frame RMS, periodicity <0.8, period spacing differs from the
   estimated period by >15%, fewer than four samples are observed, or neighboring
   geometry similarity <0.90. These are research heuristics, not confidences.
   Store candidate intervals and every rejection reason; preserve original PCM.
3. For eligible cycles, sample x=j/64, j=0..63, independently of duration. Save
   fractional start/end frames, duration, observed peak/RMS, channel offsets and
   shared stereo scale separately. Subtract each channel's mean and divide all
   channels by their joint RMS. No polarity flipping, independent channel scaling
   or phase search is performed during family assignment. Stereo ratios remain.
4. Save circular first/second differences (slope/curvature), plus magnitudes of
   normalized harmonics 1–12 from the 64-point DFT, as auxiliary descriptors.
   Harmonic magnitudes alone discard phase; they never override geometry.
5. Stream cycles against fixed observed exemplar signatures using signed cosine.
   Best similarity >=0.985 permits membership. If two qualifying exemplars differ
   by <0.01, retain an ambiguous assignment. Otherwise create a provisional
   exemplar when none qualifies. At least three unambiguous occurrences make a
   recurring family. No family count is prescribed. First-exemplar order matters;
   the method does not merge prototypes or invent relationships to force a result.
   Also report sensitivity at 0.97 and 0.995 without selecting a preferred outcome.
6. Independently measure region peak/RMS, per-cycle amplitude distributions and
   RMS variation, actual-time 5 ms envelopes and duration-normalized envelopes.
   Region labels come from independently detected periodic plateaus, not supplied
   notes. No amplitude-equality test is used for family membership.

## Limits and data safety

All selected cycles, provisional/ambiguous assignments, candidates without reliable
signatures and unmodeled frame spans remain traceable to the original waveform.
No raw waveform is reconstructed or replaced. A 64-position signature is lossy;
integer sample ranges for peak/RMS differ slightly from fractional cycle endpoints.
Global-mean crossing anchors can drift with DC/envelope changes; extra crossings,
octave errors, multiple sources and shape symmetries can defeat cycle boundaries.
For example, polarity inversion of a sinusoid is indistinguishable from half-cycle
phase shift when only locally phase-anchored cycles are inspected. Saved absolute
crossing times/level and signed signatures do not solve that inherent ambiguity.

The activity screen can miss weak meaningful sources. This is not a universal
representation of transients, noise, polyphony or unfamiliar nonperiodic sounds.
Unmodeled material remains in the original and candidate/frame records. Python/JSON
objects and auxiliary descriptors are not a compact audio codec. Reusable family
signatures reduce repeated fitting work; they do not prove source identity or
independent reconstruction. See the measured report for threshold sensitivity,
false-split evidence and memory/storage costs before considering any integration.
