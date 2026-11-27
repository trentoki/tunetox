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

## 3. Library relationship drops and strip appearance

`app/behavior/library/library-controls.js` delegates relationship drops from its
existing results list, including cross-deck origins. The existing song drag payload
carries only canonical identity. Existing setSongLink/setPlaylistMembership validate
identities and write unique relationships; membership additions never remove other
memberships. Self-links are rejected. Existing numbered/overview/Queue drop paths
are unchanged. No independent relationship store is added.

`app/visual/library/library.css`, mixer playback CSS and both theme stylesheets now
use aria-pressed for every strip option; first-child styling no longer competes with
the selected option. Existing Behavior sorting/ascending/descending/sliding code is
unchanged. Library integration tests cover cross-library links/memberships,
duplicate/self protection and selected/unselected styling in every theme.

Increment 3 verification: the expanded Library interface suite passes, including
existing deck/Queue destinations and ascending/descending/sliding behavior. Native
mouse dragstart and cross-Library song/playlist drops pass. Existing membership was
accounted for in fixture selection, so repeat-drop checks measure an actual addition.
Editor diagnostics clean. iPad Safari drag initiation remains a physical check;
Manage checkboxes remain the supported alternative when native dragging is limited.

## 4. Manage song rows and sticky sections

- `app/visual/library/song-row.js`: shared title/artist/BPM/key row presentation,
  reused by ordinary Library and Manage; no selection/actions or song cache.
- `app/visual/library/library-view.js`: uses that row presentation; existing Behavior
  selection/navigation/loading bindings remain unchanged.
- `app/visual/library/song-management-view.js`: uses the same rows with link checkbox,
  no Manage buttons; nests supplied depth rows into presentation sections. All Songs
  and playlist headings stick within their own section. Child headings temporarily
  cover parent headings, which return for direct parent contents after the child.
- `app/visual/library/library.css`: common row spacing/type/dividers and opaque,
  interactive sticky headings. The body remains the only Manage scroller; fixed Back
  remains outside it. No scroll handlers or extra navigation state are introduced.

Behavior still owns expansion sets, search and canonical relationship actions.
Checkboxes and disclosure buttons remain separate; multiple branches stay open.

Increment 4 verification: expanded Library UI and Library analysis/architecture
suites pass. Native sticky All Songs/child/parent/next heading checks pass in three
viewports × three themes, including interactive collapse. Phone screenshot reviewed.
Regression checks confirm shared spacing/type/dividers, sticky All Songs collapse,
no nested Manage buttons, and fixed Back/context restoration. Editor diagnostics clean.
