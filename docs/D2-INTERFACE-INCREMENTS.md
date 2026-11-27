# D2 interface increments

Starts at physically tested checkpoint `007a27f`. Local checkpoints only; unrelated
research and personal data are excluded. Audio/DSP and BPM algorithms are unchanged.

## 1. Settings and orientation

- `tunetox.html`: visible/document name D2; internal entry path retained.
- `app/behavior/settings.js`: validates version-1 device-local theme/color/orientation
  preferences; owns Settings actions. Storage denial/invalid data retains defaults.
- `app/visual/settings.js`: nonmodal Settings panel/button and orientation select.
- `app/visual/themes/theme-manager.js`: appearance presentation only; event handling
  and preference decisions now live in Behavior.
- `app/visual/mixer/application.js`: connects Settings instead of theme actions.
- `app/visual/library/library-import-view.js`: keeps global Import/Analyze All in header.
- `app/visual/waveform/scrolling-waveform.js`: rotates canvas drawing coordinates
  within the same box; reuses visible 5-ms groups, colors and four-second window.
- `app/visual/waveform/scrolling-cue-markers.js`: same canonical cues on the time axis.
- `app/behavior/mixer/waveform-seeking.js`: chooses horizontal/vertical drag axis;
  orientation changes cancel a pending seek. Same existing seek action/preview.
- `app/visual/mixer/playback.js`: redraws on orientation changes; no clock added.
- `app/visual/mixer/playback.css`: stationary horizontal playhead in Vertical,
  translucent nudge controls with unchanged hit areas, Settings presentation.
- `tests/orientation-tests.*`: isolated settings/storage, four decks, geometry,
  cue placement, mouse/touch seeking, persistence and playback continuity.
  Existing canvas test doubles support the standard save/transform/restore API.

Data flow: Settings gestures -> Behavior preferences -> Visual attributes/rendering;
waveform pointer axis -> existing Behavior seek -> Audio position -> both waveforms.
Vertical future positions are below center, so forward playback moves upward;
upward dragging advances. Overview geometry is unchanged. Preferences are local to
this browser/origin, not cross-device. No expanded/shared waveform is introduced.

Increment 1 verification: orientation, nudging and full Visual playback suites pass
in Chromium; editor diagnostics clean. Early fixture/startup failures were fixed
before checkpoint. Saved settings are isolated in playback fixtures. Glass theme
fixture uses the new presentation API explicitly. Physical Safari remains due.
