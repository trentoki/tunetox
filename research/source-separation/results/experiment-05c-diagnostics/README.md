# Experiment 5C — why recognition and assignment fail

[Diagnostic measurements](report.json) · [Residual-prefix comparisons](prefix-recurrence.json) · [Independent 5D test](../experiment-05d-targeted-correction/README.md)

## 1C success versus 5B failure

The preserved variable-volume 1C benchmark has eight energy events. Its first
candidate is supported in **all eight events**, and the second component in four.
Those repeatable literal waveform structures fit 1C's gain/time-shift model.

5B has seven energy events, but only **two candidates have two members**; the
other five match only themselves. Template event 5 is allocated to events 5 and 6.
On the next residual pass, **every candidate has at most one member**, below the
recurrence requirement of two, so discovery stops at one component.

This is not a one-component setting: the cap remains four. The detector combines
**1.989456–6 s into one event**, so later transient occurrences are **not detected
as separate events** by 1C. The five 5A transient-fragment locations fall about
**31.95 ms, 77.85 ms, 530.82 ms, 1.718 s and 2.468 s** after their enclosing 1C event
starts. A small ±5-ms adjustment to whole-event alignment cannot generally match
those different internal positions. Gain/delay fitting also cannot normalize pitch
or note duration. Consequently the retained template is an observed **mixture**,
not an isolated source; its self-occurrence is copied exactly. This is a grouping/
assignment limitation, not evidence of successful isolation.

## The missing third synth note in 5A

The third 1C event start and next well-supported periodic novelty bracket a
**0.488866–0.746304 s neighborhood**, determined from recorded analysis. Its **357
candidate crossing intervals** comprise:

- **350 detected but cycle-reliability rejected**;
- **6 detected but rejected by the stricter 5A periodic-model screen**;
- **1 remaining provisional family, without established recurrence**.

None is recognized into the periodic output. This is **not a rendering omission**.
Transient overlap creates many additional crossings, often only 1–3 samples apart;
late examples have period errors above 70–90%. Most cannot receive valid complete-
cycle signatures even while a repeating waveform remains perceptually recognizable.

Pitch itself recovers: around 0.613/0.623/0.633 s, estimates are **392.94/392.60/392.58
Hz**, with confidence **0.9008/0.9197/0.9069**. Yet individual crossing intervals
still fail. A fixed learned shape observed across **eight periods** instead gives:

| Center | Joint waveform correlation | Supporting 4-ms windows ≥0.85 |
|---|---:|---:|
| 0.613220 s | **0.95233** | **6/6** |
| 0.623220 s | **0.88250** | **4/6** |
| 0.633220 s | 0.63706 | 2/6: rejected |

This confirms a testable mechanism: **single-cycle boundary reliability can fail
while multi-period source-presence evidence succeeds**. It justifies 5D's narrow
provisional recognition path. It does not justify filling the earlier masked attack.

5A already relates its dominant periodic families 1, 10 and 11 across pitch, so pitch
changes alone do not explain the omission. Overlap corrupts crossing geometry;
period/shape/neighbor screens and the three-cycle coherence requirement then prevent
assignment. Elsewhere the same segmentation can create provisional families and
neighbor vetoes rather than independent sound identities.

## What remains of the transient

5A recognizes a **31.93-ms residual-template fragment**, not an entire clap. Its
observation stops at the next novelty peak at 1.598367 s; the recurrence ranking
favors smaller-energy candidates among equally recurrent choices. Complete attacks
and tails are therefore not guaranteed observations or assignments.

Some residual prefix subwindows recur strongly (individual correlations reach
**0.94–0.999**), but evidence is heterogeneous: only **2 of 10** prefix pairs pass
1C's aggregate presence rule. No pair of the next aligned 32-ms residual tails
passes the required three supporting windows; whole-window correlations are
**0.535–0.696**, with only **0–2** supporting windows. Prefix/tail observations can
also contain periodic interference, and a very short final partial window can count
in the inherited presence test. This does not support automatically assigning all
remaining transient material to Source 2. **No 5E is justified yet.**

## Controls, evaluation limits and failure categories

4Q's continuous single-synth output uses **231 provisional sections / 0.20837 s of
original PCM**, bringing coverage to **86.50%**. This is a useful completeness control,
but its source identity is assumed. Copying an overlapping mixture the same way
would not isolate sounds.

The categories are distinct: later 5B transient boundaries are **not detected**;
5A's third-note intervals are **detected but rejected**; 5B's retained composite
is **assigned as a component without source purity**. For **recognized but inaccurate
reconstruction**, existing table/join approximations remain possible, but residual
error against an overlapping mixture cannot isolate synth-model error from clap
energy. The single-synth benchmark provides the appropriate control.

`Majorsaw.aif` is a valid separate single-synth benchmark, but no aligned source
reference for this mixture was established. Only **8.06%** of supplied samples
match exactly, with varying phase/gain discrepancies even outside obvious
transients. Matching duration and pitch sequence do not establish source truth.
There is no isolated clap reference. **True SDR/SIR, absolute leakage and true event
false-negative rates cannot be verified.** No isolated source enters separation.

Main diagnostic runtime **1.456 s**, peak process RSS **324.83 MiB**; supplementary
prefix/pitch checks are separate. Earlier files remain unchanged. No listening WAVs
were exported for diagnostics. A single correction is tested independently in 5D;
no 5E or combined changes were implemented.
