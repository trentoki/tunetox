# Experiment 4H — bounded phase-tolerant neighbor recognition

[HTML listening comparison](listen.html)

- [Reconstructed](reconstructed.wav)
- [Residual](residual.wav)
- [Original reference](original_reference.wav)

Full-length stereo 44.1 kHz float32 WAVs. The original reference is a byte-identical
copy of 4D’s exact decoded conversion. No normalization, clipping or mastering.

## Comparison with 4F-B

| Measurement | 4F-B | 4H |
|---|---:|---:|
| Additional cycles | — | 75 |
| Rendered cycles | 1938 | 2013 |
| Remaining ambiguous | 194 | 119 |
| Time coverage | 76.53% | 78.87% |
| Residual/input energy | 11.10% | 8.42% |
| Error/input energy within modeled frames | 1.416% | 1.418% |
| Contiguous accepted runs | 273 | 268 |
| Whole-process peak RSS | 275.75 MiB | 324.05 MiB |

New-cycle error/input energy is 1.511%, maximum individual new-cycle error 1.876%.
The output remains incomplete; no successful source separation or identity count
is claimed. All original 4F-B render decisions are retained without reassignment.

## Narrow change

Only originally ambiguous cycles still omitted by 4F-B are reconsidered. Call the
frozen 4F-B chooser to preserve every target-shape/phase/harmonic/periodicity and
family-relationship gate. Replace only its neighbor rejection reasons.

Look up the nearest reliable temporal predecessor and successor; both gaps must
be ≤0.1 target period and period changes ≤2%. Compare signed joint-stereo geometry
at offsets −0.5, −0.25, 0, +0.25, +0.5 of a 64-position slot. Neighbor similarity
must still reach 0.995. No target-shape confidence gate is lowered or phase-aligned.

Reuse the exact frozen 4F renderer and frozen 4D 64-position linear sampler, saved
fractional cycle times, amplitude/offsets and Hermite bridges. Phase offsets apply
only during descriptor comparison, never rendering. Do not fill skipped unreliable
intervals or merge source/family identities. Newly supported ambiguous occurrences
retain unresolved identity, with a separate waveform render-family choice.

64 additions use a nearest reliable neighbor beyond a small rejected crossing;
11 benefit from phase tolerance without skipping an interval. Remaining cycles,
original unreliable candidates and provisional families remain unexplained.

## Runtime and artifact checks

- Setup/loading/preservation snapshot: 0.526 s.
- Recognition analysis of 194 candidates: **0.0366 s**.
- Frozen synthesis: 0.262 s.
- Residual calculation and three WAV exports: 0.053 s.
- Readback/evaluation/preservation checks: 0.333 s.
- Total before JSON export: **1.211 s**.
- Ten tests ran separately: 0.070 s. Development and HTML generation are not timed
  as algorithm execution. No discovery or full-separation rerun was needed.

Peak RSS is whole-process memory, including JSON audit metadata, original/baseline/
new PCM and export QA. Historical 4F-B timing/memory is not a controlled benchmark
with identical export/evaluation overhead.

Maximum sample step at the same evaluated cycle boundaries is unchanged (0.005638).
Whole-waveform maximum increases slightly from 0.207758 to 0.209021. New-cycle RMS
ratios to original are 0.971–0.986. No large new cycle errors or new boundary-step
maximum were observed, but these checks cannot certify click-free sound or absence
of modulation artifacts. **Listening has not been performed.** The 64-position
upper-frequency limitation is deliberately unchanged.

Reference samples match exactly; exported reconstruction plus residual agrees
with original within **7.45e-9** per sample. This is float32 bookkeeping tolerance,
not evidence of complete reconstruction. No original-waveform synthesis fallback.

## Tests and safeguards

Ten tests passed: recovery of small phase/micro-crossing cases, genuinely different
neighbor shapes, polarity, real gaps/pitch transitions, unchanged target confidence,
unreliable/unsupported targets, strict-B compatibility, exact frozen rendering,
float32/reference conservation and saved neighbor bounds. Synthetic controls do
not establish a real-world false-accept rate; slightly shifted descriptors are
also interpolated/smoothed, which remains an uncertainty.

Original audio, 1C–4G and production code remain unchanged. No 4F-A synthesis,
combined improvement or 4I work was started. No MIDI, instrument identities,
isolated stems or supplied scales enter recognition.

```sh
python3 -B -m unittest discover -s research/source-separation/results/experiment-04h-phase-neighbors -p 'test_*.py' -v
```

`run.py` and `build_page.py` use exclusive-create outputs. To repeat, copy only
source/test files to a new sibling directory at the same depth. Keep old outputs.
[Metrics/provenance](report.json) · [Decisions](new-decisions.json) ·
[Before/after preservation snapshot](preservation.json).
