# Experiment 4K — selected remaining boundary artifacts

[Three annotated waveform comparisons](waveforms.html) · [Measurements](report.json)

Diagnostic only, using frozen 4J-A. Five short regions were examined: the strongest
onset gap, strongest continuous-transition gap, one short-note release, a steady
control, and the recording end. No algorithms, thresholds or audio changed.

## Main causes

1. **Large transition omissions are confidence failures.** The strongest saved gap
   is 2.9860–3.0194 s. In its surrounding window, 87.3% of residual energy comes
   from detection/periodicity rejection, 12.4% from a following neighbor rejection,
   and only 0.3% from rendered waveform error. Several normal-amplitude cycles have
   nearly correct periods but are excluded by a window that spans two pitches.
   Some immediate transition cycles also have genuinely irregular crossing spacing;
   those should not automatically be treated as valid stable cycles.
2. **Beginnings have a separate two-sided-context problem.** In the selected onset
   at about 1.249 s, the first complete cycle at 1.251888 s has periodicity 0.962 and
   period error 0.014%, yet is rejected because its reliable predecessor is across
   preceding silence. About 98.2% of this selected window’s residual comes from
   omitted audio, not synthesis mismatch. Initial partial cycles are also omitted.
3. **The sampled release largely works.** Across 0.874–0.898 s, rendered cycle RMS
   tracks the decline from about 0.088 to 0.0012. Window error is 1.64% of original
   energy; detection-rejected tail material contributes only about 0.005% of that
   residual. This sample does not support blaming all endings on rejection of
   valid evolving shapes. Accepted-cycle gain probes improve error by at most
   about 4%; no one-sample shift improves on zero shift. Detail approximation is
   the main measured release error here.
4. **Repeated narrow spikes are distinct.** The steady control contains seven
   narrow threshold events near phases 0.507–0.523, one sample wide and 0–2 samples
   from sharp source edges. All are inside rendered cycles, outside bridge zones.
   These are consistent with imperfect sharp-edge/sub-sample phase reconstruction,
   not missing complete periods or arbitrary cycle-origin jumps.
5. **The file end is a partial-cycle boundary.** The final 2.88 ms lacks a complete
   next detected boundary and remains in residual. The reference itself ends at
   nonzero amplitude (−0.03285 per channel); this is not evidence about a natural
   release beyond the recording.

At selected run starts/stops, maximum adjacent-sample steps are about 4e-6 for
attack/transition and 0.000174 for release, far below ordinary internal waveform
steps. No large literal value discontinuity was found at these joins. Brief gating,
lost transient structure and sharp-edge errors are plausible pop/crackle mechanisms,
but their exact audibility was not established by a new listening test.

## Consistent timing pattern and one correction to test

The six largest saved missing-support gaps are all near continuous pitch changes
and together account for **49.27% of total 4J-A residual energy**. This ranking uses
saved gap measurements; it is not an exhaustive new pop detector.

At the strongest audio-derived boundary, the same unchanged periodicity calculation
on equally sized 46.44 ms windows gives:

| Window | Estimated f0 | Periodicity confidence |
|---|---:|---:|
| Left side only | 523.82 Hz | 0.9987 |
| Centered across change | 513.59 Hz | 0.7256 |
| Right side only | 465.63 Hz | 0.9068 |

**Single simplest next test:** make the periodicity-confidence window boundary-aware:
use a same-side window at an already audio-detected pitch change instead of a
window spanning both sides. Keep the pitch math, confidence thresholds, matching
safeguards and synthesis unchanged. This directly targets the largest measured
loss. It will not by itself fix the onset predecessor guard, final partial cycle,
or steady high-frequency detail errors. No correction was implemented.

## Cost and verification

Successful diagnostic execution: **0.567 s** before JSON output: 0.395 s loading,
selection and hashes; 0.172 s selected-window calculations/probes. Peak whole-process
RSS: **223.17 MiB**. Excludes development, figures/page generation and final QA.
Only five short windows and three pitch-window probes were newly analyzed.

Arithmetic partitions, data hashes, source syntax, SVG geometry and page links
were checked. Original audio and all earlier results/production files are preserved.
No new WAVs, feature, threshold changes, linear256 integration or correction work.
This limited sample does not establish causes for every pop or every note ending.
