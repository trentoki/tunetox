# D2 global waveform zoom and tablet orientation

Starts from physically tested checkpoint `89f19eb`. The vertical experiment is
provisionally approved; this refinement does not change waveform amplitude or DSP.

## Behavior and data flow

One Behavior-owned `waveformWindowSeconds` is the visible source duration for every
deck. Default 4 seconds; allowed 1–8 in exact 0.5-second steps. Zoom in reduces the
duration; zoom out increases it. The top strip displays seconds outside Settings.
The renderer, cue placement and relative seeking read the same public getter.
Draw caches retain their last input only to detect redraws, never a second setting.

Settings version 1 gains an optional duration field. Old saved preferences keep
their appearance/orientation and default to 4 seconds. Invalid values fall back to
4; denied storage does not disable performance. Preferences stay local to this
browser/origin. Library data and Audio analysis are not changed or migrated.

The existing tablet portrait layout (601–1100 CSS pixels, portrait) always presents
horizontal scrolling waveforms. It retains the saved Horizontal/Vertical choice
and restores it in landscape. Phone widths retain that choice. Responsive layout
is used rather than user-agent detection, consistent with D2 portrait stems.

Zoom or orientation changes cancel an uncommitted seek preview. They never call an
Audio transport action, change a source position or integrate another clock.
Committed seeks retain existing coordinator rules. Playback draws from Audio time.
The stationary playhead, four persistent decks and horizontal overview remain.
The full available duration is centered even near the start/end, with blank space
outside the song, matching existing seek bounds.

## Changed production files and responsibilities

| File | Responsibility and connections |
| --- | --- |
| `app/behavior/settings.js` | Canonical duration/preferred orientation, validation, persistence, zoom button actions and effective tablet orientation. Supplies getters/events to existing views and seeking. No Audio calls. |
| `app/visual/settings.js` | Settings and compact top-strip zoom presentation. Receives values and exposes buttons; owns no zoom or orientation decisions. |
| `app/visual/mixer/playback.css` | Compact global control styling; no deck control changes. Tablet/desktop header height remains unchanged. Phone controls omit the long visual label while retaining the accessible group name, duration and buttons, keeping the normal header height. Very narrow screens may wrap. |
| `app/visual/waveform/scrolling-waveform.js` | Draws visible groups using the shared duration; includes duration in redraw cache. No analysis/transport changes. |
| `app/visual/waveform/scrolling-cue-markers.js` | Positions the same canonical cues using the shared duration and effective axis. |
| `app/behavior/mixer/waveform-seeking.js` | Uses shared duration/effective axis for direct dragging; cancels previews on scale/axis changes. Coordinate names now describe both axes. |
| `app/visual/mixer/playback.js` | Redraws on zoom notifications; removes fixed-duration argument/import. |

No new production files, intermediate layers, song stores, playback states or
analysis arrays. Audio, cues, Queue, overview and BPM algorithms are unchanged.
Existing phone gesture/Pitch-preview ownership concerns recorded in the D2 report
remain outside this focused change. Audio readability restructuring stays deferred.

## Verification

`tests/waveform-zoom-tests.html` / `.js` use disposable storage and generated tones:
minimum/default/maximum drawing counts and scale, cue placement, mouse/touch seeks,
four-deck playback through rotation, source/worklet identity retention, local
preference reload/validation, and old-settings compatibility. Existing scrolling
alignment assertions now handle both orientations and the displayed source window;
CSS percentage comparisons account for browser serialization precision.

Physical iPad checks remain necessary: top-strip accessibility, waveform detail
and cue legibility at each zoom, touch feel during rotation, and listening during
performance. Chromium checks do not establish Safari sound quality or smoothness.

## Completed native/layout checks

- Exact deck, scrolling-box and overview geometry matches `89f19eb` at 1114×768,
  768×1024, 820×1180, 1024×1366 and 390×844 in all three themes (15 combinations).
- Native touch Zoom in/out reaches 1 and 8 seconds with the intended half-second
  steps. Phone controls remain visible without horizontal overflow; Settings keeps
  its original font/height with narrower horizontal padding. Screenshots reviewed.
- Native touch and mouse seeking uses the correct 1/4/8-second scale in landscape
  Vertical and tablet portrait Horizontal across all three themes; peer playback
  remains active. These are Chromium checks, not physical Safari certification.

All changed production files were reviewed for ownership and reading order.
Preference restoration, view application, persistence and actions stay together in
Behavior Settings. Visual builds/updates controls and draws supplied/canonical
presentation data. Seeking coordinates describe either axis. No Audio file changed;
the manually added 0.25–3 playback-rate comments remain untouched.

## Final regression result

All ten browser suites passed in one final run: waveform zoom, orientation, iPhone
layout, nudging, Library interface, Library storage, Library analysis, Queue,
Visual playback and Glass Hardware. Zoom tests include stale-drag cancellation,
minimum/default/maximum bounds, three-theme four-deck rotation, old-preference
compatibility and invalid-value recovery. Existing waveform-alignment assertions
were updated for shared zoom/orientation; a comparison tolerance accommodates
browser-rounded overview CSS percentages rather than treating display serialization
as exact source data. No unresolved automated failures remain.

Editor diagnostics and whitespace checks passed. HTTP/HTTPS preview servers remain
running independently of the agent, and both responded successfully. The checkpoint
is local only; physical iPad review is the next step. No Audio, personal music,
certificate, export or unrelated research file is included.
