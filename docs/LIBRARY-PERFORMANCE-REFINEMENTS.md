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
