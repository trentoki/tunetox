# Experiment 5D — provisional multi-period recognition

**5D is the strongest limited listening checkpoint, not a complete separation.** It
recovers measurable periodic structure that 5A rejects, including part of the third
note. Clap reconstruction is unchanged, and important regressions remain.

[Listening comparison](listen.html) · [Original](listening/original_reference.wav) · [Periodic estimate](listening/separated_source_1.wav) · [Unchanged transient fragment](listening/separated_source_2.wav) · [Residual](listening/residual.wav) · [Recombined including residual](listening/recombined.wav)

## One correction, independently tested

For original 5A periodic gaps large enough to contain three complete cycles, test
the **already learned mixture-derived periodic shape over eight periods**, rather
than requiring reliable raw rising-crossing cycles. Use mixture pitch confidence
≥0.9 and at least three same-pitch reference cycles (within 2%) anywhere in that
recording, including later evidence. Estimate positive gain and phase; reject gains
above 1.2 times the reference median. Require 1C local presence: ≥3 supporting
windows with correlation ≥0.85, and three consecutive complete supported cycles.

Only complete cycles within supporting windows and previously empty periodic
support can be assigned. Assignments are **provisional**, not new direct cycle
recognitions. The existing 256-position mixture-learned tables and frozen Hermite
renderer synthesize them. Existing 5A periodic samples and all transient samples
are preserved. No original-PCM fallback, threshold sweep, new waveform family,
transient correction or reference-source template is introduced.

This does not make the old 0.995 isolated-shape gate pass. It adds a different,
explicitly provisional **mixture-presence test** using 1C's existing 0.85 evidence
criterion. Original recognition decisions remain available for review.

## Synth/transient mixture

| Metric | 5A | 5D |
|---|---:|---:|
| Model structures | 2 | 2 |
| Periodic coverage | 68.364% | **71.924%** |
| New provisional complete cycles | 0 | **93** |
| Residual / original energy | 24.097% | **21.119%** |
| Active-periodic gap duration, gaps ≥1 ms | 1.0213 s | **0.8073 s** |
| Largest gap | 179.37 ms | **134.83 ms** |
| Gap count ≥1 ms | 40 | **46** |
| Output high-periodicity frames | 408 | 422 |
| Pitch frames agreeing with observed mixture f0 within 2% | 397 | 407 |

The third-note neighborhood changes from zero periodic support to **nine provisional
cycles / 22.90 ms**, chiefly about **0.604–0.627 s**. This is **8.90% of the wider
0.489–0.746-s neighborhood**, not recovery of the entire note. The added material
has coherent multi-period evidence, not just a lower residual. Across all new
regions, mismatch to the mixture is **4.22% energy**; because the mixture contains
other sound, this is a fit metric, not true source reconstruction error.

**Regressions:** long gaps split into more short gaps (40→46). A new half-frequency
output-pitch estimate occurs near **3.903 s** (207.76 versus mixture 414.97 Hz);
the older 4.673-s subharmonic remains. Joint high-confidence pitch disagreements
increase from one to two, despite more agreeing frames overall. The largest new
support-boundary sample step is **0.001052**. No audible-artifact claim is made.
[Pitch flags](pitch-proxy-disagreements.json).

Source 2 is **bit-identical to 5A**, with the same five recurring fragments; complete
clap attacks/tails are not newly recovered. Added periodic audio has no temporal
energy overlap with that existing transient stem (cosine 0), but unknown clap tails
can remain mixed in the residual. This is not an absolute leakage measurement.

## All three benchmarks

| Input | 5A → 5D | Original control |
|---|---|---|
| Synth + transient mixture | 93 provisional cycles; coverage +3.56 points; shorter total gaps | 5B original 1C: one mixed component, 90.22% residual |
| Variable-volume kick/clap | No periodic hypothesis, no new assignments; four fragmented models and **36.864% residual unchanged** | Original 1C: two components, **0.005791% residual** |
| Single `Majorsaw.aif` | No new assignments; **82.627% periodic coverage**, **3.542% residual unchanged** | 4Q: **86.500% coverage**, **1.395% residual**, using single-source original-PCM assignments |

5A's pre-existing kick/clap regression remains severe (best component correlations
to the two saved 1C estimates only 0.556/0.038). On the single-synth input, unchanged
5A produces four additional transient-like fragment models totaling **0.0571% of
input energy**; these are source-identity fragmentation, not four verified new sounds.
5D neither introduces nor fixes them. The original 1C and 4Q baselines were reused
from verified saved outputs; they were not rerun unnecessarily or modified.

No aligned isolated source references exist for the mixture; the separate
`Majorsaw.aif` render was not validated as its exact synth source. True source SDR,
SIR and absolute contamination remain unverified. All source information used by
5D is learned from the corresponding benchmark mixture itself. Synthetic controls
use known constructed signals only for verification.

## Reproducibility, cost and exports

Reports: [mixture](evaluation-mix.json), [kick/clap](evaluation-kick.json),
[single synth](evaluation-single.json), [new assignments](assignment-map.csv).
The map distinguishes old periodic estimates, new provisional cycles and unchanged
transient templates; unexplained audio remains in the residual.

| Successful measured run | Total evaluation | 5D correction only | Peak RSS |
|---|---:|---:|---:|
| Mixture | 4.425 s | 1.457 s | 311.19 MiB |
| Single synth, including fresh unchanged 5A baseline | 37.142 s | 1.053 s | 377.34 MiB |
| Kick/clap, using saved 5A transient estimates | 1.350 s | 0.00010 s | 192.72 MiB |
| Selected mixture listening export and checks | 5.282 s | included | 391.69 MiB |

The mixture evaluation reuses saved 5A estimates; it is not a fresh end-to-end 5A
runtime benchmark. Timings exclude imports, development, tests, serialization,
supplementary diagnostics and this report. No benchmark/intermediate listening
WAVs were exported. Only this selected mixture candidate has new audio exports.

Seven focused controls pass, covering true periodic recovery, different shapes,
noise, silence, insufficient references, pitch changes, disjoint assignment and
conservation; eleven unchanged 1C tests pass. Reconstruction plus explicit residual
matches input within **1.49e−8**, and recombined/reference within **2.98e−8**. All WAVs
are full-length stereo 44.1-kHz float32, without normalization or clipping. Exact
conservation is bookkeeping, not separation quality. No new listening/browser
validation has occurred.

**No 5E was implemented:** residual head/tail evidence is not consistent enough to
justify assigning extended transient audio. No changes were combined. All previous
experiments and production files are preserved. Stop here for listening review;
no additional experiment or integration has begun.
