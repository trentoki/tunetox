# Experiment 5B — original Experiment 1C on the synth/transient mixture

[Listening comparison](listen.html) · [Original](original_reference.wav) · [Component 1](separation/component_01.wav) · [Residual](separation/residual.wav) · [Recombined](recombined.wav)

**Original 1C is intact and was run unchanged. It did not separate this mixture into independent periodic and transient sources.** It found one anonymous component; **90.2192%** of input energy remains in the residual.

## Provenance and compatibility

Implementation: `research/source-separation/experiment_01c.py`.
Historical and current SHA-256 both equal
`eb8fd4895b4a62fe7d57c97c6004685d184a00258ca8fe29b68115c89994a6d7`.

Input: `audio/MajorsawwackClap.aif`, SHA-256
`5eb47bcae4b439165ee318ac9eca95c05f508ae08e7e229860ca0746429f7b23`.

The sole compatibility adjustment replaces the integer-WAV `read_audio` function
with the retained `results/recording-01c/run_adapter.py` AIFC fl32 decoder. It reads
exact original big-endian float32 samples into Python floats; no resampling,
quantization, scaling, normalization or clipping. The separator runs through its
original `run` entry point. All discovery, presence, grouping, gain/lag fitting,
residual passes and native exports are original.

Unchanged defaults: detection threshold **0.015**, lag search **±5 ms**, **4-ms**
presence windows with correlation **0.85**, maximum **four** components. The detector's
2-ms energy blocks, 60-ms gap bridging and 10-ms padding are unchanged. No isolated
sources or clap positions were supplied. No 4N, 4Q or 5A separation code was used.

## What the algorithm actually did

Seven energy-event regions were detected. The last is continuous from
**1.989456–6.000000 s**, so individual later note/transient structures are not separate
input events for this whole-event method.

The single component uses zero-based event **5**, observed interval
**1.488594–1.989456 s**, as its complete waveform template:

| Allocation | Event | Gain | Lag |
|---|---:|---:|---:|
| Original template occurrence | 5 | 1.000000 | 0 samples |
| Additional fitted occurrence | 6 | 0.216716 | +159 samples / 3.605 ms |

The next pass stops because no meaningful recurring candidate is found. The
four-component limit was not reached. The inherited warning about “eight events”
is legacy report text only; seven events were retained and no count was forced.

The template contains the mixture's periodic sound and transient together. Its
self-allocation reproduces that observed mixed event exactly; it is not an isolated
clap. Post-run pitch measurements also find periodic content around **585–625 Hz**
in this component. The extra lag/gain allocation is not proof of an independently
present source: the copied template may include structures canceled in the residual.

## Comparison with 5A

| Metric | Original 1C / 5B | Adapted 5A |
|---|---:|---:|
| Estimated component models | 1 | 2 |
| Residual / original energy | **90.2192%** | **24.0972%** |
| Main processing time | **60.730 s** | **18.196 s**, including inventory |
| Peak process memory | **314.28 MiB** | **430.25 MiB** |

There is **no continuous separated synth stem** in 5B: the sole component has no
output from approximately **2.401927 s to the recording end**, despite the original's
continuing audio. Its nonzero support covers only 12.74% of the recording. Remaining
synth and clap material is largely in the unresolved residual.

For evaluation only, the five recurring transient-fragment windows detected by 5A
were examined after the 1C run. Component 1 is zero at four windows (approximately
0.521, 2.520, 3.708 and 4.458 s). At 1.566 s, it exactly equals the original mixture
window, including periodic material. Thus **independent clap recovery is not
established**. These positions are 5A measurements, not DAW ground truth or input
to 1C. Numerical evidence does not substitute for listening.

5A supports a much larger periodic hypothesis and five repeated transient fragments,
but its periodic model also fails during those overlap windows. Neither run achieves
reliable complete separation. The lower 5A residual alone is not a purity score.
[Post-run measurements](comparison.json).

## Exports and checks

All WAVs are full-length stereo, 44.1-kHz IEEE float32. `recombined.wav` is component
plus residual; [components_only.wav](components_only.wav) excludes residual and is
identical to Component 1. The two `baseline_*.wav` files in `separation/` are native
1C diagnostic-baseline exports, not extra discovered sources.

Maximum additive and recombined/reference errors are **1.49e−8**. Original peaks
above unity are retained. Original 1C tests: **11 passed**. Historical algorithm,
input, output formats and **549 prior research files** were hash-verified unchanged.
[Provenance](provenance.json) · [Original algorithm report](separation/report.json)
· [Verification](verification.json).

The original 1C run, including native exports, took **60.730 s**; wrapper conversion,
recombination and preservation checks bring the measured run to **62.157 s**.
Separate post-run diagnostics took **0.594 s**, peak **110.73 MiB**. Timings exclude
imports, tests and report preparation. No new listening or browser preview was
performed. No production or previous experiment files changed. **Stopped after 5B.**
