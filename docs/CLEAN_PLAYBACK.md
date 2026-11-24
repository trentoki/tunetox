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

Tempo now uses Signalsmith: drag horizontally within the existing numeric Tempo box, or focus it and use arrow keys. Far left is 0.50×, center 1.00×, far right 2.00× on a logarithmic scale. Each deck is independent; pitch stays unchanged and the separate Pitch control remains disabled. Load now waits for decode/worklet preparation with that deck's transport disabled; successful Load still never autoplays. READY retains the existing manual queue swap behavior. Main and Tempo are retained across swaps.

**Safari access:** on your Mac use http://127.0.0.1:8080/tunetox.html, or the existing trusted HTTPS mode on port 8443. For iPad Safari use the Mac's trusted LAN HTTPS URL; see [local HTTPS setup](LOCAL_HTTPS.md). The user reports working iPad song loading/waveforms. Certificates and server configuration are preserved by the control-foundation sprint. AudioWorklet is unavailable on a plain-HTTP LAN-IP origin.

**Safari Tempo/seek test:** load familiar music on four decks, press Play, and raise Main gradually from zero. Compare 0.5×/1×/2× and continuous drags: timing should change without transposing voices/instruments. Pause/resume each deck, queue two files successively and invoke READY, and switch Library/views while others run. Tap/drag the overview while paused and playing; its marker previews during dragging and release commits through Behavior. Confirm the final coordinate after rapid taps, try Home/End and arrow keys, and check that other decks are unaffected. Repeat after rotation and background/foreground. Listen for transition gaps, retained output after Pause, and overload. No sample-accurate audible-seek claim is made.

Each deck has two independent toggle buttons in the original compact header selector slot: **Wave ↔ Stems** and **Cues ↔ Controls**. Each button shows its current view. No extra selector rows occupy the content sections. Stems contains four Behavior-owned level faders with no stem DSP; Controls contains only inactive filter, EQ and effects previews. Changing either selection leaves the other section and other decks unchanged. Library and its back arrow preserve both selections and playback.

Loading while a deck is playing prepares its queue. The READY button invokes the existing Clean Deck Play Queue action. A further load replaces that queue, as in the preserved prototype.

## Files and responsibilities

- [application.js](../app/visual/mixer/application.js): Visual startup creates four persistent Clean Deck states, mounts the interface, handles file selection, presents playback notifications, and refreshes playback-time displays. It supplies loaded/queued URL references to Audio for cleanup. Legacy application files are preserved under legacy-reference, outside the active dependency tree.
- [playback.js](../app/visual/mixer/playback.js): creates the shared visual component with approved names, view switching, and state rendering.
- [playback.css](../app/visual/mixer/playback.css): H5.3.1 section arrangement, deck accents, and shared landscape/portrait styling.
- [deck.js](../app/behavior/mixer/deck.js): load/queue/playback behavior, the loaded-song-list helper, and createPlaybackCoordinator for one deck's guarded actions and ended/error handling. The coordinator was consolidated here without changing its operation or notification order. Presentation callbacks keep rendering and status messages in Visual; Audio manages file URLs. The Clean Deck prototype continues using the existing direct actions without adopting the guarded API. No separate Integration layer or duplicate deck state is introduced.
- [deck-audio.js](../app/audio/deck-audio.js): buffered Signalsmith transport, source-position tracking, one shared Web Audio context, and independent transport-gate/Main GainNode paths, plus temporary audio URL management. Context resume starts in Load/Play gestures, before async work. Only URLs absent from every loaded and queued song are released. Original files are never modified.

The older [index.html](../legacy-reference/index.html), [clean-deck.html](../legacy-reference/development/clean-deck.html), and their legacy interface files are preserved under [legacy-reference](../legacy-reference/). Clean Deck shares the active Behavior and Audio modules via adjusted imports, without copies. Guide/reference materials remain in their existing documentation locations.

## Scope and limitations

Touch policy (revised after the CSS-only fix failed on a physical iPad): device-width and initial-scale=1 are retained, with viewport-fit=contain. No maximum-scale or user-scalable restriction is imposed. Actual computed Chromium styles are manipulation for buttons/Library, pan-y pinch-zoom for native ranges, and pinch-zoom for the interactive overview and Futuristic rollers. These desktop measurements cannot establish the iPad's computed values.

WebKit documented an iOS bug where manipulation failed to suppress double-tap zoom, corrected in [317443@main](https://commits.webkit.org/317443@main). This is a plausible explanation for the reported failure, not identification of the iPad's Safari version or proof of its installed fix status. The earlier CSS-only claim was insufficient.

[touch-guards.js](../app/visual/mixer/touch-guards.js) now installs a presentation-only fallback from the host. It recognizes two stationary single-finger taps within 350ms and 24 CSS pixels; each tap must last at most 300ms and move at most 10 pixels. Only the second touchend is cancelled. A button's suppressed click is forwarded once, with a narrow duplicate compatibility-click guard. The next real touch clears that duplicate guard. Ordinary first taps, drags, scrolls, long presses, cancelled touches and multi-touch are not cancelled. No synthetic range changes, audio changes, touchmove blocking or blanket gesture blocking are added.

The application shell uses the available dynamic viewport height and bounded width, with a 100vh fallback. Decks divide that space using the existing four-column / two-by-two arrangement; fixed deck minimum heights no longer force the page beyond the screen. Compact performance headers and control ordering stay unchanged. Short windows scroll within performance content; Library keeps its own scrolling. Outer horizontal overflow is prevented without scaling the interface.

Synthetic gesture tests cover single/double/triple taps, duplicate click prevention, blank areas, nearby different controls, stationary range taps, drags, pinch, scroll reset, long presses and distant taps. They test event-routing logic, not Safari's native zoom recognizer. Chromium checks at 1114×685, 768×1031, 1024×600, 600×450 and 390×700 found no outer horizontal overflow and retained Library scrolling. Playback regression checks passed.

Physical iPad Safari verification remains required: reload the application, repeatedly tap controls and blank regions, check each tap activates exactly once, use Load and Play/Pause, drag faders when enabled, scroll Library and short-window content, rotate, test split view and Safari toolbar changes, and confirm deliberate pinch zoom remains available. No claim is made that the fallback has passed these physical-device checks.

This checkpoint connects Load, Play, Pause, and the existing queue action. Workspace and performance-view navigation work without replacing players. Current time is read from the actual media player.

The full-song overview is drawn from decoded audio peak/RMS summaries; the larger scrolling waveform is still blank, not fake audio data. Main, pitch-preserving Tempo and overview seeking are connected. Stem faders edit permanent Behavior levels without DSP. Pitch is disabled except for Futuristic's explicitly visual-only travel demo; All themes now expose real song-owned cue pads and numbered overview markers. Participation, EQ, effects, loops and library manipulation remain inactive. No persistence, BPM analysis, matching or Handoff has been added. Eject is available in Behavior/the legacy prototype, with no new active-application Eject button.

Behavior stores mainVolume in 0–1 units, initially zero, and rejects non-finite/out-of-range values before changing state or audio. Audio applies a 15 ms linear gain ramp; rapid changes retarget from the modeled current ramp value and Main zero reaches exact silence. UI percentages represent requested gain; the short ramp is not displayed as a separate setting. Per-deck Main GainNodes provide attenuation after Signalsmith; a separate gate mutes transport transitions without changing Main. The four stem faders initialize at 100% and edit deck.stemLevels through setStemLevel in 1% steps; they do not change sound yet. Visible stem labels retain H5.3.1 wording; approved data-stem attributes do not redefine audio categories.

The legacy Clean Deck prototype shares these modules and therefore now also starts silent at Main zero. Its preserved interface has no Main fader; use the active application for audible Main Volume testing. Its transport/queue actions remain available. The prototype's existing load/pause/eject handlers now await the shared asynchronous operations; no controls were added.

Safari listening procedure: reload tunetox.html; confirm all four Main values are 0%. Load a familiar song and press Play: time should advance silently. Slowly raise Main through 25%, 50%, and 100%; listen for increasing level, then return to 0% and confirm silence. Play another deck and change only its fader; verify independence. Retest Pause/resume, READY queue swap, Library round trips, rapid fader movements, and orientation changes. Check for clicks, dropouts, stuck audio, and lost first-gesture activation. Device volume remains under your hardware control. Physical Safari/iPad listening is still required; browser signal measurements alone do not establish audible quality or touch compatibility.

The preserved prototype's queue replacement and manual Play Queue behavior differ from some future product rules. This task intentionally preserves the prototype rather than implementing those migrations. Natural end retains the song and does not automatically play the queue.

Original files are read through browser-selected File objects only. No file writes or uploads occur. Replaced blob URLs are revoked only after they are absent from every loaded, queued, and currently loading song.

## Verification performed

Signalsmith migration: the test runner now observes actual Signalsmith worklets and persistent transport objects rather than native media elements. Chromium checks passed for mono/stereo decoding, logarithmic half/unity/double mapping, four independent source-clock rates, measured 220/440 Hz pitch preservation, same-node rapid tempo changes, playing/paused seeks into distinct frequency regions, clamped/invalid seeks, async cancellation and stale-load protection, processor failure/reload, plus the existing Main/queue/view/touch/error regressions. Header heights remained 160px/152px at 1114×685/768×1031 with stable Tempo boxes and no outer horizontal overflow. Relocated legacy core/routing/native-output checks passed; the shared Clean Deck prototype loaded four songs and completed Play/Pause/resume/Eject with its handlers awaiting async completion. Older verification records below describe their original checkpoint backends and do not certify the new backend on Safari. Full music listening, long-file memory/CPU, background behavior, and physical iPad HTTPS remain outstanding.

Main Volume checks passed in Chromium: startup zero gain, enabled 0% faders, finite/range validation, independent measured post-gain signal at 0/25/50/100%, rapid retarget settling, mute without stopping playback, retained volume across Pause/resume/queue/view changes, suspended-context resume, and context-resume rejection recovery. Existing playback and synthetic touch checks also passed. At 1114×685 and 768×1031, header heights remained 160px and 152px respectively, the fader geometry stayed stable across percentage changes, and no outer horizontal overflow was detected. These are automated browser measurements, not physical Safari or listening verification.

[Browser checks](../tests/visual-playback-tests.html) create generated quiet WAV tones and observe real Signalsmith worklets, transport events, source clocks, and post-gain signals in an isolated test frame. Run them with the **Run checks** button.

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

## Four-deck control foundation verification (2026-11-23)

The current playback/touch suite passed before editing and the expanded suite
passed over existing trusted local HTTPS afterward. Added checks cover real
Behavior seek batching (including an intermediate end target), all four paused
overview seeks, immediate preview versus committed Audio position, playing seek,
keyboard, bounds, rapid final targets, cancellation/lost capture/theme changes,
per-deck Main/stem isolation, Eject state timing and cancelled Behavior loads.
The deterministic pointer checks stub only capture because synthetic PointerEvents
do not register a native active pointer. Separate Chromium native mouse and CDP
touch-emulated drags passed across Default, Glass Hardware and Futuristic, including
touch cancellation and no page scrolling. Roller/waveform removal cleanup was
also checked through native input; Main/stem mouse dragging remained deck-local.

The focused theme/stem/cue suite passed, including computed Default/Glass appearance
restoration. All three themes retained four decks without horizontal overflow at
1114×768, 768×1024 and 390×700. Overview heights remain the existing 42px/36px;
small-screen physical touch comfort needs device review. The shared legacy Clean
Deck completed generated-file Load/Play/Pause/Eject on all four decks over HTTPS.
The Mac HTTPS page reported secure context and AudioWorklet available. HTTP still
serves the same application. No server or certificate changes were made.

These are automated/Chromium results, not physical Safari/iPad or listening
verification. Seek transitions may have processing latency; continuous audible
scratching, sample accuracy, long-file memory reclamation and sustained four-deck
CPU performance are not established. Existing pending-operation guards still
ignore Play/Pause/Load/queue requests until the operation settles. No new control
engine or copied deck state was introduced. Recommended next work is physical
Safari seek/listening verification and sustained transport testing before adding
another musical subsystem.

Historical pre-cue-upgrade native CDP touch checks moved Main/stem faders independently and verified
rendered percentages; cue assignment and single-tap Shift clearing passed without
a song. These remain touch-emulation results, not physical iPad verification.

## Functional cue pads and numbered overview markers

The previous visual-only cue preview is replaced by eight Behavior-owned source
positions per loaded deck, shared across all three themes. Empty pads save the
current position without seeking; assigned pads use the existing guarded seek.
Shift clears without seeking, either held (on-screen or keyboard) or clicked to
latch. A used on-screen hold does not latch on release. Replacement songs and
Eject clear cues; queue preparation, view changes and theme changes retain them.
Cues are temporary for the loaded song, not saved to a library or across reloads.
The existing end-of-song seek rule still applies: seeking exactly to duration
leaves transport ended/paused. No Audio or DSP implementation changed.

Numbered accent-colored overview lines derive directly from those positions.
Their overlays cannot intercept seeking. Coincident cues share a compact row of
numbers while their lines retain the saved coordinate. Very closely spaced,
different positions can still overlap labels; no marker editing is introduced.
The large scrolling waveform remains unimplemented.

Verification: the complete Chromium HTTPS playback/touch suite passed, including
playing/paused cue assignment and recall, rapid recalls, deletion during a pending
recall, all four decks, zero/end markers, song replacement, theme retention and
existing overview/tempo/Main/queue/error regressions. The focused theme/stem suite
also passed. Native browser mouse/keyboard Shift and emulated two-touch on-screen
Shift + Cue deletion passed. Portrait/landscape geometry retained four decks and
no horizontal overflow. Audio, theme stylesheets, server and certificates were
unchanged. These checks do not establish Safari audible seek quality or physical
iPad multitouch compatibility.

Manual Mac/iPad Safari check (use the existing trusted HTTPS URL on iPad):

1. Load a real song, leave it paused, seek in its overview and press an empty pad.
   Its numbered line should appear immediately; playback must stay paused.
2. Seek elsewhere and recall that pad. Repeat while playing, with Main raised
   carefully from zero. Recall should retain the playing/paused state.
3. Hold Shift and press an assigned pad; repeat by clicking Shift to latch it.
   The pad/marker should clear without moving position. Click again to unlatch.
4. Repeat on other decks, switch themes and Library views, and check independence.
   Replace one deck's song and confirm only that deck's cues clear.
5. Seek through and around marker numbers using mouse/touch, then make rapid cue
   recalls. Listen for unwanted starts, clicks or dropouts; sample accuracy is not
   claimed. Report physical-device results separately from automated checks.
