# TuneTox Design Mode — milestone 1

Current development build: **DM-20261114-M1**. In this running session, the verified iPhone/iPad LAN URL is **http://192.168.50.24:8765/development/design-mode/?build=DM-20261114-M1**. Look for **DEV M1-1114** in the footer and **M1** beside Manage song. The LAN server currently preserves the repository root (`--project-root`); its `/` is the production app, not Design Mode. Loopback `/` remains Design Mode. Historical milestone notes follow below.

Independent, session-only visual prototype. No production scripts, audio engine, media files, storage, musical decision rules or research code are loaded. Waveform illustrations are decorative. Play/pause, tempo, pitch and stem controls change simulated UI state only; they do not demonstrate audio or approved stem-handoff behavior.

## Open locally

From the repository root:

```sh
python3 development/design-mode/serve-preview.py --bind 127.0.0.1 --port 8765
```

Open http://127.0.0.1:8765/ (or open this folder's `index.html` directly). The server serves only this prototype folder. Stop it with Ctrl-C.

For an actual iPad on the same trusted Wi-Fi, stop the loopback server and run the command with `--bind 0.0.0.0`, then visit `http://<Mac-LAN-IP>:8765/` on the iPad. This exposes the prototype to the local network while running; no public deployment is configured.

## Review scope

Four persistent simulated deck cards, playlist selection, independent panel search/scroll, song selection, per-deck load targets, play/pause, eject, level sliders, global readouts and reset. Data is clearly fictional. Reload resets everything. No persistence, real linking, MIDI or audio processing.

Portrait uses a 2×2 mixer. Wide landscape uses four cards across; shallow landscape also uses one row. The mixer starts at 40% viewport height with a 492px portrait minimum so controls fit; short phones therefore devote more than 40% to the mixer. Playlists use 26% of library width. These are provisional proportions requiring iPad/iPhone touch review.

## Files and ownership

- `index.html`: isolated entry and static application shell.
- `example-data.js`: fictional playlists and songs.
- `state.js`: simulated state and input-independent actions.
- `components.js`: deck, row, slider and list DOM components with supplied callbacks.
- `app.js`: mounting, simulated event wiring and rendering.
- `design-mode.css`: scoped-to-entry responsive visual design.
- `tests/checks.js`, `tests/run-tests.js`, `tests/browser-tests.html`: focused checks.

Components accept state and callbacks for later reuse; production integration is a separate future task. Search is a simple example-data filter, not the complete approved shared library search/navigation behavior.

## Verification

From the repository root on macOS:

```sh
osascript -l JavaScript development/design-mode/tests/run-tests.js
```

Open http://127.0.0.1:8765/tests/browser-tests.html for DOM, interaction and six viewport layout checks. Executed for milestone 2: 25 JavaScriptCore state checks and 65 total headless Chrome fixture checks at 390×844, 320×568, 768×1024, 1024×768, 900×680 and 844×390. Visually inspected an iPad-sized Chrome screenshot. These checks do not establish Safari behavior or touch ergonomics; actual iPad review remains necessary.


## Milestone 2 — simulated matching and drag targets

The bottom loading strip now places LINK centrally between deck targets 1/2 above and 3/4 below. Clicking LINK queues the selected fictional example; a drop queues the dragged example. A QUEUED indicator and status message confirm the simulation. No real song relationship is created.

Each front face has independently simulated Beat Match, Tune Match and Handoff buttons, plus Tempo/Pitch number controls. These do not enact global matching, musical rules or audio changes. `data-face="front"` and a separate control container prepare the component for a future flip design; no flip interaction or alternate face has been defined.

Drag song rows with a mouse to a playlist or LINK. On touch screens, drag from the artwork/note handle; elsewhere the list retains native scrolling. Drop targets highlight yellow. Playlist membership changes only in session state, rejects unknown song IDs, and avoids duplicates. Reset/reload discards additions and queued LINK state. Drag handling lives separately in `drag-drop.js` and uses existing model actions. Touch cancellation and invalid destinations leave assignments unchanged. Actual iPad touch dragging remains to be verified.

The added controls require more mixer space than milestone 1 (492px minimum in portrait). On very short phone viewports, library viewing space is severely constrained; the iPad is this milestone's visual review target. Browser layout tests check deck fit and horizontal overflow, not full device ergonomics. Native drag/drop is simulated in the test fixture; tests do not establish operating-system drag behavior.

## Landscape sidebar refinement

Tablet-sized landscape viewports (900–1600px wide, at least 650px high) now place the library in a 27% left column beneath the header, with Playlists above Songs. Each list retains its own search and scrolling. The remaining column contains the global strip and a full-height 2×2 deck grid. LINK and four load targets remain in the Songs footer. This is a responsive viewport rule, not iPad-specific user-agent detection; similarly sized desktop windows also use it. Portrait CSS and simulated actions are unchanged.

Executed: 25 state checks and 118 browser-fixture checks, including landscape sizes 1024×768, 1180×820, 1194×834, 1366×1024 and the 900×680 lower-bound case. Checks cover sidebar proportion, column height, 2×2 decks, independent list containers, loading-target fit, absence of page scrolling, and state/DOM preservation across resizing. Existing portrait checks remain included. Visually inspected a 1194×834 Chrome screenshot. Actual iPad Safari/touch review remains pending.

## Stages A and B — context and alternate landscape presentation

Stage A was verified before Stage B: 33 state checks and 132 browser checks passed. Every deck has a Links button. It shows manual links from that deck's currently loaded song in the existing library footprint, including unloaded/no-links states. Back to library restores the mounted library's search, selection and list scroll positions. Song rows have a separate Manage button; management shows details, editable directional user links and playlist memberships. The All examples collection is read-only. No musical relationships are inferred from tempo/key, and the LINK queue remains separate from the manual-link map. Everything resets on reload/reset.

Stage B adds a header selector at the existing tablet landscape breakpoint. Sidebar remains the default (27% fixed library). Full-screen uses the entire content width for the same four deck nodes in a 2×2 grid. Open library and the Left/Right choice temporarily replace the two decks on that side; the opposite decks remain visible. Close library restores all four. Clicking deck Links in Full-screen opens the drawer automatically. Portrait ignores these presentation options and hides their controls. No deck is unloaded, re-created, synchronized or paused by layout changes.

New modules: `library-context.js` owns temporary context presentation; `layout-preview.js` owns presentation selectors and CSS data attributes. State and management actions remain in `state.js`. Library and deck nodes stay mounted. Both stages use only simulated session data; no production data, storage, audio or research changes.

Final verification: 33 JavaScriptCore state checks and 160 browser-fixture checks passed, including management, manual-link validation, membership changes, saved query/selection/scroll restoration, nine viewport sizes, both drawer sides at three iPad landscape sizes, state preservation and portrait isolation. Visually inspected 1194×834 left-drawer and management views in headless Chrome. Actual iPad Safari and touch ergonomics remain for human review. To inspect fixture screenshots/layouts interactively, `tests/browser-tests.html?review=sidebar`, `?review=full`, `?review=left`, `?review=right` or `?review=manage` runs tests then presents the requested 1194×834 view.

## Revised four landscape combinations

The two independent header selectors are **Library** (Sidebar / Full-screen) and **Decks** (Quadrants / Vertical Slices). Defaults remain Sidebar + Quadrants. Both selectors affect only the existing tablet-landscape breakpoint. All four combinations use the same four mounted deck components, library nodes and simulated state. Variant rules live in `landscape-variants.css`, loaded after the base stylesheet.

Quadrants retain horizontal illustrative waveforms with more compact performance controls. Slices arrange four equal-width full-height cards, rotate the decorative waveforms vertically, and place Transients, Flow, Tune and Voice side by side. The drawer replaces the left or right pair: 1/3 or 2/4 in Quadrants, 1/2 or 3/4 in Slices. Hidden decks retain state. Portrait ignores deck-arrangement choices.

The oversized LINK target is removed; the footer now has four compact loading buttons. Playlist dragging remains available; song linking uses Manage and deck Links. The old `linkedSongId` simulated queue field is retained and never reset by layout changes, but has no new UI action or audio behavior.

**Q-label investigation:** No standalone Q control was found in Design Mode. The prior LINK target displayed a small CSS `QUEUED` label when `linkedSongId` was set. Clicking/dropping only stored a song ID; it neither cued audio nor created manual links. The label disappeared with removal of the LINK target. If a different Q is visible on a device, its location is needed to identify it. Production cue functions were only inspected and remain unchanged.

Verification: 34 state checks and 228 browser-fixture checks passed. Coverage includes all four combinations at 1024×768, 1194×834 and 1366×1024; both drawer sides; equal-width Slices; prominent waveform regions; control fit; no landscape page overflow; preserved nonempty manual links, playlist state, deck controls and selections; portrait isolation; management and drag regressions. Visually inspected Sidebar + Slices and Full-screen + Slices/right drawer at 1194×834. Device touch/Safari review remains pending. Fixture review URLs additionally accept `?review=slices`, `?review=slices-full`, `?review=slices-left` and `?review=slices-right`.

## Vertical Slices decluttering

Only tablet-landscape Slices styling is changed. Card Load, matching toggles, local tuning and the transport/main-level section are hidden, not removed or reset. Loading targets remain in the library. Quadrants and portrait keep their existing controls and layout. Every slice now has four stacked horizontal faders (Transients, Flow, Tune, Voice), 44px-high range input targets, 9px tracks and 25px WebKit thumbs. The illustrative vertical waveform expands to the remaining space using container-relative sizing.

Slices replaces the old global strip with a compact second row inside the Design Mode header: **Adjust deck**, **Tempo**, **Pitch**, and Reset. Editing uses the existing per-deck state action and never updates global tempo/pitch or other decks. Switching the selected deck reads that deck's independent values. The header itself uses two compact rows, while removing the global strip lets the slices begin higher overall. All four layout combinations remain selectable.

Verification: 34 state checks and 265 browser-fixture checks passed, covering all four combinations, drawer sides, selected-deck-only tempo/pitch edits, preserved hidden state, 44px stacked fader targets, and unchanged Quadrants/portrait controls. Visually inspected both Sidebar + Slices and Full-screen + Slices at 1194×834. Actual iPad Safari fader feel and touch ergonomics still require device review.

## Vertical Slices waveform/controls view

Each slice now has a compact Controls / Waveform button. Its `sliceView` lives on that deck's simulated state and persists through layout changes and song loads (Reset restores Waveform). Controls view retains a dimmed decorative waveform behind Beat Match, Tune Match and Handoff buttons, with disabled Effects/Looping placeholders. Matching uses the same actions/state as the existing card controls. The overlay scrolls internally if needed and provides 44px-high buttons; four stacked stem faders remain outside it and visible in both views.

This UI and its gesture containment are active only at the existing landscape Slices breakpoint. Quadrants and portrait hide the switch/overlay and preserve their original controls, even if a deck's saved slice view is Controls. No scrubbing exists; overlay pointer events are contained and dragstart is cancelled, preventing them from becoming parent waveform gestures. Waveform sizing, header tuning and deck footprint remain intact (10px is reassigned from waveform space to accommodate the top switch).

Verification: 38 state checks and 335 browser-fixture checks passed, including independent view selection, invalid-view rejection, state preservation, matching-state synchronization, unchanged stem positions, 44px overlay buttons, disabled placeholders and gesture containment in both Slices variants at three iPad landscape sizes. Existing Quadrants, portrait, library and drawer checks pass. Visually inspected a 1194×834 Sidebar + Slices controls view. Actual iPad Safari/touch verification remains pending. Fixture review URLs include `?review=slices-controls` and `?review=slices-controls-full`.

## Modular Full-screen + Slices columns (current landscape default)

Full-screen + Vertical Slices is now the initial landscape presentation. Other combinations remain selectable. Only this variant replaces the old two-deck side drawer: each column has a compact Waveform / Controls / Library selector. Its `columnMode` is independent of the other columns and of Sidebar + Slices' saved Waveform/Controls view.

Waveform and Controls retain the four stacked stem faders. Controls shows Beat, Tune and Hand in one horizontal row, with full accessible Beat Match / Tune Match / Handoff descriptions and shared simulated matching state. The waveform remains dimmed behind controls. Library replaces the column's deck content below its header, giving that space to independently scrolling Playlists and Songs. Multiple Library columns may be open together. Local search, selected playlist/song, context view and DOM scroll positions are retained independently. Four compact footer buttons can load the selected song into any deck; Manage and the column's deck Links use the existing context UI. Simulated playlist dragging works within each local library. No cross-column drag expansion was introduced.

`column-library.js` reuses the existing list, row, context and model actions through a local-navigation adapter; metadata, playlist memberships, manual links and deck state remain shared. Library selection is local to its column, so one browser does not overwrite another's navigation or the older library sidebar's selection. The original library/drawer DOM remains mounted for the other variants. A previously open Quadrants drawer does not hide modular columns. Header tempo/pitch still edits only the selected deck. Portrait ignores the landscape mode controls and retains its prior layout. All state is session-only, with no real audio, effects, persistence or research changes.

Verification: 42 JavaScriptCore state checks and 348 browser-fixture checks passed. Checks include all four combinations, unchanged legacy drawers, independent column modes, four simultaneous libraries at 1024×768 / 1194×834 / 1366×1024, usable local scrollers without page overflow, independent searches, scroll retention, shared Manage/Links edits, selected-deck loading, matching isolation and state retention across layout switches. Visually inspected a mixed Library / Controls / Waveform / Library layout at 1194×834. Actual iPad touch/Safari review is still pending. `tests/browser-tests.html?review=columns` presents this mixed view after running checks. Reset restores the new Full-screen + Slices default with four Waveform columns.

## Full-screen + Slices navigation refinement

Each modular column now has three always-visible Waveform / Controls / Library buttons with distinct active states. The earlier select remains hidden as an internal compatibility control; the visible interaction is button-based. A compact second line in each column heading accommodates these controls without crowding narrow columns. Other variants retain their prior presentation.

Each column Library has one search at the top. It drives the existing playlist and song filters together while remaining independent of other columns. Search, selection, scrolling and direct loading are preserved. The Controls view still has a single row of three independent matching toggles and four visible stacked stem faders; its waveform remains a dim background.

Manage navigation is enhanced only for these column browsers. It shows existing link checkboxes and playlist memberships; Browse beside a playlist opens its songs, and Browse playlists to add a link supports a searchable playlist-to-song path. Candidate buttons explicitly add a directional link FROM the managed source TO the candidate. The managed `songId` remains fixed; navigation records only the candidate playlist/query/scroll. Already linked candidates are marked and disabled; self-link candidates are excluded. Back pops the previous search/scroll context, then restores Manage or the library. The older sidebar context uses the same component without the navigation option and retains its previous behavior.

Future implementation note supplied by the designer: with Tune Match enabled, manually changing that deck's pitch should shift all participating decks together, analogous to shared Beat Match tempo behavior. This is recorded for future integration only. Design Mode's current per-deck pitch editing and the production matching engine remain unchanged. Waveform remains the intended future home for scrubbing/zooming; neither behavior is implemented. No compact queue has been introduced.

Verification: 42 state checks and 356 browser-fixture checks passed, including visible mode buttons, unified filtering of both lists, fixed-source candidate linking, playlist browsing, Back restoration, existing matching controls, faders, four concurrent libraries, and legacy-variant/portrait regressions. Visually inspected mixed columns at 1194×834. Actual iPad Safari/touch review remains pending.

## Simplified Full-screen + Slices (current)

The extra deck-label/Links/Eject header strip is now hidden in this variant; only the three mode tabs remain at the top of each column. Underlying deck identity/actions, manual links, loading and queue fields are retained. Song loading remains in the library footer; existing links are available through song Manage. Other variants keep their former deck headers.

The compact Design Mode header now has native Tempo and Pitch range sliders for the explicitly selected deck. These ranges exist only as visible controls in Full-screen + Slices; Sidebar + Slices retains its prior number controls. Preview-only `adjustMatchedControl` applies a common delta to Beat Match participants for tempo, or Tune Match participants for pitch, when the selected deck participates. A nonparticipating selected deck changes alone. Offsets are retained and a common delta is bounded so every affected control remains within the preview's existing ranges (90–150 tempo, −6 to +6 pitch). Main/global values and Handoff do not participate in this action. No real playback matching or production engine is invoked. This implements the requested simulated gesture behavior only, not validation of production matching rules or DSP.

Each column Library now shows ONE list: Songs or Playlists. Selecting a playlist opens its songs in the same panel with Back to Playlists. Search filters only the displayed list; playlist search and per-playlist song queries are retained separately, so a new playlist does not inherit an unrelated search. Mode/layout switches preserve local navigation, selection, scroll and Manage context. Manage's fixed-source link navigation, membership editing and Back behavior remain available. The three matching buttons remain in one horizontal row; four thick stem faders remain visible in Waveform and Controls. No queue, scrubbing or audio feature was added.

Verification: 49 state checks and 373 browser-fixture checks passed, including positive/negative matching-participation cases, linked delta/range bounds, native range input events, tabs-only column headers, single-list navigation and scope-specific searches, loading and Manage regressions, all variants and portrait, and iPad landscape sizing. Visually inspected a mixed-column 1194×834 screenshot. Actual iPad Safari touch review remains pending.

## Shared sampler + modular layout experiment

The preferred Full-screen + Slices default remains, with exactly three top-level column tabs: Waveform, Controls, Library. Library now has Songs / Playlists / Links navigation inside its existing one-list footprint. Links follows the song currently loaded on that column's deck, shows user-created links only, and supports search, selection, loading and Manage. Empty decks and unlinked songs have explicit empty states. Controls now includes an independent MAIN slider without adding a permanent mixer strip. Tempo/Pitch matching simulation and stacked stem faders remain intact.

Tap a stem NAME (rather than dragging its fader) in Waveform or Controls to enter the shared sampler with that deck/stem selected. The deck cards stay mounted behind the sampler, preserving column modes, local library navigation and DOM scroll. A compact row shows four horizontal illustrative waveform previews, Decks 1–4 left-to-right, with loaded-song names, colors and position readouts. The previews read existing deck position values if present; no playhead clock or scrubbing was added (current preview positions default to 0s).

The shared performance view has 25 placeholder pads in a 5×5 grid. Pad presses mark the most recently triggered pad and announce a simulation; no sound is produced. Source Deck and Parent Stem selectors change the same shared sampler, never repurpose another deck's column. The selected source is repeated explicitly above the pads. Return to mixer/Escape restores the previous mounted columns. Other variants and portrait retain their presentation; the shared sampler UI is scoped to modular landscape only.

State ownership:

- `sampler-state.js`: pure sampler actions, one shared state, global per-parent-stem attenuation, independent output volume, placeholder kits and state-only kit locks.
- `sampler-view.js`: one sampler surface and four compact preview cards, using the existing waveform component helper.
- `sampler.css`: isolated sampler presentation and the mixer refinements.
- Existing deck state remains the only owner of main volume, matching flags and four stem/Handoff Levels. No copies of deck state or handoff allocation calculations are introduced.

Attenuation is a separate global post-allocation preview value for each parent stem. Entering a stem saves its current attenuation. Switching to another parent stem or closing restores the exact saved entry value, not a forced 100%. Switching source deck while staying on the same parent stem continues that attenuation session. Output volume persists independently. None of these actions changes deck stem values, main volumes, matching flags or handoff settings. These are state simulations, not implemented gain/DSP or allocation behavior.

Placeholder kit state includes a song lock and four stem locks per source deck. Unlocked kit identities/placeholder assignments follow song loads; a song lock retains its kit, and an individual stem lock retains that stem's assignments. There is no locking interface, sample editing or actual sample extraction. These minimal state safeguards are for the visual experiment, not a new production allocation/locking algorithm.

Verification: 60 JavaScriptCore state checks and 418 browser-fixture checks passed. Coverage includes non-100% attenuation restoration, same-parent sessions, independent output, unchanged deck allocations, kit-lock safeguards, Links and main volume, source switching, pad bounds, exact column/navigation restoration, all existing variants and portrait isolation. At 1024×768, 1194×834, 1366×1024 and 900×680, tests verify four previews in one row, horizontal waveform containment, pads at least 44×44px, pad containment and no page overflow. Visually inspected the 1194×834 shared sampler. Use `tests/browser-tests.html?review=sampler` for this review fixture. Reload/hard-refresh the existing preview after this update to ensure the new script entry is loaded.

Space constraints: the four previews use a 100px upper row; the sampler occupies the remaining content height. Pads are generous at iPad sizes, while the source toolbar and stem-label launch buttons remain compact. Actual iPad Safari touch ergonomics are still unverified. No queue controls, sample editing, real scrubbing, effects, audio playback, production changes or research changes were introduced.

## iPhone portrait + shared mixer controls (2026-11-14)

This prototype replaces the earlier phone 2×2 grid with **one visible deck**, while preserving the same four underlying deck objects. The phone breakpoint is portrait, at most 600 CSS pixels wide. The four Deck selectors switch presentation without unloading, pausing, resetting or copying other decks. Each selected deck retains Waveform / Controls / Library tabs, local song/playlist/link navigation, simulated loading, main/stem levels, transport and independent matching flags. The existing iPad landscape layout selectors and all four variants remain available; Full-screen + Slices stays the default. iPad portrait remains on its previous layout. This is a Design Mode experiment; production product/docs/audio behavior is not migrated.

Phone primary modes:

- **Decks:** one reused mounted deck/library component, with tempo/pitch ranges bound explicitly to the visible deck and the existing simulated matching actions. Transport toggles only preview state; positions are displayed from state but no playback clock or audio runs.
- **Transition:** exactly two selected, distinct decks side by side. Main volume, Low/Mid/High EQ and filter expose the same per-deck values as iPad Controls. Pair changes preserve all values. No separate audio engine or crossfader is introduced. This navigation is phone-only.
- **Sampler:** the existing shared sampler shows 20 pads in five columns/four rows. Its four full-song decorative overviews are arranged 2×2 for phone readability, with current-position markers, elapsed/remaining times and simulated play/pause buttons. iPad retains its 25 pads and four previews in one horizontal row. Parent attenuation, sampler output, source selection and kit-lock state are unchanged. Closing returns to the prior phone mode, visible deck, transition pair and library state. Mixer deck selectors are disabled while sampling; sampler source selectors remain independent so source changes cannot overwrite the previous deck selection.

Shared Controls now includes main volume/transport, filter, one Low/Mid/High EQ row, −½ / ON / ×2 loop controls and three assignable effect knobs. Effects are placeholders with named assignments, not DSP. Tap an effect's visible selector to change its assignment; no hidden long-press requirement. Circular controls support vertical pointer dragging, pointer cancellation and keyboard arrows/PageUp/PageDown/Home/End. Only the dial captures vertical gestures; surrounding content remains scrollable. All values live in `deck.performance` or the deck's existing volume/stem fields, never in copied layout state. Beat Match / Tune Match use the existing preview participation/delta behavior; Handoff and downstream sampler attenuation remain independent.

New modules/files:

- `performance-controls.js`, `performance.css`: shared knob, transport, volume, EQ, filter, loop and assignment UI; reusable progress formatting.
- `phone-view.js`, `phone.css`: responsive phone presentation, four deck selectors, primary modes and two-deck Transition surface.
- `tests/phone-checks.js`: focused phone/shared-state browser checks.

Updated files: `state.js`, `components.js`, `app.js`, `column-library.js`, `layout-preview.js`, `sampler-view.js`, `sampler.css`, `index.html`, `tests/checks.js`, `tests/browser-tests.html`, and this README. No framework/dependency was added. No production or research files were changed.

### Opening and verifying

Use the existing local preview, http://127.0.0.1:8765/, and hard-refresh. At an iPhone portrait-sized viewport, the phone presentation appears automatically. Existing same-Wi-Fi instructions above apply to actual iPhones/iPads. Review fixtures: `tests/browser-tests.html?review=phone-decks`, `?review=phone-controls`, `?review=phone-transition`, `?review=phone-sampler`; the iframe presents a 390×844 phone after tests. `?review=slices-controls-full` shows iPad Controls. These fixtures do not represent native Safari validation.

Executed: **70 JavaScriptCore state checks and 573 headless Chrome browser-fixture checks**. Phone sizes: 320×568, 375×667, 390×844, 393×852 and 430×932. Existing iPad landscape and legacy-variant checks remain, including 1024×768, 1194×834, 1366×1024 and the 900×680 lower bound. Added checks cover independent deck selection, shared EQ/filter/effect/loop state, negative cases, vertical knob gestures/cancellation/keyboard input, direct loading, playlist and link navigation, distinct transition pairs, pair changes, 20-pad phone sampler, 25-pad iPad preservation, source/attenuation invariants and exact return state. Unit/state success establishes simulated behavior only, not real audio.

Visually inspected phone Decks, Controls, Transition and Sampler at 390×844 and iPad Controls at 1194×834. Safe-area padding uses `env(safe-area-inset-*)` and dynamic viewport height. Actual iPhone/iPad Safari, real finger dragging, notch/browser-toolbar behavior and accessibility testing remain for device review.

### Review questions and constraints

The header preserves clear mode/deck/matching context but takes a substantial share of short screens. Controls scrolls internally to keep all four stem faders present; effects can sit below the initially visible Controls area. Transition panels scroll independently on smaller phones. At 320×568, the sampler's performance area scrolls internally to preserve at least 44px pads while retaining all four overviews. Knobs use 44px dial targets; compact mode controls, assignment selectors and overview transport are smaller and need actual touch review. No full-screen page scrolling was required in tested phone sizes.

This experiment deliberately stops before Library Organizer, Sampler Editor, queue controls, real scrubbing/zoom, audio playback/DSP, MIDI, persistence or additional effects. EQ/filter/loop values and displayed progress are simulated; no device audio quality or musical timing is claimed.

Final consistency check: both Sidebar + Slices and Full-screen + Slices use the refined shared Controls component; their library/deck layouts remain unchanged. Quadrants retains its existing presentation. The final full rerun passed 70 state and 573 browser checks.

## Waveform matching + revised phone navigation (2026-11-14)

Matching toggles now belong to Waveform in the tabbed iPad Slice and phone views. Beat Match / Tune Match / Handoff sit directly below the song title, in one labeled horizontal row, using the same existing state/actions. Controls no longer duplicates these toggles. The Quadrants presentation and all four landscape layout choices are retained.

Waveform has separate left/right **Jog** preview zones and a central **Navigate** preview region. Touch/drag in the center changes a preview cursor; left/right taps change a nudge counter. These actions update only `deck.waveformPreview`; they never change `deck.position`, playback timing, tempo, pitch or allocation. Keyboard navigation is also supported. Controls and Library hide these gesture regions, and gesture capture is isolated from matching buttons and knobs. This is not transport nudging, real scrubbing or audio.

Phone navigation is now: Design Mode label, compact Tempo/Pitch ranges, four deck selectors, then **Waveform / Controls / Library / Sampler**. The former Decks/Transition/Sampler primary mode buttons are removed. Transition is a compact control inside Controls, anchored to the selected deck plus ONE other-deck selector. The selected deck always remains the first member; duplicate pairs are rejected. Back returns to normal Controls. Each deck retains its own selected tab; Transition is a remembered Controls subview until explicitly returned. Selecting a deck with a different saved tab presents that deck's saved tab.

Phone Controls and Transition have **no stem faders**. Waveform retains all four stacked faders and sampler launch labels. iPad keeps stems in both Waveform and Controls. Removing the matching row from Controls, and removing phone Controls' stems, frees room for the existing main/EQ/filter/loop/effects controls. Knob diameters/vertical drags and visible assignment selectors are unchanged. Typical iPad Controls fits without vertical scrolling at 1024×768, 1194×834 and 1366×1024; phone Controls also fits at the tested 375×667 and larger sizes. The 320×568 case can still scroll internally rather than shrinking its knobs.

The Sampler tab opens the same shared 20-pad phone sampler. Deck selectors stay enabled while it is open: changing a deck changes the existing sampler's source, preserves the current parent-stem attenuation session, and updates header matching context. The sampler's own Source Deck selector likewise updates the phone deck selection. Closing shows the currently selected deck's preserved presentation; changing sources does not overwrite another deck's library/tab state. The 25-pad iPad sampler and kit/attenuation rules remain intact.

New files: `waveform-navigation.js`, `navigation-revision.css`, `tests/navigation-checks.js`. Updated: `state.js`, `components.js`, `app.js`, `phone-view.js`, `sampler-view.js`, `performance-controls.js`, `index.html`, `tests/checks.js`, `tests/browser-tests.html`, `tests/phone-checks.js`, and this README. No production/research file is changed.

Verification: **75 state checks and 665 browser-fixture checks passed**. Existing variant/state/library/sampler checks remain, with structural assertions updated for the approved navigation changes. New focused checks cover matching visibility/state retention, jog/center-gesture isolation, slider/deck/tab ordering, no stems in phone Controls/Transition, source changes while sampling, preserved library state, touch-size knobs, and non-scrolling typical Controls. Visual review included 390×844 phone Waveform and Controls. Safe-area/device toolbar handling and real finger gestures still need actual iPhone/iPad Safari review. Existing `?review=phone-decks`, `?review=phone-controls`, `?review=phone-transition` and `?review=phone-sampler` browser fixtures use the revised navigation.

No production matching, handoff/DSP changes, new real transport/scrubbing, queue controls, sampler editor or additional effects were implemented. The new gesture preview and musical controls remain simulated.

## Final phone performance mixer refinement (2026-11-14)

Phone Controls now uses a conventional vertical strip: tall MAIN fader on the left, Filter / High / Mid / Low circular knobs beside it, compact loop controls below, and the existing three assignable effects across the bottom. Transition exposes the same strip component twice with the selected deck on the left and one partner on the right. The left fader stays within 45px of its normal-view horizontal position in tested phone sizes. Both strips read/write the existing deck values. No Gain, crossfader, stem faders or new musical state was introduced.

Controls / Transition is now a compact two-option switch at the bottom of the mixer area. The partner selector sits just above it in Transition. Entering/leaving Transition only changes presentation. The effects row in Transition edits the selected/left deck, matching Normal Controls; the partner's assignments are retained and can be edited when that deck is selected. Effect-row construction is shared and remains easy to reposition.

`vertical-fader.js` adds vertical pointer positioning/capture/cancellation to the existing MAIN range input on phones; rising movement increases the existing main volume. The 64px (56px in Transition) input hit area is wider than the visible track. Native range keyboard controls remain. EQ/filter knob gestures and value feedback are preserved. Phone strip dials are 52px in normal Controls, 48px in Transition, and at least 44px on short phones.

Inspection found the previous assignment implementation provided tap/dropdown selection but no long-press handler. That visible selector is preserved. `effect-assignment.js` now also opens assignments after a stationary 550ms hold (or context-menu/F2), cancels the hold on drag, and prevents small hold jitter from altering FX amount. Assignment menus close/cancel pending holds when their source deck changes. This is UI assignment only; no effects DSP was added.

The iPad Controls design is unchanged: the new strip wrapper uses `display: contents` there. Only the iPad Slice Waveform title/matching/waveform row gaps were tightened to 1px and the title row shortened slightly, lifting the waveform immediately below matching. Waveform jog/navigation, matching, stems, all landscape variants, and the 25-pad iPad sampler remain intact. Phone navigation, matching relationships, libraries/links/loading and the 20-pad sampler remain intact.

New files: `vertical-fader.js`, `effect-assignment.js`, `mixer-strip.css`, `tests/mixer-strip-checks.js`. Updated: `performance-controls.js`, `phone-view.js`, `index.html`, `tests/browser-tests.html`, `tests/phone-checks.js`, `tests/navigation-checks.js`, and this README. No production, research, state-rule or audio-engine files were modified.

Verification: **75 state checks and 733 browser-fixture checks passed**. Added tests cover actual synthetic pointer movement on vertical faders, independent values, cancellation, Filter/High/Mid/Low ordering, 44px+ knob targets, stationary long press with small jitter, drag cancellation of holds, assignment changes, the bottom switch, partner-value retention, exact deck-value conservation on switching, left-strip positioning, effects-row preservation and iPad spacing. Existing phone/iPad/variant/library/sampler regressions remain. Phone dimensions include 320×568, 375×667, 390×844, 393×852 and 430×932; existing iPad checks include 1024×768, 1194×834 and 1366×1024. Visually inspected normal and Transition layouts at 390×844.

Constraints for physical review: small phones retain bounded internal scrolling instead of shrinking the mixer knobs further; whole-page scrolling/overflow is not introduced in tested sizes. Touch comfort of the tall fader track, long-press timing and normal-to-dual strip positioning still need device review. No queue, sampler editing, real transport/scrubbing, production effects, audio integration or new DSP was begun.

## Final iPhone Controls compactness pass (2026-11-14)

Only phone portrait Controls/Transition presentation changes. Normal Controls now puts the three existing effects vertically in a right-hand rail, with loop controls below them, beside the approved volume + Filter/High/Mid/Low strip. Existing knob sizes, values, assignment selectors, long-press behavior and main-fader gestures are retained. No new bottom sheet, popup, effects page or navigation was introduced; the existing assignment menus are anchored within the Controls area so all three remain usable in the rail.

Transition retains two side-by-side strips. At viewport heights above 780px, its selected-deck effects row remains visible. At 780px or less it is hidden to preserve the strips without scrolling; assignments/amounts remain untouched and accessible in normal Controls via the existing bottom switch. The partner dropdown is replaced by three visible Deck buttons, excluding the current primary deck and highlighting the active partner. Partner choices call the same existing pair action.

Normal Controls and both Transition strips fit without internal vertical scrolling in the tested viewports, including 320×568. Dials remain at least 44px; no further shrinking was used to force a fit. Large safe-area insets, text scaling, or usable heights below the tested minimum still require physical review. Short-screen Transition intentionally does not show effects; this is the explicit space tradeoff.

Files: new `phone-compact.css`; updated `phone-view.js`, `index.html`, `tests/phone-checks.js`, `tests/navigation-checks.js`, `tests/mixer-strip-checks.js`, `tests/browser-tests.html`, and this README. iPad/sampler modules, model/state rules, performance gesture modules, production and research code were not changed.

Executed: **75 state checks and 778 browser-fixture checks passed**. Added assertions cover effects/loops to the right, no normal Controls scrolling or clipping, unchanged effect knob size, all assignment menu containment, three one-tap partner buttons with correct exclusion/highlight, conditional Transition effects, and scroll-free strips. Existing gesture, state preservation, iPad, sampler and library checks remain. Visually inspected normal Controls and Transition at 320×568. The normal review fixture can use `?review=phone-controls&phoneWidth=320&phoneHeight=568`; replace `phone-controls` with `phone-transition` for the dual strips. The base preview remains http://127.0.0.1:8765/; hard-refresh after updating.

Stopped for physical-phone visual review. No audio integration or unrelated work was performed.

## Single Transition FX knob (2026-11-14)

Phone Transition now always shows one compact assignable FX knob, including at 320×568. Primary / Partner target buttons include the current deck number, active highlighting and target-deck color. The knob edits that deck's **existing first FX slot** (index 0), using the same assignment options, long-press support and vertical-drag behavior. No new effect value/store was introduced. Switching targets reads their existing assignment/amount; source changes cancel pending gestures so stale motion cannot affect the new target. Both other effect slots remain untouched. Normal Controls retains all three effects unchanged.

Both mixer strips, four circular knobs per strip, partner buttons and bottom arrangement switch remain. On the shortest screens, only decorative header spacing and mini-waveform/title layout are compressed to recover room for the 44px FX strip. Mixer knob and FX dial targets stay at least 44px. No scrolling, bottom sheet or additional navigation was added. iPad and sampler presentation remain unchanged.

Files: new `transition-single-fx.css`; updated `phone-view.js`, `performance-controls.js` (optional shared effect-slot list, defaulting to all three), `index.html`, `tests/mixer-strip-checks.js`, and this README.

Verification: **75 state checks and 810 browser-fixture checks passed**. Focused checks verify constant FX visibility, primary/partner assignment and amount isolation, target changes cancelling stale gestures, untouched mixer values/other FX slots, three unchanged normal effects, 44px dial size and no scrolling/clipping. Existing short-phone strip, partner and navigation tests remain. Visually inspected 320×568 Transition. Physical touch comfort and shortened song-title display on this smallest size remain for review. The existing local preview and `?review=phone-transition&phoneWidth=320&phoneHeight=568` fixture show the change.

## Fixed visible-viewport instrument shell (2026-11-14)

`viewport.js` now owns Design Mode's visible screen bounds. It uses `visualViewport` size/offset at normal zoom, falls back to window dimensions, and coalesces resize/scroll notifications into an animation frame. Pinch/accessibility zoom is not counter-resized. `viewport.css` fixes the document/body and application shell, applies safe-area padding and keeps document scroll positions at zero. No production transport, audio, matching or allocation state is involved.

Only designated content surfaces scroll: song/playlist lists, management content and existing effect assignment menus. Performance panels, Transition strips and sampler performance surfaces no longer act as scrollers. Pan isolation is scoped to range inputs, knobs, waveform navigation/jog zones and pads. The document does not have a blanket `touch-action:none`; library lists explicitly retain vertical touch scrolling, while artwork retains its existing drag handle.

Responsive compact rules use the measured visible height, including when Safari's visible viewport changes without the layout viewport following it. Short phone sampler spacing is reduced while preserving all 20 pads and four overviews: a smaller overview row and explicit toolbar label/range rows prevent overlap. The repeated source-summary line is visually collapsed on compact screens (it remains accessible); the Source Deck/Parent Stem selectors stay visible. Pads retain at least 44px targets. This is a fit adjustment, not clipping or disabling pads. iPad retains its 25 pads.

Verification: **75 state checks and 998 browser-fixture checks passed**. Existing interaction/state/variant checks remain. New checks cover fixed-shell geometry and scroll attempts, stationary headers, independent list scrolling, control-specific touch-action rules, synthetic pointer gestures, essential-control reachability, sampler toolbar/pad separation and mocked visualViewport contractions/offsets/safe-area changes. Real viewport sizes include 320×568, 375×667, 390×844, 393×852, 430×932, 1024×768, 1194×834 and 1366×1024. Headless iframe geometry tests explicitly settle the viewport controller before measurements. Visually inspected the compact sampler at 320×568.

**Measured fit limit:** a 390×568 visual viewport with simulated 44px top + 34px bottom safe-area insets leaves 490px of usable height. At that constrained geometry Waveform and Sampler do not fit all essential controls; they require a further design decision. Controls and Transition still fit in that stress case. The supported-size cases above fit without document or performance-panel scrolling. Unusually short keyboard-reduced screens, large text settings and additional inset combinations are not claimed supported by these checks. The browser fixture records measured limits in the preview iframe's `data-viewport-limits` attribute.

Native iOS Safari rubber-banding, keyboard/browser-chrome transitions and real finger gestures have **not** been verified on hardware in this run. The automated viewport-event/geometry cases are Chrome simulations, not a claim of Safari device validation. Actual iPhone/iPad review remains required.

Files: new `viewport.js`, `viewport.css`, `tests/viewport-checks.js`; updated `index.html`, `tests/browser-tests.html`, `tests/phone-checks.js`, `tests/navigation-checks.js`, `tests/mixer-strip-checks.js` (viewport settling during simulated iframe resizes), and this README. All changes remain inside Design Mode.

## Interaction + shared Library Manage cleanup (2026-11-14)

Manage is now one clean playlist list in BOTH phone/iPad modular columns AND the older iPad fixed sidebar/drawer library. Each row separates a membership checkbox from a playlist-name button: checking changes membership only; tapping the name opens that playlist's songs while preserving the managed song as link source. Redundant Playlist memberships headings and Browse [playlist] buttons are removed. The All examples collection remains read-only. Existing links are retained in a compact Links disclosure, including removal controls; playlist song navigation still creates links and Back restores the source Manage/library context. Lists and Manage remain independent scroll surfaces inside the unchanged fixed viewport.

FX values now reserve a fixed 24px tabular readout space in phone Controls and the single Transition FX control. Dials do not shift between 9%, 10% and 100%.

`knob-reset.js` adds short double-tap reset to Filter / High / Mid / Low and compatible 0% FX amount reset. Neutral values come from the same explicit preview-model defaults used to initialize each deck, via `getPerformanceNeutral`; they are not inferred from the knob range or hard-coded in the gesture helper. The current preview defaults happen to be zero. This is not a statement about production DSP parameter encodings. Dragging, long holds and source changes cancel tap history; native double-click is deduplicated, and Enter provides keyboard reset. Existing long-press FX assignment and vertical-drag behavior remain.

The central waveform marker is stationary at its visual reference point. The center is no longer a focusable slider and has no pointer/key scrub handlers. Existing preview-navigation data and actual deck position are not reset; the old navigation field is simply not driven by the UI. Jog counters remain view-only previews. Real waveform scrolling/scrubbing is deferred to audio integration. Sampler position markers remain non-draggable.

Files: new `knob-reset.js`, `interaction-cleanup.css`, `tests/cleanup-checks.js`; updated `state.js` (shared neutral defaults, unchanged initial numerical values), `performance-controls.js`, `library-context.js`, `waveform-navigation.js`, `index.html`, `tests/checks.js`, `tests/browser-tests.html`, `tests/navigation-checks.js`, and this README. The physically tested viewport controller/styles and all production/research files are unchanged.

Verification: **77 state checks and 1084 browser-fixture checks passed**. New coverage verifies clean Manage on phone, iPad columns and iPad fixed sidebar; independent checkbox/name actions; membership add/remove; source-locked playlist linking; disclosure/back/scroll preservation; stable normal/Transition FX coordinates; neutral reset of every control; a mocked nonzero neutral to guard against zero assumptions; FX reset; drag and long-press discrimination; and a stationary noninteractive playhead. Existing fixed-viewport, matching/handoff state, sampler, layout and gesture checks remain. Focused sizes include 320×568, 390×844, 1024×768 and 1194×834, alongside existing size regressions. Visually inspected clean Manage at 320×568 and the 1194×834 iPad sidebar. `?review=phone-manage&phoneWidth=320&phoneHeight=568` is available in the browser fixture.

Stopped for physical-device review of double-tap timing, long-press coexistence and Manage touch ergonomics. No audio integration, production matching/handoff change, sampler change or research work was performed.


## Served Manage mismatch investigation (2026-11-14)

Confirmed before the fix:

- Two Python servers listened on port 8765: loopback PID 61912 served `development/design-mode/` as `/`; LAN PID 62482 served the project root as `/`. Their start commands/cwds were inspected. The device-reachable Design Mode path was `/development/design-mode/`, not LAN `/`.
- GETs to loopback `/library-context.js` and LAN `/development/design-mode/library-context.js` matched the workspace exactly. No stale server-side copy or second active Manage implementation was found. Their pre-fix SHA-256 was `3e2805337178102525cc218abcaed070f8ca4e9896adffaf81fd3721be7d1b5a`.
- Neither server sent Cache-Control/Expires, and the HTML used unversioned script/style URLs. Plain static HTTP servers read files on request; stale browser assets are the likely explanation for the old UI at the correct Design Mode path. Safari's actual cached response/tab state could not be inspected, so that device-specific cause is not asserted as proven.

Component/navigation trace: `app.js` mounts the shared sidebar context with `createLibraryContext`; `column-library.js` mounts the same function for each deck column. On phone: Library tab → song Manage. On preferred iPad: column Library → song Manage. On fixed-sidebar iPad: Songs → Manage. All render `library-context.js`. Searches found the old heading only in historical documentation/negative test assertions; old Browse playlist class names remain in styling, and Browse text occurs in accessibility/navigation labels, not as redundant visible Manage buttons.

Fix: added `serve-preview.py`, restarted both identified preview servers with their original binds/roots, and disabled caching only for Design Mode resources. Responses have `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`, and `X-TuneTox-Design-Build: DM-20261114-M1`. Preview conditional-cache headers are ignored so updated development files return 200. Existing repository-root content is unchanged. Every JS/CSS URL in the entry page now carries `?v=DM-20261114-M1`; the footer badge and actual Manage component stamp distinguish fresh HTML from a loaded old component. Bump these development identifiers with a future preview build.

Post-fix loopback and LAN responses both matched disk, including conditional requests using a future If-Modified-Since. Current hashes: index `94839566e33d0580f677da6c7fcd8dd4a0d28fe030f30f3d7d920f554af7671e`; Manage component `cf176a0d8251ba8edede85b67861687eec8ba8753d73509b40e499f6ce3aa992`.

Direct served-page verification: `tests/served-manage-smoke.py` opens the actual LAN page in a disposable headless Chrome tab (no iframe/component fixture), clicks through all three routes above, checks footer/component versions, four clean rows, absence of the old heading/Browse buttons, and membership/name/Back behavior. All three routes passed. The existing 77 state checks and 1084 browser checks also passed when loaded through the LAN URL. No regression expectations were weakened for this fix.

To reproduce direct navigation checks, start disposable Chrome with `--headless --remote-debugging-port=9229 --user-data-dir=/tmp/tunetox-manage-audit`, then run `python3 development/design-mode/tests/served-manage-smoke.py`. Its default URL is the currently verified LAN address; use `--url` if the Mac address changes.

On iPhone Safari: open a NEW tab on the same Wi-Fi; enter the exact versioned LAN URL shown at the top; verify DEV M1-1114; tap Library → a song's Manage; verify M1 beside Manage song, with checkbox/name playlist rows and no redundant heading/buttons. Do not use localhost on the phone or the LAN repository-root URL. No site-data purge is required for this versioned URL.

Files changed: `index.html`, `library-context.js` (stamp only), `interaction-cleanup.css` (stamp styles), new `serve-preview.py` and `tests/served-manage-smoke.py`, plus this README. Production audio, research and musical state are unchanged.
