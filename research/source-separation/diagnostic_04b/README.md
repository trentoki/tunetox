# Experiment 4B independent diagnostics

Standalone standard-library analysis, separate from every separation module.
`analysis.py` includes a copy of the retained AIFC float32 decoder, then implements
its own FFT, autocorrelation-based pitch estimates, region grouping and four
relationship descriptors. No instrument properties, scale intervals or identity
count are supplied. It requires the approved Majorsaw input hash for this study.
There are no new dependencies, network requests, audio writes or 1C imports.

The measured study, methods, limitations, raw data and cost breakdown are in
`../results/experiment-04b-majorsaw-diagnostics/README.md`. A run requires a new
output directory. `envelope_controls.py` separately checks onset alignment and
sensitivity to pitch estimation errors; it does not alter the initial report.

These are descriptors and uncertainty probes, not an automatic identity classifier.
Important limits include a 60–2000 Hz pitch search, simple decimation filtering,
overlapping frame boundaries, harmonic/phase ambiguities, quadratic pair costs and
one-recording validation. The copied decoder is limited to mono/stereo AIFC fl32
and four million interleaved samples. No production or full-song guarantee.

Tests:

```sh
python3 -B -m unittest discover -s research/source-separation/diagnostic_04b -p 'test_*.py' -v
```

Seven tests passed, covering positive and negative synthetic cases and onset
censoring. No listening or real multi-instrument control study performed.
