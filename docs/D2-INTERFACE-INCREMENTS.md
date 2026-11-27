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

## 2. Destination navigation and performance input

- `app/behavior/mixer/deck-navigation.js`: owns one deck's workspace and retained
  upper/lower choices. Successful loaded outcomes return only that deck to its prior
  performance sections; queued/rejected outcomes do not change workspace.
- `app/visual/mixer/playback.js`: renders navigation getters and binds direct Behavior
  actions; exposes the successful-load notification, no competing selection store.
- `app/visual/mixer/application.js`: forwards coordinator's existing `loaded` result
  to that destination view; no alternative load pathway.
- `app/behavior/mixer/cue-controls.js`: extracted cue/Shift gestures, held/latched/
  keyboard modifier state and existing cue action. No cue-position copy.
- `app/visual/themes/glass-hardware/cue-preview.js`: now presentation only in its
  existing path. Stable Shift text avoids removing a native press target mid-gesture.
- `app/behavior/mixer/performance-input.js`: existing touch fallback moved from Visual,
  plus nonediting selection/context-menu suppression. Text fields keep native editing.
- `app/visual/mixer/playback.css`: performance selection/callout protection with text
  input exceptions. Library import/export and audio processing are unchanged.

Shift remains one deck-local modifier; its current secondary action is cue clearing.
No future secondary controls are implemented. Source position, cues, queues and
musical settings are not owned by navigation or input helpers.

Increment 2 verification: Library interface (including destination-only restoration
and queued-view retention), Glass and full Visual playback suites pass. Native
Chromium mouse/touch Shift toggles pass at center and four corners in all themes.
Focused navigation and editable-field/context-menu checks pass. Editor diagnostics
clean. Tests reopening Links after successful loads were updated for the approved
new close-on-load rule. Uniform Default colors now apply without requiring a prior
color edit. Physical Safari selection/callout and modifier review remains due.
