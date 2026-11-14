# Experiment 4Q — provisional original-sample continuity

[Original reference](listening/original_reference.wav) · [4Q reconstruction](listening/reconstructed.wav) · [4Q residual](listening/residual.wav) · [4N comparison](baseline-4n/reconstructed.wav)

Controlled **known-single-source** test on `Majorsaw.aif`, SHA-256
`5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`.
All listening files are six-second stereo, 44.1-kHz IEEE float32. No normalization, clipping, mastering, new smoothing or synthesized gap filling.

| Metric | Unchanged 4N | 4Q |
|---|---:|---:|
| Total coverage, whole recording | 83.0268% | 86.4996% |
| Residual / original energy | 3.5765% | 1.3947% |
| Significant waveform gaps | 20 | 0 |
| Original active samples left without reconstruction, above 1e−12 | — | 0 |
| Provisionally copied support | 0 | 231 sections / 0.208367 s |

The 4N recognition and synthesis rerun is **bit-identical** to its saved exports.
All 2137 accepted cycles and every sample of their reconstruction are preserved.
Provisional original PCM occupies only **3.4728%** of the full recording; recognized
4N synthesis remains 83.0268%. Nine unassigned runs total **0.810023 s**: inter-note
silence/near-digital-quiet tails plus initial quiet samples. These are not remaining
missing active waveform sections.

## Assignment policy and map

Long original-sample near-digital-quiet runs (amplitude ≤1e−12 for at least 2048
samples / 46.44 ms) separate candidate activity regions. Isolated zero crossings
never split them. Each region must also have RMS activity above 4% of maximum
2-ms block RMS and at least three complete **frozen 4N** recognized cycles. A weak
or unanchored separate region is left unassigned. These rules establish nine supported
regions, without using pitches, note times or a new sound identity classifier.

Within a supported region, every sample outside 4N's accepted cycle support is
copied from the original, including partial attacks, irregular transitions and low
release tails. Individual failed cycles cannot create a new boundary. This layer
assumes that unresolved original audio inside an established region belongs to the
known single source; it does not claim that its shape has been recognized.

[Assignment map, CSV](assignment-map.csv) gives half-open absolute sample intervals,
times, label and provenance. [Raw per-frame labels](assignment-labels.u8) contains
264600 bytes: **0 unassigned, 1 frozen 4N synthesis, 2 provisional original PCM**.
These are categorical assignments, not calibrated confidence probabilities; “recognized”
means 4N render-supported, not proven source identity. [Report](report.json) lists all
231 provisional sections and region evidence.

## Completeness and boundary behavior

The omitted long-note attacks, continuous-transition sections and release-side
support gaps now contain their original samples. Every provisional sample has zero
residual exactly. Existing synthesized regions retain 4N's sharp-edge/detail and
join approximations; copying omitted material does not repair those errors. The
original file's final mid-waveform cutoff remains unchanged.

The largest sample step at a provisional boundary is **0.00434809**, compared with
**0.00443000** in the original at that location (4.516304 s). 4N had tapered to almost
zero there. The largest boundary step mismatch against the original is **0.0104058**
at 1.767075 s, reflecting the switch into the unchanged synthesized waveform.
Boundary steps are tabulated individually in the report; no crossfade was added.
These numerical checks do **not** establish audible seamlessness. No new listening
test was performed.

Residual improvement is largely expected from directly copying original PCM into
previously omitted regions. It demonstrates completeness under the single-source
assumption, **not separation of overlapping sources**. Reconstruction plus residual
matches the original within **3.73e−9** after float32 export, independently of quality.

## Cost and verification

Measured core processing: **4N rerun 1.645 s**, followed by **4Q 0.749 s** (including
**0.100 s** assignment), approximately **2.394 s** sequentially. Separate-process peak
RSS: **344.20 MiB** for 4N, **255.11 MiB** for 4Q. Timings exclude imports, final 4N
provenance audit, JSON serialization, development, tests and report preparation.

Four focused tests pass: original-only provisional samples, recognized samples
unchanged, real silence/unanchored material preserved, and isolated zero crossings
not creating boundaries. File formats, complete map coverage, conservation and
actual nonquiet output holes were checked. All **482** prior research files were
hash-verified unchanged; no production or earlier experiment files were edited.
[Verification](verification.json).

Stopped after 4Q. No multi-source separation or further experiment was implemented.
