# Experiment 1B — boundary-aware alignment and relative significance

Implemented as a separate `experiment_01b.py`; Experiment 1 source, README, tests,
recording, WAV exports and diagnostics are preserved. Production files are unchanged.
This remains an experimental observed-template separator, not an instrument classifier.
No reference samples, event parity, source labels or expected component count are used.

## Run and compare

Integer PCM WAV interface and all original export protections are retained:

```sh
python3 -B experiment_01b.py separate audio/combined.wav --output results/new-1b-run
python3 -B -m unittest discover -s tests -v
```

The supplied recording is AIFC float32, outside the original CLI reader's formats.
The new `results/recording-01b/run_adapter.py` uses the same lossless file-decoding
adapter as Experiment 1, with only its target module changed. It runs the unchanged
sample rate and stereo data without normalization, clipping or quantization to integer
PCM. From repository root:

```sh
python3 -B research/source-separation/results/recording-01b/run_adapter.py
```

That adapter requires a new `separation/` output directory; do not rerun over results.
Original results are in `results/recording-01/separation/`; 1B results are in
`results/recording-01b/separation/`. All WAVs retain the original recording timeline.
The baseline remains deliberately unchanged for comparison.

## Boundary-aware alignment

Event segmentation is unchanged. We additionally record the first active 2 ms
energy block's position relative to each event's actual window start, denoted `c`.
The activity threshold is derived from the mixture using the original detector's
block energy and relative amplitude threshold. These anchors remain fixed during
residual analysis; they do not infer which source is playing.

For template event `i` and target event `j`, search integer-frame lag

`lag = c_j - c_i + delta`, where `delta` ranges over the original ±5 ms tolerance.

Thus a recording-start event with no leading context can align to a later event
with approximately 10 ms of leading context without widening the jitter tolerance
for every pair. This addresses different observation windows rather than assuming
that window starts are sound onsets. Both directions and stereo use the same rule.

For a proposed lag, intersect the observed frame supports:

- template start `s=max(0,-lag)`;
- target start `d=max(0,lag)`;
- overlap length `n=min(template_frames-s,target_frames-d)`.

Skip empty overlaps. Estimate nonnegative least-squares gain using only the matching
observed samples: `g=max(0,dot(template_overlap,target_overlap)/energy(template_overlap))`.
Explained energy is `g²*energy(template_overlap)`. Divide by **full target energy**
for recurrence gating, so a tiny overlap cannot claim to explain the whole event.
Missing context is not inserted into the gain calculation as an observed zero.
Reconstruction uses the same lag and overlap, inserting samples at
`target_window_start+d`, with no wraparound or write outside the observed window.
The global residual remains `input-sum(accepted_tracks)`.

The measured first-active block is only an anchor: different attacks, weak sounds,
noise and variable timbre can shift it. ±5 ms still limits departures from that
anchor. Samples outside event windows and unobserved source tails stay unresolved;
this change does not synthesize pre-recording audio or extrapolate missing tails.

## Recurrence is not sufficient for a separate component

Original recurrence gating (65% target residual explained, at least two supporting
events including the candidate itself) remains. Before ranking candidates, 1B also
measures each candidate's proposed fitted contribution relative to the **original
input**, never relative only to the progressively shrinking residual:

- `global_fraction = sum(fitted_energy_in_members)/original_input_energy`;
- `event_fraction_j = fitted_energy_j/original_event_energy_j`;
- `typical_fraction = median(event_fraction_j)` over supporting events.

A candidate is eligible if `global_fraction >= 1e-5` **or**
`typical_fraction >= 1e-4`. Both must fail to reject it as negligible. This allows
locally meaningful recurrence in quiet original events, even when the rest of the
recording is much louder. Uniformly scaling a recording leaves these ratios unchanged
within numerical precision. The original tiny numerical-zero safeguards remain.

These conservative relative-energy settings are explicit research heuristics, not
psychoacoustic audibility guarantees. They can reject a real very weak source; source
identity and perceptual importance remain unresolved. They were not optimized against
isolated reference sounds. Correlated sources also make fitted energy fractions
imperfect significance measures.

Rejected candidates retain their energies, membership, explained fractions, both
significance ratios and rejection reason in the per-pass comparison diagnostics.
They are not subtracted, and remain in `residual.wav`. Screening happens before
candidate ranking, so a negligible candidate cannot block an eligible one merely
by recurring in more events. No fixed absolute amplitude threshold is introduced.

## Verification

The original eight tests run unchanged on Experiment 1 and again against 1B.
Six additional tests cover recording-start context, valid overlap/placement in
both directions, empty overlap, stereo boundary recovery, scale invariance,
quiet meaningful recurrence and actual preservation of rejected structure in
residual audio. All 22 tests passed. Their known synthetic sources are fixtures,
not reference inputs to separation. Real-file checks and the original artifact
hash comparison are recorded separately under `results/recording-01b/`.

The new run still needs human listening. Low residual energy and signal conservation
cannot prove independent-source recovery. No production integration, browser test,
reference evaluation or device/performance qualification is claimed.
