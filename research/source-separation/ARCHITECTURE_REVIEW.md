# Source-separation architectural review snapshot

Experiments are paused after the focused Experiment 5E diagnostic. No 5F or joint periodic/transient fit has been implemented. This branch is a review snapshot, not production integration or a claim of successful multi-source separation.

## Main implementation entry points

| Responsibility | Research source | Main functions |
|---|---|---|
| Original 1C event detection | `experiment_01c.py` | `detect_events`, `leading_contexts` |
| Original 1C recognition, grouping and subtraction | `experiment_01c.py` | `fit`, `presence`, `discover`, `separate` |
| Float32 AIFF compatibility adapter | `results/recording-01c/run_adapter.py` | `decode_aifc` |
| Pitch estimation primitives | `diagnostic_04b/analysis.py` | `pitch`, `fft` |
| Periodicity windows, crossing boundaries and signatures | `diagnostic_04c/analysis.py` | `frame_analysis`, `crossings`, `extract_cycles`, `signature` |
| Shape-family discovery | `diagnostic_04c/analysis.py` | `cluster`, `shape_scores` |
| Related shape-family recognition | `results/experiment-04f-independent/methods.py` | `related_pairs`, `choose_related` |
| Phase-tolerant target recognition | `results/experiment-04j-independent/methods.py` | `target_phase_choice` |
| Boundary-aware periodicity | `results/experiment-04l-boundary-periodicity/methods.py` | `boundaries`, `adjust_periodicity`, `first_cycles_after_silence` |
| Robust neighbor periods | `results/experiment-04n-robust-period/methods.py` | `local_period`, `make_choose` |
| Shape synthesis and joins | `results/experiment-04f-independent/render.py` | `synthesize`; uses frozen 4D I/O and Hermite functions |
| Single-source original-PCM provisional assignments | `results/experiment-04q-provisional-continuity/methods.py` | `assign` |
| Adapted periodic/transient separation | `results/experiment-05a-synth-clap/methods.py` | `event_candidates`, `periodic`, `transients` |
| Multi-period provisional recognition | `results/experiment-05d-targeted-correction/correction.py` | `apply`, `support_mask` |
| Latest focused diagnostic; no separation changes | `results/experiment-05e-focused-diagnostic/analyze.py` | `run` |

Files under `results/` include frozen experiment implementations, not only generated data. The later experiments load earlier Python files dynamically. These dependencies are deliberately retained for historical accuracy; this snapshot does not refactor them into a production architecture.

## Scientific state and review focus

- Original 1C remains unchanged: SHA-256 `eb8fd4895b4a62fe7d57c97c6004685d184a00258ca8fe29b68115c89994a6d7`.
- 1C succeeds on the retained kick/clap benchmark but its whole-event grouping does not handle the pitch-changing overlapping mixture reliably.
- 4Q's original-PCM provisional assignment is a controlled single-source completeness experiment. It cannot be transferred directly to overlapping-source separation.
- 5A separates partial periodic and recurrent transient structures, with substantial unresolved audio and benchmark regressions.
- 5D adds provisional periodic recognition but recovers only a short portion of the third note. Its transient estimate is unchanged, and additional gap/pitch flags remain.
- Focused 5E finds overlap-contaminated pitch/cycle evidence and an overly late recognition opportunity. Its joint-fit proposal remains unimplemented. See `results/experiment-05e-focused-diagnostic/README.md`.
- Additive conservation is bookkeeping, not evidence of source purity. Aligned isolated sources for the synth/clap mixture have not been established.

## What this commit includes

Python implementations and tests, Markdown documentation, HTML reports, SVG diagnostics, and JSON summaries no larger than 128 KiB. This size rule selects review context; it does not modify or prune the local experiments.

Audio, DAW sidecars, caches, raw assignment CSV/U8 maps, preservation manifests and large generated JSON inventories are omitted. They remain in the local workspace. Reports can therefore link to local artifacts absent from this branch, and full experiment replay requires the original recordings and generated intermediates. For example, 5A replay depends on its locally retained `mixture-inventory.json`. Do not mistake this lightweight code-review snapshot for a complete reproducible artifact archive.

Original media are read-only inputs. No audio has been renamed, moved or removed to prepare the commit. Existing application/document changes outside `research/source-separation/` are outside this snapshot.

## Lightweight verification

Standard-library Python tests can run without generated audio:

```sh
python3 -B -m unittest discover -s research/source-separation/tests -p 'test_experiment_01c.py'
python3 -B research/source-separation/results/experiment-05d-targeted-correction/test_correction.py
```

These are constructed regression/negative controls; they do not establish real-world separation quality. Before running a historical CLI, inspect its input/output requirements: many use exclusive-create outputs and expect locally retained intermediates.
