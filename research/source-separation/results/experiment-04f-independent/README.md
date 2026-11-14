# Experiment 4F — independent reconstruction improvements

**Results:** richer synthesis models improve upper-band energy while keeping coverage fixed, but the highest-band waveform still does not transfer reliably across all pitches. Independently, conservative relationship evidence recovers 522 omitted cycles with much lower residual energy. The improvements have not been combined.

## Listen before deciding

- [Listening page with every comparison](listen.html)
- [Original reference](../experiment-04d-majorsaw-reconstruction/original_reference.wav)
- [Unchanged 4D reconstruction](../experiment-04d-majorsaw-reconstruction/reconstructed.wav)
- [Unchanged 4D residual](../experiment-04d-majorsaw-reconstruction/residual.wav)

| Independent variant | Reconstructed audio | Residual audio |
|---|---|---|
| A: cubic 64 | [WAV](a-cubic64/reconstructed.wav) | [WAV](a-cubic64/residual.wav) |
| A: linear 256 | [WAV](a-linear256/reconstructed.wav) | [WAV](a-linear256/residual.wav) |
| A: harmonic fit | [WAV](a-harmonic/reconstructed.wav) | [WAV](a-harmonic/residual.wav) |
| B: related shapes | [WAV](b-related-shapes/reconstructed.wav) | [WAV](b-related-shapes/residual.wav) |

All exports are six-second, stereo, 44100 Hz IEEE 32-bit floating-point WAVs. There is no mastering, limiter, clipping, loudness/peak normalization or original-waveform fallback. Amplitude is restored from the same saved 4C scale/offset metadata as 4D. Original audio, 1C, 4C, 4D, 4E and production code are preserved. No MIDI, note names, instrument class or scale intervals entered any method.

## Measurements against the frozen baseline

| Variant | Coverage | Residual/input energy | Error on modeled input | Total time | Synthesis time | Peak RSS |
|---|---:|---:|---:|---:|---:|---:|
| 4D baseline | 59.07% | 31.49% | 1.464% | 1.117 s | 0.197 s | 339.91 MiB |
| A: cubic 64 | 59.07% | 31.41% | 1.354% | 1.296 s | 0.429 s | 290.69 MiB |
| A: linear 256 | 59.07% | 31.15% | 0.980% | 0.934 s | 0.233 s | 276.52 MiB |
| A: harmonic fit | 59.07% | 31.35% | 1.255% | 6.680 s | 5.630 s | 269.98 MiB |
| B: related shapes | 76.53% | 11.10% | 1.416% | 1.000 s | 0.257 s | 275.75 MiB |

All variants pass float32 reconstruction + residual conservation with maximum sample error **7.45e-9** against original. This is bookkeeping, not sound quality. The baseline’s end-to-end timing/RSS is historical; variants were run sequentially in separate fresh processes, as single observations with normal cache/system variation. Their totals include loading/verification, preparation, synthesis, residual/export/readback, spectral/error evaluation and preservation checks, but exclude JSON serialization, plotting and synthetic tests. Peak memory is whole-process high-water RSS, dominated by Python audit metadata and PCM arrays; memory differences do not isolate the efficiency of a mathematical representation.

## 4F-A — synthesis only; every baseline cycle decision preserved

Every A render uses exactly the same accepted cycle IDs, fractional timing, amplitude/offset records, family assignments, frame support, gap policy and Hermite join model as 4D. All have **156305 covered frames and 447 accepted runs**. No omitted cycle was admitted.

### Methods compared

1. **Cubic 64:** periodic four-point Catmull–Rom interpolation of the unchanged 64-position-per-channel family exemplar. This changes interpolation only; no original sample is read to enrich the shape. It modestly reduces modeled-frame error but does not recover lost information, and the highest band becomes quieter still.
2. **Linear 256:** resample only each existing family’s one original exemplar cycle to 256 positions per channel, then reuse that family table at every accepted occurrence’s saved duration/amplitude. Use the old exemplar’s offset and RMS scale so occurrence gain metadata remains unchanged. This adds representation detail without target-cycle copying or new recognition decisions. The extraction and output both use linear interpolation; no extra anti-alias filtering was introduced in this control, so upshifted table images/aliasing remain a risk.
3. **Harmonic fit:** fit a real trigonometric least-squares model to native PCM sample positions within the same four family exemplar cycles, using reorthogonalized QR. Keep complex phase via cosine and sine coefficients. Models retain 70, 52, 51 and 41 harmonics respectively, bounded by available native observations and exemplar Nyquist. At each target cycle, cap harmonics below its sample-rate Nyquist using saved duration, not a musical pitch label. No target occurrence is waveform-fitted. Direct harmonic value/derivative evaluation replaces the sampler; 4D’s joins remain the same.

Every method uses shared **family-level** models. It does not copy individual original cycles into the output. The harmonic fit is compact (roughly 864 stereo coefficients, excluding metadata), but fits one same-recording exemplar per family; it is not held-out inference or source separation. Prototype self-fit errors/QR diagnostics and tables/coefficients are saved in each `learned-exemplar-models.json`. QR diagonal ratios are about 0.68–0.71; the fit succeeded numerically, but numerical success does not imply pitch-invariant high-frequency timbre.

### Upper-frequency energy versus actual waveform recovery

Use the exact six fully covered windows selected in 4E, without searching for new favorable regions. Values below are medians across those windows.

| Method | 10–15 kHz output/original level | 15–22.05 kHz level | 10–15 kHz residual/original energy | 15–22.05 kHz residual/original energy |
|---|---:|---:|---:|---:|
| 4D | -10.26 dB | -12.42 dB | 0.779 | 0.808 |
| A: cubic 64 | -9.30 dB | -15.72 dB | 0.738 | 0.840 |
| A: linear 256 | -2.36 dB | -5.14 dB | 0.130 | 0.923 |
| A: harmonic fit | -0.10 dB | -0.08 dB | 0.082 | 1.487 |

**Confirmed improvements:** linear 256 gives the lowest modeled-frame waveform error (**0.980%**, versus 1.464% baseline). The harmonic model restores upper-band energy to within about **0.1 dB** on the median windows and strongly reduces 10–15 kHz error. Cubic interpolation alone is insufficient.

**Confirmed failure:** above 15 kHz, median harmonic-model error is **1.487 times original band energy**, worse than baseline’s 0.808, even though output energy is nearly equal to original. The 256-position model’s highest-band median error is also slightly worse (0.923). This is why energy restoration must not be called complete harmonic recovery. Whole-recording residual moves little in A because missing-cycle support is frozen.

Per-window harmonic-model highest-band error ratios are approximately **0.056, 1.493, 1.516, 2.248, 1.481, 0.078** for regions 1, 2, 3, 4, 14, 15. The two matching-low-pitch regions fare well; several other pitches do not. Phase-sensitive cross-spectrum evidence is saved in comparison.json: energy agreement accompanies weak or negative high-band alignment in some windows. **Hypotheses:** upper-partial phase/shape may depend on original oscillator/filter/sample phase or on cycle-boundary uncertainty; a single phase-scaled exemplar may not transfer that information across pitch. The experiment does not determine the physical cause. No extra target fitting or normalization was added to hide the failure.

The harmonic kernel costs **5.630 seconds**, around 28.6× 4D’s historical 0.197-second kernel. Native-model preparation takes 0.344 seconds. Linear 256 synthesis takes 0.233 seconds and cubic 64 takes 0.429 seconds. Faster cached evaluation could be a computational optimization, but none was applied after measurement. There is no full-song performance guarantee.

## 4F-B — related shapes, unchanged 4D synthesis

This render uses exactly 4D’s **64-position linear interpolator**, original family arrays, per-cycle amplitude/offsets and Hermite bridge rules. The copied renderer is regression-tested to match the original 4D renderer exactly when given unchanged decisions. No A sampler or richer exemplar enters B.

### Conservative relationship and occurrence evidence

The policy was fixed before rendering and was not tuned to measured residual energy. It applies to any exemplar pair, not particular family IDs or instruments:

- Require at least **3 historical shared ambiguous occurrences**, both families recurring, signed geometry cosine >=0.98, harmonic-magnitude cosine >=0.995, and fundamental phase distance <=0.025 cycles.
- For a candidate ambiguous occurrence, require its historical best geometry score >=0.995, target/prototype harmonic cosine >=0.995 and phase distance <=0.01 cycles, local periodicity >=0.9 and period-spacing error <=5%.
- Require both immediate observed neighbors to be reliable/contiguous, each with geometry cosine >=0.995 to the target and cycle-duration change <=2%. These guards deliberately exclude unstable boundaries and unusual/unexplained structures.
- If all pass, render **one** best-supported existing exemplar at the occurrence’s saved scale/time, not the sum of candidates or the original occurrence waveform. Original family labels are not merged. The occurrence’s identity remains unresolved; a separate `render_family` records the waveform estimate.

Only pair 1/2 qualifies on this recording: 714 shared ambiguities, geometry **0.984827**, harmonic cosine **0.999080** and phase difference **0.001562 cycles**. This supports close waveform variants, **not proof of shared origin or instrument identity**. The two other pairs have only one shared ambiguity each and fail the rule.

### Measured outcome and remaining uncertainty

- **522** originally ambiguous cycles gain supported waveform estimates: 444 use family 1 and 78 use family 2. All original 1,416 accepted cycles remain; no baseline family assignment is changed.
- **194** ambiguous cycles, **399** unreliable intervals and **4** provisional cycles remain unexplained. Rejection reasons are saved for every considered cycle.
- Coverage rises **59.07% → 76.53%**; residual energy falls **31.49% → 11.10%**. Error on newly included cycles is **1.290%** of their own input energy. Overall modeled-frame error is **1.416%**, compared with baseline’s 1.464%; this is not evidence of a higher real-world assignment accuracy.
- Accepted runs fall **447 → 273**, reducing cycle-level interruptions. On the exact garbled region-6 spectral window used in 4E, the outside-harmonic-neighborhood power proxy falls **69.21% → 8.61%** (original 6.69%). This finite-window/leakage-sensitive proxy supports reduced modulation contamination, not a guarantee of artifact-free listening.
- Maximum whole-waveform adjacent sample step remains **0.20776**, equal to baseline. That statistic cannot establish absence of clicks; it includes legitimate sharp waveform edges.
- Upper-harmonic loss remains essentially baseline-like, as intended: B has no A rendering changes.

**Incorrect assignments / audible artifacts:** genuinely different synthetic shapes, equal-harmonic-magnitude phase collisions, inverted polarity, bad neighbors, period transitions and provisional competitors are rejected by the focused controls. Related synthetic variations pass. No failures occurred in those constructed tests. This does **not** establish that no real false waveform estimate or identity error was added; the recording lacks independently labelled per-cycle identity ground truth. Phase checking currently uses the first channel, and similarity gates can be fooled by sufficiently close different-origin shapes. No new listening was performed. The user should assess B’s remaining gaps, attack/release handling and modulation before any further change.

## Safeguards and verification

- **Eight synthetic tests passed**, including a bit-for-bit comparison of frozen 4D versus the sampler-injected renderer, distinct shape/phase negatives and a known harmonic-fit/band-limit positive.
- Every WAV is read back as float32 at the original rate/channels/length. Reconstruction plus residual agrees with original within floating-point tolerance; there is no peak normalization or original-PCM fallback.
- All prior experiment data/source and original audio are checked against preservation manifests. Source hashes and accepted-cycle IDs are included in each run report.
- Variants were run separately, without simultaneous profiling. There is no A+B combined render, production integration or Experiment 4G.
- SVG XML and finite coordinates are validated; rendered preview was not inspected. [A tradeoffs](a-spectral-tradeoffs.svg) and [B coverage](b-coverage.svg) accompany the listening files.

Full machine-readable results: [comparison.json](comparison.json), per-variant report.json, occurrence-decisions.json, learned-exemplar-models.json and preservation.json.

## Reproducibility

```sh
python3 -B -m unittest discover -s research/source-separation/results/experiment-04f-independent -p "test_*.py" -v
python3 -B research/source-separation/results/experiment-04f-independent/run.py --variant harmonic --output /new/project/results/path
```

Use a **new** output directory for each run. Allowed variants are `cubic64`, `linear256`, `harmonic`, and `relationships`. Run each in a fresh process and sequentially for meaningful independent timing/RSS. Saved WAVs and reports are exclusive-create. No old results are overwritten.
