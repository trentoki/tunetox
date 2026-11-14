# Experiment 4C — waveform-shape discovery findings

**The diagnostic recognizes recurring cycle geometry across frequencies efficiently,
but family construction remains unstable.** One dominant family spans the recording;
several small shape variants and many ambiguous cycles prevent a clean identity
interpretation. No sound separation or instrument identity is established.

Input: `research/source-separation/audio/Majorsaw.aif`

SHA-256: `5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134`

Hash verified before and after analysis. No references, supplied pitches, scale
intervals, instrument properties or expected family count entered discovery.
1C, all previous experiments, original audio and production code are preserved.
Only observed geometry and periodicity drive candidate/family decisions. The known
8 ascending + 7 descending structure was used **after discovery** for evaluation;
the independently detected 15 periodic plateaus agree in count, not a proof of
accurate note boundaries or pitches.

## Saved evidence and visualizations

- [Shape and occurrence figures](figures.html)
- [Normalized shapes across frequency and family exemplars](shapes.svg)
- [Recognition timeline and absolute amplitude](occurrences-and-amplitude.svg)
- [Compact family library and all occurrence locations](signature-library.json)
- [Full cycle signatures, confidence evidence and relationships](report.json)
- [Evaluation and region distributions](evaluation.json)
- [Methods and reproducible commands](../../diagnostic_04c/README.md)

SVG XML and finite plot coordinates were checked. Rendered visual inspection was
unavailable in this session because the browser host was unavailable. Figures
show the reference channel; the saved signatures retain both channels. No visual
waveform was substituted for measured data.

## Discovered families and recognized cycles

| Outcome | Count |
|---|---:|
| Candidate crossing intervals | 2,535 |
| Cycles passing reliability screens | 2,136 |
| Unambiguous occurrences in recurring families | 1,416 |
| Ambiguous reliable cycles | 716 |
| Provisional single-cycle occurrences | 4 |
| Unreliable candidate intervals | 399 |
| Recurring shape families | 4 |
| Provisional families | 4 |

Reliable candidate cycles cover 4.985 seconds; other timing covers 1.015 seconds,
including silence, boundaries and uncertain intervals. Unambiguous recurring-family
occurrences cover 3.547 seconds. No excluded interval was deleted or reassigned.
Original samples, exact fractional boundaries, rejection reasons and frame records
remain available. These intervals are not certified complete physical oscillator
cycles: the screens can admit transition cycles or reject legitimate quiet cycles.

| Family | Occurrences | Observed prototype time | Interpretation |
|---|---:|---:|---|
| 1 | 1,398 | 0.0019 s | Dominant recurring geometry across all 15 periodic regions |
| 2 | 12 | 0.8800 s | Small variant near short-note endings and transitions |
| 3 | 3 | 0.8872 s | Rare release/edge variant; uncertain significance |
| 4 | 3 | 2.5082 s | Transition-associated variant; uncertain significance |

Four further exemplars have one occurrence each, near later pitch-change boundaries.
They remain provisional, not new sound identities. Family 1 spans observed crossing
frequencies approximately 311–633 Hz; the higher outliers include uncertain edge
cycles. Stable-region median f0 estimates span approximately 311–620 Hz.

The fixed-exemplar method is order-dependent. A rare exemplar can compete with the
main family on subsequent cycles and produce ambiguity. Threshold sensitivity is
large:

| Geometry threshold | Recurring families | Provisional families | Recognized cycles | Ambiguous cycles |
|---|---:|---:|---:|---:|
| 0.970 | 2 | 3 | 2,103 | 30 |
| 0.985 (declared baseline) | 4 | 4 | 1,416 | 716 |
| 0.995 | 4 | 10 | 630 | 1,492 |

These results are retained without tuning to force one family. Different waveform
shapes during releases may be real articulation changes, boundary artifacts or
both. Interpreting four families as four instruments would be an unsupported and,
given the post-hoc recording description, misleading identity claim.

## Which shape descriptions remain stable?

The table compares one representative reliable cycle per detected region (105 pairs,
including repeated frequencies). It is descriptive evidence, not a classifier score.

| Descriptor cosine | Minimum | Median |
|---|---:|---:|
| Signed normalized cycle geometry | 0.9891 | 0.9968 |
| First differences / slope | 0.7609 | 0.9587 |
| Second differences / curvature | 0.4898 | 0.9282 |
| Harmonic magnitudes 1–12 | 0.9989 | 0.9997 |

Duration-normalized geometry and harmonic structure remain stable across the
recording. Slopes and especially curvature emphasize smaller differences and are
less stable. They may help distinguish shapes in other data, but this experiment
does not show that adding them to the membership gate improves recognition.

Harmonic magnitudes alone are insufficient: a synthetic control with identical
harmonic magnitudes but different relative phase yields geometry cosine below 0.7.
Signed geometry also distinguishes inverted fixed-phase signatures. However, some
phase/polarity changes are inherently equivalent for symmetric periodic signals;
absolute occurrence times, crossing level/channel and signed shapes are retained
rather than claiming that cycle anchoring resolves every ambiguity.

## Absolute amplitude is separate from shape

- Full-recording peak: **0.2702820**; full-recording RMS: **0.0800299**.
- Detected stable-region peaks: **0.212153–0.227361**. Full-recording transients
  outside those regions can be higher. These values are broadly close, not equal.
- Region median cycle RMS values: **0.087196–0.088206**, about a 1.16% max/min spread.
  This supports similar sustained per-cycle level in this particular recording.
- Whole-region RMS spans **0.073141–0.087693**, because duration, silence margins,
  short-note decay and sustained articulation change averages.
- Within the short-note regions, cycle RMS coefficients of variation are about
  **23–26%**; in the continuing passage they are approximately **0.2–0.75%**.
  Similar maximum heights therefore do not imply constant amplitude throughout notes.
- Duration-normalized full-region envelope similarity has median cosine **0.8932**.
  It is not amplitude equality: cosine removes gain and duration normalization changes
  the time axis. The earlier 4B onset-only, aligned 100 ms comparison was 0.9986;
  it asked a narrower question and did not include full articulation differences.

No amplitude-equality condition enters family membership. Only the relative activity
screen uses amplitude to avoid numerical/noise cycles; it can still miss a quiet
meaningful occurrence. Synthetic gain-varied cycles group together while their
raw scales remain different. Future identity evidence could include amplitude or
articulation as optional context, not a mandatory equality rule. No such identity
rule was implemented here.

## What was not recognized reliably?

Many short candidate intervals around waveform edges fail the period/spacing or
minimum-sample checks; other intervals have uncertain periodicity or low energy.
Rejection reasons overlap (a cycle can fail several checks). Four otherwise
eligible cycles fail the neighboring-geometry check. All reasons and candidate
locations are saved, including unfamiliar/unexplained material without a signature.

Seven synthetic tests passed: different pitches/levels/DC offsets of the same
shape, different harmonic shapes at the same pitch, fixed-phase polarity,
opposite-phase stereo, cycle timing, silence/noise rejection, multiple families,
ambiguous/provisional assignments, harmonic-phase collisions and gain independence.
These are constructed controls, not proof of a low real-world false-match rate.
No second instrument, polyphonic mixture, chirp, missing-fundamental recording or
held-out corpus was evaluated. Multiple periodic sources can make misleading
cycles; nonperiodic sounds need another representation. No identity count is inferred.

## Computational cost and memory

| Stage | Seconds |
|---|---:|
| Decode and preservation snapshot | 0.261 |
| Periodicity frames | 1.221 |
| Cycle boundaries and signatures | 0.398 |
| Baseline family assignment | 0.129 |
| Clustering including three sensitivity passes | 0.569 |
| Amplitude analysis | 0.038 |
| Total before report export | **2.539** |

Baseline assignment is included in the clustering/sensitivity total; do not add
both. Total includes final verification and region relationship calculations but
excludes JSON export, figures and tests. OS peak process RSS was **128.25 MiB**,
including Python, decoded PCM, signatures, auxiliary descriptors and preservation
hashes. This is a process high-water measurement, not incremental feature memory.

Baseline family assignment needed **9,663** cycle-to-exemplar comparisons at 64
positions per channel, rather than exhaustive sample-lag fitting of whole events.
Frame periodicity is now the largest measured stage. Cost is roughly linear in
samples plus cycles × exemplar count × 64; it can become quadratic if every new
cycle creates a new exemplar. Prototype growth is not capped by an assumed count.

The 64-position shape is a compact comparison coordinate system, **not an audio
codec**. Auxiliary signatures and Python/JSON metadata have substantial overhead.
The full audit report is **27.57 MiB**, larger than the **2.02 MiB** input; the smaller
prototype/occurrence library is about **0.84 MiB**, but relies on the input and full
report for unmodeled/raw details. At higher pitches 64 values/channel are only
slightly fewer than observed samples/cycle. Storage compression is not established.

## Comparison with 4B and exhaustive fitting

4B's pitch-scaled eight-cycle comparisons gave median cross-pitch waveform similarity
0.982 and harmonic-relative similarity 0.9999. Here, independently anchored single
cycles give similar qualitative evidence, while exposing boundary/release variants
and threshold-dependent family splitting. The metrics use different supports and
phase handling; their scores are not directly interchangeable.

4B took 6.70 seconds plus 1.18 seconds of additional controls. 4C took 2.54 seconds
before export, including sensitivity and amplitude analysis. Experiment 4's 1C
separation took 79.67 seconds. These are different tasks: this diagnostic does not
subtract components, recover overlap, or synthesize complete sounds. It demonstrates
cheaper relationship measurements, **not an equivalent faster separator**. The
full-song three-minute goal remains unproven; the inherited input-size limit also
precludes normal full-length songs in this diagnostic.

## Review before further work

The useful foundation is a remembered, signed, stereo cycle geometry with independent
pitch/time/amplitude metadata. The present fixed-exemplar grouping needs review for
boundary uncertainty, ordering and near-duplicate prototypes before integration.
A subsequent diagnostic could compare a stable-core exemplar policy or explicit
variant relationships, with the same negative controls and a held-out corpus.
Those would be separately evaluated grouping changes, not silently applied speedups.
No 1C change or production integration has been made.
