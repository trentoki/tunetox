# Phase 1H H4 — responsive Library and queue review

**Open:** http://192.168.50.24:8765/development/design-mode/responsive/?build=h4

Same Mac/Wi-Fi preview server as H3. Header reads **H4 · NO AUDIO**.
This is an isolated, session-only Design Mode experiment: fictional metadata,
illustrative waveforms, simulated playback clock, gains, matching, cue actions and
queue. No native audio engine, IndexedDB, audio media or external service is used.

## Layout and interaction

H3's fixed frame, D-label matching popovers, local Tempo/Pitch, Play/Main, overview,
continuous captured-pointer selector and four permanently mounted stems are retained.
Only the center changes between Wave, Cue and Controls. Cue distributes eight pads
(two rows of four), Loop, held Repeat and Shift throughout that region. Controls
spreads Filter/EQ and three FX across the region, with at least 44px dials. Shift+Cue
still deletes a preview cue; no real quantization or musical rules were changed.

Landscape defaults use the requested values: 44px Tempo/Pitch, 3px row spacing,
36×156px selector, 1px selector spacing, 50px matching targets, 36px Play/Main with
6px spacing, 46px overview, 360px target center, 244px stems, minimum 36px fader
rows, and 44px minimum cue pads. Portrait starts with 40px overview, 168px center,
144px stems, 132px selector and 36px cue targets. Deck padding stays 5px.

Design tools edit the current orientation only. Rotation restores that orientation's
previous edits; Reset resets only the current preset. These settings are intentionally
in-memory, not saved preferences. H3's responsive arrangement is retained: four
columns on landscape tablets, four visible decks in a 2×2 tablet portrait grid,
one full-width selected deck on phone portrait. Layout switches never change deck
songs, positions, levels, matching or simulated playback.

Available space limits the center instead of forcing the requested 360px. At
1194×834 it is about 326px; at 1024×768 about 260px. Portrait uses compact defaults;
320×568 phones retain all stems and contract the center to about 118px. Cue/Controls
can scroll internally on short screens. The performance document does not scroll.
Titles truncate beside the selector; full titles remain accessible via Library.
These are responsive compromises for physical review, not finalized proportions.

## Library and Manage

Library takes over its entire deck. The top row contains deck identity,
**Songs | Playlists | Links** (tap or continuous slide) and an accessible Return
arrow. The former navigation row now contains contextual sorting and direction.
Songs/linked songs support Title, BPM, Key and Artist; BPM is numeric, Key is a
metadata-label sort, not harmonic ordering. Playlists use playlist-name ordering.

The same shared song and playlist row factories are used normally and in Manage:
64px song rows, 56px playlist rows, unchanged typography. The gear icon retains its
accessible Manage label. Manage expands existing user links, offers unchecked
candidates and playlist membership checkboxes. Playlist names browse that playlist;
its song checkboxes link to the original managed song, which remains identified.
Back returns to the summary; Done returns to browsing. List scroll, independent
per-deck navigation, per-playlist searches and selections survive these changes.
Sorting does not clear links, membership or selected songs. Original song data,
manual links, read-only All examples membership, loading buttons and playlist
HTML drag/drop concepts remain shared, simulated behavior.

Expandable Local, Apple Music/iTunes and SoundCloud groups appear within Playlists.
External examples explicitly have no connection, import, authentication or playback.

## Queue / load / Swap

- Empty deck: load current song, reset preview position, stay stopped.
- Loaded nonplaying deck: retain replace-without-autoplay behavior.
- Playing deck: queue the song; do not replace the current title/waveform, position,
  playing flag, Main, stems, matching or other decks.
- Successful loads select only the destination deck's Wave performance view, even
  when queuing. Its full-panel Library closes if open.
- **NEXT** appears in the song-title column, with the entire column as its tap
  target. Tap to inspect title and artist. No second waveform or overview movement.
- **⇄ Swap** appears beside Play/Main only with a queued song. It consumes the next
  song, starts its simulated playback at zero, inherits outgoing levels and leaves
  other decks unchanged. Main remains available.

Queue overflow was not specified: this prototype keeps one next-song slot and
reports “Swap first” instead of silently replacing an occupied slot. Multi-item
queue ordering, replacement policy, real timing/crossfades and live integration are
not implemented or inferred as approved production behavior.

## Files and checks

All new implementation is in this directory:
`index.html`, `state.js`, `queue-state.js`, `selector.js`, `deck.js`, `design-tools.js`, `library.js`, `app.js`, `responsive.css`.
The frozen H3 state, matching popover, header layout and CSS are reused unchanged,
alongside the original shared simulated controls.
No dependencies were installed. Fictional text is rendered through DOM textContent;
search and sorting stay local. No external-service network code was added.

Run state checks: `osascript -l JavaScript development/design-mode/responsive/run-tests.js`.
Browser checks: `browser-check.py` uses an isolated Chrome CDP session on port 9230
and the actual served LAN page. Native touch dispatch checks mode changes before
finger release; it does not establish physical Safari fluidity or audio behavior.
See [verification](review/verification.json) and [measurements](review/measurements.json).

[Landscape mixed modes](review/h4-landscape.png) · [Tablet portrait](review/h4-portrait.png) ·
[Phone](review/h4-phone.png) · [Short phone](review/h4-phone-small.png) ·
[Manage](review/h4-manage.png) · [Library](review/h4-library.png) · [Queued song](review/h4-queue.png)

## Physical review

1. Rotate iPad; edit a center dimension in each orientation and rotate back. Reset
   one preset and confirm the other remains as edited.
2. Hold/slide Wave→Cue→Controls and reverse without lifting. Check that stems,
   overview and transport stay fixed; try Cue Shift deletion and knob gestures.
3. Open Library; slide Songs→Playlists→Links. Try sorting, Manage checkboxes,
   playlist browsing and Back/Done. Scroll lists without moving the page.
4. Start an example, open Library, select another song and load it into that deck.
   Confirm the current song keeps moving in Wave and NEXT appears. Inspect NEXT,
   then Swap; confirm the incoming title starts at zero with inherited stems.
5. Repeat on phone, switching decks during simulated playback. Review compact
   center scrolling and selector readability at small widths.

Stop after physical review. H4 is not integrated into G2.

Verification completed: **77 H4 state checks (38 inherited + 39 queue/sorting checks),
106 H4 served-browser checks** across seven viewport sizes. Preserved suites also
passed: H3 38 state/74 browser; H2 44 inherited + 21 H2 state/62 browser;
H1 41 state/70 browser; original Design Mode 77 state/1084 browser. Comparison
captures were redirected to `/tmp` to preserve existing review artifacts. All 130
pre-task protected files, 190 G2 protected files and the G2 archive match their
hashes. Native audio regressions were not rerun for this isolated UI task; no new
audio or physical Safari success is claimed. Preservation evidence:
[pre-task hashes](review/baseline-sha256.json).

Documentation appended only the H4 experiment record to root `RULES.md` and
`TUNEFLOW_DESIGN.md`; pre-existing changes in this workspace were preserved.
