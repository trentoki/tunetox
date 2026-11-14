# Experiment 1 — supplied recording, initial unchanged implementation

The only input is `audio/DPTE Kick 111 Clap 808.aif`. Its filename is not
interpreted by the inference code. No reference files or event assignments are used.

The supplied file is 4 seconds, stereo, 44,100 Hz AIFC big-endian float32.
The existing CLI supports integer WAV only. `run_adapter.py` adapts only the
file reader in memory, passing decoded float samples to the unchanged original
`run` function. The original `experiment_01.py` file is not modified. No sample
rate/channel conversion, integer quantization, normalization or clipping occurs.
The original input peak is approximately 1.61424, above nominal full scale.

Command from repository root:

```sh
python3 -B research/source-separation/results/recording-01/run_adapter.py
```

The original defaults remain: detection threshold 0.015, alignment ±5 ms,
recurrence projection threshold 0.65, at most four discovery passes. The maximum
is a stopping bound, not a requirement to find four components. Eight events
were detected by the original detector; event indices/parity are not supplied.

`separation/` contains the original experiment exports, including unresolved
residual and first-event baseline. Component names are anonymous, and may contain
mixtures. `provenance.json` records input/algorithm hashes and elapsed time.
All WAVs are float32 and retain the original timeline and stereo channels.
Playback software may clip above-unity samples; the exported samples are preserved.
No listening judgment or reference evaluation is performed by this run.
