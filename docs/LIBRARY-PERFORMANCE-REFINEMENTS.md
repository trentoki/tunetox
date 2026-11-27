# Library performance refinements

Starting checkpoint: 20657c8. Human physical testing confirmed folder imports,
inline nested playlists, links, memberships, loaded-song Links, sliding, bulk V40
analysis and verified BPM correction. Preserve those behaviors and native drops.

## Increment 1 — global controls and deck-local Manage

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
