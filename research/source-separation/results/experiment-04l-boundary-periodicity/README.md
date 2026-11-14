# Experiment 4L — boundary-aware periodicity

[Original reference](4l-final/original_reference.wav) · [4L reconstruction](4l-final/reconstructed.wav) · [4L residual](4l-final/residual.wav) · [Unchanged 4J-A rerun](baseline-rerun/reconstructed.wav)

Input: `audio/Majorsaw.aif` (original preserved), SHA-256
`5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`.
All WAVs are full-length stereo, 44.1 kHz, IEEE 32-bit floating point. No normalization, clipping, mastering, or original-waveform fallback. Only 4L implements both requested boundary corrections; no other improvement is combined.

## Controlled comparison

| Run | Recognized cycles | Coverage | Residual/input energy | Significant gaps | Processing seconds | Peak MiB |
|---|---:|---:|---:|---:|---:|---:|
| 4J-A | 2102 | 81.831% | 4.999% | 29 | 1.283 | 314.86 |
| Periodicity only | 2128 | 82.761% | 3.888% | 26 | 1.392 | 344.06 |
| Onset only | 2106 | 81.953% | 4.855% | 28 | 1.135 | 326.06 |
| 4L | 2132 | 82.883% | 3.743% | 25 | 1.672 | 346.75 |

The unchanged 4J-A rerun is bit-identical to its earlier three audio exports.
The two independent effects are disjoint: periodicity context recovers 26 cycles;
onset predecessor handling recovers 4. Combined: 30 new cycles, zero lost baseline
cycles, zero inferred cycles. Seventeen newly recognized cycles were previously
unreliable at the periodicity/detection screen. Existing cycle boundaries are reused.

Energy-weighted waveform error in newly covered regions is **1.353%** of their
original energy (worst individual newly accepted cycle **2.099%**, median **1.367%**).
Modeled-region error is 1.426% versus 1.427% baseline. Global waveform RMSE falls
from 0.017894 to 0.015484. These are measured signal errors, not perceptual claims.

## Recovery of the six largest 4K gaps

Coverage is the fraction of each formerly omitted interval now modeled; residual
is measured error divided by original energy in that identical interval.

| Original gap (seconds) | Modeled fraction | Residual/input energy |
|---|---:|---:|
| 2.986032–3.019388 | 65.6% | 32.9% |
| 4.988776–5.016825 | 30.6% | 69.8% |
| 3.489206–3.510204 | 40.8% | 57.3% |
| 4.497166–4.507687 | 0.0% | 100.0% |
| 3.998980–4.015011 | 0.0% | 100.0% |
| 2.497732–2.508209 | 18.0% | 83.0% |

Four of six intervals partly recover; two remain entirely omitted. All 25 remaining
significant-gap locations are recorded in [comparison.json](comparison.json), using
the unchanged 4I/4J significance definition. Recognition decisions, newly accepted
cycle errors, context windows, and detected boundaries are in
[4l-final/report.json](4l-final/report.json) and [decisions](4l-final/decisions.json).
Remaining omissions include irregular crossing spacing, insufficient confidence,
unsupported exemplar relationships, and neighbor disagreement. The small gaps are
not automatically filled. Seventeen of 4J-A's original 30 ambiguous cycles remain
unrecognized; five newly eligible ambiguous candidates also remain unresolved
(22 total in the revised candidate set).

## Narrow implementation

Saved audio-derived f0 observations must pass existing 0.9 confidence and 5% observed
period-consistency screens. A change exceeding the existing 2% neighbor period limit
brackets a possible boundary; brackets spanning sustained silence are excluded.
The split minimizes capped observed-period disagreement over the bracket. No pitch
names, musical intervals, expected count, or fixed note times are supplied.

Only windows crossing one of these boundaries or a measured silence-to-activity
boundary are replaced. At pitch changes, equal-length 2048-sample context windows
are placed entirely beyond the confident bracket on the appropriate side. This
avoids treating an uncertain single crossing as an exact transition. Elsewhere,
analysis metadata remains unchanged. Recomputed signatures use the frozen 64-point
calculation and frozen exemplars, without reclustering or creating families.

At onset, only the first reliable complete cycle close to the end of sustained
silence is eligible for a missing/distant-predecessor waiver. The 2-ms activity-block
uncertainty is included in that proximity bound. The target gates and following
neighbor must still pass. Geometry mismatch and unrelated-shape failures cannot be
waived. Silence and partial initial cycles are not synthesized.

All original similarity/confidence thresholds, bounded phase matching, family
relationships, amplitude metadata, and 64-position synthesis/interpolation are reused.
The runner reuses the 4J measurement/export code; its inherited
`step_checks.4h_at_new_boundaries` label actually refers to the loaded **4J-A** waveform.

## Safeguards, cost, limitations

Four focused tests and seven unchanged 4J tests pass. Tests cover an audio-derived
synthetic pitch transition, unchanged away-boundary metadata, different shapes,
uncertain/partial cycles, silence, and the narrowly permitted predecessor waiver.
A synthetic transition exposed a confident subharmonic estimate; boundary proposals
now also require the existing observed-period agreement screen. This changes boundary
proposal eligibility, not a recognition threshold.

No baseline accepted cycle was lost. Maximum whole-waveform sample step remains
0.209021 and maximum step at modeled cycle boundaries remains 0.005639. Newly modeled
cycle errors are low; this does not prove absence of false recognitions or audible
pops. No new listening test was performed, and sharp-edge detail limitations remain.
Four-cycle onset recovery is incomplete; no unsupported predecessor or following
constraint was broadly removed. Small sample-value changes near frozen renderer joins
are expected when formerly isolated cycles become adjacent.

Reconstruction plus residual matches the reference within **7.46e-9** maximum absolute
sample error after float32 export. This conservation identity is separate from
reconstruction quality. Prior research hashes and current source hashes were checked;
production files and earlier experiments remain untouched.

The combined run took **1.672 seconds** through evaluation/export checks, including
0.258 seconds of same-side periodicity calculation, 0.016 seconds recognition, and
0.302 seconds synthesis; peak whole-process RSS **346.75 MiB**. These timings exclude
module import, development, tests, and this short report. Boundary detection/loading
and preservation hashing are included in setup. Baseline and variants ran in separate
processes, sequentially; one run each, not a performance benchmark.

Development trials are retained in `combined/`, `final/`, `4l/`, and `periodicity-only/`;
they are not the final listening result. One trial unnecessarily analyzed release-side
silence boundaries and lost one accepted cycle; final code restricts silence-boundary
correction to beginnings and loses none. No thresholds or synthesis were tuned.

**Stopped after 4L. No 4M or additional correction was implemented.**
