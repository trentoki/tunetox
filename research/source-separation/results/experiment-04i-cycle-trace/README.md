# Experiment 4I — missing-cycle trace, frozen 4H baseline

[Compact diagnostic report with four annotated waveform comparisons](report.html)

## What actually happens

The ordinary isolated missing ramps are generally **detected but rejected**, not
accepted and lost during rendering. There are 70 isolated rejected cycles with
accurately modeled neighbors: 57 fail the fixed target-shape gate, 8 neighbor
checks, and 5 target-periodicity confidence. All regenerated rejected reliable
signatures match their saved values exactly. No missing reliable signature,
accepted-but-unrendered cycle, or out-of-support rendering was found.

The 57 isolated target failures have median score **0.994895**, just below 0.995.
A diagnostic quarter-slot phase comparison moves all 57 above the gate; translating
both audio boundaries together by up to one original sample moves 40 above it.
Their median period error is only **0.134%**. The target match stayed fixed-phase
in 4H even though neighbors became phase tolerant.

This confirms alignment/sampling sensitivity of the confidence gate, **not proof
that physical boundaries are wrong**. Rotation/interpolation can smooth descriptors;
native translation changes how the waveform is sampled. No improved score was
used to accept or reconstruct anything.

## Failure counts and energy

Percentages below are shares of the entire saved 4H residual energy, with exclusive
categories. Candidate counts include low-level/tiny false-crossing intervals.

| Stage | Candidate cycles / fragments | Share of residual |
|---|---:|---:|
| Fixed target-shape rejection | 93 | 42.12% |
| Detection/reliability rejection | 399 | 27.32% |
| Target-periodicity confidence | 11 | 6.04% |
| Neighbor rejection | 13 | 4.28% |
| Provisional family | 4 | 2.45% |
| Unsupported family relationship | 2 | 1.08% |
| Outside first/last complete candidate | 2 partial fragments | 1.06% |
| Error within rendered cycles | 2013 modeled cycles | 15.65% |
| Accepted but not rendered | 0 | 0% |

One unsupported pair also has a low-score reason; hence the original logs contain
94 low-score reasons while the exclusive target-shape category contains 93 cycles.

There are **102 significant flat-output intervals**: 75 target-shape dominated,
9 detection/reliability, 8 neighbor, 7 target-periodicity, 2 context boundaries,
1 unsupported relationship. Every interval is traced to candidate IDs and their
full pipeline in report.json. The CSV retains all 267 active-block flat intervals,
including smaller insignificant ones. Significance uses relative original energy
and local period duration, not an audibility model.

## Boundaries and spikes

Cycle boundaries are rising mean-level crossings. The steep waveform reset is an
internal landmark; its roughly half-period offset is intentional. Reliable local
reset-to-reset versus crossing-period spacing differs by median **0.272%** for the
isolated target failures, rather than indicating a whole misplaced period.

**1616 narrow residual events occur inside rendered 4H cycles.** Median width is
one sample, median phase 0.5123 period, median offset from the source’s steepest
edge one sample, and zero lie in bridge zones. These are detail/phase approximation
errors, not entirely missing ramps. They contain about 5.69% of total residual
energy. This diagnostic cannot uniquely separate bandwidth loss from sub-sample
high-harmonic phase error.

## Scope and cost

- Main execution before JSON/CSV output: **1.150 s**.
- Load/hash setup: 0.310 s; trace/boundary probes: 0.616 s; aggregation/final
  preservation checks: 0.224 s.
- Peak whole-process RSS: **254.94 MiB**. Includes metadata and three frozen WAV
  arrays; excludes tests/figures/HTML generation.
- **Seven focused tests passed**: stage distinctions, exclusive counts, significance,
  reset/origin distinction, saved residual-energy partition and trace consistency.

All earlier files and exports remain unchanged. No recognition, grouping, synthesis,
cycle detection or pitch algorithm was changed or rerun as a new method. Only
frozen math utilities were called for evaluation probes. No new WAV, linear256
combination, MIDI/stem input, instrument/scale assumption or 4J work.

A future controlled target-side alignment test is supported; a blind confidence
relaxation or automatic family merge is not. No correction is implemented here.

[Full traces and probes](report.json) · [Gap locations](gap-trace.csv) ·
[Preservation snapshot](preservation.json)

```sh
python3 -B -m unittest discover -s research/source-separation/results/experiment-04i-cycle-trace -p 'test_*.py' -v
```

To repeat, copy source/test files to a new sibling directory at the same depth.
Run `analyze.py`, then `build_report.py`. Generated data is exclusive-create.
SVG XML, finite coordinates, HTML IDs and links are checked; browser-rendered
preview and new listening were not performed.
