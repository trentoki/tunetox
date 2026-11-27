# Library performance refinements

Starting checkpoint: 20657c8. Human physical testing confirmed folder imports,
inline nested playlists, links, memberships, loaded-song Links, sliding, bulk V40
analysis and verified BPM correction. Preserve those behaviors and native drops.

## Increment 1 — global controls and deck-local Manage

Local checkpoint `ffa382d`.

Created Visual library-import-view and Behavior library-global-controls: the same
working import chooser/actions now have one global entry beside the theme picker.
Updated Visual application startup and HTML to remove obsolete header file loaders.
No alternate deck-loading path remains in that host. Existing numbered/drop
Library destinations are unchanged.

Changed Visual library-view to show Manage at the right of selected song rows only.
Behavior library-controls still owns the single selected ID and browsing state.
Changed Behavior song-management to own local open/close navigation; changed Visual
song-management-view to render inside its deck, below the unchanged Library header.
The Manage toolbar sits outside its own scrolling body, so Back remains accessible.
Library DOM is retained; Behavior saves/restores its scroll position and preserves
search, selection and expanded folders. Tapping a Library content tab leaves Manage
for that tab. Returning from the performance workspace preserves local Manage state.

Temporary individual analysis and verified BPM editing are grouped in a labeled
Development disclosure; individual analysis runs inline and shares the existing job.
It does not open a modal or block other decks. Global Import/Analyze All retain their
existing transient dialogs. CSS only changes the requested controls/Manage region.

Data flow: global DOM -> Behavior -> existing shared library/import/analysis jobs.
Row Manage action -> Behavior local navigation -> Visual pane. Relationship actions
still call canonical management/storage. No audio, song collection, selection or
analysis job is duplicated. New/modified production files were reviewed for folder
responsibility and ownership; rendering stays Visual, interaction decisions Behavior.

Tests: Library UI and analysis/architecture suites passed; nested expansion, search,
selection and scroll restored, fixed Back tested after scrolling, other deck browsing
works during Manage. Existing visual playback and iPhone regressions passed after
migrating obsolete loader fixtures to supported Library imports/destinations.
The new test-only library-loading-fixture uses isolated databases and detached
pickers; it does not restore production loaders or introduce a playback pathway.
No physical Safari verification of these new changes is inferred from prior approval.

## Increment 2 — intentional playing Queue replacement

Local checkpoint `e095e7c`.

Changed Behavior mixer/deck loadQueue: while playing, assignment replaces the one
prepared song. The same sendToDeck/queueSong coordinator paths serve numbered
selection and all existing Library drop destinations. The sounding resource, source
time, cues, gain, tempo and peers remain unchanged; normal URL retention releases
superseded prepared resources. Busy guards still reject during an in-flight operation.
Paused explicit Queue occupied-slot rejection is preserved: the new instruction's
replacement condition is a playing deck. No separate queue state/path was added.

Changed Queue, Library deck-boundary/interface and visual playback tests, plus
RULES and Queue/Library specifications. These suites passed, including each of the
four destination types, READY using the latest replacement, natural-end advance,
failed preparation, cancellation and independent peers. No Audio file changed.

## Increment 3 — scrolling source-anchored cue markers

Local checkpoint `d39513c`.

Created Visual waveform/scrolling-cue-markers, a passive renderer with eight reused
DOM markers. It reads the existing Behavior cuePositions array and the same source
position/seek preview as the scrolling renderer. Changed Visual mixer playback
wiring and CSS only; no Audio, cue assignment or seek decisions changed. Exact
four-source-second geometry is independent of Tempo. Out-of-window/deleted cues
hide; labels remain legible at edges/coincident positions while lines stay exact.

Expanded scrolling/visual playback tests compare visible lines with authoritative
overview positions, numbers, seeking, deletion and passive pointer behavior. Existing
four-deck playback/tempo/queue, waveform and iPhone regressions passed. Architecture
review: this file owns DOM presentation only, not stored cue values or a clock.

## Increment 4 — persistent BPM comparisons and explicit research export

Changed Behavior library-management to produce a compact allowlisted research
snapshot from canonical metadata/results. Changed library-analysis-controls to
prepare a local JSON Blob only on request and manage its temporary download URL.
Changed Visual library-analysis-view to present the preparation button and download
link; global controls supply the existing service directly. JSON preserves literal
song titles without spreadsheet formula interpretation. Only formatVersion and
measurement rows are exported: title, detectorVersion, detectedBpm, verifiedBpm,
difference (detected minus verified; null for unknown). Multiple detector versions
remain separate rows. No audio, paths, IDs, links, playlists or large measurements.
Exports are never written into the repository or automatically sent elsewhere.

Storage schema remains version 4; no migration or destructive storage operation
was introduced. The original V40 source, mathematical detector, decoder and worker
are byte-identical to 20657c8. Tests passed for independent detected/verified BPM
persistence after application reload and database reopen, multi-version results,
failed-retry retention, and the four supplied numeric reference pairs using generic
synthetic metadata fixtures. The actual physical phone collection was not remotely
read or modified; physical reload/download remains a device check. No algorithmic
explanation of those errors is claimed.

Native layout testing found and corrected an extra phone header row. Global
buttons now share the original first row and retain its sizing; unrelated performance
and Library geometry exactly match the preceding approved baseline at 1114x768,
768x1024 and 390x844 in all three themes. Native mouse dragstart/drop checks passed
for numbered destinations, overview and Queue. Native touch-emulated continuous
strip navigation and phone Import-dialog fit passed. These are Chromium checks,
not claims of physical Safari verification.

## Final production responsibility review

The table covers every new/modified production file in this refinement. No Audio
file changed. Tests and documentation are separate verification/reference material.

| File | Reason/folder responsibility | Owned information | Direct connections / duplication review |
|---|---|---|---|
| [library-global-controls.js](../app/behavior/library/library-global-controls.js) — new | Behavior global import/analysis actions | No second jobs or collection | Existing library-management, analysis queue and Visual import presentation; deck loading never invoked by import |
| [library-import-view.js](../app/visual/library/library-import-view.js) — new | Visual global controls and existing chooser presentation | DOM/progress display bookkeeping | Behavior supplies job state and binds events; no import or navigation decisions |
| [library-controls.js](../app/behavior/library/library-controls.js) | Behavior per-deck selection, tabs, row interactions and Manage return | Existing per-view browsing and saved list scroll | Canonical library service, song-management, Visual rows and existing deck-loading action; no duplicate collection or playback |
| [song-management.js](../app/behavior/library/song-management.js) | Behavior deck-local open/close and relationship/manual-BPM actions | Managed ID, open state, stale-read guard | Canonical service, shared analysis job and Visual pane; no second job or song metadata cache |
| [library-view.js](../app/visual/library/library-view.js) | Visual rows, selected-row Manage and retained browsing DOM | DOM only | Behavior supplies selection/navigation/snapshots; no handlers or sorting decisions |
| [song-management-view.js](../app/visual/library/song-management-view.js) | Visual fixed toolbar, scroll body and development disclosure | DOM/input draft presentation | Behavior supplies canonical snapshots/progress; no relationship mutation or job decisions |
| [library.css](../app/visual/library/library.css) | Visual global controls, selected rows and local Manage styling | No state | Existing hierarchy; phone control sizing preserves deck geometry |
| [application.js](../app/visual/mixer/application.js) | Visual startup assembly and presentation callbacks | Existing DOM/shared component references | Direct Behavior services/actions; obsolete direct-file loader and its decisions removed |
| [playback.js](../app/visual/mixer/playback.js) | Existing Visual deck component; supplies pane hosts and reads source-time cues | Existing deck DOM; no new musical state | Behavior Library bindings and Visual waveform cue renderer directly |
| [tunetox.html](../tunetox.html) | Visual entry removes obsolete loader mount | No new state | Existing script/module order unchanged |
| [deck.js](../app/behavior/mixer/deck.js) | Behavior approved Queue assignment rule | Existing single prepared Queue only | Existing coordinator/Audio; source/cue/transport state untouched on replacement |
| [scrolling-cue-markers.js](../app/visual/waveform/scrolling-cue-markers.js) — new | Visual passive source-time cue rendering | Eight reused DOM nodes, no cue values or clock | Existing live cuePositions and source/preview position; same four-second scale as waveform renderer |
| [playback.css](../app/visual/mixer/playback.css) | Visual passive marker lines/labels and playhead stacking | No state | Cue overlays cannot intercept input; existing waveform geometry unchanged |
| [library-management.js](../app/behavior/library/library-management.js) | Behavior canonical queries/export field selection | Existing import job; no export cache | Existing storage reads; compact metadata snapshot only |
| [library-analysis-controls.js](../app/behavior/library/library-analysis-controls.js) | Behavior explicit export interaction and Blob URL lifecycle | Temporary export URL/guard, existing job target | Shared queue, canonical library and Visual link; no duplicated results or decoding |
| [library-analysis-view.js](../app/visual/library/library-analysis-view.js) | Visual job progress and explicit download link | DOM only | Behavior prepares file and binds actions; no export/storage/analysis decisions |

New test-only library-loading-fixture replaces removed UI dependencies with supported
Import and numbered destinations inside isolated browser databases. It is not loaded
by production. UI tests verify local Manage context and peer independence. Queue,
scrolling, existing playback, iPhone and theme regressions verify current paths.
Boundary checks and manual review separately verify layer responsibilities.

Remaining architectural concerns: pre-existing waveform/fader gesture interpretation
and performance/Library workspace switching still reside in the older Visual deck
component. Those unrelated handlers were preserved, not duplicated or expanded.
The previously noted Visual host direct-file loading concern is resolved by removing
those obsolete controls. Unused historical loader CSS selectors remain harmless;
no broad theme/iPhone refactor was undertaken. No new routing, adapter, playback
path, synchronization system or authoritative-state duplication was introduced.

Remaining verification: physical Safari review of the new row Manage, fixed Back,
cue label legibility, download behavior and listening during Queue replacement;
large-library/storage-pressure testing. Prior physical acceptance applies to the
preserved foundation, not automatically to these new changes. The prototype detector
retains known errors; this task deliberately does not diagnose or change its math.

Final verification: all seven existing/expanded browser suites passed together
(Library foundation, Library UI, BPM analysis/architecture, Queue, visual playback,
iPhone and Glass theme). Editor diagnostics, production syntax and whitespace
checks passed. Native Manage checks passed across nine theme/viewport combinations:
no overflow/modal, Back stays visible after scrolling, native Back restores exact
list scroll. Phone Manage screenshot was inspected. Both existing HTTP and HTTPS
previews returned 200; server configuration/certificates were not changed.
