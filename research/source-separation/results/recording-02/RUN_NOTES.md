# Experiment 2 — unchanged 1B algorithm, new recording

Only `audio/VarVolDPTE Kick 111 Clap 808.aif` is supplied to separation.
No isolated references, source identities, volume patterns, event membership or
expected component count are provided. The filename is not interpreted.

The existing `experiment_01b.py` and its defaults are unchanged. The same lossless
AIFC float32 decoder adapter used for Experiment 1B changes only the input path
and output folder. Input: four seconds, stereo, 44,100 Hz, big-endian float32.
Samples remain unchanged in amplitude; there is no normalization, clipping,
resampling or integer conversion. Input peak is approximately 2.28007.

Run from repository root:

```sh
python3 -B research/source-separation/results/recording-02/run_adapter.py
```

All exports are anonymous float32 WAVs with the original timeline/sample rate and
channels, under `separation/`. The residual and original simple baseline are also
exported. Above-unity samples remain in the data; playback software may clip them.

`provenance.json` records input/algorithm hashes and runtime. `preservation.json`
contains hashes of existing experiment artifacts before this run; `verification.json`
records their subsequent check and WAV reconstruction measurements.

No algorithm changes, reference evaluation, parameter tuning, human listening
judgment, production-code edits, commit or push are part of this run. Component
identity/quality remains for listening; reconstruction alone does not prove separation.
