# Experiment 4M — missing sections in the seventh short note

Diagnostic only, frozen **4L final**. [Complete sample/cycle trace](report.json) · [Timing evidence](supplement.json) · [Beginning comparison](beginning.svg) · [Interior-gap comparison](interior-gap.svg).

## What is missing, and why

Original-sample activity islands separated by at least 2048 digital-silence samples locate the sixth, seventh and eighth short regions automatically. Their active extents are respectively **1.250068–1.399297**, **1.500068–1.648367**, and **1.750068–1.898753 seconds**, including quiet releases. No supplied timestamps, MIDI or pitches were used. Median measured cycle frequencies are 523.72, 587.98 and 621.29 Hz.

The seventh region has **three significant missing sections**, using the unchanged 4I gap-significance rule:

| Absolute sample frames, half-open | Time (seconds) | Cause |
|---|---|---|
| [66153, 66178), 25 frames | 1.500068–1.500635 | Initial partial waveform sits in rejected candidate 458 spanning preceding silence |
| [68130, 68206), 76 frames | 1.544898–1.546621 | Complete cycle 491 rejected solely by following-neighbor period check |
| [70758, 70834), 76 frames | 1.604490–1.606213 | Complete cycle 535 rejected for the same reason |

**No accepted cycle is omitted by rendering.** All 77 accepted cycles have nonzero output throughout their sampled support. No cycles were inferred. In addition to those three significant gaps, there are 24 lower-energy zero-output runs: 22 two-sample holes and two release-region omissions. These are listed individually in the trace; they should not be counted as 24 lost ordinary full cycles.

## The two interior cycles are good shape matches

| Evidence | Cycle 491 | Cycle 535 | Required |
|---|---:|---:|---:|
| Periodicity confidence | 0.983191 | 0.982814 | ≥0.9 |
| Target period error | 0.5823% | 0.5902% | ≤5% |
| Target similarity, bounded phase | 0.998623 | 0.998607 | ≥0.995 |
| Previous-neighbor similarity, bounded phase | 0.998155 | 0.998157 | ≥0.995 |
| Following-neighbor duration difference | **2.3183%** | **2.3324%** | **≤2%** |

Both had detected boundaries and calculated signatures, passed all target gates, and were rejected only at that last period comparison. Their following-neighbor shape comparison was **never evaluated**, because the duration guard short-circuited it. Their original/reconstruction/residual samples confirm complete omission, not inaccurate rendering.

After duration/amplitude normalization and bounded phase alignment, cycle 491 matches accepted cycles in notes 6/7/8 at **0.997992 / 0.999048 / 0.998655**; cycle 535 gives **0.997985 / 0.999045 / 0.998658**. The missing cycles do not appear to represent distinct waveform shapes.

The rising-crossing durations are **75.726 / 73.971 frames** and **75.731 / 73.965 frames**. In contrast, adjacent original sharp-edge intervals are **75.05915 / 75.06061** and **75.05915 / 75.06076 frames**—only about **0.002%** relative change. The sharp-edge positions are sampled maximum-slope proxies, not exact physical discontinuities, but strongly contradict a genuine 2.32% local pitch jump.

Original samples show small ripples/dips near the crossing level; elsewhere these generate extra rising-crossing intervals only about one sample long. The two full-cycle losses repeat 2628 samples apart with nearly identical boundary geometry. The evidence supports **crossing-location jitter tripping a rigid one-cycle neighbor guard**, rather than silence, a pitch transition, missing periodicity, or poor target recognition.

## Beginnings, narrow holes and reconstruction inaccuracies are separate

The first 25 active samples of note 7 are part of candidate 458, whose detected interval is **4837.18 frames** long because it starts in the previous release and crosses the silence. Its analysis window is inactive, f0 is unavailable and confidence is zero. No pipeline signature is calculated and family recognition is never reached. This is not evidence that a partial cycle failed a waveform-similarity threshold. The first complete cycle 459 is accepted by 4L. The same initial-boundary problem loses 81 active frames in note 6 and 43 in note 8.

The two-sample holes occur near the rising crossing; their original amplitude and energy are small, so their residual can look inconspicuous. The **54 rendered-error events** above the stated diagnostic threshold (20% of this region’s original peak) are different: they are narrow spikes at cycle phases **0.490–0.543**, within two samples of the original sharp edge. They occur inside rendered cycles, not at the tiny crossing holes. Of 1.07274 residual-energy units inside accepted cycles, 0.98446 are outside synthesis join zones; 0.57888 lie within two samples of sharp edges. Frozen waveform-detail approximation dominates this measured rendered error; it is not a missing-ramp explanation. The sixth/eighth regions similarly have 61/57 threshold events.

Later, quiet release cycle 560 fails neighbor similarity **0.994855 < 0.995**; cycle 562 fails its selected target **0.994921 < 0.995**. Both match other accepted release cycles above 0.9995, but their energies are low. They are retained as distinct confidence failures rather than hidden in the interior-gap explanation. Notes 6 and 8 also have neighbor-duration rejections (cycles 428/685: **2.3439% / 2.0850%**), during quieter releases, below gap significance.

## Residual and decision dependencies

At every zero-output section, the stored residual equals the original **exactly**. Across all three regions, maximum `original − reconstructed − residual` discrepancy is **7.45e−9**, consistent with float32 export. Tiny original amplitude explains small-looking residual holes; where reconstruction remains nonzero but differs, only the difference belongs in the residual.

Code inspection confirms that recognition consumes original-derived signatures, periodicity, fixed exemplars and cycle-neighbor metadata—**not the residual**. Reliable cycles remain eligible as neighbors even if unaccepted; unreliable candidates are skipped, affecting which reliable neighbor is selected and its gap. There was no observed rejected-but-reliable neighbor example in these three local decision traces. Residual samples themselves never feed classification. Rendering joins depend on accepted neighboring models.

## Single simplest next test

**Use a short, robust multi-cycle period estimate in the neighbor-duration guard instead of comparing two raw single-crossing durations.** Retain the 2% limit and all shape/confidence checks. This directly targets the two substantial interior losses without lowering a similarity threshold or changing synthesis. Future tests must still reject genuine period changes and unrelated shapes. It would not solve initial partial-cycle support or sharp-edge detail errors. **Nothing was implemented.**

Main trace execution: **1.698 seconds**, peak whole-process RSS **235.83 MiB**; supplementary edge probes: **0.190 seconds**. These exclude imports, development, figures, tests and this report. Three focused diagnostic tests pass; energy partitions, exact gap residuals, syntax and SVG geometry were checked. Hashes verify 445 prior research files unchanged. No listening or browser preview was performed. No algorithms, thresholds, production files or audio exports changed.
