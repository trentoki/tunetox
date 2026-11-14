# Experiment 4O — short versus long boundaries

Frozen **4N**, `Majorsaw.aif`; diagnostic only. [Detailed trace](report.json) · [Short decay comparison](short-decay.svg) · [Long transition comparison](long-transition.svg).

## Finding

**The apparent long-note release truncation is mainly a reconstruction-support break at a continuous pitch transition, not loss of an isolated decay comparable to the short notes.** Attacks have several causes: partial initial support, ambiguity/neighbor rejection, and irregular crossing intervals during continuous transitions. Note length or low amplitude alone does not explain them.

Original-sample silence intervals identify eight separate short activity islands (0.1483–0.1492 s, including decays); measured frequencies rise from about 311 to 621 Hz. The following continuous activity island is divided into seven longer segments using the existing audio-derived pitch-change brackets, with decreasing measured frequencies. These are approximate boundary estimates, not known note-off times: the selected split is 4.009976 s, inside a 3.973220–4.023220 s uncertainty bracket. No MIDI, scale or supplied timestamps were used.

The selected short example is the second island: it has the lowest measured error across at least three appreciably decaying complete cycles. The selected long example has the largest omitted span preceding a saved split, around 4 s. The first long onset after silence is also examined separately.

## Attacks

At the first long onset, original activity starts at sample **88203** (2.000068 s); reconstruction starts at sample **88377** (2.004014 s).

- Candidate **702** crosses the preceding silence: duration **4858.65 samples**, confidence **0**, no valid f0 or signature. Its small initial fragment is never evaluated for recognition.
- Complete cycle **703** has RMS **0.08795**, confidence **0.96722**, period error **1.324%**, and bounded target similarity **0.996743 ≥ 0.995**. It nevertheless fails the **unsupported family-1/family-3 relationship** gate. High shape similarity alone does not authorize this relationship.
- Complete cycle **705** has RMS **0.08737**, target similarity **0.996085**, and robust duration deviation only **0.0140%**. It fails predecessor geometry: **0.994073 < 0.995** against reliable-but-unaccepted cycle 703. Similarity to the following accepted cycle is **0.999722**.

Thus this attack loss is predominantly ambiguity/context rejection, not insufficient amplitude or periodicity. Short attacks also lose initial partial cycles: the selected short's complete cycle 70 is accepted, while its preceding silence-spanning candidate is not.

## Long “tail” and following attack

The large support gap spans samples **[176355,177062)**, approximately **3.998980–4.015011 s**. Original audio is nonzero throughout this transition; it is not a quiet release into silence.

| Example | Original RMS | Confidence | Actual rejection |
|---|---:|---:|---|
| Normal pre-transition cycle 1835 | 0.08760 | 0.899241 | Below ambiguous-target requirement 0.9 |
| Transition interval 1840 | 0.08748 | 0.959325 | 69.168-sample spacing, **34.92%** period error; discovery limit 15% |
| Transition interval 1846 | 0.03615 | 0.959325 | 23.150-sample spacing, **78.22%** period error |
| Complete-looking cycle 1851 | 0.08479 | 0.959325 | Provisional family 6; no supported recurring exemplar |
| Cycle 1852 | 0.08678 | 0.996723 | Direct discovery neighbor similarity **0.836944 < 0.9** |
| Complete cycle 1853 | 0.08745 | 0.996723 | Target passes (**0.997261**), previous reliable neighbor is **0.9856 periods** away; maximum is 0.1 |

Intervals 1840–1850 contain original oscillating structure but irregular, sometimes 1–3-sample recrossings; they cannot all be called valid complete fundamental cycles. They fail before signature calculation. Cycle 1851 does have a signature, but its best direct recurring-exemplar similarity is only **0.7831**, versus the 0.985 discovery criterion. Transition geometry is measurably different under the existing boundaries. This does not establish a new sound identity: genuine evolution and boundary distortion remain confounded.

The 50-ms transition trace has 12 detection-rejected candidates, one confidence rejection, one provisional family, and one neighbor rejection. All 13 accepted candidates are rendered. The missing section combines **original transition structure** with a longer **reconstruction-support boundary** that also excludes valid matching cycle 1853.

## Why the short decay works

Short cycles **114–117** decrease in RMS from **0.03418 → 0.01599 → 0.00674 → 0.00209**, retain approximately **126-sample** periods, confidence **0.94865**, and adjacent normalized similarities **0.99786–0.99904**. Their decaying-cycle error energy is **1.612%**. Cycle 117's direct family similarity is **0.994717**: it is unambiguously assigned under the 0.985 discovery criterion, rather than requiring the stricter ambiguous-target pathway.

Amplitude-matched contrasts reject an amplitude-only explanation: short cycle 114 is accepted at RMS **0.03418**, while long interval 1846 is rejected at **0.03615**. Short cycle 105 is accepted at **0.08735**, versus rejected long interval 1840 at **0.08748**. Quiet-interval centers have measured RMS **0** in this digital recording; no independent noise-only sample exists at the continuous transition, so its local noise floor cannot be separately estimated.

Short decay amplitude changes are substantial but normalized shape remains stable. Near the long transition, amplitude can remain nearly unchanged while geometry varies sharply (1851→1852 bounded similarity about **0.903**, amplitude ratio **1.0235**). Evidence supports transition-local complexity, not a general claim that longer notes have slower or more gradual envelopes. No separate final long-note decay is available: the original file itself ends at **−0.03285** per channel, mid-waveform.

## Window placement and one next test

Short decay windows extend into subsequent silence yet retain high energy-weighted periodicity. Long transition cycles use high-confidence same-side windows, but target crossing spacing can still be irregular; better confidence does not fix those boundaries.

There is also a confirmed point-versus-bracket oversight. Cycle 1835 uses window **[174636,176684)**, ending at 4.006440 s. This intersects the transition uncertainty bracket, but not the single split at 4.009976 s; it is therefore left unchanged. Its confidence is **0.899241 < 0.9**, despite target similarity **0.996449**. An already saved left-side window **[173171,175219)** measures confidence **0.959325**, with a corresponding period error of only **0.2721%** for that cycle. No recognition decision was rerun with this alternative context.

**Single simplest next test: use the full detected pitch-change uncertainty bracket, rather than one split timestamp, to trigger same-side periodicity analysis.** Keep thresholds and synthesis unchanged. This targets a demonstrated loss of an ordinary pre-transition cycle. It will not by itself fix the irregular transition intervals, unsupported first-onset relationship, partial cycles or later neighbor vetoes. No correction was implemented.

## Cost and checks

Diagnostic execution: **0.960 seconds**, peak whole-process RSS **223.73 MiB**, excluding imports, figures, tests and report preparation. Three reused diagnostic tests passed; four local energy partitions and conservation (maximum **7.45e−9**) were checked. No accepted rendering omissions were found in the selected windows. Original and all 469 prior research files were hash-verified unchanged. No audio exports, algorithm or production changes; no new listening/browser preview. Stopped after 4O.
