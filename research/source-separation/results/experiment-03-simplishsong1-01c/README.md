# Experiment 3 — simplishsong1, unchanged Experiment 1C

Input: `research/source-separation/audio/simplishsong1.aif`

SHA-256: `0637f1f93a257035a7af6948e35cd079c60d377da44041ce838467177d154211`

Input and algorithm hashes verified before and after the run. All 150 previous
research files verified unchanged. No references, normalization, resampling,
source identities, assumed source count or production code changes.

## Listening exports

- [Component 1](separation/component_01.wav)
- [Component 2](separation/component_02.wav)
- [Component 3](separation/component_03.wav)
- [Residual](separation/residual.wav)

All four are full-length 16-second, 44.1 kHz stereo IEEE 32-bit floating-point
WAVs. The unchanged algorithm also exports its separately labelled baseline files.

## Result and verification

Processing time: **242.150714583 seconds**, including decode, separation, exports
and post-run preservation verification; excluding preflight and subsequent export QA.
The report also records elapsed time just before writing report.json. Three
components discovered. Residual/input energy: **0.2166492343** (21.66%). The
four-component maximum is the existing search cap, not a source-count assumption.
An existing eight-event warning is historical; no expected event count was imposed.

Maximum reconstruction sample error after float32 export: **8.3819e-8**. This is
bookkeeping verification, not evidence that components are independent sources.
No listening or reference evaluation performed. No Stage 2 run.

[Detailed report and fitted gains](separation/report.json),
[provenance and processing time](provenance.json),
[export verification](verification.json), and
[performance assessment](PERFORMANCE.md).
