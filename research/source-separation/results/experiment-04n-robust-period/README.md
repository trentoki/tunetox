# Experiment 4N — robust local period reference

[Original reference](listening/original_reference.wav) · [4N reconstruction](listening/reconstructed.wav) · [4N residual](listening/residual.wav) · [4L reconstruction](../experiment-04l-boundary-periodicity/4l-final/reconstructed.wav)

Input: `audio/Majorsaw.aif`, SHA-256
`5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`.
Full-length stereo, 44.1 kHz, IEEE float32. No normalization, clipping or mastering.

| Metric | Frozen 4L | 4N |
|---|---:|---:|
| Recognized cycles | 2132 | 2137 |
| Coverage | 82.8832% | 83.0268% |
| Residual/input energy | 3.7433% | 3.5765% |
| Significant gaps (unchanged 4I/4J rule) | 25 | 20 |
| Modeled-region error energy | 1.4262% | 1.4258% |
| Waveform RMSE | 0.015484 | 0.015135 |

Five newly recognized cycles: **491, 535, 859, 903, 947**. Every recovery is verified
against the old guard: target gates passed before and the original neighbor-duration
rule rejected it. No inferred cycles or partial-onset recovery. All 2132 previous
accepted cycles remain; the new period check was also audited on their metadata,
with no new period failures. The baseline is its unchanged, hash-verified saved
export; earlier experiments were not rerun.

## Seventh note and quieter releases

| Cycle | Median reference, samples | Duration deviation | Reconstruction error energy |
|---|---:|---:|---:|
| 491 | 74.483311 | 1.6412% | 1.3396% |
| 535 | 74.480320 | 1.6516% | 1.3380% |

Each reference uses six reliable cycles (three per side), excluding the target.
The six periods for cycle 491 are 74.9977, 74.9960, 75.0000, 73.9706, 73.8752,
73.8300 samples. The resulting median is a robust crossing-period reference, **not**
a claim of the exact physical oscillator period. The unchanged comparison remains
`abs(reference / target_duration - 1) <= 0.02`.

Both substantial interior gaps identified by 4M are recovered. The median does not
change original cycle boundaries or phase. The first partial cycle remains omitted.
Release cycles **428 and 685 remain rejected**: their intervals overlap the previously
measured quiet-region boundary, so the conservative estimator falls back to the
original one-neighbor check (2.3439% and 2.0850% deviations). Release confidence and
shape failures are otherwise unchanged.

New-region energy-weighted reconstruction error is **1.3398%**; worst new cycle is
**1.3421%**. Output RMS ratios are about 0.9773. These signal measurements support the
recoveries but do not establish perceptual quality or source identity.

## Estimator and safeguards

At most three reliable cycles are collected per side, using 4L's frozen original-
audio metadata, not newly accepted decisions or residual audio. Require at least
three total references and at least one per side. Existing 0.1-period temporal gap
bounds apply. Do not cross saved pitch-change uncertainty brackets or sustained
quiet intervals; do not pool f0 estimates differing from the target by over 2%.
Require flank medians to agree within 2%, and median absolute period dispersion
within 2%. Otherwise use the **exact old guard**. All these bounds reuse existing
2% duration tolerance; no similarity threshold is lowered.

Target recognition, neighbor geometry, bounded phase comparisons, periodicity screens,
4L onset handling, original amplitudes, families and 64-position synthesis are reused.
Only the duration reference is substituted. No families merge and no missing
waveform is copied from the original into the reconstruction.

Five focused tests pass: median/outlier behavior, exact insufficient-context fallback,
silence/onset and boundary protection, a genuine unmarked period change, and different
waveform/failed-target rejection. All new real-data recoveries lie outside genuine
pitch-boundary brackets. No new transition recoveries or failed accepted-period
checks were found. Maximum whole-waveform and modeled-boundary steps remain
0.209021 and 0.005639. Audio outside the five new cycles and the frozen adjacent
join zones is bit-identical to 4L. These checks found no regression; false recognition
or audible artifacts cannot be ruled out without listening.

Conservation after float32 export is within **7.45e−9** maximum absolute sample error.
Reference WAV is bit-identical to 4L. Earlier research and production files are
unchanged. [Verification](verification.json) · [Detailed report](listening/report.json)
· [Decisions](listening/decisions.json).

Measured core run through synthesis/export/evaluation: **1.529 seconds**, peak process
RSS **333.39 MiB**; recognition/period estimation took **0.00825 seconds**. This excludes
imports, final provenance/accepted-cycle audit, JSON serialization, development,
tests and report preparation. Baseline's earlier recorded run was 1.672 seconds /
346.75 MiB, but these single timings are not a controlled speed benchmark.

## Remaining significant gap locations

These use the unchanged block-activity mask, so their endpoints can include quiet
samples immediately before an onset. Exact original-sample onset extents remain in 4M.

- 0.000000–0.001905 s
- 0.249433–0.251519 s
- 0.498866–0.502404 s
- 0.750295–0.752381 s
- 0.999728–1.001769 s
- 1.249161–1.251905 s
- 1.750023–1.751043 s
- 1.999456–2.004014 s
- 2.497732–2.506327 s
- 2.999388–3.008707 s
- 3.015125–3.017279 s
- 3.489206–3.491361 s
- 3.499932–3.510204 s
- 3.512608–3.514989 s
- 3.986939–3.989342 s
- 3.998980–4.015011 s
- 4.497166–4.507687 s
- 4.510544–4.516304 s
- 4.997370–5.016825 s
- 5.997120–6.000000 s

**Stopped after 4N. No other correction or synthesis change was implemented.**
