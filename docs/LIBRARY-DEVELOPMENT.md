# Library sprint — local checkpoints and verification

## Increment 1 — import and deck destinations

Local checkpoint `f370832`. Foundation and real-application browser suites passed:
additive batches, SHA-256 duplicates, restart persistence, independent views,
numbered destinations, overview/Queue drops and import during advancing playback.

Created Behavior library-storage and library-management, Visual library-view and
library.css, library unit/interface/deck-boundary tests. Changed Visual application
startup and playback view wiring, Behavior deck coordinator (exposes existing
Queue action), HTML stylesheet loading, documentation and EventTarget test probes.
Source Blobs and metadata live in IndexedDB, never Git. This checkpoint initially
mixed interaction decisions into Visual; the next increment corrects that boundary.

## Increment 2 — nested playlists and architectural correction

Created Behavior library-controls (interaction/browsing ownership) and
library-deck-loading (canonical source resolution into existing coordinator).
Replaced mixed Visual library-view implementation with DOM presentation methods;
Visual playback supplies existing elements, Visual application assembles services.
Changed library-storage with additive schema-v2 playlists/memberships stores and
library-management with sequential folder import. Relationships reference song IDs;
no duplicated audio or metadata. CSS adds only inline folder presentation.

Each folder import creates a distinct tree, even if a previous import has the same
folder name. Audio still deduplicates across all trees. Direct folder membership
does not imply membership in ancestor folders. Empty folders cannot be recovered
from browser FileLists. Interrupted imports retain completed songs/memberships;
there is no automatic resumption. Large row lists remain incrementally rendered.

Data flow: existing DOM -> Behavior library-controls -> shared library-management
-> library-storage. Behavior derives rows and expansion state -> Visual
library-view renders. Loading uses library-deck-loading -> existing deck coordinator
-> existing Audio. Import never invokes deck loading. Each panel has one Behavior
browsing state; storage owns the shared collection. No adapter or synchronization
layer. Disposable-database unit and real-application suites passed; editor problems
reported none. Physical Safari and listening remain human checks.

## Increment 3 — single-song Manage and loaded-song Links

Created Visual song-management-view for transient dialog presentation, and Behavior
song-management for selected-song interaction decisions. Changed storage with
additive schema-v3 link relationships and atomic reference validation; management
owns reciprocal unique link operations and independent membership mutations.
Changed Behavior library-controls to open Manage and derive Links from the existing
deck song ID supplied by Visual playback. Visual library-view presents Manage and
state only. No multi-selection, bulk membership, Link All or new playback path.

Manage captures the selected library song when opened; Links follows the current
loaded song, including paused loads. Links are reciprocal unordered song pairs;
memberships reference individual folders and never remove other memberships.
Existing historical Manage notes were consulted for context; current requirements
supersede their multi-selection and design experiments.

Foundation and application suites passed: reciprocal/deduplicated links, removal,
invalid/self references, independent membership changes, paused/playing Links,
independent views and all previous deck/Queue/import checks. Editor checks passed.
No additional audio or playback state exists in these files.
