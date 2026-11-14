# Performance target and Experiment 3 findings

Research target: separate a full-length song in approximately **180 seconds or
less on target hardware**. Target song duration, exact hardware, channel/rate
limits and an acceptance corpus remain unspecified. This run establishes no
full-song throughput or target-device guarantee.

## Measured versus estimated

- Input: 16 seconds, 705600 stereo frames at 44100 Hz; within the unchanged
  four-million-interleaved-sample input limit. Longer songs at this rate will
  exceed that limit; this experiment does not remove it.
- Initial full run: **242.150714583 seconds**, three components. This is elapsed
  wall time, not CPU time. It includes decoding, separation, exports and final
  preservation hash checks. No per-stage stopwatch was installed in that initial
  run, so exact whole-run stage timings are unavailable.
- Preflight decode/detection/work-count calculation: approximately 0.107 seconds.
- Unprofiled representative fit before the full run: **2.554514292 seconds**.
- Estimated full first-pass fitting cost: **77.05 seconds**; four full passes
  would be approximately **308.22 seconds**, excluding other work. Actual later
  passes examined fewer nonzero candidates: 4, 3, 2, 1. Scaling estimates are
  approximate, not measured full-pass times.
- Additional cProfile representative fit: **6.544669 seconds cumulative**;
  energy and dot-product summation account for approximately 96.6% of that fit's
  profiled time. Energy scans alone account for approximately 46.5% of fit time.
  Percentages overlap through caller/callee relationships and must not be added.
  cProfile adds overhead. This probe ran concurrently for about 6.5 seconds with
  the initial run, introducing resource contention; 242.15 seconds is therefore
  not a clean isolated benchmark. Do not subtract probe time from the total.

Raw measurements: [preflight](preflight.json),
[representative function profile](representative-fit-profile.json),
[initial run provenance](provenance.json).

## Bottlenecks and limitations

The detector merged activity into four observation windows of 65735, 88176,
264616 and 287073 frames. Long windows can contain several sources; they are
not source identities. Every nonzero candidate is fitted to every target event
at 441 integer lags. The first pass alone covers about **1.747 billion
interleaved overlap sample positions**; each position participates in both
energy and dot-product work, with list slicing and Python generator overhead.

This exhaustive fitting is the dominant expected full-run stage based on its
work count, representative measurement and profile. It is an inference, not a
measured whole-run percentage. Presence tests also scan windowed samples and
retain correlation diagnostics; reconstruction/export scale with sample and
component count. Their full-run shares were not measured. Peak memory was not
measured; lists and per-lag copies allocate repeatedly.

Cost grows roughly with candidate count × event count × overlap length × lag
count × passes. Longer continuous events increase overlap length; more distinct
events increase pair count. Simple linear extrapolation from clip duration is
therefore unreliable. Even this clip exceeds 180 seconds on the current host;
the current implementation is unsuitable for the stated full-song target without
substantial performance work. Target hardware has not been confirmed.

## Proposed computational optimizations — not implemented

Keep candidate selection, segmentation, lag grid, gains, presence thresholds,
ranking, significance guards and subtraction rules unchanged:

1. Add function-level stage timers to a future diagnostic wrapper, and measure an
   isolated run on agreed target hardware. Timing hooks must not alter samples.
2. Cache identical candidate overlap-energy calculations using candidate identity
   and exact source start/count. Reusing the result of the same ordered sum can
   preserve numerical results; bound cache memory and benchmark hit rates.
3. Replace list slicing and Python generators with compiled double-precision loops
   over the same samples, keeping summation order and deterministic tie handling.
   This requires a separately approved implementation/dependency plan and validation.
4. Consider native/vectorized dot products, prefix energies, exact-lag FFT correlation
   or independent pair parallelism. These can preserve mathematical objectives but
   change floating-point reduction order, cancellation or resource usage. They are
   not automatically bit-identical. Require comparisons of selected candidates,
   membership, gains/lags, stop conditions and exported audio against this baseline,
   including near ties and very weak residuals, before claiming behavior preservation.

Separately, candidate-count pruning, coarser lag search, downsampling, altered event
segmentation, new tail models, changed thresholds or a different factorization are
**algorithmic improvements**, not pure speedups. Evaluate those in distinct versions
with listening tests after computational changes are independently assessed.

The existing input cap also blocks normal full-length songs. Raising it or adding
chunked processing needs a separately reviewed memory/runtime plan; chunk boundaries
must not silently change discovery. No limits or mathematics were changed here.
