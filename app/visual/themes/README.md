# TuneTox visual themes

Theme styles belong in this folder, separate from mixer layout and behavior.
Copy a theme folder to create a new reskin, then add its name and stylesheet
to the registry in `theme-manager.js`. Do not edit audio or behavior modules.

A theme should style existing semantic selectors (for example `.deck`,
`input[type="range"]`) and use `var(--accent)` for the deck color.
Colors are assigned per deck by the theme manager. Theme files should not
change input ranges, event handlers, audio gain, or transport behavior.

The Default theme is the existing `app/visual/mixer/playback.css`.
Plasma is an initial, deliberately modest reskin. Advanced plasma slider
effects are a later visual task.

The "Control colors (future)" mode currently uses per-deck colors until
per-control color roles are implemented.
