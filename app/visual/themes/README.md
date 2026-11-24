# TuneTox visual themes

Theme styles belong in this folder, separate from mixer layout and behavior.
Copy a theme folder to create a new reskin, then add its name and stylesheet
to the registry in `theme-manager.js`. Do not edit audio or behavior modules.

A theme should style existing semantic selectors (for example `.deck`,
`input[type="range"]`) and use `var(--accent)` for the deck color.
Colors are assigned per deck by the theme manager. Theme files should not
change input ranges, event handlers, audio gain, or transport behavior.

The Default theme is the existing `app/visual/mixer/playback.css`.
The obsolete Plasma theme has been removed from the active theme registry.

Glass Hardware is an experimental reskin with recessed glass waveform windows,
machined knob rims and single native metallic slider caps. Select **Glass Hardware**
in the application's **Visual theme** menu; existing deck colors and One color
mode also apply. Its [stylesheet](glass-hardware/theme.css) changes presentation
only and is removed when another theme is selected. Default styling remains
unchanged. No theme preference is saved across page reloads.

Cue pads now use real Behavior-owned song positions in **all three themes**.
The existing [cue presentation module](glass-hardware/cue-preview.js) retains its
historical filename but contains no simulated assignments or second cue store.
Load a song, press an empty pad to save its current position, or an assigned pad
to recall it without changing playing/paused intent. Hold the existing Shift button
(or keyboard Shift) to clear, or click Shift to latch clearing mode. Numbered
passive overview markers follow the same positions. Song replacement/Eject resets
cues; theme/view changes do not. The old unloaded-pad preview is superseded.
Run [focused visual checks](../../../tests/glass-hardware-tests.html) and
[real playback checks](../../../tests/visual-playback-tests.html) through the server.

The [Sprint 3 source snapshot](../../../docs/visual-verification/Glass-Hardware-Sprint-3-reference.zip)
preserves the previous stylesheet, loaded-song cue preview, Visual host, theme
manager, Default/Plasma styles and focused test page. It is a frozen archive,
not a second development application. Extract into a separate scratch folder
and serve its root to run `tests/glass-hardware-tests.html` without audio.

Stem inputs now edit permanent `deck.stemLevels` through Behavior's `setStemLevel`
in 1% steps, independently of themes. Their audio and Handoff remain disconnected.
Glass Hardware derives track illumination from those rendered values and Main's
existing percentage. Decorative Filter/EQ/Effects knobs remain disabled: their
permanent ranges and update actions have not been defined in the current host.

Historical verification before functional cues (2026-11-23): Chromium focused checks passed for assignment without
audio, Shift clearing, independent decks/stems, validation and programmatic value
rendering. Native mouse dragging and Chromium-emulated touch dragging/tapping
were exercised, including reversal. The full playback/touch browser suite passed
(Load/Play/Pause, queue, Main, Tempo, seeking and error recovery). Four-deck layouts
were checked at 1114×768 and 768×1024; track fill was visually checked at 0/25/50/100%.
Safari, physical iPad interaction and listening quality have not been verified.

The "Control colors (future)" mode currently uses per-deck colors until
per-control color roles are implemented.

## Futuristic experiment

Select **Futuristic** for crystal-framed surfaces, system monospace typography,
lit fader tracks and raised translucent rubber pads. Its independent
[stylesheet](futuristic/theme.css) does not import or change Glass Hardware CSS.
Futuristic uses the same Behavior cue positions and Shift presentation as Default
and Glass Hardware; its pad materials and illumination are unchanged.

In Futuristic only, Tempo's existing native range has a vertical pointer gesture:
drag anywhere upward to increase, downward to decrease. Pointer capture permits
movement outside the roller. Pressing alone never changes the value. Full travel
is 360 vertical pixels (180 per octave); `rollerTravelPixels` in the existing
[Visual component](../mixer/playback.js) is the sensitivity adjustment. The native
range still provides keyboard arrows/Home/End and sends its existing input action
to Behavior. Its pointer hit testing is disabled only in Futuristic, preventing
the native horizontal touch jump. Pinch remains available; one-finger page panning
over a roller is disabled. Theme changes, pointer cancellation and busy controls
end capture. Default and Glass Hardware retain native horizontal Tempo interaction.

**Pitch demo** is deliberately Visual-only: 0–100% travel, initially 50%, retained
per deck for the page lifetime. It is not semitones, a pitch ratio, or musical state.
It never calls a Behavior or Audio pitch action. Default and Glass Hardware restore
their original disabled Pitch control and +0.0 display. A permanent pitch range and
Behavior interface still need approval before actual pitch can be connected.

Futuristic refinement: roller markings travel upward as values increase; compact
label-adjacent readouts retain the existing ratio/percentage precision. The
full-song overview has a noninteractive glass cover. Stems, knobs, cue preview,
and Glass Hardware are unchanged by this refinement. Future design idea only:
Echo/Reverb/Delay may eventually resemble vertical wheels; no interaction or
musical behavior is approved or implemented for that idea.

For real iPad song loading, see [local HTTPS setup](../../../docs/LOCAL_HTTPS.md).
