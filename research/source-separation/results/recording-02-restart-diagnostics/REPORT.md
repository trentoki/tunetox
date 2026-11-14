# varvol2 read-only diagnostic investigation

No separation source or existing audio/report file was modified. Diagnostic replay uses saved decisions, not reference samples. New files are confined to this diagnostic folder.

## Templates and assignments

Event numbers below are one-based. Each cell gives fitted gain and lag in frames; a dash means no assignment. Templates after pass 1 are residual observations, not original isolated sounds.

| Component | Template event | Event 1 | Event 2 | Event 3 | Event 4 | Event 5 | Event 6 | Event 7 | Event 8 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 2.599866 / -465 | 4.658847 / +26 | 5.874899 / -12 | 3.882561 / -50 | 1.000000 / +0 | 3.427669 / -38 | 4.659504 / +12 | — |
| 2 | 4 | — | 5.450583 / +76 | — | 1.000000 / +0 | — | 3.970875 / +12 | — | 7.609910 / +24 |
| 3 | 7 | — | — | 1.260842 / -24 | — | — | — | 1.000000 / +0 | — |
| 4 | 6 | — | 1.376843 / +64 | — | — | — | 1.000000 / +0 | — | — |

The selected candidate explains these fractions of the current event residuals (membership gate 0.65):

| Component | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.997996 | 0.927503 | 0.998963 | 0.997217 | 1.000000 | 0.928944 | 0.998967 | 0.299981 |
| 2 | 0.200869 | 0.736651 | 0.368478 | 1.000000 | 0.000000 | 0.737877 | 0.369747 | 0.700019 |
| 3 | 0.498981 | 0.001206 | 0.996567 | 0.000000 | 0.000000 | 0.037502 | 1.000000 | 0.000192 |
| 4 | 0.040507 | 0.999527 | 0.000000 | 0.000000 | 0.000000 | 1.000000 | 0.000000 | 0.000016 |

## Confirmed findings

1. **Eighth-event exclusion:** Component 1 uses original event 5, the lowest-energy candidate among candidates with seven supporting events. Its fit to event 8 has lag -26, gain 0.810883705 and explained fraction 0.299981091. The 65% whole-event gate rejects it despite a nonzero fitted contribution. This is not a missing-template or reconstruction-index bug. Later Component 2 explains about 70.0% of event 8; approximately 30.0% remains there. Identifying that remainder as the quiet kick follows the user's listening, not an isolated-reference comparison. Relative mixture composition is the supported explanation; no independent source amplitude ground truth was used.

2. **Hard endings:** The Component 1 template spans 16,194 frames (367.21 ms), ending at a nonzero value. Reconstruction zero-pads after its observed support, with no taper or tail extension. Left-channel endings abruptly drop by 0.0131–0.0770 across the seven assignments. For example at frame 59,829 (1.356667 s), the component goes from 0.0770441 to zero, versus an input step of only -0.000249207. At frame 81,879 (1.856667 s), its left-channel slope before the cut is -0.000162616 per frame, the cut step is -0.0509163, and slope after is zero. Original slopes are about -0.000163/-0.000167, with no comparable discontinuity. Stereo values, slopes and every observed segment boundary are in analysis.json and internal_boundaries.json. Starts generally copy leading zeros; the measured major discontinuities are endings and inherited internal tail starts.

3. **Component 2 blip origin:** Its template is event 4 AFTER subtracting Component 1. At frame 81,879, Component 1 ends, leaving the original tail in the residual: Component 2's template jumps from 0.000000902 to 0.050752636 in the left channel. The original has a smooth step of -0.000164606 there. Thus the tail samples existed in the input, but their isolated abrupt reappearance was created by truncated subtraction. The contaminated residual becomes the selected template; reconstruction scales and copies it. The corresponding jumps are approximately +0.276627 at 0.856667 s and +0.201529 at 2.856667 s. Every component export exactly equals float32 rounding of replayed reconstruction: export did not invent these blips. The late blip is NOT copied into event 8: that shorter observation ends at frame 170,017, before the mapped blip onset at 170,079. Any different audible blip there needs separate localization; it cannot be attributed to that same late tail.

4. **Division between Components 2 and 4:** The greedy algorithm fits an entire residual template with one gain, including its early sound AND the late tail. These structures need not scale together across observations. Event 4's residual template wins on lowest energy among four-member candidates. It explains only 73.6651% and 73.7877% of the residual energy at events 2 and 6, respectively. Later, those leftover observations strongly match each other; event 6 becomes Component 4's template and is copied to events 2 and 6. This confirms splitting of recurring residual structure, without proving its source identity. Component 4 has substantial early-event signal plus an inverted late tail: at 2.856667 s it jumps about -0.156723, partly cancelling the excessive positive tail in Component 2. A source-level claim that all its early signal is clap material remains based on listening. No joint multi-template fit or independent source model exists in the algorithm.

5. **Component 3 pop:** Its template is the event 7 residual. Assignments are events 3 and 7. Before the Component 1 cutoff, that residual is almost zero; after the cutoff it contains the unremoved input tail. It jumps approximately +0.076795 at 1.356667 s and +0.060908 at 3.356667 s (left channel). These measurements support a tail-fragment artifact rather than evidence of another source. Two placements are present even if listening suggests a single isolated pop.

## Isolated Component 2 self-separation

Only the original exported component_02.wav enters the unchanged algorithm; a file-reader adapter accepts its float32 format. Defaults remain unchanged. The original mixture, references and assignments are not supplied to this test. It detects SEVEN events: four early groups at approximately 0.489, 1.491, 2.490 and 3.490 s, and three late groups at 0.846, 1.846 and 2.846 s (window times include leading context).

- Self component 1 reconstructs the four early groups.
- Self component 2 extracts additional recurring early-group residuals.
- Self component 3 reconstructs the three late blip/tail groups.
- Self component 4 extracts further small early-group residuals.

The algorithm therefore detects the early sound and late blips as distinct temporally separated recurring structures, but does not label instruments or prove the early sound is pure. The run reaches the existing four-pass limit. Residual energy is approximately 0.0264662% of Component 2 input energy. All self-test exports are separate float32 WAVs, including residual and baseline, under component2-self-separation/. No outputs are normalized or clipped. See its original-format report.json for complete membership decisions.

## Reconstruction and preservation

For the ORIGINAL separation, every exported component equals the float32-rounded saved-decision replay exactly. Components 1–4 plus residual reconstruct varvol2.aif with maximum absolute error 6.0455932e-8 and RMS error 6.5210226e-9, passing 1e-6 absolute tolerance. Not bit-identical due to float32 rounding. This validates conservation, not source quality: opposing artifacts in different components can cancel in the sum.

All algorithm/input/original-run files hashed before the investigation match afterward (preservation_verified.json). No rerun or overwrite of the original experiment occurred. New diagnostic JSON/replay code and self-test outputs are the only additions. No production code, thresholds or separation logic were changed. Human listening remains necessary for the isolated self-test outputs.
