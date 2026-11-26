# H5.3.1 Clean Playback checkpoint

The new application entry point is [tunetox.html](../tunetox.html). Serve the repository over HTTP; ES module imports are not reliable from a double-clicked file URL.

## Open and test

### Detailed four-second waveform refinement (26 November 2026)

The user found the first display too zoomed out for drum hits. The current window
now spans four source seconds, with a stationary center and fixed source-time
scale. Higher Tempo scrolls faster without stretching transient shapes. Audio
retains signed min/max and RMS in approximately 5 ms groups; the full-song overview
keeps its original 360-column summary. Canvas paints only the visible ~800 groups.
Visible playing decks use requestAnimationFrame and read Audio's currentTime each
frame; paused/hidden views do not run an animation loop. Shared seek-on-release,
cues, Queue, colors and geometry remain. See the [waveform specification](../specs/waveform.md).

Analysis is in [app/audio/waveform/](../app/audio/waveform/) and rendering in
[app/visual/waveform/](../app/visual/waveform/), with clearly named overview and
scrolling files in each. The host's existing emptied event now also refreshes the
view, releasing renderer references when the source is disposed. Behavior and DSP
are unchanged; no routing layer or second playback position was introduced.

Verification completed in isolated Chromium:

- Playback/touch, Queue, theme and iPhone suites pass. Added checks cover signed
  single-sample transients at group/channel boundaries, correct RMS/final groups,
  source-time shape, visible-only rendering and linear one-hour summary storage.
- Native mouse/touch-emulated four-second seeks and independent Tempo operation
  passed on all four decks in all themes at desktop, tablet and phone sizes.
  Layout rectangles match the preceding checkpoint; no horizontal overflow found.
- Two actual local stereo music WAVs (175 s and 322 s) were loaded read-only,
  including four-deck playback with one 175 s source and three 322 s sources.
  Screenshots show distinct transient peaks. Source advances over five seconds
  were 2.50/5.00/7.50/10.01 s at 0.5×/1×/~1.5×/2×. Original file hashes are unchanged.
- Those four detailed summaries total 2,733,636 bytes (~2.61 MiB). DevTools reported
  backing storage of ~405.7 MB while loaded and ~0.203 MB after disposal, a 2.5 s
  wait and forced garbage collection. These are observed test-page backing-store
  figures, not full browser/process RAM or proof of native/WASM reclamation.
- Foreground per-deck animation callback work averaged 0.29 ms, p95 0.60 ms,
  maximum 0.90 ms in the five-second sample. Headless rAF cadence averaged 77 ms;
  the idle page also averaged 81 ms. This environment does not establish 60 fps
  or physical-device smoothness despite low measured callback cost.
- A separate generated ten-minute mono transient recording decoded, analyzed and
  played near its end. Its detail arrays used 1,436,748 bytes at the test context's
  44.1 kHz rate. One-hour array/render bounds were tested without decoding an hour
  of PCM. Recordings longer than 322 s were synthetic, not additional real music.

Physical iPhone/iPad/Mac Safari touch, visible smoothness, listening and sustained
native memory/CPU remain necessary. Analysis currently runs on the main thread
during preparation, so loading very long recordings can still delay UI frames.
No claim is made about sample-accurate scratching, gapless Queue transitions or
hour-long real-music playback. Keep original music read-only during manual tests.

### Historical initial scrolling-waveform checkpoint

The following initial increment used 20 seconds and is superseded by the detailed
four-second refinement above; it remains a record of the preceding implementation.

### Scrolling-waveform development increment (26 November 2026)

The accepted Queue work was first preserved in local commit `d8c4c7d`. The four
shared Wave views now show existing decoded peak/RMS data beneath a stationary
centered playhead. A 20-source-second window follows Audio's existing 50 ms clock
notifications; the full-song overview and time readout use the same position.
Drag right to move backward or left to move forward. Both views preview the
target during the drag; release uses the existing guarded seek and retains
playing/paused intent. Arrow keys and Home/End work on either surface.

The implementation extends only shared Visual rendering/CSS and the common seek
handlers. Behavior, Audio, vendored DSP, deck accent colors and layout geometry
are unchanged from the Queue checkpoint. The decorative minus/plus placeholders
are removed; no zoom control or extra routing layer is added. Details and limits
are in the [scrolling contract](../specs/interface.md#implemented-scrolling-waveform).

Verification: the playback/touch suite passes decoded-data rendering, stationary
center mapping, shared previews, directional mouse/touch seeks on four decks,
bounds, view/theme/resize/cancel/lost-capture cases, continuous four-deck SVG-window
movement without rebuilding bars, playing seeks, cue alignment and Queue alignment.
Queue, theme and iPhone suites also pass, including hidden-phone automatic Queue
advancement. Native CDP mouse and touch-emulated drags on all four decks passed in
all three themes at 1114×768, 768×1024 and 390×844, with concurrent playback and
independent Tempo changes. Measured layout rectangles exactly match the preserved
Queue checkpoint; no horizontal overflow was found. Screenshots were inspected.

Readability review: overview and scrolling gestures share one seek implementation
and temporary preview. Bar nodes are reused until source data changes; time ticks
update the SVG viewBox instead of generating waveform DOM or a separate clock.
No duplicated playback state or independent waveform position store is introduced.

Limitations: 360 columns per whole song look coarse for long recordings, and the
display follows 50 ms notifications rather than animation-rate interpolation.
This is seek-on-release, not continuous audible scratching or sample-accurate
scrubbing. Physical Safari touch/listening and long-file resource checks remain
necessary. The historical blank-waveform descriptions below are superseded here.
For Safari review, compare the two positions while playing, drag both directions
while playing and paused, change Tempo, recall cues, invoke READY and allow natural
Queue advancement. Check all decks, views, themes and phone-tab changes while
listening for seek artifacts or interruptions. Main still starts safely at zero.

### Queue development increment (26 November 2026)

The user has tested and accepted the Queue functionality. This acceptance is
recorded separately from the automated results and remaining verification limits.

While playing, Load fills one queue slot. Another file is rejected with an
occupied-queue message; the current and queued songs are retained. READY swaps to
the accepted song, and natural end now invokes the same swap automatically, even
on a hidden phone deck. Outgoing playback continues during candidate preparation.
Main, Tempo and the current stem settings are retained; changed-song cues clear.
Invalid candidates retain the current song and queue and report failure. No
automatic retry loop or new queue-editing controls are introduced. See the
[Queue specification](../specs/queue.md) and [browser checks](../tests/queue-tests.html).

Natural-end swaps still include decode/preparation and processing lead-in; this
increment does not promise gapless or beat-quantized transitions. Queue removal/
replacement presentation remains undecided. Physical Safari listening, long-file
resource use and background behavior remain unverified. For manual review, load
familiar music, press Play, raise Main carefully, queue another file and try READY;
repeat by letting the outgoing song finish, including with a hidden phone deck.
Confirm settings remain, a third file cannot replace the accepted queue, and
other decks continue. Listen for gaps, clicks, dropouts and unexpectedly retained
outgoing sound. The historical results below describe their original checkpoints;
this section supersedes their manual-only/occupied-replacement Queue behavior.

Chromium verification: the full playback/touch and theme suites passed before
implementation and after the Queue changes. The new Queue suite passed real
worklet tests for occupied-slot rejection, measured outgoing signal during held
preparation, manual and four-deck automatic swaps, latest inherited controls,
delayed Play/end coordination, corrupt files, automatic failure without retry,
post-commit Play rejection/recovery and cancelled preparation. The phone suite
also passed hidden-deck automatic advancement, tabs, cues, settings and READY.
Syntax, editor diagnostics and whitespace checks passed. These are browser/signal
checks, not human listening or physical Safari results.

Readability review: Queue decisions remain in the existing Behavior deck module,
Visual only presents occupied-slot feedback, and the Audio loader reuses its
existing preparation path with an explicit preserve-playback option. No extra
application layer, duplicated deck implementation or DSP change was introduced.
The two cancellation controllers represent the outgoing source lifetime and the
candidate preparation lifetime; they are not competing musical state stores.

### iPhone layout review (24 November 2026)

**Checkpoint status:** The iPhone layout is provisionally accepted, with visual
refinement still needed. Physical Safari/device verification remains separate
from the automated results below; this is not a release approval.

Phone-sized viewports now show one shared deck at a time with tabs 1–4, an empty
expandable Transition area and four vertical native stem faders. All four decks
remain mounted and operational. Tap the separate Transition handle or swipe it
down/up; deck tabs select only. No transition musical controls are designed yet.
Short landscape phones scroll the performance workspace so controls remain usable.
See [viewport thresholds and interaction choices](../specs/interface.md#iphone-single-deck-layout).

The only new production files are
[phone CSS](../app/visual/iphone/layout.css) and
[phone navigation](../app/visual/iphone/deck-selector.js). The shared host imports
the navigation after mounting its existing decks; the entry loads the phone CSS.
No shared deck component was copied and no Behavior/Audio source was changed.
The two additional [phone test files](../tests/iphone-layout-tests.html) provide a
dedicated browser runner and its checks; no framework or dependency was introduced.

Verification completed in isolated headless Chromium:

- Existing full playback/touch and Glass Hardware/Futuristic suites passed.
- The new phone suite passed with four generated-file transports: switching tabs
  retains playing/paused state, source clocks, Main/Tempo/stem values, cue markers
  and recall, prepared queues and READY playback. Context, transport and worklet
  identities remain unchanged. Keyboard navigation and tablet resize restoration
  passed. Transition cancellation, horizontal movement, lost capture, resize and
  compatibility-click regressions passed.
- Native CDP touch-emulated vertical stem drags, tab taps and transition swipes
  passed in all three themes at 320×568, 375×667, 390×844, 430×932 and 844×390.
  No outer horizontal overflow was found. All four stem categories were separately
  dragged at 390×844 in each theme without changing another deck.
- Measured header/footer/deck/content/Main/stem geometry exactly matched the
  committed pre-phone Visual snapshot at 1114×768, 768×1024 and 1024×768 in all
  three themes. Phone screenshots were inspected, including short landscape.
- JavaScript syntax, editor diagnostics and Git whitespace checks passed.

Readability review: phone code owns only navigation/transition presentation;
shared controls and musical actions stay in their existing modules. CSS and JS
carry the same explicit viewport query. No alternative deck state or audio engine
was introduced. The checkpoint also includes the earlier approved publication and
archive-status documentation corrections.

These are automated Chromium results, not physical Safari or listening approval.
For iPhone/iPad on the Mac's Wi-Fi, start the existing HTTPS server and use its
printed LAN URL, with the development CA trusted on that device. See
[HTTPS setup](LOCAL_HTTPS.md). The Mac's LAN IP may change after reconnecting.

Physical review: load familiar songs on several decks, press Play and raise Main
carefully from zero. Switch tabs while listening, pause one deck, recall cues,
seek and adjust Main/Tempo; check that hidden decks continue as intended. Open
Stems and drag each fader; stored levels should change, but stem audio remains
disconnected. Tap/swipe the Transition handle separately from tabs; test rotation,
short-screen scrolling, Library return, intentional pinch zoom and each theme.
Repeat on iPad to confirm its existing multi-deck layout. The layout is
provisionally accepted with visual refinement pending. That checkpoint preceded
the Queue increment recorded above.

### Start the preview server

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

Loading while a deck is playing fills its one queue slot. READY invokes the shared guarded swap action; natural end requests the same action. Further files are rejected with feedback while the slot is occupied. An empty or paused deck still loads without autoplay.

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

Both waveform windows now draw the same decoded peak/RMS summary. The scrolling waveform moves beneath a stationary center; both views share source timing and the existing seek action. Main, pitch-preserving Tempo and overview seeking are connected. Stem faders edit permanent Behavior levels without DSP. Pitch is disabled except for Futuristic's explicitly visual-only travel demo; All themes now expose real song-owned cue pads and numbered overview markers. Participation, EQ, effects, loops and library manipulation remain inactive. No persistence, BPM analysis, matching or Handoff has been added. Eject is available in Behavior/the legacy prototype, with no new active-application Eject button.

Behavior stores mainVolume in 0–1 units, initially zero, and rejects non-finite/out-of-range values before changing state or audio. Audio applies a 15 ms linear gain ramp; rapid changes retarget from the modeled current ramp value and Main zero reaches exact silence. UI percentages represent requested gain; the short ramp is not displayed as a separate setting. Per-deck Main GainNodes provide attenuation after Signalsmith; a separate gate mutes transport transitions without changing Main. The four stem faders initialize at 100% and edit deck.stemLevels through setStemLevel in 1% steps; they do not change sound yet. Visible stem labels retain H5.3.1 wording; approved data-stem attributes do not redefine audio categories.

The legacy Clean Deck prototype shares these modules and therefore now also starts silent at Main zero. Its preserved interface has no Main fader; use the active application for audible Main Volume testing. Its transport/queue actions remain available. The prototype's existing load/pause/eject handlers now await the shared asynchronous operations; no controls were added.

Safari listening procedure: reload tunetox.html; confirm all four Main values are 0%. Load a familiar song and press Play: time should advance silently. Slowly raise Main through 25%, 50%, and 100%; listen for increasing level, then return to 0% and confirm silence. Play another deck and change only its fader; verify independence. Retest Pause/resume, READY queue swap, Library round trips, rapid fader movements, and orientation changes. Check for clicks, dropouts, stuck audio, and lost first-gesture activation. Device volume remains under your hardware control. Physical Safari/iPad listening is still required; browser signal measurements alone do not establish audible quality or touch compatibility.

The historical prototype shares current Behavior/Audio, so its direct queue calls now also protect occupied slots and preserve outgoing audio during preparation. Its historical presenter does not install the active host's automatic-end coordinator or occupied-slot feedback. The active application advances on natural end when queued; without a queue it retains the ended song.

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
At this historical cue checkpoint the large scrolling waveform was unimplemented; the scrolling-waveform increment above supersedes that limitation.

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

### Shared frequency colors — 26 November 2026

The preceding four-second/5 ms waveform work is preserved in local commit
`14f41ab`. Frequency additions remain uncommitted for evaluation; nothing pushed.
[Shared source analysis](../app/audio/analysis/frequency-energy.js) now supplies
three time-aligned mean-square arrays through `audio.frequencyEnergy`, reusable by
future BPM analysis. The [waveform specification](../specs/waveform.md) records
provisional 200/4,000 Hz roll-offs, hue rotations and energy blending. Playback DSP,
Behavior actions and the original V40 reference ZIP are unchanged.

Verification completed in headless Chrome:
- Isolated 80/1,000/10,000 Hz at 44.1/48 kHz, stereo polarity, crossover balance,
  silence, mixed tones, cancellation, summary timing and hue mapping passed.
- Playback/touch, Queue, Glass/Futuristic controls and iPhone regression suites passed.
- Actual music: `01ItsNotMe.wav` (~175 s) and `ACRAZE - Take Me Away (Extended Mix).wav`
  (~322 s), loaded as one plus three copies across four decks. Original SHA-256
  hashes unchanged. All bands contained energy and exact summary-grid alignment.
- Over five seconds at 0.5/1/~1.5/2×, source clocks advanced 2.502/5.004/7.501/10.008 s.
  Callback mean 0.185 ms/deck, p95 0.30 ms, maximum 0.50 ms; measured animation
  interval mean 16.666 ms in this run. These are host-specific observations.
- Added frequency-array storage 2,733,636 bytes (~2.61 MiB) across those four decks.
  Eject cleared frequency/overview/detail references; DevTools backing storage fell
  from ~408.46 MB loaded to ~0.211 MB after Eject, settling and forced GC. This is
  not a native-process memory measurement.
- A generated ten-minute transient recording loaded and played near its end.

Screenshot inspection confirms varied frequency colors with the centered playhead
and existing waveform silhouettes. Physical Safari appearance, touch, audible
continuity during analysis and sustained phone/tablet performance remain to verify.

Native CDP mouse/touch checks also passed for all four decks in all three themes
at 1114×768, 768×1024 and 390×844: exact prior layout geometry, directional seeks,
playback/Tempo alignment and no horizontal overflow. Frequency tests additionally
verify cancellation after preparation starts, not just an already-aborted signal.

### Overview complementary coloring — 26 November 2026

The scrolling frequency colors are visually approved, preserved in local checkpoint
`ea66195`. The full-song SVG now uses the same palette and energy mapping via
[frequency-colors.js](../app/visual/waveform/frequency-colors.js). Existing source
energy is aggregated into overview columns with sample-overlap weighting and cached;
no audio re-analysis or new BPM work. Geometry and absolute seeking are unchanged.

Automated checks passed for exact rectangle geometry, boundary/final-group weighted
aggregation, unchanged source arrays, identical color mapping, accent recoloring and
Eject clearing. Playback/absolute seeking/cues/Tempo, Queue, theme and iPhone suites
passed in Chrome. Actual music loaded on four decks at 0.5/1/~1.5/2×; both waveform
views showed frequency colors, playback advances matched the prior run, and original
music hashes were unchanged. Screenshot inspection confirmed colored overviews and
unchanged centered detail playheads. Physical Safari visual approval and listening
remain separate human checks. New overview changes remain uncommitted.

Native mouse/touch and exact layout comparisons passed at 1114×768, 768×1024 and
390×844 in all three themes, including four-deck seek direction, playback/Tempo
alignment and no horizontal overflow. The iPhone regression initially timed out
while other browser runs were active; it passed when rerun alone. Syntax/editor
checks and `git diff --check` passed. Physical device verification remains pending.
