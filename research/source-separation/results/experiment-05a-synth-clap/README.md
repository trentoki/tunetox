# Experiment 5A — partial separation, substantial unresolved overlap

[Listening comparison](listen.html) · [Original](listening/original_reference.wav) · [Source 1](listening/separated_source_1.wav) · [Source 2](listening/separated_source_2.wav) · [Residual](listening/residual.wav) · [Recombined including residual](listening/recombined.wav)

**The current methods do not reliably separate this mixture.** They discover a periodic model and a recurring transient-fragment model, but periodic continuity fails around several transients, complete transient attacks/tails are not recovered, and the adapted method regresses on the kick/clap benchmark. These exports are an experimental attempt, not verified isolated stems.

Input: `audio/MajorsawwackClap.aif`, six seconds, stereo, 44.1 kHz float32;
SHA-256 `5eb47bcae4b439165ee318ac9eca95c05f508ae08e7e229860ca0746429f7b23`.
No isolated recordings, previous Majorsaw shapes, DAW timings, note names or instrument classifications enter discovery. Original peak **1.11733** is preserved without normalization or clipping.

## Structures and timing

- **20 abrupt-change candidates**, measured from 2-ms stereo energy, 8-ms smoothing/differences and a six-MAD rise threshold. Their timings and uncertainty are in [event-candidates.csv](event-candidates.csv). These include periodic attacks/transitions and multiple concentrations within an event; they are **not a count of 20 claps**. The 24-candidate cap was not reached on this mixture.
- **Five recurrent transient-fragment occurrences**, candidate starts **0.520816, 1.566440, 2.520272, 3.707574, 4.457868 s**. Subsequent waveform fitting refines alignment by −56, 0, −32, −23 and −36 samples. Across independent matches, 5–7 of eight 4-ms windows exceed correlation **0.85**. The prototype's self-match is not independent evidence.
- The discovered transient prototype is only **31.93 ms** long, limited by the next novelty candidate. This confirms recurring waveform material, **not complete clap boundaries or complete clap recovery**. Some candidate peaks may be sub-events; onset accuracy and false-negative counts are unknown.
- **One persistent periodic hypothesis**, comprising three related mixture-learned shape families; 1733 directly supported cycles plus eight provisional flank-predicted cycles (**16.26 ms**). Other recurring but nonpersistent patterns remain unsupported, not declared additional sources.

[Pitch observations](pitch-trajectory.csv) span **311.10–620.81 Hz** at confidence ≥0.9; the 596-row table retains uncertainty. [Pitch plot](pitch.svg) shows observations without connecting gaps. Four supported pitch-change brackets were found; transients obscure others. No expected scale, pitches or note count was supplied.

## Separation quality and confidence

Source 1 is periodic and pitch-changing: 85.9% of its active analysis frames have periodicity ≥0.9; median spectral centroid is 1067 Hz. Source 2 is brief, recurrent and less periodic: none of its active frames reach 0.9; centroid 2140 Hz. These characteristics support “periodic” and “transient-like” descriptions, but do not prove instrument identity or purity.

Periodic support covers **68.36%** of the recording. Around all five supported transient fragments, the 120-ms diagnostic window has **zero periodic model support**. Thus the putative synthesizer is **not continuous through those overlaps**. Source 2 contains a repeatable transient fragment distinct in temporal/periodic characteristics, but its observed residual prototype can carry periodic leakage. Complete claps cannot be claimed distinct or intact.

**24.10% of mixture energy remains unresolved.** It contains unsupported periodic sections, transient material and model error. Source energies are not orthogonal and should not be interpreted as source proportions. [Detailed report](report.json) includes all scores, fitted gains, model proposals and event-level continuity measurements.

[Confidence map](confidence-map.csv) distinguishes direct periodic models, provisional periodic interpolation, recurring residual templates and unresolved energy at each interval. Confidence is categorical evidence, not a calibrated probability. All identity assignments remain revisable. No uncertain overlap is repaired by duplicating the entire mixture into stems. Unlike single-source 4Q, unsupported PCM remains explicitly available in `residual.wav`.

**Recombined includes both estimates plus the residual.** The two estimated stems alone do not sum to the input; complete separation was not achieved. Additive conservation error is **1.49e−8**; recombined/reference maximum error is **2.98e−8**. These bookkeeping checks say nothing about source purity. No new listening test was performed.

## Reuse and adaptations

1C's signed/gain/lag fitting, local presence test, recurrence discovery and explicit subtraction are reused. Adaptations: residual-event candidates, windows capped at 250 ms or the next candidate, 4× box-decimated discovery with full-rate lag/gain/presence verification, at most 24 candidates and four transient models. Observed residual templates remain unproven isolated sources.

4N's audio-derived periodicity, 64-position recognition, learned shape relationships, bounded phase and robust local-period checks are reused on **fresh mixture-derived** families. Periodic hypotheses additionally require sustained three-cycle context. The existing 4F 256-position exemplar sampler is used to retain more waveform detail; this is an explicit 5A synthesis adaptation, not an unchanged 4N run. Short provisional periodic predictions interpolate between stable flanks, require time/period/shape/amplitude agreement and 1C mixture-presence evidence, and never copy the missing mixture.

4Q contributes revisable assignment/provenance and conservation. Its original-PCM fallback is deliberately unavailable for uncertain overlap: the single-source premise no longer holds.

## Regression and cost

The **unchanged 1C** run on `varvol2.aif` reproduces two components, all five WAVs and fitted allocations **bit-for-bit**. Residual is **0.005791%**. Runtime **149.821 s**, peak **130.31 MiB**. [Regression report](regression-report.json).

The **adapted 5A method on that same benchmark mixture** produces four fragments, with **36.86% residual**. Best whole-track correlations to the two saved 1C estimates are only **0.556 / 0.038**. Its novelty detector finds 51 peaks and retains 24; next-candidate windows split events, and the four-model cap is reached. This is a measured structural regression, not preserved 1C quality. Baseline outputs were consulted only after separation for evaluation, not as templates. Runtime **12.959 s**, peak **171.25 MiB**. [Adapted benchmark](benchmark-5a-report.json). No tuning was performed to hide this failure.

Mixture processing: **18.196 s** including the separate 2.116-s structure inventory and 16.080-s main run; peak main-process RSS **430.25 MiB**. Transient recurrence dominates at **11.951 s**. Timings exclude development, final spectral/report diagnostics, tests and serialization; inventory overlapped the unchanged regression, so these are not controlled performance benchmarks. Discovery/template counts and observation windows are bounded; no full-song timing guarantee follows.

Five focused overlap/negative/normalization/budget controls and eleven unchanged 1C tests pass. All 506 prior research files and production files remain unchanged. Format, finiteness, map coverage and conservation checks pass ([verification](verification.json)); browser/listening QA was not performed. **Stopped after 5A; no 5B or production integration.**
