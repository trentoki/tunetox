# TuneTox — Approved Product Behavior

This document describes the intended behavior of TuneTox, not a claim that every feature is implemented. The four-deck application remains one system across devices. Implementation status belongs in the feature checklist and roadmap. Detailed technical contracts and unresolved mechanics belong in `specs/`.

The complete preceding RULES.md, including detailed matching/handoff contracts, tested experiments, implementation notes, and superseded proposals, is preserved without alteration at [specs/legacy-rules.md](specs/legacy-rules.md). When implementing behavior not specified in detail below, consult that record and distinguish approved decisions from historical experiments. Never silently treat an experiment as approved production behavior.

## 1. Decks and Playback

1. TuneTox has exactly four persistent decks, numbered 1–4. All remain operational regardless of screen layout or visibility.
2. Each deck supports an active loaded song and a prepared queued song. Loading does not automatically start playback. Queuing does not interrupt the current song.
3. Play starts or resumes; Pause retains playback position; internal Stop rewinds to the beginning without requiring a visible Stop button; Eject unloads, with its presentation to be determined. Play/Pause is the primary visible transport. At natural song end without a queue, the song remains loaded.
4. A queued-song swap atomically replaces the outgoing song, begins the replacement, and inherits the outgoing deck's current stem levels. Automatic advancement at song end follows this same handoff when a queue is present. Intentional assignment to a playing deck replaces its prepared Queue song without altering the sounding song. This applies to numbered destinations and Library drops on numbered buttons, overview or Queue. Existing paused explicit-Queue occupied-slot rejection remains unchanged.
5. Original song BPM and key remain distinct from current playback tempo and sounding pitch. Decks retain independent transport. Pitch-preserving time stretching is a desired capability; its DSP and limitations belong in technical specifications.
6. Layout or view changes never load/unload songs, interrupt playback, reset musical settings, or trigger matching.
7. Independent Tempo spans 0.5×–2.0×, preserves musical pitch, and uses a logarithmic slider with 1.0× exactly at its center. This ratio does not imply BPM detection or enable musical matching. The independent Pitch slider remains disabled in the current Tempo increment. Seeking uses source seconds; do not claim sample-accurate audible positioning without verification.
8. Manual nudge temporarily multiplies established Tempo by 1 ± the selected 2–50%, preserves pitch and restores established Tempo on release/cancellation without a source-position jump. Scrolling waveform controls are excluded from seeking. Double-click/double-tap Tempo resets its established ratio to 1.0; details in [nudging](specs/nudging.md).
9. Each loaded deck song has eight cue positions. An empty pad saves the current source position without seeking or changing playback. An assigned pad recalls through the existing seek mechanism, retaining paused/playing intent; it never toggles transport or starts a paused deck. Shift plus a pad deletes its cue without seeking. The existing Shift button supports hold and click-to-latch clearing; keyboard Shift also clears. Cues remain deck-local through theme/view changes and reset when the loaded song changes or is ejected. Queue preparation alone does not reset the active song's cues. Numbered passive overview and scrolling-waveform markers correspond to these same positions. End-of-song seeking retains the existing paused-at-end rule.

## 2. Musical Matching

1. Beatmatching and Tune Matching are independent, continuous musical relationships, each controlled directly by per-deck participation and defaulting ON for all four decks. Neither depends on visibility, Handoff, or interface mode.
2. The first eligible Beatmatching participant establishes the shared tempo reference. A single participant remains independent; when multiple participants are matched, tempo changes from any participant propagate to all participating decks.
3. A nonplaying deck joins tempo matching immediately. A playing deck joins without an abrupt tempo jump and converges through subsequent intentional tempo gestures, not autonomous post-gesture movement. Match Now is an approved function; its button and placement are undecided.
4. Standard 1:1, 2:1, and 1:2 tempo equivalences are automatic; prefer the interpretation closest to the song's original BPM. Tempo matching and beat-phase alignment are distinct. Advanced metric modulation remains deferred.
5. Tune Matching aligns the **current sounding key**, not merely the original recorded key, with smooth, immediate adjustment on joining. Global pitch changes move participating decks together; support fractional semitone changes without snapping.
6. Harmonic comparisons support the seven diatonic modes and major/minor pentatonic relationships, including pitch-class containment where appropriate. Preserve the previously approved detailed harmonic rules and beat-convergence examples in the archived technical record; do not invent a universal convergence formula where none was approved.
7. Turning participation OFF retains the deck's current tempo/pitch rather than resetting it. Exact multi-deck convergence, reference ties, phase behavior, and exceptional cases remain specification questions.

## 3. Stems and Handoff

1. The four functional parent stems are **Beats, Bass, Tune, Voice**. Each deck has a main volume and four stem levels in [0,1], adjustable in 0.01 steps.
2. On application startup, all four deck main volumes are **0**, all four stem levels are **1**, and per-deck Handoff participation defaults ON, subject to explicitly saved starting preferences.
3. Effective stem gain is deck main volume multiplied by allocated stem level. Handoff is a shared relationship among eligible, actively playing participating decks, independent of Beatmatching and Tune Matching.
4. Automatic gain increases are constrained by a session-wide, per-category authorization high-water mark established through qualifying direct human gestures. Authorization persists when faders are lowered and resets on application restart. A category directly authorized to 1 can automatically reach 1 on any eligible participant, subject to allocation.
5. Enabling Handoff does not abruptly normalize existing levels. Before shared allocation is established, lowering one stem does not automatically raise another. Once established, lowering one may proportionally raise eligible others, and reversals respond within the same gesture.
6. An untouched/ineligible silent stem must not be introduced automatically. An eligible stem automatically reduced to zero may return. Eligibility is distinct from audibility and authorization; a prepared, paused, stopped, or muted deck can retain prepared levels without participating in live redistribution.
7. Starting playback gives prepared requested levels priority and transitions smoothly. Pausing or stopping a playing deck redistributes among remaining playing eligible participants smoothly. The first touched fader takes priority in simultaneous gestures. Visible controls track actual gain changes.
8. Disabling Handoff preserves current allocations without jumping to prior manual levels; re-enabling alone does not synthesize a gesture or normalize. Queued replacements inherit the outgoing stem levels.
9. Exact eligibility initialization, rounding, multiple-participant distribution, gesture mathematics, and transitions belong in `specs/stems-handoff.md`. Preserve the archived detailed rules and do not substitute historical immediate-cap behavior.

## 4. Library and Organization

1. One shared library serves all four decks and supported devices. It holds songs, playlists, musical metadata, and user-created song relationships.
2. The two primary library areas are **Playlists** and **Songs**, including an **All Songs** collection. Playlist membership need not duplicate underlying audio files.
3. Search songs, artists, and playlists, including BPM and key filters. Ranking and grouping describe musical relationships without prescribing what musicians should combine or unnecessarily hiding discoverable content.
4. Preserve playlist and song navigation, selection, scrolling, and useful browsing context across views. Library functionality is shared regardless of which deck opens it.
5. Support drag-and-drop songs to playlists and decks, and drag a song onto another song to create a user-defined link; support multiple-song selection and playlist operations, accessible alternatives to touch dragging, playlist renaming, undo for supported edits, and avoidance of unintended duplicate imports.
6. User-created links between songs must be visible and navigable, distinct from automatic analysis. Connections may affect display, grouping, and order without preventing independent browsing or sorting.
7. Song loading, queueing, and replacement obey Sections 1 and 3 and do not interrupt other decks. BPM-first versus key-first ordering, linked-song placement, sorting priority, and precise drag semantics belong in `specs/library.md`; retain earlier decisions and discussions rather than inventing new ones.

## 5. Sampler

1. An integrated performance sampler prepares and performs sounds from songs and their separated stems without replacing deck playback or changing Handoff allocations.
2. Each song kit contains four parent stem kits: Beats, Bass, Tune, Voice, with instrument pages and pads. Tabs select Decks 1–4 and their associated song kits.
3. Melodic pads are chromatic. Prefer authentic source notes, visually distinguish pitch-shifted substitutes, and allow manual sample selection. Pads support one-shot and gate modes.
4. Beats can subdivide into kick, snare, hats, clap, and other percussion. Further instrument separation is sampler-only and does not alter parent performance stems.
5. A sample editor offers zoomable waveforms, start/end boundaries, preview, note markers, and pad assignment. Preparation may be offline.
6. **Sampler Attenuation** controls normal playback of a parent stem globally across decks **after** Handoff allocation; it never changes Handoff authorization or levels. Sampler output has its own volume. Switching decks while focused on the same parent stem retains attenuation; switching parent stems restores the previous parent's entry attenuation.
7. Lock an entire song kit or individual stem kits across deck/song changes; unlocked kits follow the selected deck. Alternate source selection prioritizes its queued song, other deck queues, then the library.
8. Melodic sampler pitch follows its associated deck's Tune Matching; percussion is exempt. Transposition changes sounding pitch, not pad positions. Sample triggering does not change deck transport or timeline synchronization.
9. Precise playback, routing, transitions, kit state, and future advanced layers/learning overlays belong in `specs/sampler.md`. The sampler is planned, not asserted to be implemented.

## 6. Recording and Creations

1. Capture audible performances, mixing, stem manipulation, and supported sampling without unexpectedly interrupting playback.
2. Support recording passages and loops with relevant tempo, length, timing, and quantization context, and development through overdubs while preserving available layers/history.
3. Provide a **Bin** for saved musical creations, recordings, loops, samples, and other supported material, with accessible playback and reuse.
4. Preserve source songs, stems, decks, samples, tempo, key, pitch, loop timing, Beatmatching/Tune Matching/Handoff relationships, and overdub/history where relevant.
5. Distinguish saved creations from temporary/unsaved state. Reusing creations must not unexpectedly overwrite active performance settings. Formats, recording routing, persistence, and restoration belong in `specs/recording.md`.

## 7. Interface and Customization

1. One expressive, responsive interface adapts across devices without changing the four-deck musical system. Keep controls compact, readable, tactile, and immediately responsive.
2. The primary interface consists of **four decks**. Each deck has alternative **Performance** and **Library** workspaces. Performance has a persistent header and two independently switchable content sections: upper **Wave / Stems**, lower **Cues / Controls**. The Library view distinguishes Playlists and Songs and maintains useful navigation context.
3. The upper Wave view presents the scrolling waveform and playback time; the persistent header retains the full-song overview and transport. Upper Stems contains the four stem faders. Lower Cues contains cue and loop controls; lower Controls contains filter, EQ and effects, without stem faders.
   The scrolling waveform uses real decoded data beneath a stationary centered
   playhead. Dragging right seeks backward and dragging left seeks forward through
   the existing shared seek action. Both waveforms track the same source position
   across playback, Tempo changes, cues and Queue swaps; display gestures do not
   create a separate playback clock or change another deck.
   The scrolling window defaults to four source seconds, independent of BPM, with
   a saved global 1–8-second zoom in 0.5-second steps. Detailed
   analysis uses approximately 5 ms sample groups and preserves transient extrema;
   Tempo changes scrolling speed rather than waveform shape or horizontal scale.
4. Each deck independently retains both section selections, including across Library round trips. All four decks default to **Wave + Cues**. Switching a section must not reset the other section, another deck, playback, queue state, or musical participation. This supersedes the combined Wave/Cue versus Controls switch.
5. The iPhone layout displays one existing shared deck at a time, selected immediately by compact tabs 1–4. All four decks remain operational; switching visibility never recreates Audio/Behavior objects or resets playback, songs, queues or control values. A separate handle below the tabs expands downward and collapses upward into an empty Transition area; its musical controls remain undecided. On iPhone, the four existing stem faders are vertical and side by side, retaining their names, ranges, values and actions. D2 also uses vertical stems within the unchanged iPad portrait allocation; landscape remains unchanged. Preserve all themes and other existing iPad/desktop layouts. Responsive thresholds and gestures are documented in `specs/interface.md` and remain subject to physical device review. Visibility never determines musical participation.
6. Support deck accent colors, coordinated waveforms/controls, themes, accessible input alternatives, and isolated Design Mode experiments. Never merge prototypes into working audio without review.
7. Detailed view gestures, cue behavior, dimensions, navigation, and customization belong in `specs/interface.md`; historical v40 is inspiration, not a mandatory implementation.

Current Library increment: all four existing deck Library views share one persistent
collection while retaining independent browsing. Import adds files/folders without
loading a deck. Existing 1–4 buttons and song drops onto them/overviews use the
normal paused-load/playing-queue behavior. Explicit Queue drops fill only an empty
slot without replacing the current song, even while paused. Occupied slots on paused explicit Queue destinations remain protected; playing assignments replace the prepared song. Unknown BPM/key are not invented. Nested playlists expand inline and
reference shared songs. Manage operates on one selected song with independent
reciprocal links and playlist memberships; Links follows the loaded deck song,
including paused loads. Both existing strips support tap and continuous sliding.
Individual/Analyze All use versioned original V40 analysis, sequential progress,
cancellation and per-song failures. Verified BPM is separate and never overwritten.
Import and Analyze All are global controls near themes; header direct loaders are
removed. Manage appears on selected song rows and opens inside that deck's Library,
with its own fixed Back and preserved browsing context. Development BPM controls
remain separately labeled. Manage All Songs is collapsible; playlist membership checkboxes
and inline expansion buttons are independent, and song-link state is shared across
all displayed occurrences. Explicit research export includes only compact metadata.
No multi-selection, Link All or bulk membership assignment is implemented. See [Library contract](specs/library.md).

## 8. Controls and Settings

1. Touch, mouse, keyboard, and future MIDI controls invoke shared, consistently identified application actions. Controls have stable IDs independent of visual placement.
2. Each deck has independent transport, volume, stems, tempo, pitch, and participation controls, subject only to its approved shared musical relationships.
3. **Direct Participation Controls:** Beatmatching, Tune Matching, and Stem Handoff each operate as a shared musical relationship among participating decks. Each deck has a direct ON/OFF participation control for each feature. There is no additional global participation switch required to activate these relationships. Changing one deck's participation affects only that deck's membership in the selected relationship, following the feature's approved musical behavior. Other genuinely application-wide controls may exist where needed, but must not introduce redundant layers of participation.
4. Factory defaults, saved starting preferences, and temporary performance-session changes are distinct. Session changes do not silently overwrite saved defaults.
5. Settings should be discoverable without cluttering performance. Support visual preferences and understandable feedback without interrupting audio.
6. Provide an accessible account/session panel showing, where supported, identity, sign-in methods, connected services, session, collected data, export/deletion, sign-out/switching, and ownership of libraries/projects.
7. Validate and version persisted preferences; invalid data must not corrupt state. Offline settings must not assume cloud sync. Detailed action IDs, schemas, and mappings belong in `specs/controls-settings.md`.

## 9. Data and Application Behavior

1. Protect users' imported music, playlists, links, preferences, recordings, creations, and musical work from unintended loss. Keep local/offline use available where supported.
2. Support seamless, modular transfer of an active session across devices, preserving deck songs and positions, playback and queue state, tempo/pitch, stem allocations, mixer controls, sampler assignments, and relevant musical relationships.
3. Cross-device conflicts must be detected and resolved clearly rather than silently overwriting work. Do not assume synchronization is already implemented.
4. Maintain clear ownership of libraries, projects, and creations by account. Provide understandable privacy, data-collection, backup, export, and deletion controls.
5. Prefer versioned, validated, recoverable data formats and safe migrations. Distinguish temporary state, saved settings, saved creations, and synchronized data.
6. Data operations and interface changes must not unexpectedly interrupt live playback. Detailed storage, transfers, conflicts, recovery, security, and privacy belong in `specs/data.md`.

---

**Frequency waveform colors (overview and scrolling visually approved, 26 November 2026):** Analyze decoded source energy in Low (<200 Hz), Mid (200–4,000 Hz), and High (>4,000 Hz) ranges on the detailed waveform time grid. Low uses the deck accent; Mid rotates its hue 90°; High rotates it 180°. Shared analysis remains independent of Visual and available for future BPM work. Apply the same mapping to the full-song overview using aggregated existing frequency energy per column. Preserve geometry, playback indicator and absolute seeking. These ranges are provisional. Separate per-band rhythmic analysis is authorized as an offline exploration only; no final BPM selection, matching integration or performance-interface change is approved. See [waveform specification](specs/waveform.md).

**Documentation boundaries:** `AGENTS.md` governs development workflow; `RULES.md` governs intended product behavior; `specs/` retains detailed technical contracts; `TUNETOX_PLAN.md` governs roadmap/context; the master feature checklist tracks implementation and verification. Approved behavior is not proof of implementation.

**D2 orientation experiment:** Settings contains theme/deck-color preferences and a
saved global Horizontal/Vertical scrolling waveform choice, initially Horizontal.
Vertical uses the same scrolling waveform box, colors/cues and authoritative source
position with a stationary horizontal playhead. Playback scrolls upward; dragging
up advances/down rewinds. The overview remains horizontal. Global Import and
Analyze All remain directly accessible.

**D2 deck interactions:** A successful paused deck load returns only its destination
Library to that deck's retained performance sections. Queuing alone never closes a
Library. Shift remains a deck-local held/latched modifier, currently used for cue
clearing. Performance text selection and callout menus are suppressed; actual text
fields retain normal editing.

## Human readability of implementation

- Organize code according to conceptual relationships rather than merely grouping
  declarations by instruction type.
- Keep related declarations and operations physically close wherever initialization
  dependencies permit.
- Favor a progressive, understandable human reading order.
- Prefer descriptive naming and readable formatting over compactness.
- Minimize the number of places a reader must visit to understand an operation.
- Do not introduce unnecessary functions, files, abstractions or intermediate layers
  for organizational purposes.

These principles support the existing Visual, Behavior and Audio responsibilities.
They do not authorize unrelated restructuring during an approved musical increment.

**Global waveform zoom and portrait direction:** The directly accessible top-strip
Waveform Zoom controls set one saved visible duration for all four decks: 1–8 source
seconds in 0.5-second steps, default 4. Drawing, cue positions and drag distances use
that same Behavior-owned value. The centered playhead, analysis, playback and full-song
overview are unchanged. The existing tablet portrait layout always shows horizontal
scrolling waveforms; landscape restores the saved Horizontal/Vertical preference.
Rotation never changes established musical state or interrupts playback.

**Experimental waveform coloring:** Settings selects Deck shades (default for this
experiment) or the retained Complementary hues. Both waveform views blend the same
relative frequency energies: saturated deck hue for Low, lighter same hue for Mid,
near-white for High. Analysis, amplitude and source-time geometry are unchanged.

**Temporary waveform comparison experiment:** In landscape Vertical mode, dragging
at least 3 CSS pixels expands visible Wave views downward over lower controls.
Library/Stems and the overview remain unchanged. Playheads align without changing
source-time scale, and only the dragged waveform seeks. Release/cancellation restores
normal controls immediately. Horizontal/portrait retain ordinary seeking for this
initial experiment. See [waveform specification](specs/waveform.md).
