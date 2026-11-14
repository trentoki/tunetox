# Experiment 4G — gap and family-fragmentation diagnostics

Open the **[readable HTML diagnostic report](report.html)**. It is self-contained,
with eight labelled waveform comparisons, all 272 interruption locations,
family shapes/similarities, audio-region comparisons and recommendations.

## Dominant measured causes

- **Missing cycles:** 88.50% of 4F-B residual energy lies outside accepted support.
  The 194 remaining ambiguous cycles account for **65.12% of residual energy**.
  Active-block support contains 272 missing intervals: 161 dominated by ambiguity,
  109 by unreliable candidate detection and 2 by unmodeled boundary/context. These
  diagnostic counts are not claims that every interval is audible.
- **Regular narrow spikes are different:** 1,546 narrow events lie entirely in
  rendered B cycles. All are near the source’s sharp internal edge (within the
  stated frame/period tolerance), none in a bridge zone. Median width is one
  sample and phase is 0.5123 cycle. They reflect missing/inaccurate waveform detail,
  not missing whole periods. They comprise 36.3% of accepted-cycle error, about
  4.18% of total residual energy. B has more rendered cycles, so its raw spike count
  must be exposure-normalized before comparison with 4D/A.
- **Attack bursts are mostly omitted original cycles:** nine silence-backed energy
  onsets were detected. First-5-ms error ranges 19.5–98.8% of source energy;
  omitted support accounts for 92.6–100% of that error. The recording-start onset
  is censored; continuous pitch changes are not energy onsets.
- **No gross placement fault found:** every saved reconstruction is exactly zero
  outside its declared accepted supports. No energetic accepted B cycle exceeds
  the diagnostic 25%-error-energy threshold. This does not rule out small phase,
  amplitude or high-harmonic errors within accepted cycles.

## Why four recurring families?

Each family has one exemplar, not one proven source. Historical unambiguous counts
are **1398 / 12 / 3 / 3**. B renders **1842 / 90 / 3 / 3** using those same exemplars.
Family 1 spans all 15 audio-derived pitch regions. Family 2 originated in release;
its later members occur at several articulations, especially one higher pitch.
Family 3’s three members are low-level releases. Family 4’s three are near continuous
pitch transitions. Thus this is not a one-family-per-pitch decomposition. Historical scan order matters: family 2 was created near 0.880 s, after most of the first four regions. Of 716 original ambiguities, 713 occur in regions 5–13, one in the first four and two in the last two.

Geometry varies with release/transition and phase anchoring. Family 1/2 cosine
0.984827 barely misses the 0.985 match threshold despite harmonic cosine 0.999080.
Family 1/4 cosine rises from 0.931729 to 0.995001 in a diagnostic one-position
cyclic comparison. This supports phase/edge sensitivity; it does not prove every
boundary is wrong or authorize merging identities. Known single-synth structure is
post-hoc context only. The report preserves all family distinctions and uncertainty.

## Remaining 194 and the smallest next test

Recovered/remaining median RMS is virtually equal (about 0.08753). Remaining cycles
have weaker period/shape evidence, but many still match well. The largest disjoint
failure groups are **70 neighbor-only** and **55 target-score-only**.

Among the 70 neighbor-only cases, 68 of 70 bad-neighbor entries are shorter than
four samples (median 1.14 frames). Nearest reliable temporal neighbors meet all old
geometry/period conditions with tightly bounded gaps for only 8 cases. A bounded
half-position phase comparison raises that diagnostic compatibility count to 64.
Fractional comparison also smooths sampled signatures slightly, so this cannot
uniquely establish physical phase error. No cycle was reclassified or rendered.

The smallest supported next experiment is a **time-local, bounded-phase neighbor
compatibility check**, retaining the target’s confidence gates, original timing,
family identities and unmodeled intervals. Do not blindly lower the global score
threshold or merge families. The 64-case probe is not a promise of correct recovery.
Core-exemplar/variant promotion and sharp-edge synthesis fidelity should be separate
studies. No algorithm change, combined A+B or 4H was implemented.

## Measurement and verification

Main diagnostic wall time: **2.700 seconds** before JSON serialization.
Peak whole-process RSS: **394.69 MiB**, including original audio, five frozen
render/residual pairs, metadata and diagnostics. Excludes tests, context probes,
HTML/figure generation and browser rendering. No full-song performance claim.

**Nine tests passed**, covering interval locations, fractional masks, energy
partitions, stereo polarity, gain/phase classification, frame-unit correctness,
bounded-phase probes and different-shape negatives, plus independent agreement
of saved spike/gap locations with the original 4F WAV data.

The original, prior algorithms, exports and reports are preserved by before/after
hashes. The old 4F manifest has an invalid self-hash of its then-empty own file;
all other 4F recorded artifact hashes matched. That old file was preserved and
the limitation disclosed; 4G’s independent inventory avoids self-hashing.

SVG XML, finite geometry, HTML structure and internal links were checked. Rendered
browser preview and new listening were not performed. No MIDI or isolated reference
stems were used. Diagnostic thresholds are not audibility or source-identity rules.

## Files and commands

- [Report](report.html)
- [Main numerical evidence](report.json)
- [Context and phase probes](context-and-phase-probes.json)
- [All interruption locations](interruptions.csv)
- [Preservation snapshot](preservation.json)

```sh
python3 -B -m unittest discover -s research/source-separation/results/experiment-04g-gap-family-diagnostics -p 'test_*.py' -v
```

For a repeat, copy only source/test files into a NEW sibling results directory at
the same depth, then execute `analyze.py`, `contextualize.py`, and `build_report.py`.
Generated data and outputs are exclusive-create. No WAVs are generated.
