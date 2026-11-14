# Experiment 1C — staged presence and relationship research

Experimental standard-library-only CLI; no production integration. Experiments 1,
1B and all pre-existing artifacts are retained. `preservation_01c.json` records their
pre-edit SHA-256 values, including ignored local results. No source identities,
reference recordings, event parity or expected source count enter discovery.

Stage 1 is `experiment_01c.py`. Stage 2 is the independently invoked
`relationships_01c.py`; it never feeds back into separation or writes audio.

From this directory:

```sh
python3 -B -m unittest discover -s tests -p test_experiment_01c.py -v
python3 -B experiment_01c.py separate audio/combined.wav --output results/new-1c
python3 -B -m unittest discover -s tests -v
python3 -B relationships_01c.py results/new-1c --output results/new-1c-relationships.json
```

All outputs are exclusive-create. Existing runs cannot be overwritten. WAV input
and export limits are inherited from 1B. The retained recording adapter in
`results/recording-01c/run_adapter.py` decodes the same AIFC float32 mixture directly,
without resampling, normalization, reference access or original-file writes.

## Stage 1

The 65% full-event recurrence requirement is removed. Boundary-aware, nonnegative
least-squares fitting still finds the lag and gain. At that lag, candidate/target
waveforms are compared in 4 ms windows, jointly across stereo channels. Windows
with candidate energy below 0.001 of its highest window are uninformative. Presence
requires positive normalized correlation >=0.85 in at least three informative
windows (all available windows if fewer than three). Diagnostics retain each window
correlation and supporting count, plus whole-event energy fractions for inspection
only. The 1B input-relative significance guard remains (global >=1e-5 OR median
original-event contribution >=1e-4). These constants are provisional research
heuristics, not calibrated detection confidence or audibility thresholds.

Observation windows now extend from detected starts through the next event start,
or recording end. Thus below-threshold tails are measured rather than cut at the
old detector end; `detected_end_frame` retains that old boundary for comparison.
No fade is applied to erase evidence, and no missing samples are synthesized.
Complete observed tails are preserved when they fit within that observation.
Tails overlapping the following event, unequal observation lengths, contaminated
candidate tails, and nonzero recording-end cuts remain unresolved. This does not
claim a general solution for overlapping-source tail reconstruction.

Local agreement can establish evidence in a small part of a much louder mixture.
It can also mistake a shared substructure for presence. Co-occurring interference
can hide every local window; the global lag/gain fit can still be biased by correlated
sources. Candidates remain entire observed events, not proven isolated sources.
The detector can miss quiet events. Low residual energy is not separation quality.

## Stage 2

Every nonzero component/event fragment and residual/event fragment is compared
pairwise, including within a component. Exhaustive integer-frame delays, signed
gain, signed normalized waveform correlation and overlap energy coverage are
reported. Channels are never summed, preserving stereo polarity. Full support
and terminal halves are compared separately; score = correlation squared times
minimum overlap energy coverage. Score >=0.7 flags shared structure, potential
cross-component duplicate assignment, inversion/cancellation, or shared terminal
structure warranting incomplete-tail inspection. Disjoint active supports within
one event flag possible complementary fragments, with no claim of shared identity.
All pair scores are retained, not only flagged ones.

Phase-aware here means signed waveform/polarity and integer-frame delay comparison;
it does not implement fractional delays, arbitrary frequency-dependent phase,
or phase-vocoder analysis. Complementarity and missing tails are hypotheses;
correlation alone cannot establish them. Pairwise exhaustive analysis may be slow
on long recordings. No new dependencies, permissions or network access.

## Verification

Stage 1's first independent run passed 3 new tests plus 22 unchanged 1/1B tests,
before Stage 2 was implemented. The final suite also runs the original eight
regressions against 1C, plus Stage 2 signed/shifted/scaled, negative and nonmutation
checks. Synthetic tests validate constructed cases, not real-world source purity.
Listening, Safari/device checks and production readiness are not established.

Recorded verification: all 37 tests passed on 2026-11-12. The original mixture
run produced eight detected events and three anonymous components; float64
residual/input energy was 8.18e-36 (1B: 1.15e-6). This near-zero residual is
bookkeeping evidence only, not proof that 1C found the correct sources.
All 107 pre-existing research files matched their preservation-manifest hashes.

Stage 2 completed at ±5 ms on saved 1C float32 exports: 105 fragment
pairs compared. See `results/recording-01c/relationships.json` and
`stage2-verification.json` for scores, hypotheses and source hash. Saved audio
and all previous files passed hash verification after diagnostics. Float32 export
reconstruction maximum sample error was 2.98e-8.
