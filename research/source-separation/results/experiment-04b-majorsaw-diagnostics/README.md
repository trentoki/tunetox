# Experiment 4B — pitch-invariant relationship diagnostics

**Finding:** pitch-relative harmonic structure and short pitch-scaled waveforms remain very similar across the estimated pitches in this recording. Raw time-aligned waveforms do not. This supports investigating pitch-normalized representations, but does not establish a source classifier or authorize a separation change.

Input: `research/source-separation/audio/Majorsaw.aif`

SHA-256: `5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`

The diagnostic reads only the combined recording. It does not import 1C, consume separated tracks, use instrument identities or note pitches, fit scale intervals, or infer an expected identity count. No audio was synthesized/exported or reassigned. All existing separation outputs are preserved.

## Measurements

Automatic periodicity grouping produced **15 candidate regions** and **105 pair comparisons**. This count was an output, never a constraint. Estimated median fundamentals span approximately **311–620 Hz**. Median within-region autocorrelation confidence is approximately 0.96–1.00, but this is not a probability of correct pitch. Region durations and boundaries include window uncertainty.

The table uses the **92 pairs** whose estimated pitch distance exceeds 100 cents. This is a descriptive reporting cut, not a discovery rule, scale assumption, or note-interval target. Cosines are gain-normalized; waveform scores are absolute signed correlations maximized over phase, so polarity differences alone are not rejected.

| Relationship | Minimum | Median | Maximum |
|---|---:|---:|---:|
| Harmonic-relative amplitudes (12 harmonics) | 0.9994 | 0.9999 | 1.0000 |
| Absolute-Hz smoothed log spectral envelope | 0.8025 | 0.9401 | 0.9950 |
| Boundary-aligned first 150 ms RMS | 0.7504 | 0.8608 | 0.9999 |
| Unscaled waveform, phase aligned | 0.0238 | 0.1248 | 0.4853 |
| Pitch-scaled waveform, phase aligned | 0.9640 | 0.9820 | 0.9977 |

1. **Harmonic structure:** energy around the first 12 estimated harmonic centers is exceptionally stable relative to f0. This is stronger evidence than raw waveform similarity for a common pitched waveform family. The score can be dominated by lower harmonics; distinct sources can share harmonic ratios, and f0 octave errors change indexing. It is not proof of one instrument.

2. **Spectral envelope:** the absolute-Hz, smoothed log spectrum is broadly similar but less invariant (minimum correlation 0.802). Pitch changes move harmonic energy and alter which partials lie under a fixed frequency band. Smoothing width is itself f0-dependent, and broad spectral rolloff or noise-floor structure can inflate correlation. This descriptor is not a uniquely identified filter response.

3. **Amplitude and attack:** the initial boundary-aligned envelopes vary substantially, but boundary alignment is confounded by analysis-window margins. A separate observed-rise control yields median cosine **0.9986** over nine onset-observable regions (36 pairs, including one recording-start-clipped rise). The first rise measures approximately 15 ms; other observed rises are 0–5 ms on the 5 ms grid. Zero means thresholds fall in the same bin. The six continuing-sound boundaries have **unknown attack time**, rather than an invented zero-time attack. Attack estimates depend on local peak selection, RMS window, threshold, and an uncertain/censored start. Similar isolated onset envelopes do not show that complete note durations or sustained articulations are identical.

4. **Time-scaled waveform:** compare eight cycles at estimated f0, with shared stereo gain and 64 target-phase positions. Scaled correlations are high even across different pitches, while the raw fixed-duration comparison degrades. Same-pitch controls (<40 cents) already have median raw correlation approximately **0.987**, supporting pitch mismatch as a major source of raw-comparison failure. These local, gain-normalized segments exclude most attack/decay and do not test complete-note subtraction.

## Uncertainty and controls

- Synthetic tests cover FFT round trip, several pitched periodic signals, silence/noise negatives, a different harmonic-profile negative control, stereo polarity, waveform scaling, variable region count, and attack censoring. **Seven tests passed.** Synthetic tone profiles are fixtures only and are not references supplied to recording analysis.
- Perturbing target f0 by −1% or +1% in comparisons against the first region reduces median scaled correlation from **0.9795** to **0.8843** or **0.9259**. Deliberate target-f0 doubling reduces it to approximately **0.4811**. These probes involve 13 comparisons per factor and illustrate sensitivity; they do not certify pitch accuracy.
- Region f0 spread reaches about 113 cents near some transitions, despite high median periodicity. Overlapping 46 ms frames can mix adjacent pitches. Candidate boundaries are not exact note boundaries, and the last stable region includes release/tail frames.
- Eight-cycle waveform segments come from region centers. Source and target use different physical durations after scaling; the reference-region choice is asymmetric. Phase search and gain normalization make scores optimistic. Linear interpolation and the simple four-sample low-pass used before pitch decimation can introduce artifacts. No fractional-delay or production resynthesis quality is established.
- The analyzed corpus contains one combined recording. There are no real different-instrument controls, independent source labels, polyphonic stress tests, or held-out recordings. High similarity can reflect a shared oscillator/waveform family without proving perceptual sound identity. No identity count or automatic grouping is reported.

## Why 1C missed the scale

This independent analysis suggests two distinct failure mechanisms. First, 1C compares fixed-pitch observed waveforms with gain and small time shifts; a shift does not compensate for a changed period. The contrast between cross-pitch raw and scaled scores supports that explanation. Second, energy-only segmentation joins the continuous passage into a long event rather than stable-pitch regions. Discovery then considers whole observed event templates and truncated supports, which can produce short recurring fragments rather than complete articulations. These conclusions combine the diagnostic measurements with the separately recorded 1C behavior; this diagnostic does not execute, tune or replace it.

## Computational cost

| Stage | Seconds |
|---|---:|
| Decode plus pre-run preservation hashing | 0.254 |
| Pitch-frame analysis | 1.279 |
| Region and spectral features | 0.469 |
| Pair comparisons | 4.654 |
| Main total before JSON export | 6.703 |
| Additional onset and f0 sensitivity controls | 1.180 |

The totals are wall-clock measurements on the current host, not target-device guarantees. Main total includes post-run preservation hashing and excludes report serialization; controls exclude their JSON write. Pair comparison (about 69% of main time) is dominant. It performs two waveform comparisons per pair, with 64 phases × 512 samples × channels, using Python interpolation. Cost grows quadratically with region count. FFT-based pitch analysis scales with frame count and transform size. This is a bounded diagnostic on six seconds; **7.88 seconds combined diagnostic computation does not establish full-song separation within three minutes**. Peak memory and UI/device performance were not measured.

Possible future computational optimizations include caching resampled cycles and spectra, batching correlation, or reviewed native numerical loops. No new dependencies, approximation shortcuts or separation-mathematics changes were introduced. Pitch-invariant candidate models, new boundaries, or rules combining features would be algorithmic proposals needing independent approval and validation.

## Files

- [Full feature vectors, pitch frames, regions, pair scores and stage timings](report.json)
- [Onset controls and pitch-error probes](envelope-and-pitch-controls.json)
- [Numerical summary](summary.json)
- [Preservation manifest](preservation.json)

Commands from the repository root (every output path must be new):

```sh
python3 -B -m unittest discover -s research/source-separation/diagnostic_04b -p "test_*.py" -v
python3 -B research/source-separation/diagnostic_04b/analysis.py research/source-separation/audio/Majorsaw.aif --output research/source-separation/results/new-04b-run
python3 -B research/source-separation/diagnostic_04b/envelope_controls.py research/source-separation/results/new-04b-run/report.json --output research/source-separation/results/new-04b-run/envelope-controls.json
```
