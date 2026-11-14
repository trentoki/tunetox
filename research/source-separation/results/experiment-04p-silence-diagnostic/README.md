# Experiment 4P — silence detection

**Ordinary zero crossings do not trigger silence in these 4N results.** Silence/activity logic does contribute indirectly at onsets and quiet releases, so it cannot be ruled out as a contributing subsystem altogether. No algorithm or audio changed.

[Measurements and all 20 remaining significant gaps](report.json) · [Verification](verification.json)

## Actual logic at 44.1 kHz

| Logic | Window / step | Threshold in this recording | Effect |
|---|---|---|---|
| 4C discovery activity | 2048 samples = 46.44 ms; hop 441 = 10 ms | Stereo RMS > **0.00369303**, 4% of maximum frame RMS | Inactive windows skip pitch estimation; their candidates fail activity screening |
| 4L sustained quiet intervals, inherited by 4N | Nonoverlapping 88-sample blocks = 1.995 ms; require at least 2048 contiguous quiet samples | Block RMS ≤ **0.00492060**, 4% of maximum block RMS | Boundary context, onset handling and robust-period barriers; not direct output muting |
| Significant-gap reporting | Same 88-sample RMS activity blocks, without the sustained-duration requirement | Block RMS > **0.00492060** | Evaluation mask only; does not decide reconstruction |

RMS includes both channels. There is no instantaneous original-sample silence gate. The `1e-12` sample check in gap reporting tests whether the **reconstruction** is zero. The near-zero original-sample tests in 4M/4O are diagnostic note-location tools, not recognition inputs. Pitch autocorrelation has separate correlation/peak checks; discovery requires confidence ≥0.8, and ambiguous related-shape recognition requires ≥0.9. These are periodicity screens, not silence tests.

## Numerical checks

- In the continuous long-note passage, **no sustained quiet interval exists**. Minimum 2-ms block RMS is **0.0540149**, over ten times the quiet cutoff. The longest run below a diagnostic instantaneous amplitude cutoff of 0.0108113 is only **11 samples / 0.249 ms**; its containing block RMS is **0.0942007**, so it is active. This diagnostic amplitude cutoff is not an algorithmic silence threshold.
- Transition interval **1840** has candidate RMS **0.0874828**, analysis-window RMS **0.0866355** and confidence **0.959325**. It fails crossing-period agreement, not activity. Cycle **1852** similarly has window RMS **0.0865645** and confidence **0.996723**, but fails shape geometry. Cycle **1853** is active and target-compatible, but fails neighbor context.
- Ordinary pre-transition cycle **1835** has window RMS **0.0869766**, far above the activity cutoff. Its **0.899241** periodicity falls just below the ambiguous-target requirement **0.9**. Calling that failure “silence” would be incorrect.
- First complete long-note cycles **703/705** have window RMS **0.0648210**, are active, and fail family relationship / predecessor geometry respectively.

All 596 saved frame activity flags reproduce their documented RMS comparison; all eight saved sustained-quiet intervals reproduce exactly. No checked zero-crossing run creates a false silence interval. There is no evidence that a continuous transition is classified silent.

## Indirect effects that remain

**Onsets:** candidate 702 spans the previous release, real silence and the initial active fragment. Its midpoint-selected analysis window has RMS **5.16e−30** and is correctly inactive. That window is then associated with the whole long crossing interval, including the new onset fragment. Seven of the 20 reported significant gaps involve such activity-rejected, silence-spanning candidates. This is a candidate/window association problem, not false silence at a zero crossing. Later complete onset cycles are active and fail other gates.

**Quiet releases:** the relative quiet threshold includes low-amplitude original decay, not just digital zeros. Cycles **428/685**, RMS **0.003164 / 0.002884**, overlap saved quiet intervals. That disables 4N's robust estimator, preserving their old neighbor-duration rejections. This is an indirect conservative limitation. Quiet labels do **not** automatically erase audio: accepted cycles **117/239**, RMS **0.002094 / 0.001173**, also overlap quiet intervals and are rendered. Their longer analysis windows remain active.

Quiet intervals also constrain boundary proposals and same-side analysis windows. Rising-crossing candidates are extracted from the original signal independently of an instantaneous activity mask; candidates subsequently inherit a frame's activity and periodicity. Reliable-neighbor selection can then propagate the effects of rejected candidates. Residual audio is not a classification input.

## Recommendation

**Do not change silence thresholds on this evidence.** Rule out ordinary zero crossings being falsely classified as sustained silence as the explanation for the continuous-passage gaps. Preserve separate diagnoses for silence-spanning onset candidates, quiet-release estimator barriers, periodicity confidence, crossing accuracy and shape/neighbor checks. Changing silence detection alone would not fix the demonstrated transition losses.

Successful diagnostic execution: **0.548 seconds**, peak whole-process RSS **225.13 MiB**, excluding imports, development, tests and report preparation. An initial diagnostic attempt was stopped after detecting a repeated whole-file statistic calculation; the corrected diagnostic caches that statistic and produced the reported results. Three reused diagnostic tests and threshold/preservation checks pass. All **477** earlier research files are unchanged; no WAVs, production changes or reconstruction reruns. Stopped after 4P.
