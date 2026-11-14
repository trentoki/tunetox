# Experiment 4J — independent flexible-recognition and continuity tests

[Simple listening comparison](listen.html)

| Branch | Reconstruction | Residual | Original reference |
|---|---|---|---|
| A — phase-tolerant target | [WAV](a-target-phase/reconstructed.wav) | [WAV](a-target-phase/residual.wav) | [WAV](a-target-phase/original_reference.wav) |
| B — sequence continuation | [WAV](b-sequence-continuity/reconstructed.wav) | [WAV](b-sequence-continuity/residual.wav) | [WAV](b-sequence-continuity/original_reference.wav) |

All are six-second stereo 44100 Hz float32, without normalization or clipping.
Both start from frozen 4H and remain independent. No linear256 or combined render.

## Measured outcome

| Metric | 4H | A | B |
|---|---:|---:|---:|
| Additional recognized cycles | — | 89 | 0 |
| Inferred periods | 0 | 0 | 83 |
| Remaining unmodeled ambiguous cycles | 119 | 30 | 36 |
| Time coverage | 78.87% | 81.83% | 81.69% |
| Significant gaps, same 4I criterion | 102 | 29 | 35 |
| Contiguous modeled runs | 268 | 229 | 201 |
| Residual/input energy | 8.42% | 5.00% | 5.11% |
| Modeled-frame error/input | 1.418% | 1.427% | 1.412% |
| New-region error/input | — | 1.720% | 1.328% |
| Analysis runtime | 0.0366 s | 0.0541 s | 0.2640 s |
| Total timed run before JSON | 1.211 s | 1.035 s | 1.229 s |
| Peak whole-process RSS | 324.05 MiB | 310.94 MiB | 326.09 MiB |

B’s 83 inferred periods connect 67 complete bounded gaps: 51 single-period and
16 two-period continuations. It has slightly more residual energy but fewer model
interruptions than A. Naturalness still needs listening; run counts and error
metrics are not perceptual proof. New-region sets differ, so their errors are not
an isolated estimator comparison on identical samples.

A recovers all 57 isolated target-score failures from 4I. Of new original ambiguous
cycles modeled by either branch, 76 overlap, 13 are A-only and 7 are B-only. B-only
cases include five old neighbor and two old periodicity-confidence rejections.
No family/source identities are merged. B’s identity labels remain ambiguous even
when a waveform is inferred; “remaining” in the table means still unmodeled.

## Precisely what changed

**A:** compare the historical best target exemplar over ±0.5 of a 64-position slot,
using the existing 4G probe. Keep 0.995 and all other 4H phase/harmonic/periodicity,
family and neighbor gates. Do not alter synthesis phase, timing, amplitude or
learned templates. No global threshold reduction or B inference is used.

**B:** retain only original 4H recognition. Three accepted cycles on each side must
form stable period/amplitude/shape context, with compatible learned families and
a dominant exemplar. Require ≤2% period deviation, ≤20% flank amplitude ratio,
and one/two-period phase closure within 2%. Predict phase increments, amplitude
and offsets from neighboring metadata, not the target signature or waveform.

Verify that one fixed prediction against original audio: ≤5% gap error and ≥0.98
signed correlation, ≤8% per-period error and ≥0.97 correlation, and no quiet block
where the model predicts material. No target gain/phase fit or residual-minimizing
search. Context-ineligible or mismatching sections stay unexplained. All 67
context-eligible proposals passed verification on this clip; tests separately
exercise genuine silence, endings, unrelated shape and transition rejection.

Both use exactly the frozen 64-position linear sampler and Hermite joins. B marks
new negative cycle IDs as `sequence-inferred, not directly recognized`; it does
not rewrite original detections or recursively use inferred context. Stable source
phase closure connects whole gaps; leading/trailing extrapolation and long gaps
are not attempted. Full policies, anchor IDs and uncertainty records are saved.

## Quality, cost and safeguards

Maximum whole-waveform step stays 0.209021 for both. Boundary maximum is essentially
unchanged (A 0.00563875, B 0.00563840). Worst added-period error is A 2.331%, B 1.605%.
No listening has been performed, and these checks do not certify click-free audio.
64-position high-frequency limitations remain intentionally unchanged.

Both reconstruction-plus-residual exports conserve original within 7.45e-9 per
sample. Reference WAVs are byte-identical to 4H’s exact conversion. No original
waveform is copied into synthesized/inferred output; original samples are used
only for verification, reference export, residual and evaluation.

Actual timing is split by stage in each report.json. A setup/analysis/synthesis/
export/evaluation: 0.270/0.054/0.300/0.060/0.352 s. B: 0.266/0.264/0.291/0.053/0.354 s.
These are measured execution regions, excluding development, process startup/imports,
JSON, tests and page generation. Nine tests ran separately in 0.120 s. Peak RSS
includes audit metadata, PCM and readback, not incremental method memory. Baseline
performance is historical and not a controlled benchmark.

Nine tests passed, including genuinely different shapes, polarity/phase differences,
unchanged confidence gates, silence/endings, real gaps, pitch/volume transitions,
long-gap rejection, two-cycle inference, independent outputs and original agreement.
Constructed controls do not establish a general false-accept rate or source identity.

All prior experiments and production files are preserved. No MIDI, predefined
instrument or scale, isolated stem, linear256 combination, merged variants or 4K.

```sh
python3 -B -m unittest discover -s research/source-separation/results/experiment-04j-independent -p 'test_*.py' -v
```

To repeat, run `run.py --variant target-phase --output NEW_DIRECTORY` or
`run.py --variant continuity --output NEW_DIRECTORY`, each in a separate process
and sequentially. All generated WAVs/JSON are exclusive-create. `build_page.py`
creates the local listening page from the frozen run reports.
