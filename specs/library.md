# Shared persistent Library — current contract

## Scope and approved layout

All four existing deck Library workspaces browse the same persistent collection.
Their header tabs, Title/BPM/Key/Artist row, search field, song list and numbered
1–4 destinations retain the approved hierarchy and positions. Each workspace keeps
its own search, sort direction, selection and scroll position. There is no new
library area and no requirement to choose a historical panel arrangement.
The current human clarification supersedes the earlier unresolved placement notes.

The working application before this increment is preserved at local checkpoint
`checkpoint/pre-library-20261126` (`7045e4e`). Existing waveform analysis/rendering,
Audio DSP and transport execution are unchanged.

## Ownership and modules

- [library-storage.js](../app/behavior/library/library-storage.js): version-1
  IndexedDB `tunetox-library-v1`, separate `songs` metadata and `sources` Blob stores.
  Metadata and source commit atomically; SHA-256 identity prevents renamed/concurrent
  duplicates from overwriting existing metadata. Dependent writes run inside IDB
  request callbacks rather than after arbitrary awaits, preserving Safari transactions.
- [library-management.js](../app/behavior/library/library-management.js): one shared
  import job/service; sequential hash/store, cancellation, per-file failures,
  search/sort and validated manual BPM setter. IndexedDB is authoritative; there
  is no second library cache. Event notifications request fresh reads, not state
  synchronization. A file being imported never enters a deck action.
- [library-view.js](../app/visual/library/library-view.js): binds the existing DOM
  controls and renders rows safely as text. Each instance retains presentation
  state only. A transient Import chooser supports multiple files/folders, progress,
  cancellation, errors and a persistence request. It does not replace the Library
  layout. Shared drag/drop handling accepts only the library's custom song-ID MIME
  type, with 64-character hash validation and a canonical IDB lookup.
- [library.css](../app/visual/library/library.css): scoped functional states, Import
  action in the existing footer line, and transient chooser styling. Existing
  performance/library geometry is retained across all three themes.
- [application.js](../app/visual/mixer/application.js): resolves the stored source,
  creates an existing Audio-owned object URL, and calls the existing deck coordinator.
  Temporary playback resources carry identity/name/URL, not editable library metadata.

## Import and persistence

Import adds to the collection without replacing earlier batches or loading any
deck. Folder FileLists include nested paths. Sidecars/unrecognized extensions are
skipped; empty files fail individually. Audio MIME types/known audio extensions are
admitted without decoding at import, so a mislabeled/corrupt file may be retained
and later fail playback/analysis safely. Duplicate checking requires HTTPS or localhost.

Read/hash/store one file at a time. Browser reads/hashes already underway may finish
on cancellation, but cancellation is checked before starting the storage transaction.
Completed files remain, pending files do not resume automatically after restart.
Quota failures produce per-file reports without orphaned metadata. Import progress
is shared across views, while lists refresh from canonical storage after completion.

Metadata retains source hash, filename, inferred Artist - Title, nested relative
path, size/type, import timestamp, nullable verifiedBpm/verifiedAt, and nullable key.
New BPM and key values remain unknown: no guesses, tags or filename-based BPM/key
extraction. Sorting BPM uses the stored verified BPM; Key uses supplied stored key
text with natural ordering. Unknown values stay last in either direction; no musical
key ordering is invented. Repeat a sort button to reverse direction.

The existing manual BPM setter preserves a distinct field, accepts finite values
above 0 through 1000 (including decimals), and treats null as explicit clearing.
No new metadata editor or detector/analysis control is added to the approved layout
in this increment. Experimental algorithms, bulk analysis, and large regenerable
measurement persistence remain disconnected. No decoded songs are retained by the
library. Search covers title, artist, filename, path and supplied BPM/key. Lists
render 100 rows initially with Show more for larger collections.

## Loading and Queue destinations

Selecting a row (mouse, touch, Enter/Space) enables its view's existing 1–4 buttons.
Clicking a numbered button or dropping a song on one calls the same host action.
The four full-song overview waveforms are also library drop destinations:

- Empty/paused deck: existing `sendToDeck()` loads paused, without autoplay.
- Playing deck: existing `sendToDeck()` fills its one Queue slot without interrupting
  the sounding source; an occupied slot is retained with feedback.
- Explicit Queue drop: existing `loadQueue()` fills an empty slot even while paused
  or empty, leaving current source, cues and playback untouched. The coordinator's
  new `queueSong()` method only exposes that existing action under its normal guard.
  It does not add a queue store, second player or alternative playback pathway.
- Busy deck: existing operation guard applies; host reports busy and asks to retry.
  Occupied Queue rejection, READY/manual play and natural-end swapping are unchanged.

Loaded, queued and loading URL references retain the existing cleanup policy.
Rejected file URLs are released; the persistent source stays in IndexedDB. Dropping
unrelated files, URLs or malformed song IDs does not invoke library playback.
Overview absolute seeking and scrolling-waveform gestures remain unchanged.

## Explicitly unfinished

Playlists and Links remain disabled and labeled not implemented. There is no
playlist creation/editing/membership/navigation or song-link creation/removal/search
workflow in this increment. No new behavior is inferred from V40 or old designs.
Bulk BPM analysis, detector comparisons, analysis-detail presentation and metadata
editing UI are separate later increments. Touch selection plus 1–4 provides a shared
alternative where native drag/drop is unavailable or awkward.

## Storage limits and verification

Libraries belong to an exact browser origin (scheme, hostname and port), not a Git
folder or account. HTTP/HTTPS, localhost/LAN addresses, browsers and devices have
separate stores. Keep original music: clearing site data, private-mode lifecycle or
browser eviction can remove a local library. Persistence requests may be denied;
no fixed capacity or permanent retention is promised. See [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
iOS Safari added folder selection in 18.4; older versions need multi-file selection.
See [WebKit Safari 18.4 notes](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).
Physical Safari/iPad import, restart persistence and large-library limits remain
separate device checks.

[Foundation checks](../tests/library-tests.html) use disposable named databases and
synthetic sources: atomic persistence, duplicate protection, nested paths, quota
failures, cancellation, search/sort, manual BPM safety and import guards.
[Interface checks](../tests/library-interface-tests.html) remap only the test frame's
library database name, protecting the user's actual collection. They verify batches,
folder paths, playback-preserving import, four shared/independent views, unknown
metadata, all sorts, numbered/drop destinations, occupied Queue rejection and real
application reload persistence. [Deck boundary checks](../tests/library-deck-loading-tests.js)
exercise stored Blobs through all four real coordinators, including paused Queue
behavior and operation guards. These tests do not establish audible Safari quality.

## Current sprint updates

The subsequent approved library sprint supersedes the earlier “Explicitly
unfinished” inventory incrementally. See [implementation and verification log](../docs/LIBRARY-DEVELOPMENT.md).
Nested folder imports now create playlist trees. Inline expansions are independent
and multiple levels can remain open. The database upgrades additively to version 2.
Behavior owns interactions in library-controls and library-to-deck coordination in
library-deck-loading. Visual library-view only creates and presents DOM snapshots.
