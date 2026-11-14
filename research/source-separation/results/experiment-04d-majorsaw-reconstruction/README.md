# Experiment 4D — shape-based audio reconstruction

## Listen

- [reconstructed.wav](reconstructed.wav) — generated from saved 4C family shapes
- [residual.wav](residual.wav) — decoded original minus reconstruction
- [original_reference.wav](original_reference.wav) — exact decoded float32 sample conversion

All are full-length six-second, stereo 44100 Hz IEEE 32-bit floating-point WAVs.
There is no peak/loudness normalization, clipping, limiter or mastering processing.
The reference export exactly matches the decoded source samples, including timing,
channel order and amplitude. The original AIFC file was read only.

[Waveform and RMS visualizations](figures.html) · [Numerical report](report.json) ·
[Occurrence decisions](occurrence-decisions.json) · [Boundary diagnostics](boundary-step-evaluation.json)

## Measured result

| Measurement | Result |
|---|---:|
| End-to-end processing before JSON report write | **1.117 seconds** |
| Shape synthesis alone | **0.197 seconds** |
| Peak process memory | **339.91 MiB** |
| Accepted 4C occurrences | **1,416 cycles** |
| Accepted families used independently | **4** |
| Modeled frame coverage | **59.072% / 3.544 seconds** |
| Input energy in modeled frames | **69.527%** |
| Reconstruction energy / input energy | **67.827%** |
| Residual energy / input energy | **31.491%** |
| Reconstruction error energy / input energy | **31.491%** |
| Error energy / input energy within modeled frames | **1.464%** |
| Full-recording reconstruction RMSE | **0.0449103** |
| Maximum absolute reconstruction error | **0.2702820** |
| Exported reconstruction + residual maximum sample error | **7.45058e-9** |

Energy ratios are not a partition: reconstruction and residual need not be
orthogonal. The 1.464% covered-frame error describes actual mismatch on selected
frames; it says nothing about omitted frames. The 31.491% full-recording residual
is the remaining error of this deliberately partial model. The near-zero summation
error only verifies subtraction/export bookkeeping, **not successful reconstruction
of every sound**. No overlap separation or instrument identity is demonstrated.

## Transparent reconstruction method

The implementation loads both `signature-library.json` and `report.json` from
Experiment 4C, checks their saved hashes and occurrence consistency, and verifies
that their input hash matches Majorsaw. The input SHA-256 is:

`5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`

Only unambiguous `assigned`, reliable cycles belonging to a `recurring` family
are synthesized. Provisional, ambiguous and unreliable occurrences remain
unexplained. No family merging, note labels, supplied pitches, scale intervals,
expected identity count or new shape fitting is used. Using all four accepted
shape families in a combined reconstruction does not assume a common sound origin.

For each accepted occurrence:

1. Read its family's observed 64-position-per-channel exemplar, rather than that
   occurrence's original waveform or its individual measured shape vector.
2. Map absolute sample time to phase `(frame - start)/(end - start)` using saved
   fractional cycle boundaries. Periodically linearly interpolate the exemplar.
3. Multiply by the occurrence's saved shared stereo RMS scale and restore its
   saved per-channel offset. This restores absolute units from normalized shape
   coordinates; it is not a post-export gain normalization. Stereo geometry and
   polarity are preserved. No independent phase adjustment is fitted.
4. Replace only the short cycle-edge zones with cubic Hermite bridges. Each edge
   width is `min(0.5 ms, 15% of the cycle duration)`. At adjacent accepted joins,
   bridge endpoints use the average of the two model-predicted values/slopes.
   At a gap, the model meets zero with zero slope. Bridges stay entirely inside
   accepted support and use no original PCM. About **17.74% of all recording
   frames**, or **30.0% of modeled frames**, lie in these bridge zones.

The result is initialized to zero elsewhere. There is **no raw waveform fallback**,
no filling of ambiguous intervals, and no interpolation across unknown cycles.
The synthesis function receives family signatures and metadata only; original PCM
is used later for reference export, residual subtraction and evaluation.

The family exemplars themselves were discovered from the original in 4C, so this
is a same-recording reconstruction study, not held-out recognition. In particular,
an exemplar's own occurrence uses its compact discovered shape. It is still an
interpolated, shared, lossy shape model, not a copy of the raw occurrence samples.

## Transitions, releases and audible limitations

There are **447 accepted runs**, because ambiguity frequently interrupts otherwise
periodic material. Reconstruction may therefore sound incomplete or gated. This
baseline intentionally retains those holes rather than reassigning ambiguous cycles.

Per-region full reconstruction error is approximately **1.7–3.4%** for the first
four detected regions, rises to **28–67%** in several middle regions, and is about
**3.6–4.4%** in the final two. These include both model error and omitted cycles.
Some low-level release windows remain wholly unexplained (100% relative error).
The report includes absolute energy as well as ratios for ±20 ms windows around
all detected region starts/ends. Those boundaries are approximate, overlapping
periodicity-derived supports, not certified musical transitions; windows can overlap
silence or neighboring notes. They are evaluation windows only, not synthesis inputs.

Cubic bridges give continuous model value and slope at defined boundaries in the
continuous interpolant. Measured maximum adjacent-sample step immediately after
modeled boundaries is **0.00423**, versus **0.01128** in the original at those frames.
Across the entire waveform, maximum steps are **0.20776** for reconstruction and
**0.20068** for original. A sharp periodic waveform can have large legitimate sample
steps; neither statistic proves the presence or absence of audible clicks.
**Listening has not been performed.** Smooth boundaries do not guarantee click-free
playback, and opening/closing many short runs can introduce modulation artifacts.

64-position interpolation loses details and can underrepresent sharp peaks; the
reconstruction's maximum amplitude is **0.18742**, compared with **0.27028** for the
whole original (which also includes unmodeled transients). Exact peak preservation
was not forced, and no compensating peak normalization was applied. Saved per-cycle
RMS scales approximate cycle amplitude but do not reproduce the complete within-cycle
or attack envelope. Linear resampling has no additional anti-alias filter; prototype
bias, boundary uncertainty, timbre changes and release details remain limitations.
These failures are reported without tuning the model after hearing the result.

## Runtime, memory and verification

The 1.117-second wall time includes verification/loading of saved 4C data, decoding,
synthesis, WAV export, export QA, evaluation and final preservation checks. It
excludes 4C discovery (not rerun), tests, plotting and JSON report serialization.
Stage timings are in report.json. This is not a full-song throughput guarantee.

Memory is the OS process high-water RSS, not incremental synthesis memory. Loading
the 27.57 MiB audit JSON creates large Python object structures; original/reconstructed/
residual arrays and export verification add more. This implementation prioritizes
reviewable listening results rather than streaming or memory optimization.

Six synthetic tests passed: varying duration/amplitude, fractional timing, opposite-
phase stereo, ambiguous/provisional/unreliable silence, cubic endpoint values/slopes,
model joins, gap boundaries, above-unity float export, summation tolerance, overwrite
refusal and invalid/overlapping metadata rejection. WAV reads verify float32 format,
rate, channels and full length. The reference matches every decoded source sample.
SVG XML and finite plot geometry were checked; rendered preview was not inspected.
No browser/device/listening or production readiness claim is made.

The input, original 1C source and all earlier research files are hash-verified
unchanged. No production application code was edited. All 4D code, tests, plots,
metadata and listening outputs are in this new directory. No Experiment 4E or
production integration has been started.

## Reproducibility

```sh
python3 -B -m unittest discover -s research/source-separation/results/experiment-04d-majorsaw-reconstruction -p 'test_*.py' -v
```

`reconstruct.py` and `plots.py` create outputs exclusively and refuse overwrite.
To repeat the run, copy only those source scripts into a NEW sibling directory at
the same results depth, then execute the copied scripts. Keep earlier outputs.
