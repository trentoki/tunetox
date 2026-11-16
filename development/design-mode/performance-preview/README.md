# H5 — phone navigation, Transition and Wave interaction review

**Open:** http://192.168.50.24:8765/development/design-mode/performance-preview/?build=h5

Header: **H5 · NO AUDIO**. H4 received very positive user-reported physical feedback;
H5 is a new, separate review build. All songs, playback, gains, matching, scheduling,
queue and effects here are simulated. No production engine, audio storage, media,
authentication, external playlist service or source-separation code is used.

## What changed

- **Phone navigation:** tap a colored D1–D4 button to select a deck. Move downward
  more than 12px while holding to open Wave/Cue/Controls/Transition choices. Drag
  highlights a choice; release commits it. Small movements do not change the view.
  Tap the current-view badge beside the song title for the accessible button-based
  alternative. Arrow Down on a deck button also opens the choices; menu arrows and
  Escape work. The popup disappears after selection/cancellation.
- **Position:** small tracks inside the four phone deck buttons and tablet D-labels
  follow the current song, including hidden decks. They pause with playback and
  are subdued when empty. Queued songs do not replace the current position.
- **Phone stems:** four short vertical faders replace the four horizontal rows.
  Visual handle diameter is 24px; transparent native thumb target is 44px and the
  full track responds immediately. Pointer capture retains ownership outside a
  handle; neighboring faders are not swept into a gesture. Hit regions remain
  bounded by their own rows/columns. Tablets retain horizontal faders and H4's
  fixed stem section dimensions. At the compact 36px tablet row minimum, the row
  bounds the vertical target rather than overlapping adjacent rows.
- **Main / queue:** independent Play stays left; a separate queue button occupies
  the former Main space. Empty is clearly inert; ready shows Swap/title, with artist
  in the accessible name and tooltip. Tap deliberately swaps, starts at zero,
  inherits stem levels and consumes the queue. H4's occupied-slot protection and
  load-to-Wave behavior remain. Main is available in Controls and Transition.
- **Transition:** primary deck plus one of three one-tap partners. Both use the
  same existing deck Main/EQ/FX values. Partner choice persists. Phone has two
  side-by-side strips with vertical Main, High/Mid/Low and one FX amount/assignment
  per deck; normal Controls retains all three FX. Tablet Transition is reached
  from Controls, preserving the existing three-position horizontal selector.
  The Transition badge/Controls return offer navigation back.
- **Library:** Title/BPM/Key/Artist now uses the same captured horizontal slide
  implementation as Songs/Playlists/Links, generalized to four positions. Playlist
  name sorting remains contextual; linked songs use song metadata sorting. Direction,
  independent search/navigation, Manage links/memberships, row dimensions and load
  targets remain. Selected rows retain their background, with the accent line
  removed. Settings and Back are inline SVG using currentColor, not font/emoji icons.

## Wave simulation

Upper ± controls are separate from the lower, captured-pointer scrub surface.
The lower waveform supports a **relative 12-second scrub window** per full-width
finger drag, in either BeatMatch state; arrows offer ±1 second keyboard movement.
This is illustrative position control, not an analyzed/audio waveform or live seek.

With BeatMatch **ON**, choose 1/2/4/8 beats (default 1). A press records the next
strictly later preview beat boundary. The deterministic clock waits for that boundary,
computes its then-current position, adds/subtracts the chosen integer beat duration,
and retains any remaining elapsed time after execution. Tempo and the preview beat
clock phase remain unchanged. Pending status is visible. Other playing decks advance
normally; paused decks do not. Rendering is a 33ms UI timer, not an audio scheduling
or Safari latency guarantee. No real beat grid is detected: the preview assumes a
uniform grid at the displayed tempo.

With BeatMatch **OFF**, holding ± applies a labeled ±5% temporary preview rate;
release/cancel/blur restores the normal rate without altering the Tempo value.
±5% is an explicitly provisional demonstration amount, not a production rule.
Scrubbing cancels a stale pending jump; switching BeatMatch or replacing/swapping
songs clears transient actions. Another skip press before execution replaces that
pending request. A paused request waits for playback. These prototype policies do
not authorize production quantization, seek or mixing behavior. Natural preview end
retains H4's stop/reset behavior.

## Dimensions and compromises

H4 tablet presets and landscape four columns / portrait 2×2 are retained. Phone is
still one selected deck with four persistent objects. Its separate in-memory preset
starts with a 440px target center, 152px vertical stem section and 44px hit width.
Actual center height adapts to the visible viewport. Design tools independently
adjust phone, tablet portrait and landscape, including new deck-button/view-menu
height controls. Reset affects only the active preset. Safe-area and visible-viewport
handling are reused; browser chrome need not be absent. No preference persistence
or offline shell was added.

The tested side-by-side Transition layout keeps 44px knobs with substantially less
scrolling than the stacked comparison. See [measured comparison](review/transition-comparison.json).
The stacked arrangement was exercised by a test-only presentation attribute, not
introduced as another product setting. Short phones require scrolling within Cue,
Controls or Transition; the page, overview, queue and stems remain fixed. At 320×568
Wave has limited vertical room once adaptive controls and stems are included. Titles
truncate; touch comfort on physical Safari remains for review. Effects assignment
menus and Library lists retain their independent scrolling.

## Evidence and opening comparison builds

- H5: **140 state checks** (77 inherited H4 + 63 H5), **106 served-browser checks**.
- Browser sizes: 1194×834, 1024×768, 834×1194, 768×1024, 390×844, 390×724,
  375×667 and 320×568. The reduced-height phone models visible browser-chrome space;
  this is not a claim of physical Safari verification or every safe-area combination.
- Real CDP touch dispatch checks downward navigation, release-to-commit, fader
  capture and Library sliding sorting. Pointer/gesture tests exercise independent
  Main and partner EQ; deterministic clock tests check boundary timing, no premature
  jumps, release-restored nudge and scrubbing in both states.
- Tests instrument AudioContext/IndexedDB constructors and capture script errors.
  No audio/storage/production initialization occurred. Production audio regressions
  were not rerun; unchanged G2 sources/archive are verified separately by hashes.

[Verification](review/verification.json) · [viewport measurements](review/measurements.json) ·
[pre-task preservation hashes](review/baseline-sha256.json)

[Phone Wave](review/h5-phone.png) · [Short phone Wave](review/h5-phone-small.png) ·
[Transition](review/h5-transition-phone.png) · [Short phone Transition](review/h5-transition-small.png) ·
[Queue ready](review/h5-queue-phone.png) · [Library Manage](review/h5-library-phone.png) ·
[iPad landscape](review/h5-ipad-landscape.png) · [iPad portrait](review/h5-ipad-portrait.png)

Prior Design Mode paths remain unchanged: H4 `../responsive/`, H3 `../fixed/`,
H2 `../flexible/`, H1 `../compact/`. G2 remains on the existing playable server.

Implementation is confined to this directory: `state.js` (pure preview actions),
`wave.js`, `navigation.js`, `touch-fader.js`, `transition.js`, `icons.js`, plus the
H4-derived host/deck/library/selector/design-tools modules, entry page and scoped CSS.
Frozen H3/H4 factories and shared controls remain imports. No dependencies added.
Fictional/search metadata is rendered through DOM text, with no external service calls.

Run state checks:
`osascript -l JavaScript development/design-mode/performance-preview/run-tests.js`.
`browser-check.py` targets the actual LAN page using an isolated Chrome CDP session
on port 9230. Its deterministic-clock flag exists only when injected by tests; the
normal preview runs its own simulated clock. Native scheduling is never constructed.

## Physical review checklist

1. Tap different decks; then hold/drag down from a colored deck button, reverse
   direction and release on each view. Try the tap-based view badge as well.
2. Move each vertical stem from its track and handle, drifting slightly sideways.
   Confirm neighboring stems stay unchanged and position indicators keep moving.
3. Open Transition, change partner/Main/EQ/FX, leave and return. Check both decks'
   values and compare scroll comfort on the shortest phone.
4. In Wave, hold ± with BeatMatch off; release. Turn BeatMatch on, choose a beat
   distance and watch Pending execute. Drag the lower waveform in both modes.
5. Load a different song while playing: current song stays visible, queue becomes
   ready, and Wave is selected. Tap Swap once; check incoming playback and stems.
6. Try Library slide sorting, direction, selection, SVG Manage/Back and memberships.
   Rotate iPad and revisit phone settings; confirm preset and deck state survive.

Stop at physical-device review. Do not integrate H5 into G2 without approval.

Preserved regressions all passed: H4 77 state/106 browser; H3 38 state/74 browser;
H2 44 inherited + 21 state/62 browser; H1 41 state/70 browser; original Design Mode
77 state/1084 browser. Their generated review captures were redirected to `/tmp`.
All **153 pre-task files** and **190 G2 protected files plus its archive** match
preservation hashes (the three evolving root documents are excluded from the
historical G2 manifest comparison). Root `RULES.md` and `TUNEFLOW_DESIGN.md` received
only the new H5 experiment record; unrelated existing workspace changes remain.
