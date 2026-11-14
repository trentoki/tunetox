# Experiment 1C — varvol2 rerun

Input: `/Volumes/OWC Express 1M2/TuneToss/research/source-separation/audio/varvol2.aif`

SHA-256: `5eab41d64b97a895b0c5ef6ffe81cf146e2d91e595bfb1245f1079e29a4298d4`

Unchanged 1C algorithm and settings: threshold 0.015, maximum lag 5 ms, maximum four components. No reference recordings, normalization, resampling, or production changes. Input and algorithm hashes verified before and after the run; all 132 prior research files verified unchanged.

## Listening files

- [Component 1](separation/component_01.wav)
- [Component 2](separation/component_02.wav)
- [Residual](separation/residual.wav)

All are full-timeline 32-bit IEEE floating-point WAVs at 44100 Hz, 2 channels. Baseline exports are also retained separately.

## Fitted gains

Events use one-based numbering below. Unassigned events contribute zero to that component. Gains are relative to each component’s observed template.

| Event | Component 1 | Component 2 |
|---|---:|---:|
| 1 | 2.59986980646 | Unassigned |
| 2 | 4.65884755841 | 7.94921534202 |
| 3 | 5.8748987785 | Unassigned |
| 4 | 3.88256154266 | 1 |
| 5 | 1 | Unassigned |
| 6 | 3.42766914535 | 5.78482931564 |
| 7 | 4.65950405363 | Unassigned |
| 8 | 0.810884424593 | 7.60991059764 |

Detailed input identity and gains: [report.json](separation/report.json). Export validation: [verification.json](verification.json). Maximum float32 export reconstruction sample error: 7.63821e-08. This verifies bookkeeping, not source quality. Listening remains for the user; Stage 2 was not rerun.
