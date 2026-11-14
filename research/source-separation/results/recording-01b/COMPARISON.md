# Experiment 1B — initial recording comparison

No isolated references were read. Input SHA-256 matches Experiment 1. All 19
preserved Experiment 1 implementation/run artifacts match their pre-change hashes.
Production code is unchanged. The baseline algorithm is unchanged.

| Check | Experiment 1 | Experiment 1B |
|---|---:|---:|
| Detected events | 8 | 8 |
| Exported components | 3 | 3 |
| Component 1 event assignments (one-based) | 2–8 | 1–8 |
| Component 1 template event | 7 | 1 |
| Residual as percentage of input energy | 12.0606% | 0.000115251% |
| Component 3 as percentage of input energy | 0.0000162754% | 0.0182196% |
| Component 3 peak | 0.00440004 | 0.184209 |

The corrected alignment makes the first observation eligible across all eight
events. Because it has the lowest observed energy, the unchanged template ranking
now chooses it. Its placement at later events uses fitted positive lags 427–503
frames (relative to event windows), rather than repeating it at unaligned window starts.
The first event is reconstructed at lag zero and unity gain.

Component 2 is assigned at events 2, 4, 6 and 8. These assignments are discovered,
not provided as an alternating pattern.

The third 1B component is **different from** the original nearly silent third
component. It consists of recurring leftovers at events 3, 5 and 7, contributing
about 0.0503% of each original event's energy. Both relative significance tests
accept it. It may still represent template mismatch rather than another independent
sound; the new criteria do not prove source identity. Choosing the first observed
waveform instead of a later one changes the subtraction leftovers. No thresholds
were retuned to force two exported tracks.

Six recurring candidate rows were rejected as negligible across the later passes;
the corresponding unextracted material stays in the residual. In particular,
pass 3 rejects a candidate with four-millionths of a percent of total input energy
while preserving the more substantial repeating leftover. See all significance
ratios and rejection reasons in `separation/report.json`.

The 22 automated tests passed. All six WAV exports decode as four-second stereo
44.1 kHz float32, and component sum plus residual reconstructs input with maximum
absolute export rounding error below 3e-8. Input and algorithm hashes are recorded
in `provenance.json`; numerical comparisons in `verification.json`. Float samples
are not normalized or clipped. No human listening evaluation is claimed here.
