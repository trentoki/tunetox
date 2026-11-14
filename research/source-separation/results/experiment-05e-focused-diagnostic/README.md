# Experiment 5E — focused third-note diagnosis

**Most likely mechanism: the transient masks the same mixture evidence used to initialize and recognize the synth.** The method expects a measurable single periodic waveform before it can assign periodic audio; it does not jointly explain overlapping periodic and transient waveforms.

Only **0.46–0.77 s** was analyzed. Existing 4Q/5A/5C/5D artifacts were reused. No benchmarks, algorithm changes or listening exports.

| Interval / center | Measurement | Decision consequence |
|---|---|---|
| Before onset, 0.493 s | Local 8-ms RMS is zero | No clean same-note, pre-transient pitch anchor |
| Overlap, 0.503–0.573 s | Pitch confidence **0.23–0.54**, usually no f0; mixture RMS reaches **0.333** | 5D's ≥0.9 pitch gate prevents even attempting its learned-waveform fit |
| 0.583 s | Wrong half-frequency **196.73 Hz**, confidence **0.620** | Wrong pitch exists briefly, but is rejected rather than rendered |
| 0.593 / 0.603 s | Correct-looking **392.32 / 392.69 Hz**, confidence **0.804 / 0.873** | Still not evaluated by 5D |
| 0.613 / 0.623 s | **392.94 / 392.60 Hz**, confidence **0.901 / 0.920** | Only successful recognition interval; nine cycles rendered |
| Decay, 0.633 s | RMS falls to **0.0211**; only **2/6** presence windows pass | Presence rejection ends reconstruction |

During 0.495–0.600 s, **197/199** detected crossing intervals fail period-spacing checks; only two are reliable. This is not missing sample detection. Overlap fragments the mixture into crossings that are not synth-cycle boundaries.

**Why only a blip:** all nine accepted cycles are rendered at **0.604162–0.627090 s**, totaling **1010 samples / 22.90 ms**, with output RMS **0.0906**. Their amplitude is normal; duration, not renderer attenuation, explains the tiny recovery. No evidence here identifies incorrect stem assignment or dropped accepted cycles as the main cause.

Diagnostic use of the later-derived **392.77-Hz** hypothesis improves matching before the gate opens: correlations **0.884/0.938** with **5/6 and 6/6** supporting windows at 0.593/0.603 s. But during the stronger overlap at 0.523–0.553 s, even this hypothesis gives correlations only **0.29–0.46**, with **zero** supporting windows. Thus relaxing a pitch-confidence threshold cannot solve the main masked section.

Subtracting the *existing* 5A transient estimate raises overlap pitch confidence from **0.23–0.39 to 0.54–0.58**, still insufficient. Its short, partial template does not remove enough interference. The actual pipeline recognizes periodic audio before transients and never revisits it afterward. 4Q's original-PCM fallback succeeds only under its single-source assumption and cannot resolve this overlap.

**One proposed next experiment:** a local **joint periodic-plus-transient fit**, using the later-supported pitch as a provisional hypothesis and mixture-learned recurring transient material. Compare joint versus periodic-only evidence over this same neighborhood, without requiring the contaminated mixture to supply a fresh confident pitch in every window. Keep unsupported audio unresolved. Do not tune cycle thresholds. This proposal was not implemented.

[Local measurements](measurements.json) · [Checks](checks.json) · [Wall-clock accounting](timing.json)
