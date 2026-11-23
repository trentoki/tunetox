# H5.3.1 Clean Playback checkpoint

The new application entry point is [tunetox.html](../tunetox.html). Serve the repository over HTTP; ES module imports are not reliable from a double-clicked file URL.

## Open and test

With Node available, run:

```sh
node tests/serve-visual-playback.cjs
```

Open http://127.0.0.1:8080/tunetox.html. The server listens on 0.0.0.0:8080 and accepts loopback/private IPv4 clients for local-network testing.

On the current Mac, the installed Code runtime can also run this dependency-free server:

```sh
ELECTRON_RUN_AS_NODE=1 '/Applications/Visual Studio Code.app/Contents/MacOS/Code' tests/serve-visual-playback.cjs
```

Use **Load D1–D4** in the global header to select local audio. Load does not start playback. Press a deck's triangle to Play; press its pause symbol to Pause and retain position. All four decks start in Performance with **Wave + Cues**.

All four **Main Volume** faders start at **0%**: Play advances the song silently until you raise that deck's Main. The existing fader displays its actual requested percentage in 1% steps. Each deck retains its Main across pause/resume, loading, queue swaps, and view changes. Volume changes do not start playback or affect other decks.

Each deck has two independent toggle buttons in the original compact header selector slot: **Wave ↔ Stems** and **Cues ↔ Controls**. Each button shows its current view. No extra selector rows occupy the content sections. Stems contains the four disabled stem faders; Controls contains only filter, EQ and effects. Changing either selection leaves the other section and other decks unchanged. Library and its back arrow preserve both selections and playback.

Loading while a deck is playing prepares its queue. The READY button invokes the existing Clean Deck Play Queue action. A further load replaces that queue, as in the preserved prototype.

## Files and responsibilities

- [application.js](../app/visual/mixer/application.js): Visual startup creates four persistent Clean Deck states, mounts the interface, handles file selection, presents playback notifications, and refreshes playback-time displays. It supplies loaded/queued URL references to Audio for cleanup. Legacy application files are preserved under legacy-reference, outside the active dependency tree.
- [playback.js](../app/visual/mixer/playback.js): creates the shared visual component with approved names, view switching, and state rendering.
- [playback.css](../app/visual/mixer/playback.css): H5.3.1 section arrangement, deck accents, and shared landscape/portrait styling.
- [deck.js](../app/behavior/mixer/deck.js): load/queue/playback behavior, the loaded-song-list helper, and createPlaybackCoordinator for one deck's guarded actions and ended/error handling. The coordinator was consolidated here without changing its operation or notification order. Presentation callbacks keep rendering and status messages in Visual; Audio manages file URLs. The Clean Deck prototype continues using the existing direct actions without adopting the guarded API. No separate Integration layer or duplicate deck state is introduced.
- [deck-audio.js](../app/audio/deck-audio.js): native media transport, one shared Web Audio context, and one media-source/Main GainNode path per deck, plus temporary audio URL management. Playback resumes the context and starts the existing media element from the initiating gesture. Only URLs absent from every loaded and queued song are released. Original files are never modified.

The older [index.html](../legacy-reference/index.html), [clean-deck.html](../legacy-reference/development/clean-deck.html), and their legacy interface files are preserved under [legacy-reference](../legacy-reference/). Clean Deck shares the active Behavior and Audio modules via adjusted imports, without copies. Guide/reference materials remain in their existing documentation locations.

## Scope and limitations

Touch policy (revised after the CSS-only fix failed on a physical iPad): device-width and initial-scale=1 are retained, with viewport-fit=contain. No maximum-scale or user-scalable restriction is imposed. Actual computed Chromium styles are manipulation for controls/waveforms/Library and pan-y pinch-zoom for native ranges. These desktop measurements cannot establish the iPad's computed values.

WebKit documented an iOS bug where manipulation failed to suppress double-tap zoom, corrected in [317443@main](https://commits.webkit.org/317443@main). This is a plausible explanation for the reported failure, not identification of the iPad's Safari version or proof of its installed fix status. The earlier CSS-only claim was insufficient.

[touch-guards.js](../app/visual/mixer/touch-guards.js) now installs a presentation-only fallback from the host. It recognizes two stationary single-finger taps within 350ms and 24 CSS pixels; each tap must last at most 300ms and move at most 10 pixels. Only the second touchend is cancelled. A button's suppressed click is forwarded once, with a narrow duplicate compatibility-click guard. The next real touch clears that duplicate guard. Ordinary first taps, drags, scrolls, long presses, cancelled touches and multi-touch are not cancelled. No synthetic range changes, audio changes, touchmove blocking or blanket gesture blocking are added.

The application shell uses the available dynamic viewport height and bounded width, with a 100vh fallback. Decks divide that space using the existing four-column / two-by-two arrangement; fixed deck minimum heights no longer force the page beyond the screen. Compact performance headers and control ordering stay unchanged. Short windows scroll within performance content; Library keeps its own scrolling. Outer horizontal overflow is prevented without scaling the interface.

Synthetic gesture tests cover single/double/triple taps, duplicate click prevention, blank areas, nearby different controls, stationary range taps, drags, pinch, scroll reset, long presses and distant taps. They test event-routing logic, not Safari's native zoom recognizer. Chromium checks at 1114×685, 768×1031, 1024×600, 600×450 and 390×700 found no outer horizontal overflow and retained Library scrolling. Playback regression checks passed.

Physical iPad Safari verification remains required: reload the application, repeatedly tap controls and blank regions, check each tap activates exactly once, use Load and Play/Pause, drag faders when enabled, scroll Library and short-window content, rotate, test split view and Safari toolbar changes, and confirm deliberate pinch zoom remains available. No claim is made that the fallback has passed these physical-device checks.

This checkpoint connects Load, Play, Pause, and the existing queue action. Workspace and performance-view navigation work without replacing players. Current time is read from the actual media player.

Waveforms are deterministic illustrations, not analysis of loaded audio. Tempo, pitch, participation, EQ, effects, stems, cues, loops, and library manipulation remain disabled visual previews. Main Volume is connected; no persistence, analysis, matching, or Handoff has been added.

Behavior stores mainVolume in 0–1 units, initially zero, and rejects non-finite/out-of-range values before changing state or audio. Audio applies a 15 ms linear gain ramp; rapid changes retarget from the modeled current ramp value and Main zero reaches exact silence. UI percentages represent requested gain; the short ramp is not displayed as a separate setting. Native media volume stays at unity; per-deck GainNodes provide attenuation without relying on iOS media-element volume. The four stem faders still show 100% as inactive previews. Visible stem labels retain H5.3.1 wording; approved data-stem attributes do not redefine audio categories.

The legacy Clean Deck prototype shares these modules and therefore now also starts silent at Main zero. Its preserved interface has no Main fader; use the active application for audible Main Volume testing. Its transport/queue actions remain available. No legacy code was altered to add controls.

Safari listening procedure: reload tunetox.html; confirm all four Main values are 0%. Load a familiar song and press Play: time should advance silently. Slowly raise Main through 25%, 50%, and 100%; listen for increasing level, then return to 0% and confirm silence. Play another deck and change only its fader; verify independence. Retest Pause/resume, READY queue swap, Library round trips, rapid fader movements, and orientation changes. Check for clicks, dropouts, stuck audio, and lost first-gesture activation. Device volume remains under your hardware control. Physical Safari/iPad listening is still required; browser signal measurements alone do not establish audible quality or touch compatibility.

The preserved prototype's queue replacement and manual Play Queue behavior differ from some future product rules. This task intentionally preserves the prototype rather than implementing those migrations. Natural end retains the song and does not automatically play the queue.

Original files are read through browser-selected File objects only. No file writes or uploads occur. Replaced blob URLs are revoked only after they are absent from every active and queued song.

## Verification performed

Main Volume checks passed in Chromium: startup zero gain, enabled 0% faders, finite/range validation, independent measured post-gain signal at 0/25/50/100%, rapid retarget settling, mute without stopping playback, retained volume across Pause/resume/queue/view changes, suspended-context resume, and context-resume rejection recovery. Existing playback and synthetic touch checks also passed. At 1114×685 and 768×1031, header heights remained 160px and 152px respectively, the fader geometry stayed stable across percentage changes, and no outer horizontal overflow was detected. These are automated browser measurements, not physical Safari or listening verification.

[Browser checks](../tests/visual-playback-tests.html) create generated quiet WAV tones and observe actual native media players in an isolated test frame. Run them with the **Run checks** button.

Passed in the integrated Chromium browser on 2026-11-22:

- Four persistent components and four native players; empty Play disabled.
- Four files load without autoplay and display filenames.
- All four playback clocks advance independently.
- Pause retains position; resume advances again; other decks remain playing.
- Loading during playback preserves the active source, replaces the queue as before, and READY plays the replacement.
- All four combinations (Wave + Cues, Wave + Controls, Stems + Cues, Stems + Controls) on every deck, with independent sections and independent decks.
- Exactly two independent toggle buttons in each original header selector slot, with no selector controls inside performance-content.
- Library round trips retain both selections for each combination.
- Every combination and Library round trip while all four players run retains sources, positions, and player identities without pause or emptied events.
- Rejected Play reports an error and restores an available Play control.
- Natural end retains the loaded song and updates transport.
- Invalid audio reports an error, and a subsequent valid file loads.

Landscape (1114 × 685) and portrait (768 × 1031) screenshots were inspected in headless Chrome. Static editor diagnostics reported no errors in the added application modules and stylesheet. Code review checked deck ownership, separation of visual/behavior/audio responsibilities, text-safe filename rendering, and blob URL lifetime.

Compact-header correction: measured every deck against a pre-correction snapshot at both sizes. Header height remains 160px in landscape and 152px in portrait. Header, Play/Pause, main-volume, song-title, Library, total content, and both section rectangles are unchanged. Removing each section's 26px selector and 4px gap returns that space to its view. All four combinations were visually checked in both orientations. The Developer's Guide was not regenerated; the naming specification explicitly supersedes its intermediate selector placement.

These checks do not establish listening quality, Safari support, touch behavior on physical devices, or release readiness. Actual music playback and listening on the intended devices remain necessary.

## Documentation revision

Legacy relocation verification (2026-11-22): all 75 approved files were retained under legacy-reference. All eight active entry/module/style files matched the architecture checkpoint byte-for-byte. The current playback/touch suite passed in Chromium. Relocated legacy startup/routing, all three core test groups, and the native output-meter test passed both before and after relocation. All 71 legacy HTML resource paths resolved. The relocated Clean Deck prototype loaded generated audio on four native players; independent Pause and resume were verified. These are browser/state/signal checks, not listening or physical Safari verification. No active Behavior or Audio modules were copied.

The current [naming specification](visual-verification/APPROVED-NAMING.md) and [interface specification](../specs/interface.md) supersede the earlier combined Wave + Cue / Controls switch. The [editable Developer's Guide](visual-verification/TuneTox-Developers-Guide-v1.html) includes a current-layout addendum. The Version 1 PDF and its six images are preserved historical references; that PDF has not been regenerated for this layout.
