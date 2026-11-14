# Experiment 4E — two distinct reconstruction errors

**Confirmed:** continuous reconstructed sections lose upper harmonics because the 64-position shape/interpolation path does not retain/reproduce them accurately. The bridges are not the principal cause in those interiors. The garbled sections are dominated by intentional omission of high-similarity but family-ambiguous cycles. These failures need separate changes.

No 1C, 4C, 4D, threshold, signature resolution, or production code was modified. No replacement audio or Experiment 4F was created. This investigation reads the frozen original-reference, reconstruction and residual WAVs and the exact discovery metadata used by 4D. All prior research files pass preservation hashes.

## Evidence and visual comparisons

- [All figures](figures.html)
- [Harmonic loss in continuous windows](harmonic-loss.svg)
- [Continuous shape loss versus missing cycles](waveform-mechanisms.svg)
- [Regional coverage and accepted-cycle error](coverage-and-error.svg)
- [Full numerical evidence and cycle records](report.json)
- [Historical ambiguity decisions and summaries](summary.json)

Input SHA-256: `5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`. The original/reference/reconstruction/residual and source hashes are recorded. SVG XML and finite coordinates were checked; rendered browser inspection and new listening were not performed. The user’s listening observations motivate the two evaluation groups.

## 1. Missing high frequencies in continuous sections

For notes/regions 1–4 and 14–15, choose 46.44 ms windows with **100% accepted-cycle coverage**, then compare Hann-windowed stereo spectral power without normalizing it. No flat gaps occur in any of these windows. Note numbering is ordinal audio-region order for evaluation, not a MIDI alignment.

| Region | Window start (s) | 5–10 kHz change (dB) | 10–15 kHz change (dB) | 15–22.05 kHz change (dB) |
|---|---:|---:|---:|---:|
| 1 | 0.0382 | -4.46 | -10.26 | -14.01 |
| 2 | 0.2582 | -3.27 | -10.57 | -12.40 |
| 3 | 0.5032 | -2.05 | -9.19 | -10.47 |
| 4 | 0.8230 | -2.18 | -9.75 | -10.88 |
| 14 | 4.6978 | -3.27 | -10.58 | -12.45 |
| 15 | 5.3873 | -4.46 | -10.26 | -13.97 |

Negative dB here means reconstructed band energy is below original energy, not that the residual is quiet. The low 0–2 kHz band is within about **−0.08 to +0.10 dB** of original in these windows. The high-frequency residual retains roughly original band energy in several cases. This confirms frequency-selective loss even when low-frequency waveform continuity is good.

### Signature resolution: confirmed representation limitation

Each prototype has only 64 positions per cycle per channel. A real 64-point cycle has independently represented harmonic bins only through roughly harmonic 32; higher source harmonics cannot be uniquely recovered from those samples. At the clean-region frequencies, that limit is only about **10.0–13.3 kHz**, below the recording’s 22.05 kHz Nyquist limit. This is an information limit, **not a brick-wall cutoff**: interpolation can still produce higher-frequency images, but they are not independently recovered original harmonics. Sampling the signatures without a suitable band-limit also permits aliasing of upper partials into other shape bins.

As a diagnostic attribution control, evaluate each occurrence’s **own saved 64-position signature**, keeping its existing timing/amplitude and linear interpolation. This is not an updated reconstruction and is not exported as audio. The upper-band deficit persists: about **−5.2 to −9.6 dB at 10–15 kHz** and **−8.6 to −13.7 dB above 15 kHz**. Therefore, family reuse alone is not the explanation.

Family reuse adds further mismatch: the shared prototype versus own-cycle control differs by up to about **4.6 dB** in the 10–15 kHz band among these windows. That comparison includes prototype phase/shape/sampling differences; it is not an orthogonal causal energy decomposition. The first observed exemplar is not guaranteed to preserve every later note’s upper partials. Earlier 4B/4C harmonic-similarity tests focused on only 12 harmonics, so their very high scores did not validate the highest audible partials.

### Linear interpolation: confirmed attenuation

For a represented cycle harmonic h, periodic piecewise-linear interpolation introduces amplitude factor `sinc(h/64)^2`, where `sinc(x)=sin(pi*x)/(pi*x)`, relative to ideal reconstruction of that discrete harmonic. Below the independent-harmonic limit this gives:

| Harmonic | Level change |
|---|---:|
| 10 | −0.70 dB |
| 20 | −2.89 dB |
| 30 | −6.81 dB |

The transfer calculation was checked numerically with synthetic 64-point harmonics strictly below the cycle Nyquist bin. At h=32, positive/negative harmonics coincide: the formal sinc-squared kernel value recorded in report.json is not a standalone real-cosine amplitude response. The Nyquist cosine requires both aliased signs and has a different gain; that edge case is tested separately. It explains part of the rolloff below harmonic 32. It does not alone predict the full original-to-output spectrum, because signature extraction also uses interpolation, omitted harmonics can alias, and a reused exemplar differs from the target cycle. A 64-point interpolator cannot reconstruct independently lost upper information just by a smoother curve.

### Boundary smoothing: ruled out as the dominant interior high-frequency loss

Evaluate the exact saved 4D base formula without its Hermite edge replacement on the selected short windows, at the same 64 positions and metadata. The resulting band-power difference from saved 4D audio is at most **0.00581 dB** across all five bands in all six clean windows. The main high-frequency losses are 9–14 dB, so this comparison decisively rules out bridge smoothing as their main cause in these interiors. It does not assert bridges have no effect at run starts, gaps or releases. No modified WAV was rendered.

## 2. Garbled/incomplete reconstruction

### Omitted cycles are the dominant confirmed failure

4D reconstructs only unambiguous accepted cycles. Every excluded frame in the saved output is exactly zero. The original waveform is therefore retained in the residual at those frames. There are **716 ambiguous cycles**, **399 unreliable candidate intervals**, **4 provisional cycles** and **447 accepted runs**. Frequent short holes modulate/truncate the periodic structure even though the cubic joins meet smoothly. A mathematically smooth join cannot replace a missing period.

Of total residual energy:

- **96.767%** lies outside modeled support.
- **3.138%** lies within modeled non-bridge frames.
- **0.0945%** lies within modeled bridge frames.

Bridge-frame attribution is a location-based decomposition, not a counterfactual proof of bridge causation. The exact values sum to residual energy. Ambiguous cycles alone contain **944.92** energy units, approximately **27.88% of whole-input energy** and **88.5% of residual energy**. This explains why recognizable original periodic structures remain in the residual. Within modeled frames, error is only about **1.05–1.73%** of their original energy across the regions, versus much larger full-region errors where cycles are absent.

### Family competition, not generally failed shape recognition

The **actual historical 4C ambiguity lists** show:

- **714 of 716** ambiguous cycles compete between families 1 and 2.
- One competes between families 1/3; one between 1/7.
- Median best similarity is **0.99624**, comfortably above the 0.985 membership threshold.
- Median best-versus-runner gap is **0.00655**, below the separate 0.01 ambiguity margin.

The cycles are therefore often recognized as geometrically similar but rejected because two exemplars both qualify. Family 2 originated at **0.880002 s**, in the fourth short note’s decay. Its prototype RMS is **0.01879**, versus **0.08760** for the primary prototype; its normalized geometry cosine to family 1 is **0.984827**, just below the 0.985 match boundary. This created a new exemplar rather than attaching the variant to the primary family. It does not prove a different sound identity.

Code inspection confirms **provisional exemplars compete immediately**, before the three-occurrence recurring-family requirement is met. **95 ambiguous decisions occur before family 2’s third unambiguous occurrence** at about 1.5704 s. Excluding provisional competition alone would not explain away the remaining 621 ambiguities; prototype stability and variant/identity semantics still need review.

**Hypotheses:** within-cycle decay, boundary positioning, sample-phase-dependent upper-partial differences and articulation changes may account for the slightly different release exemplar and its later competition. Family 2’s later occurrences in the sustained high region recur at roughly 59.6 ms intervals; that pattern is compatible with sampling/phase-related variation, but this analysis does not establish the physical cause. A high cosine is not proof that the two families share one source.

### Phase and cycle detection

Accepted cycles have small fundamental phase offsets relative to their assigned exemplar: per-region median absolute offsets are about **0.0004–0.0056 cycles**. The overall accepted median is about **0.00172 cycles**; ambiguous cycles have an even smaller median **0.00130 cycles** to their best final exemplar. Median period-spacing errors are about **0.24% accepted** and **0.30% ambiguous**. This does not support gross phase/period failure as the dominant explanation for interior holes. It does not rule out large high-harmonic phase errors from small fundamental offsets or errors in individual transition cycles. Phase comparisons use signed saved geometry, not a newly fitted phase shift.

The report’s best/runner and phase fields are retrospective comparisons to the final exemplar dictionary. The historical-candidate summary above uses the actual recorded streaming decisions, avoiding confusion about which exemplars existed at a given time.

### Continuous transitions contribute locally, but are not the sole cause

Within 25 ms of audio-derived region edges, **57.0%** of candidate intervals are unreliable, versus **9.15%** in region interiors. This is consistent with window-smearing, changing periods and release/noise boundary uncertainty. However, ambiguity among reliable cycles is similar near edges (**34.7%**) and in interiors (**33.4%**).

Errors already begin in the silence-separated notes 5–8, and the final two notes in the continuing passage are comparatively clean. Continuous transitions are therefore neither necessary nor sufficient for the widespread garbling. Interior family competition is a separate confirmed mechanism. Edge statistics are associations around uncertain detected boundaries, not exact MIDI note-on/off validation.

As a further spectral check, in the selected garbled region-6 window, power outside the defined harmonic neighborhoods is approximately **69.2% of reconstructed spectral power**, versus **6.7% in original**. The same proxy is about 7–8% for both signals in clean windows. It includes finite-window leakage and is not a perceptual artifact score, but supports modulation/sideband contamination from intermittent reconstruction. The residual contains both omitted original cycles and the smaller shape/phase/interpolation error on accepted cycles.

## Audio-based evaluation scope

The user confirmed that MIDI-specific validation is **not required for Experiment 4E**; the MIDI screenshot was contextual. No MIDI file was used. Note regions and transitions were identified independently from original audio, then compared with frozen reconstruction and residual. Exact MIDI pitch/onset/offset accuracy is outside scope. The human-described eight ascending and seven descending notes are used only afterward to label ordinal evaluation groups. All spectral pitch estimates, supports and model decisions come from the existing audio-derived records. No guessed scale pitches or note names were introduced. No MIDI data is needed to complete this audio-based investigation.

## Smallest proposed changes — not implemented

### A. Treat high-frequency fidelity independently of cycle coverage

1. **First isolate interpolation below the representable limit.** In a separately approved 4F variant, hold assignments, periods, amplitudes and signature samples fixed and compare a better periodic interpolator. A local four-point cubic interpolator is a small implementation change, but is not an exact band-limited reconstruction. Periodic Fourier interpolation can remove the known sub-limit sinc-squared attenuation, subject to proper Nyquist handling. Neither recovers independent harmonics already absent/aliased in the 64 measurements.
2. **If the highest harmonics must be recovered, retain richer synthesis information separately from the compact recognition descriptor.** Keep 64-position recognition and its assignments unchanged while evaluating richer observed family exemplars or complex harmonic coefficients. The six clean-window pitches require roughly **107–141 independent positions**, depending on frequency, to represent phased harmonics through the source Nyquist limit; 128 positions is not automatically sufficient for the lowest notes. This is a theoretical capacity count, not a recommendation to blindly raise every signature to a fixed size. Appropriate anti-alias handling and target-pitch band limiting must be tested. No new resolution was used here.

Estimated costs, not benchmarks: a four-point local interpolator uses roughly twice the sample reads and more arithmetic than two-point linear interpolation (budget approximately **2–4× the 0.197 s synthesis kernel**, not 2–4× the whole pipeline). A higher-resolution lookup with the same two-point sampler retains O(output samples) synthesis cost and may stay in the same runtime order, but extraction/storage increase with signature size. Direct Fourier summation of roughly 32–70 harmonics/sample can be tens of times slower in pure Python; cached/pre-filtered tables need separate design and validation. Four richer family tables alone cost only additional kilobytes; duplicating richer signatures/derivatives into every cycle inflates the already-large audit JSON and memory substantially. None of these estimates establishes the full-song target.

### B. Treat family-label ambiguity separately from waveform-prediction uncertainty

1. **Small bookkeeping/eligibility fix:** provisional exemplars should not immediately have the same global veto authority as stable recurring core exemplars. Retain new/release variants and unknown structures, but evaluate an explicit stable-core promotion rule before allowing them to create widespread ambiguity. This addresses the confirmed early-provisional failure mode; it cannot by itself guarantee resolution of all 716 cycles.
2. **Then test variant/consensus handling:** when several family labels are plausible but their aligned waveform predictions agree closely, identity may remain unresolved while a waveform estimate is supported. A future experiment can test a confidence rule for this case, keeping uncertain or genuinely different predictions in the residual. Do not simply reduce the ambiguity margin or force all similar periodic sounds into one family. New stable-core/consensus rules are grouping/reconstruction behavior changes, not mere computational optimizations.
3. **Keep transition handling conservative initially.** Preserve unreliable edge cycles and releases in residual while fixing interior omissions first. More elaborate period tracking or partial-cycle models should be a separate experiment. Do not disable bridges as a substitute for restoring missing support; bridges were not the primary measured failure.

Estimated costs: eligibility checks are O(number of cycles) using existing metadata, with tiny additional memory. Prototype stability/consensus comparisons cost O(cycles × candidate exemplars × 64 × channels), the same order as existing compact comparisons. 4C’s 9,663 baseline exemplar comparisons took 0.129 s, so a small number of extra candidate comparisons should be of that order on this clip, not a full 80-second waveform fit. Reconstructing more accepted frames increases the 0.197 s 4D kernel approximately in proportion to modeled samples (all 6 seconds versus current 3.54 seconds suggests roughly **1.7× kernel work**, before any new interpolation/anti-alias cost). These are rough work estimates, not a promise that more cycles are valid.

### Evaluation order

Keep the two interventions independent: spectral fidelity on fixed continuous support, then coverage/family handling at fixed rendering quality, followed by their combination only if both pass negative controls. Preserve 4D as baseline. Review the evidence before implementing 4F.

## Diagnostic cost, tests and scope

Analysis took **1.988 seconds** before JSON export, with **210.47 MiB** OS process peak RSS. Most time was loading audit metadata and cycle/spectral analysis. Timings exclude plots, summary generation, synthetic tests and report serialization. It is not a production or full-song benchmark.

Four synthetic tests passed: numerical confirmation of the 64-position interpolation transfer, known −6.02 dB half-amplitude spectral power with opposite-phase stereo, the real Nyquist-bin edge case, and zero-energy denominator handling. Preservation checks cover all earlier research files and the frozen WAV/source hashes. The investigation does not establish listener thresholds, a real-world false-match rate, or a click-free reconstruction.

Reproduce analysis only in a new sibling results directory; output JSON/SVG files are exclusive-create. `analyze.py`, `summarize.py`, `plots.py` and `test_analyze.py` are saved here. No new WAV files are created by this diagnostic.
