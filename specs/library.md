# Shared Library — current implementation contract

The existing four deck Library workspaces retain their approved layout. One
persistent collection serves all four. Historical libraries are references only.

## Ownership and data flow

Visual creates existing controls, rows and transient global Import/analysis dialogs and deck-local Manage panes.
It displays Behavior-supplied snapshots and owns no selection, sorting, navigation,
import, relationship or loading decisions. Behavior binds those controls, owns
per-view browsing, import operations, storage, relationships and analysis jobs.
Audio alone decodes and performs musical analysis.

Existing DOM -> Behavior library-controls -> library-management -> library-storage.
Behavior supplies rows -> Visual library-view. Manage uses song-management Behavior
and song-management-view presentation. Library deck loading resolves a canonical
song/source and directly calls the existing playback coordinator; Audio retains its
URL and playback ownership. No adapter, routing layer or second deck state exists.

See [per-file architecture review and increment results](../docs/LIBRARY-DEVELOPMENT.md).

## Persistence and imports

IndexedDB database `tunetox-library-v1`, schema version 4, contains:

- `songs`: one metadata record per content SHA-256, including unknown/verified BPM
  and key. Artist/title are inferred only from an Artist - Title filename.
- `sources`: read-only source Blobs, keyed by the same content identity.
- `playlists`: folder names and parent playlist IDs.
- `memberships`: unique song/playlist references.
- `links`: reciprocal unordered song-ID pairs.
- `analysisResults`: compact results keyed by song ID and versioned detector ID.

Additive upgrades retain older songs and original source Blobs. Metadata/source
insertion is atomic; duplicate imports never overwrite existing metadata. Import
reads/hashes/stores sequentially, adds to previous batches, and never calls deck
loading. Cancellation retains completed work; in-flight native reads/hashes finish
before cancellation checks. Per-file errors and quota failures are reported.
Sidecars are skipped. Corrupt audio can import but subsequently fails decoding.

Import Songs chooses multiple audio files. Import Playlist chooses a folder and
creates nested playlists from relative paths. Each folder import creates a distinct
playlist tree; identical audio remains one shared song across trees. Songs belong
to their immediate folder, not implicitly to ancestors. Empty folders cannot be
recovered from the browser FileList. A failed playlist write can leave an already
imported song in Songs; reimport or Manage can add membership. Interrupted jobs do
not resume automatically. Original files are never changed.

## Browsing, selection and loading

Each deck's Behavior owns its content tab, search, sort, direction, single selected
song and expanded playlist IDs. Multiple folders may remain open inline; opening
one does not navigate away. Song rows and relationships are read from canonical
storage, not mirrored in another mutable library cache. Query snapshots are transient.

Songs covers the entire collection. Playlists shows nested inline folders. Links
shows explicit connections of the song currently loaded on that deck, paused or
playing, and follows queue replacements too. Manage instead captures the library
song selected when its pane opens. Links are reciprocal and unique; self links
are rejected. Playlist membership changes and links are independent. Adding a
membership never removes another. No multiple selection, Link All or bulk assignment.

Search matches songs, artists, filenames, source paths, supplied BPM/key and playlist
names. Playlist search retains ancestor context and includes contents below a
matching folder, without changing expansion state. Lists initially render 100 song
rows per opened folder/list; Show more increases that limit. Manage has a song
search field for finding link targets.

Both existing strips support tap, keyboard click and captured continuous pointer
sliding. Crossing into an organization option chooses ascending order; tapping the
same active sort again reverses order. Unknown BPM/key sorts last in both directions.
BPM sorting uses verified BPM when present, otherwise V40 detected BPM; this metadata
ordering never changes playback tempo. Key uses natural text order; no musical key
ordering or unknown values are invented.

Selected row + 1–4 and drops on numbered buttons/full-song overview call the existing
`sendToDeck`: empty/paused loads paused; playing fills the one Queue slot. Explicit
Queue drops fill an empty Queue even on a paused/empty deck without changing its
current source/cues. Playing assignments replace an existing prepared Queue without affecting the sounding song. Paused explicit occupied Queue assignments and busy coordinators reject with feedback.
Existing READY/manual and natural-end queue behavior remain unchanged. URL cleanup
retains only existing loaded/queued/loading references. Unrelated/malformed drops
cannot trigger library loading. Touch selection + numbered buttons remains available
where native drag/drop is limited.

## Initial BPM analysis

Manage groups individual V40 analysis and verified BPM entry under a temporary
Development disclosure. These controls run inline without blocking other decks.
Global Analyze All opens
a shared-job progress dialog for the entire collection. Closing a dialog hides it;
Cancel explicitly stops analysis. Jobs run sequentially and share one guard across
all views, separate from the four playback Queues. Completed results persist.

`v40-original-1` preserves V40's mathematical detector unchanged. The exact archived
functions/provenance remain under tests/reference. Only decoding is separated:
Audio uses an independent OfflineAudioContext at 44.1 kHz, then transfers PCM copies
to a short-lived module Worker. No deck context, waveform, frequency arrays or
playback state are changed. The worker terminates after each song or cancellation.
Native decoding cannot be interrupted; cancellation discards its result and waits
before allowing another job. One song's decoded/PCM data can still be substantial.
No decoded collection, frequency arrays or regenerable onset/correlation arrays are
persisted automatically. Existing experimental analysis remains available separately.

Compact results retain detector version, BPM, sample rate, duration, analysis time
and last attempt/error. A failed reanalysis retains the previous successful BPM;
new detector versions occupy separate records. Verified BPM is a distinct field,
validated above 0 through 1000 (decimals allowed), and only explicit user entry can
change/clear it. Displayed difference is detected minus verified, without octave
correction. Manual entry never controls deck tempo. V40 inaccuracies remain: synthetic
150 BPM can return 75 BPM. No final combined experimental detector is introduced.

## Storage and verification limits

Storage belongs to an exact origin/browser/device. HTTP/HTTPS, localhost/LAN,
ports and devices have separate libraries; there is no synchronization. Keep original
music: private mode, clearing site data, quota and eviction may remove local data.
Persistence requests may be denied. See [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
Folder selection on iOS requires Safari 18.4+; older systems use multiple files.
See [Safari folder support](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).

Disposable-database [foundation tests](../tests/library-tests.html),
[real-application tests](../tests/library-interface-tests.html),
[analysis tests](../tests/library-analysis-tests.html) and
[boundary checks](../tests/library-architecture-tests.js) cover migration, imports,
relationships, controls, destinations, analysis, persistence and negative cases.
Existing playback, Queue, iPhone and theme regressions passed in desktop Chromium.
Geometry matches checkpoint 7045e4e at nine theme/viewport combinations. These checks
and advancing browser playback do not verify audible Safari quality. Physical Safari
folder import, storage pressure, large-library responsiveness, touch feel and listening
remain human/device checks. No public release readiness is claimed.


## Approved performance placement and research export refinement

Import and Analyze All now appear globally beside the theme picker. Header direct
Load D1–D4 controls are removed. Existing Library numbered buttons and drag/drop
remain the destination actions. Manage appears only at the right of selected song
rows, below which it replaces the corresponding deck's Library content. The Library
header Back and Songs/Playlists/Links strip remain above it. Manage has its own fixed
Back toolbar outside its scrolling body. Returning restores prior browsing search,
selection, expansion and scroll; tapping a Library tab leaves Manage for that tab.

The global Analyze All dialog provides Prepare BPM research export, followed by an
explicit Download link for physical Safari. JSON formatVersion 1 contains a compact
measurements array with title, detectorVersion, detectedBpm, verifiedBpm and difference
(detected minus verified; null if either is unknown). Each detector version has a
separate row. Unanalyzed songs retain null detector fields. Only these fields are
exported: no source audio, paths, IDs, links, playlist data or intermediate arrays.
JSON preserves literal titles without spreadsheet formula interpretation. Export is
requested and downloaded locally, never automatically saved to the repository.
The Blob URL is released after closing/regenerating; there is no new library cache.

Storage remains schema version 4 and V40 mathematics is unchanged from checkpoint
20657c8. Reload/reopen tests retain detected and verified values independently,
including multiple detector versions and reference comparison pairs. Browser storage
eviction and cross-origin/device separation remain the same constraints.
