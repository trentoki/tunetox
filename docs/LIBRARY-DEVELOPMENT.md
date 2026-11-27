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

Local checkpoint `256e577`.

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

Local checkpoint `d4a9b32`.

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

## Increment 4 — search, sorting and continuous strips

Local checkpoint `849da9c`.

Created Behavior library-strip-interactions, using existing pointer-capture and
hit-testing patterns. Changed library-controls to invoke the same decisions for
keyboard/tap and continuous pointer crossing; CSS permits horizontal interaction
while retaining vertical browser scrolling/pinch. Presentation has no gesture rules.
Repeated sort taps reverse order; crossing into another sort selects ascending.
No musical key/BPM is fabricated. Search and organization remain per-view.

Application tests passed, including continuous Title-to-Artist and Songs-to-Links
crossings, independent peer views, search, supplied/unknown metadata sorting and
all previous import/Manage/loading checks. Native physical Safari gesture feel
remains a device check.

## Increment 5 — initial versioned analysis and final review

Added Audio v40-bpm, library-audio-analysis and library-analysis-worker. The full
original V40 archive functions/provenance remain unchanged in tests/reference;
the runtime post-decode mathematical body matches them exactly. Added Behavior
library-analysis-queue and library-analysis-controls, and Visual
library-analysis-view. Added Behavior library-playlist-browsing to keep tree/query
interpretation out of presentation and event bindings.

Updated storage additively to schema v4 for compact detector-version records;
management derives display/sort BPM without duplicating durable values. Updated
Manage Behavior/Visual files for analysis and protected manual BPM entry, existing
Library presentation for Analyze All and detected/verified differences, and host
assembly/wiring only. Updated README, RULES, plan, Library specification and this
verification log. New analysis and architecture tests supplement expanded existing
foundation/interface tests. No dependency installation or playback DSP changes.

Data flow: Behavior analysis queue snapshots canonical song IDs, obtains each Blob,
awaits Audio decoding/worker analysis, then stores compact results and advances.
Progress is shared across all views; presentation only reads that job. Imported
songs added after a job begins are included in the next job. Analysis uses 44.1 kHz
independent offline decoding, and releases the one-song decoder/PCM/worker scope
before advancing. Native decoding cannot be interrupted; cancellation discards it.
Success/failure attempts never write the manual BPM field. Failed retries retain a
prior result. Comparison is detected minus verified, with no octave correction.

### Functional and architectural verification

- Foundation tests passed: version-1-to-current additive migration, source/metadata
  persistence, batches, duplicate protection, cancellation, quota failures, nested
  hierarchy, references, reciprocal links and all four real deck destinations.
- Real-application tests passed: independent views, inline expansion and folder-name
  search, selection, tap/slide strips, all sorts with unknowns, Manage relationships,
  loaded/paused Links, individual/bulk analysis controls, cancellation, verified BPM,
  result comparison, native-style drops, Queue rejection and restart persistence.
- Analysis tests passed: unchanged source hash/mathematical parity, real decode and
  worker output (80 -> 80, 120 -> 120, 150 -> 75 BPM), silence/corruption failures,
  individual and sequential jobs, per-version persistence, failed retry retention,
  cancellation before decode/after PCM transfer/between songs, overlap rejection,
  compact storage and advancing real playback during analysis.
- Two previously supplied real recordings produced 113 and 126 BPM; source-file
  hashes were unchanged. Personal sources/collection data were not added to Git.
- Existing visual playback, Queue, iPhone and Glass theme suites passed in desktop
  Chromium. Those suites include four-deck transport/tempo/seeking/cues/queue and
  scrolling/overview regressions. No listening verification is inferred.
- Native Chromium geometry matched 7045e4e at 1114x768, 768x1024 and 390x844 in all
  three themes. Native mouse dragstart and Queue/overview/number destinations passed.
- Native touch-emulated iPhone strip sliding and Import-dialog fit passed.
- Editor diagnostics, production module syntax and whitespace checks passed. Boundary tests reject the
  reported Library interaction/coordination leak into Visual and analysis imports
  of Behavior/Visual. A separate manual review is recorded below.

### Per-file production responsibility review

All paths below are relative to the repository root. “Owns” means authoritative
state; temporary render/query snapshots are not another mutable library store.

| File | Why it exists / folder responsibility | Owns | Direct communication and duplication review |
|---|---|---|---|
| [library-storage.js](../app/behavior/library/library-storage.js) | Behavior durable storage and transactional integrity | Canonical songs, sources, playlists, memberships, links and detector records in IDB | Called by library-management; no DOM/decoding/playback or metadata cache |
| [library-management.js](../app/behavior/library/library-management.js) | Behavior imports, canonical queries, validation and relationships | One import job; no duplicate durable records | Storage directly; Audio detector ID for baseline queries; change notifications trigger reads |
| [library-controls.js](../app/behavior/library/library-controls.js) | Behavior interactions and panel browsing choices | One selected ID, content, sort/direction, expansion set per deck view | Existing DOM, presentation, management, Manage, strip actions and existing loading action; no playback store |
| [library-playlist-browsing.js](../app/behavior/library/library-playlist-browsing.js) | Behavior tree/search interpretation isolated from event bindings | No durable state; derived rows only | Management song-match predicate and panel inputs; no parallel collection |
| [library-strip-interactions.js](../app/behavior/library/library-strip-interactions.js) | Behavior tap/slide/keyboard interpretation | Temporary pointer capture and duplicate-click guard | Existing strip DOM and Behavior choice callback; no sort/navigation state copy |
| [library-deck-loading.js](../app/behavior/library/library-deck-loading.js) | Behavior canonical source resolution and deck coordination | No deck state | Management, existing coordinators and Audio URL owner directly; no alternate loading/Queue rules |
| [song-management.js](../app/behavior/library/song-management.js) | Behavior single-song edits and link/membership/manual-BPM actions | Managed song ID and stale-request guard | Management and song-management-view; loaded deck identity remains elsewhere |
| [library-analysis-queue.js](../app/behavior/library/library-analysis-queue.js) | Behavior sequential job scheduling, cancellation and result persistence | One analysis job/progress/AbortController | Management and independent Audio analysis; no playback Queue imports or decoded collection |
| [library-analysis-controls.js](../app/behavior/library/library-analysis-controls.js) | Behavior start/cancel/dialog interactions | Selected job target only | Shared queue and presentation; no second job |
| [library-view.js](../app/visual/library/library-view.js) | Visual existing controls/rows/import chooser presentation | DOM nodes and render bookkeeping only | Behavior calls rendering methods; no interaction listeners, sorting decisions or loading coordination |
| [song-management-view.js](../app/visual/library/song-management-view.js) | Visual one-song dialog, checkboxes and result comparison | DOM/input draft presentation | song-management supplies canonical snapshots; no relationship mutations |
| [library-analysis-view.js](../app/visual/library/library-analysis-view.js) | Visual shared-job progress/failure dialog | DOM only | analysis-controls supplies job; no scheduling/worker ownership |
| [library.css](../app/visual/library/library.css) | Visual functional states and transient dialog styling | No application state | Existing Library hierarchy; no performance geometry changes |
| [v40-bpm.js](../app/audio/analysis/v40-bpm.js) | Audio versioned reference mathematical detector | No persistent state | Worker calls pure decoded-buffer analysis; unchanged reference body, no playback dependency |
| [library-audio-analysis.js](../app/audio/analysis/library-audio-analysis.js) | Audio independent decoding and analysis worker lifecycle | One invocation's decoder/PCM/worker resources | Behavior queue invokes it; worker receives transferred PCM; no cached decoded songs |
| [library-analysis-worker.js](../app/audio/analysis/library-analysis-worker.js) | Audio CPU analysis off the UI thread | Current transferred PCM only | Audio module and V40 directly; worker lifetime bounded to one song |
| [application.js](../app/visual/mixer/application.js) | Existing Visual startup assembles existing services and views | DOM/view references; existing deck objects remain shared | Creates one library/analysis service and forwards actions to Behavior; new Library loading decisions removed |
| [playback.js](../app/visual/mixer/playback.js) | Existing Visual deck component; Library changes supply existing elements and loaded ID | Existing deck DOM/presentation | Calls Behavior Library controls/drop binding directly; no new library state or destination rules |
| [deck.js](../app/behavior/mixer/deck.js) | Existing Behavior coordinator; queueSong exposes existing loadQueue under existing guard | Existing persistent deck state and guard | Existing Audio and approved Queue action; no second queue/store |
| [tunetox.html](../tunetox.html) | Visual application entry loads scoped Library CSS | No new state | Existing script order/modules retained |

No remaining Library interaction, storage, relationship, scheduling or deck-loading
ownership was found in the new Visual presentation files. No duplicated playback
state, routing adapter or collection synchronization system was introduced.

**Inherited architectural concerns:** the existing playback Visual component still
contains its older waveform/fader gesture handlers and performance/Library workspace
switching, and the existing startup host retains the older header direct-file input
handler. These predate this Library task; their interpretation remains outside the
strict responsibility split. They were reviewed and preserved under the prohibition
on unrelated playback refactoring. This is not a claim that the whole pre-existing
application already satisfies the stricter separation. A focused follow-up can move
those handlers without changing waveform/playback behavior if separately approved.

### Remaining limits / provisional implementation choices

- V40 remains inaccurate for some recordings and octave choices; no new detector,
  beatmatching or automatic tempo application is implemented.
- BPM sort uses verified then baseline detected BPM; unknowns last. Reimporting a
  folder creates another tree, while source songs deduplicate. These explicit
  implementation choices remain available for human refinement.
- Manage renders matching link candidates as checkboxes; very large collections
  need device responsiveness evaluation. No large-library benchmark or permanent
  Safari storage guarantee is claimed. Individual long recordings still require
  their decoded PCM in memory, despite sequential processing.
- Physical Safari folder picker, touch/drag feel, restart persistence under real
  storage pressure and audible playback during bulk analysis remain unverified.
- Existing experimental frequency/rhythm research files remain untouched and
  available locally. Personal recordings and saved research measurements remain
  outside these commits. No push or branch reorganization was performed.
