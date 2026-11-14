# Experiment 2 restart — varvol2.aif

The sole separation input is `audio/varvol2.aif`. Previous variable-volume results
are not used for inference, parameter selection or comparison. No references,
source labels, volume patterns or event assignments are supplied.

`experiment_01b.py` runs unchanged with its existing defaults. The same lossless
AIFC float32 decoding adapter changes only the input path and destination folder.
Outputs in `separation/` are IEEE 32-bit floating-point WAVs at the input sample
rate/channel count, with no clipping, normalization, resampling or integer conversion.
Only float32 output rounding occurs. The residual and original baseline are exported.

From repository root:

```sh
python3 -B research/source-separation/results/recording-02-restart/run_adapter.py
```

The output directory must not already exist. Previous files are preserved; hashes
are checked solely for preservation, without using their audio as separation inputs.
`preservation.json`, `provenance.json` and `verification.json` record those checks.
No algorithm or application code changes, reference evaluation or listening claims
are part of this run. Component identities remain unassigned pending human listening.
