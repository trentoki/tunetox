# Experiment 4 — Major Scale Sawtooth, unchanged 1C

Input: `research/source-separation/audio/Majorsaw.aif`

SHA-256: `5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`

Verified before and after processing. Input is 6 seconds, stereo, 44100 Hz,
AIFC float32. Algorithm SHA-256 remains
`eb8fd4895b4a62fe7d57c97c6004685d184a00258ca8fe29b68115c89994a6d7`.
Settings remain threshold 0.015, lag ±5 ms, maximum four components. The cap is
an existing search limit, not an expected source count. Only decoded mixture PCM
was passed to discovery: no instrument identity, pitch labels, supplied note
boundaries, references or expected component count.

## Listening files

- [Component 1](separation/component_01.wav)
- [Residual](separation/residual.wav)

Both are full-timeline, 6-second stereo 44100 Hz IEEE 32-bit floating-point WAVs.
No normalization, clipping or resampling. Existing baseline exports are separately
labelled and are not discovered components.

## Measured result

- End-to-end processing: **79.673292375 seconds**, including decode, separation,
  WAV/report exports and final preservation checks. Excludes preflight and later QA.
- Discovered components: **1**; stopped on the next pass because no meaningful
  recurring candidate remained, rather than because the four-component cap was hit.
- Residual/input energy: **0.9493426479868444**, or **94.9343%**.
- Exported component plus residual reconstructs input with maximum sample error
  **7.45058e-9**. This identity is not evidence of correct separation.
- Original input, algorithm and all **173** earlier research files verified unchanged.
  No production code edits. No reference evaluation, listening or Stage 2 run.

## What the component represents

Post-run inspection indicates **pitch-specific waveform fragments**, not a recovered
sound identity spanning the scale. This is an inference from assignments and support,
not a validated note classifier or a listening judgment.

The detector found nine windows: eight short windows plus one continuous final
window (87735–264600 frames, about 1.989–6 seconds). It does not segment the final
passage into its changing notes. The existing eight-event warning is historical
diagnostics only; no count was imposed on the input.

Component 1 uses event 7 (one-based) as its observed template. Its fitted gains are
1.0 in event 7 and 1.009562965231247 in event 9 (186-frame lag). It is unassigned in
all other events. Samples above absolute 1e-7 occur only at approximately
**1.50007–1.64179 seconds** and **2.00515–2.14687 seconds**. Thus the component copies
one short recurring waveform into part of the final continuous passage. It does
not include all ascending/descending notes or recover complete sustained notes
throughout that passage. Most of the recording remains explicit residual.

Post-hoc source zero-crossing probes show changing oscillation periods across the
scale, but are not precise pitch estimates (envelopes and waveform details affect
crossings); exact pitch equivalence is not asserted. The waveform-template method
has no pitch-invariant representation of timbre. Even finding one component does
not establish that it recovered the one synthesizer described by the user.

[Detailed report with per-event gains](separation/report.json),
[provenance and timings](provenance.json), [export checks](verification.json), and
[post-hoc waveform support](posthoc-structure.json).
