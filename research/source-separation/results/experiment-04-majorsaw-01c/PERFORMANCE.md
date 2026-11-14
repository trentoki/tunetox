# Computational findings — Experiment 4

Existing 1C source and separation mathematics were not edited. Lightweight wrapper
timers surrounded function calls and returned their original results. No concurrent
profile or other benchmark was run during separation. Timings are wall-clock and
include small wrapper overhead; they are not target-hardware qualification.

| Measured function | Calls | Inclusive seconds |
|---|---:|---:|
| read_audio | 1 | 0.015918 |
| detect_events | 1 | 0.011477 |
| leading_contexts | 1 | 0.011889 |
| fit | 153 | 78.624915 |
| presence | 153 | 0.427195 |
| discover | 2 | 79.239706 |
| separate | 1 | 79.460834 |
| write_float_wav | 4 | 0.093833 |
| baseline | 1 | 0.010622 |

**Do not add nested totals:** discover includes fit and presence; separate includes
discover, detection and reconstruction. End-to-end time was **79.673292 seconds**.

Fitting alone took **78.624915 seconds**, approximately **98.68% of end-to-end time**.
This directly measures the dominant stage in this run. Presence took 0.427195 seconds;
all four WAV exports combined took 0.093833 seconds. Decode, detection and leading
context calculation were each approximately 0.01–0.02 seconds.

There were 153 fits (81 first pass, 72 second pass), each trying 441 integer lags.
The first full pass spans about **920.6 million interleaved sample positions**.
Every lag slices overlap lists, sums candidate energy and computes a dot product
with Python loops/generators. Earlier representative profiling in Experiment 3
identified these repeated sums as dominant inside fit; it was not rerun here.
Long observation windows also waste comparisons on a passage with changing notes.
That is both a computational burden and a limitation of the existing representation.

The production goal remains a full-length song in roughly 180 seconds or less on
target hardware. This six-second clip took 79.67 seconds, so it does not demonstrate
that goal. Cost depends on event count, overlap lengths, lag count and residual
passes, not just duration; do not linearly extrapolate a guaranteed song runtime.
The unchanged four-million-sample input limit also excludes normal full-length
44.1 kHz stereo songs. Peak memory and target-device behavior were not measured.

## Computational optimizations proposed, not applied

- Cache identical overlap-energy sums for identical candidate start/count supports,
  preserving the existing summation result while bounding cache memory.
- Eliminate temporary list copies and Python generator overhead through reviewed
  compiled double-precision loops with preserved summation order and lag tie rules.
- Benchmark native dot products, exact-lag correlation acceleration and deterministic
  pair parallelism separately. Mathematical equivalence does not guarantee identical
  floating-point results; require regression comparisons of membership, ranking,
  gains/lags, stop conditions and audio. Prefix sums likewise change rounding and
  can lose precision for weak tails; they need explicit numerical validation.

No optimization or new dependency was introduced. Coarsening lag search, changing
segmentation, transposing templates, changing thresholds or introducing pitch-invariant
sound models would be **algorithmic changes**, requiring separate approval and
experiments, not computational speedups to this baseline.
