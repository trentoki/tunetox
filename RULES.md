# TuneToss — Behavior Rules

Project name: **TuneToss**, including the DJ application and broader music/audio research (formerly TuneFlow). Any future name is undecided. Existing file names and executable identifiers are retained for compatibility.

This file records the **agreed user-facing behavior** of TuneToss. Keep it readable and update it whenever a product decision changes. `AGENTS.md` describes how to develop; `TUNEFLOW_DESIGN.md` provides broader context. Do not treat unresolved ideas as implemented requirements. The approved matching model in section 14 and unified product direction in section 17 supersede conflicting earlier *planned* behavior; earlier sections remain as historical prototype and experiment descriptions until implementation is reconciled. Section 21 supersedes older stem joining/cap/initialization rules. Only AGENTS.md, RULES.md and TUNEFLOW_DESIGN.md are authoritative project instructions/requirements/design; older updated-named copies, if present, are historical.

## 1. Decks and interfaces

1. TuneToss has four underlying deck objects: Decks 1, 2, 3, and 4.
2. The historical metadata prototype distinguishes two-/four-deck interface modes while retaining the same four objects. Approved future phone portrait shows all four in a 2×2 grid (section 17); layouts never create a different audio system.
3. Switching between interfaces must not unload songs, reset deck settings, interrupt playback, or itself trigger synchronization.
4. Each deck begins empty and paused. A loaded song retains its **original** BPM and key in its song information, separately from current playback tempo and pitch adjustments.
5. Loading a song initially assigns that song to the chosen deck, pauses it, sets playback tempo to its original BPM, and resets that deck's pitch shift to zero. The current prototype gates matching by interface; approved future matching follows participation, not visibility (section 14).
6. Each deck has a separate cue slot, initially empty. Cueing a song must not replace the active song or change active playback state.

## 2. Historical prototype: Two-deck mixer: independent by default

**Superseded for future matching:** section 14 defines continuous, participation-based
beatmatching and equivalent tempos. This section records existing prototype behavior,
not the approved future trigger/reference model. No executable code or tests change here.

1. Loading a song in the **two-deck mixer** does **not** automatically synchronize decks.
2. Decks 1 and 2 retain their own playback tempos and musical pitches unless the user explicitly enables matching.
3. Example: Deck 1 plays at 120 BPM and Deck 2 is at 106 BPM. Explicitly beatmatching Deck 2 to Deck 1 makes Deck 2 follow 120 BPM. The chosen global tempo is then 120 BPM.
4. Explicit/manual beatmatching and tune matching are planned behaviors; their full control and precedence rules are not yet implemented.

## 3. Historical prototype: Four-deck mixer: synchronize on song load

**Superseded for future matching:** section 14 defines continuous, participation-based
beatmatching and equivalent tempos. This section records existing prototype behavior,
not the approved future trigger/reference model. No executable code or tests change here.

View-dependent load triggers below are historical. Layout changes alone still must not trigger matching.

1. **Loading any song while the four-deck mixer is displayed triggers synchronization of every loaded deck**, including Decks 1 and 2, regardless of which deck receives the song.
2. Merely opening or switching to the four-deck mixer does **not** trigger synchronization.
3. Empty decks are not assigned a playback tempo by synchronization.
4. Synchronization includes **beatmatching and tune matching** in the product design. Tempo matching is being implemented first; tune-matching logic is not yet implemented.
5. A synchronization event chooses a target tempo (`globalTempo`) and applies it to the playback tempo of every loaded deck. It must **not overwrite any song's original BPM**.
6. `cueSong()` prepares a dragged song in a separate cue slot. It stores the song and its prepared tempo and deck pitch adjustment; cue preparation does not replace the active song, start playback, or change the global tempo or key reference.
7. A cue uses `appState.globalTempo` when available; if it is `null`, the cue uses its song's original `bpm`. This fallback does not establish or change global tempo. Cued songs do not contribute to average-tempo calculations.
8. `playCuedSong()` activates a prepared cue immediately: it replaces the active song, applies the cue's prepared tempo and deck pitch shift, marks the new song as playing, and clears the cue. An empty cue does nothing. Other decks continue uninterrupted; there is no beat quantization or crossfading.

## 4. Historical prototype: Choosing the global tempo on four-deck song load

**Superseded for future matching:** section 14 defines continuous, participation-based
beatmatching and equivalent tempos. This section records existing prototype behavior,
not the approved future trigger/reference model. No executable code or tests change here.

Apply the following rules to the state at the time of loading:

1. **No decks playing:** Set the target to the arithmetic mean of the **original BPMs of all loaded songs**, including the newly loaded song. For example, original BPMs 120, 106, and 130 yield `(120 + 106 + 130) / 3 = 118.666... BPM`.
2. **Exactly one deck playing:** Use that deck's **current playback BPM**, not its original BPM, as the target, no matter which deck it is.
3. **Multiple decks playing at the same BPM:** Use their shared current playback BPM.
4. **Multiple decks playing at different BPMs:** When loading **Deck 3**, prioritize the current playback BPM of **Deck 1**, if Deck 1 is playing. When loading **Deck 4**, prioritize **Deck 2**, if Deck 2 is playing. If the preferred deck is not playing, use another playing deck.
5. **Still unresolved:** Complete deterministic tie-breaking when several other decks are playing, and the priority rules when a new song is loaded into Deck 1 or Deck 2 while multiple decks play at different tempos. Ask before inventing these rules.
6. **No songs loaded:** The average-tempo helper returns `null`; there is no target BPM. (A normal song-load event necessarily leaves at least one song loaded.)

## 5. Tune matching and pitch — retained harmonic rules

1. **Match to the reference song's current sounding musical pitch/key, not its original recorded key.** Example: an original C-minor song shifted up two semitones sounds in D minor; a newly matched song should match D minor.
2. Preserve the distinction between `song.key` (original recorded key), `deck.pitchShift` (deck-level pitch adjustment), and `globalPitchShift` (additional global pitch adjustment).
3. Pitch controls are continuous and fluid by default. Preserve fractional semitone values internally; neither deck nor global pitch is quantized by the displayed key. Global pitch does not snap to keys and is not restricted to a 12-semitone range; actual DSP limits remain unresolved.
4. Global pitch moves tune-matching participants together while preserving their established harmonic relationships. Displayed key names are the nearest conventional key, not a quantization of actual pitch. Avoid audible discontinuities; DSP limits and smoothing are implementation questions.
5. Keep the matching reference separate from subsequent global transposition: the `referenceKey` concept must be specified carefully so the app does not double-apply global pitch changes.
6. Joining an existing tune-matching group selects and applies alignment automatically and immediately, with smooth audio application rather than an audible discontinuity. **Still unresolved:** precise group reference establishment/update and missing or unsupported key metadata. Do not average key names as if they were BPM values.
7. A song key is represented as `{ tonic, mode }`, preserving the song's actual tonic and mode. Supported modes are Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, and Locrian; `major` means Ionian and `minor` means Aeolian.
8. Normalize a diatonic collection to its relative-major (Ionian) tonic. For example, C Dorian, G minor, and B-flat major normalize to the B-flat major collection. Cue matching transposes the whole song by the shortest pitch interval that makes these normalized collections equal; a six-semitone tie uses +6.
9. A playing deck supplies the current sounding key, including deck and global pitch adjustments. When cueing Deck 3, prefer Deck 1 if it is playing; when cueing Deck 4, prefer Deck 2. Otherwise choose the lowest-numbered playing deck with a valid key. If none are playing, use a valid `appState.referenceKey`; otherwise use the lowest-numbered loaded deck with a valid key. With no valid active reference, leave the cue at its original key.
10. `referenceKey` is the established matching reference before `globalPitchShift`; global pitch is applied once when deriving the current sounding key. Cueing must not establish or change `referenceKey`.
11. `calculateParentScaleTransposition(firstSong, secondSong)` is a pure calculation returning the shortest signed semitone shift to transpose the first song's parent collection to match the second's. It returns `null` when either song has an unsupported key or mode.
12. `calculateSymmetricalParentScaleShifts(firstSong, secondSong)` is a separate pure calculation that returns equal-and-opposite half-shifts for the two songs. The values may be fractional. Both calculations preserve each song's actual tonic and mode and do not alter cueing, playback, global pitch, or synchronization.
13. TuneToss reads key and mode from supplied `song.key` metadata. It does not currently detect keys or modes from audio.
14. Pentatonic keys use `song.key.scaleType` with `majorPentatonic` or `minorPentatonic`, alongside the song's actual `tonic`. Their intervals are `[0, 2, 4, 7, 9]` and `[0, 3, 5, 7, 10]`, respectively. C major pentatonic and A minor pentatonic therefore have identical pitch-class collections.
15. `getSongPitchClassCollection(song)` builds the actual collection for either a pentatonic scale or one of the seven diatonic modes. It returns `null` for an undefined/null song, a missing or invalid key, or an unsupported scale type. `comparePitchClassCollections(first, second)` reports equality and containment using pitch classes, not scale names. A pentatonic collection is compatible with a diatonic mode when all five of its pitch classes are contained in the mode's seven-note collection.
16. `findSmallestCompatibleScaleTransposition(firstSong, secondSong)` searches relative semitone transpositions and chooses the compatible candidate with the smallest absolute movement. Its `matchedPitchClassCollection` is the contained collection after the full relative transposition but before symmetrical midpoint shifts. On equal-movement ties, compare the sorted matched pitch classes numerically (C=0 through B=11) and choose the lexicographically lowest collection; do not prefer a transposition direction.
17. `calculateSymmetricalScaleCompatibilityShifts(firstSong, secondSong)` divides the chosen relative movement equally and oppositely between the songs. It returns `matchedPitchClassCollection` plus `firstSongSoundingPitchClasses` and `secondSongSoundingPitchClasses` after both midpoint shifts. C minor pentatonic with C Locrian yields `-1` and `+1` semitone shifts. These calculations are pure and are not connected to cueing, playback, global pitch, or synchronization. Discrete pitch-class searches do not quantize continuous pitch controls or impose a global pitch-range limit.

## 6. Tempo and audio behavior

1. `song.bpm` is the recorded/original BPM. `deck.tempo` is the current playback BPM. `appState.globalTempo` is the chosen shared target when synchronization is applied.
2. Tempo adjustment should eventually use time stretching so tempo can change **without automatically changing musical pitch**.
3. The existing metadata, synchronization, and cue prototype models state only. A separate temporary four-deck player now loads and plays real local audio through Web Audio, with temporary independent rate-based tempo controls that also change pitch. It does not apply the prototype's tempo or pitch values.

## 7. Current implementation and testing

1. `createDeck(id)` creates an empty deck with song/playback/tempo/pitch/volume/EQ state. Participation now lives only in `appState.participation`, with all three capabilities enabled on every deck. The unused per-deck `beatmatch`/`keyMatch` fields were removed rather than retained as a competing source.
2. `loadSong(deck, song, appState)` stores song data, resets playback state, and checks the active interface mode. The exact current implementation should always be verified in `app.js`.
3. `calculateAverageTempo(decks)` ignores empty decks, averages the original BPM of loaded songs, and returns `null` if none are loaded.
4. `appState` stores `interfaceMode`, `globalTempo`, `globalPitchShift`, `referenceKey`, and the four shared decks.
5. The retained no-decks-playing synchronization prototype averages original BPM and assigns all loaded decks that tempo. It returns without matching when any deck is playing. This historical behavior is tested separately and is not the approved future continuous matching model.
6. `cueSong()` prepares a separate cue without changing the active song. `playCuedSong()` applies the prepared cue to that deck only; neither action changes global tempo or the synchronization reference. Browser assertions cover preparation and activation.
7. Real audio playback is implemented separately in `audio-engine.js` with temporary four-deck controls in `audio-controls.js`. Normal startup leaves all metadata decks empty, retains the declared `twoDeck` presentation, and does not run demonstrations or tests. Historical metadata tests live in `tests/metadata-model-tests.js`; the explicit demonstration at `development/metadata-demo.html` uses its own state and no audio files.
8. createDeck() now initializes main volume to 0 and separate requested/allocated stem records (Deck 1 all 1, Decks 2–4 all 0). Authorization starts unestablished and tracks qualifying direct gestures; no enforcement, audio gains or handoff behavior are connected (section 21).
9. Prefer code organization that follows the user's experience: create decks → load songs → decide whether to synchronize → choose tempo/key → play and mix.

## 8. Future features (not current implementation requirements)

- Four-deck stem mixing: Transients, Flow, Tune and Voice; stem handoff and shared allocation (section 17).
- Local music library, playlists, importing, search, links between songs, and drag-and-drop deck loading.
- Offline-first iPad/iPhone/Mac browser app with durable library storage and backup/export.
- Beat detection, audio time stretching, key detection, pitch shifting, waveform controls, looping, EQ and playback.

**Rule for contributors:** Preserve these agreed behaviors, keep proposed features distinct from implemented features, and ask the user when a case is not specified.

## 9. Temporary audio playback foundation

1. One lazily created Web Audio `AudioContext` is shared by independent players keyed by deck ID. All four decks have independent browser controls and may play simultaneously.
2. Selecting a local file decodes it into memory. A successful load replaces that player's audio, paused at the beginning. It does not autoplay. A failed load retains the previous audio; the latest file selection wins if decoding overlaps.
3. Play starts or resumes audio. Pause retains position using the audio context clock. Stop silences that deck and resets its position to zero. Repeated Play does not layer duplicate playback.
4. At natural end, playback is marked stopped at the duration; pressing Play starts again from the beginning.
5. This temporary player does not call `loadSong()` or change `appState`, original song metadata, cues, synchronization, tempo, pitch, or other decks. Integration with the metadata/cue model is a later step; no BPM or key is invented for imported files.
6. Files remain in memory for this page session. There is no persistence, streaming, time stretching, pitch shifting, or stem processing.
7. `tests/audio-engine-tests.html` runs the preserved prototype tests and additional transport tests with a simulated audio clock. Audible playback requires a separate Safari check.

8. Eject stops and disconnects only that deck's source, releases its decoded audio, clears the filename, position, and duration, and resets the file picker. It also invalidates pending loads and Play requests. The deck can then load a file again, including the same file. Other decks and the shared audio context remain active.
9. Browser controls are created from one HTML template and one reusable setup function. Each deck has independent file selections, status messages, and transport controls.

## 10. Temporary rate-based tempo controls

1. Each real audio player stores `originalBpm`, `targetBpm`, and `playbackRate`, separately from the existing metadata/cue prototype. BPM starts unknown (`null`) and rate starts at 1. Files are not analyzed for BPM.
2. Enter original and target BPM manually, then press Apply tempo. Rate is target BPM divided by original BPM. Original BPM remains separate from target BPM.
3. Both values must be finite positive numbers and their ratio must be representable as a positive Web Audio rate. Missing, invalid, zero, negative, or unrepresentable settings are rejected without changing applied BPM, rate, position, or playback state. Unknown BPM does not prevent normal-speed playback.
4. Changes apply only to the selected deck. A playing source changes rate in place without restarting. Position measures seconds within the original audio, accumulating elapsed time at each rate. Paused and stopped decks stay paused or stopped when tempo is applied.
5. Pause/resume and Stop retain applied BPM and rate. Successful file replacement and Eject clear BPM and restore rate 1; failed replacement retains existing settings.
6. This temporary implementation changes pitch along with tempo. It performs no pitch-preserving time stretching, synchronization, or stem processing, and does not connect rate changes to musical matching or cue logic.

## 11. Deck 1 pitch-preserving experiment (B2.2)

1. Empty Deck 1 can select Normal Playback or experimental Pitch-Preserving Playback. Eject before changing modes. Normal mode and Decks 2–4 keep the existing engine and tempo range.
2. Experimental mode uses the pinned local SoundTouchJS 2.1.1 WSOLA stage, unchanged, through an isolated transport worklet. Valid BPM ratios are 0.8–1.2 inclusive; rejected inputs leave applied settings unchanged.
3. Pause freezes DSP buffers and source reads; Resume continues the retained queue. Stop discards DSP state and rewinds while retaining BPM. Eject releases PCM and DSP output and clears BPM. Loading does not autoplay.
4. Source/read position, DSP-consumed position, rendered source mapping, and estimated audible position are distinct. The latter two are nominal estimates, not sample-accurate provenance or synchronization signals. Browser/device output latency remains a measurement requirement.
5. SoundTouch DSP has not been replaced or rewritten. Local dependency source, license, integration details, limits, automated checks, and Safari steps are documented in `EXPERIMENTAL_AUDIO.md`.
6. No synchronization, stem analysis, cue activation changes, musical matching changes, or claim of click-free tempo adjustment is included.

## 12. B2.5 Deck 1 processor comparison

1. Empty Deck 1 selects Normal, SoundTouchJS, or Signalsmith. Other decks and Normal retain the original engine. Both stretch modes are limited to 0.8–1.2× with zero transposition.
2. Signalsmith uses the unchanged, locally packaged 1.3.2 ES module/WASM and a separate adapter. Pause saves the planned source coordinate and mutes residual output; Resume reschedules it. Stop closes DSP/context and rewinds while retaining PCM/BPM; Eject additionally clears them. Late operations cannot restore ejected audio.
3. Natural completion uses the source schedule with a conservative DSP-tail allowance and gain cutoff, followed by context cleanup on the next state poll. Tail accuracy is a Safari listening check.
4. Both experimental paths use identical -12 dB output gain and sampled peak/RMS meters. This is headroom, not guaranteed perceptual loudness normalization or a limiter. Normal audio output is unchanged.
5. Unexposed Signalsmith DSP positions and counters remain unavailable. Planned source coordinates and estimated audible positions are labeled separately from raw library read-ahead reports.
6. Historical B2.5 status: SoundTouch manual Safari tests and browser smoke test were reported passed. Later Signalsmith release+persistence listening succeeded according to the user (section 18); long-run CPU, latency and offline acceptance remain separate checks. See EXPERIMENTAL_AUDIO.md.

## 13. B2.6 Signalsmith loading reliability

The numbered experiments below are development history. Current user-reported Safari success
is recorded in section 18; universal click freedom and native reclamation are not established.

1. Signalsmith loading stages have diagnostic logs and bounded waits. Failure identifies the stage and releases loading/busy controls; readiness is never silently assumed.
2. Candidate processor errors fail preparation. Synchronous session/resume errors run protected cleanup. Resource cleanup cannot indefinitely retain loading state.
3. Eject invalidates pending attempts; late results cannot restore audio. Failed/abandoned module promises are released by the adapter, using the same local URL and fresh contexts for later attempts.
4. Timeout means the adapter stopped waiting, not that browser work was cancelled. Pending context closures remain reported. The upstream DSP/wrapper and other playback backends remain unchanged.

5. Temporary B2.6 activation experiment: Signalsmith selection only retains a file. Its Load selected file button starts initialization directly from a click. Eject/mode changes clear the pending selection. This is not a finalized interface decision; other playback paths retain immediate selection/loading.

6. Experimental B2.6 Signalsmith startup smoothing opens gain from zero to the existing comparison level over 4 ms at the unchanged scheduled audio start. It also applies on Pause → Play. The ramp is scheduled before waiting for playback acknowledgement, preserved during completion planning, and invalidated on cancellation. This is an adjustable experiment, not proof of the startup click's cause or a finalized audio-envelope design.

7. B2.6 completion scheduling leaves Signalsmith's startup envelope untouched on Play
   acknowledgement. Each session tracks its completion cutoff so tempo changes replace
   obsolete cutoffs independently. Explicit comparison trim retains its own gain adjustment
   behavior. Acknowledgement after the completion deadline cannot reopen output.

8. Temporary Signalsmith diagnostics are opt-in and default off. A silent parallel worklet
   captures pre/post-gain PCM and render-frame metadata without replacing the audible route.
   Failures cannot gate playback readiness; Stop/Eject never wait for capture completion.
   Unfinished or unavailable capture data must be labelled incomplete. Diagnostic exports
   do not establish hardware output, internal DSP positions, or the cause of startup clicks.

9. Temporary Signalsmith closure-serialization experiment: Load/Play cannot create or resume
   a replacement while an earlier context closure is pending or failed. Stop/Eject remain
   responsive. Actual closure resolution permits a fresh user click; no action is queued.
   Timeouts report uncertainty and retain the guard; rejection requires page reload. A single
   adapter option disables this experiment without changing DSP, ramps, or other backends.

10. Opt-in Signalsmith diagnostics export an initial Load/resume window without Play and
    request a best-effort Stop snapshot without awaiting disposal. Session-tagged lifecycle
    history links old closure to new resume/tap readiness. Complete internal windows never
    imply coverage before tap attachment or measurement of browser/system/device output.

11. Diagnostic frame anomalies distinguish missing ranges, leading/internal/trailing coverage,
    duplicates, overlaps and backward callbacks. Per-channel valid ranges distinguish recorded
    zero from unknown PCM. Stop exports a bounded cached pre-Stop checkpoint with measured age,
    never an asserted exact Stop snapshot, and does not await recorder messages.

12. Persistent Signalsmith context mode is explicitly opt-in and defaults off. A separately
    owned context survives session Stop/Eject; processors, output graphs, ports and session
    diagnostics retire independently. Disabling while empty or full Signalsmith shutdown
    explicitly closes the owner. Source timing, DSP, gain ramps and other backends are unchanged.


## 14. Musical matching — participation implemented; musical behavior not wired

**Terminology:** Beatmatching means rhythmic tempo matching and synchronization. Tune matching
means harmonic/pitch matching (formerly key matching). Stem handoff means coordinated stem
levels and associated automatic playback behavior. Each has independently selectable deck
participation; changing one never toggles another. The unused `beatmatch`/`keyMatch` deck fields have been replaced by the shared participation
store (section 20); existing musical functions and audio identifiers remain unchanged.

### Beatmatching participation and compatible relationships

- Beatmatching defaults enabled, with independent participation controls on each deck,
  regardless of visibility. A single participating deck remains independent; the first
  participating deck establishes the initial global tempo reference.
- Disabling participation preserves current tempo and playback. Re-enabling cannot abruptly
  jump a playing deck's tempo. A nonplaying joining deck aligns its target immediately to a
  compatible relationship; a playing joining deck initially preserves its current tempo.
- Subsequent tempo-control gestures drive convergence. Motion stops when the musician stops
  moving the control; no autonomous convergence tail. Matched deck tempo controls and global
  tempo operate on the same shared relationship; once converged, they move decks together.
- Standard compatible relationships include 60:60, 60:120 and 60:30. Automatically recognize
  these without a permanent half-/double-time selector. Prefer a compatible playback tempo
  closest to the song's original BPM, subject to available stretch limits. Actual playback
  BPM, rhythmic interpretation and beat phase are separate; compatibility is not phase alignment.
- Preserve independent deck control and stem mixing. Turning matching off never resets
  playback, current tempo/pitch or position. Tune matching's retained harmonic rules are in
  section 5; each deck independently joins/leaves that capability too.

### Gesture examples — approved musical intent, not a universal algorithm

A. Playing Deck 1 at 100 BPM; playing Deck 2 at 50 BPM joins. Moving Deck 1 100→99 moves Deck 2
   50→51; moving toward 75 brings both toward 75. Once converged, shared movements preserve
   their matching relationship.
B. From 100/50, increasing the first deck should cause faster convergence. Approximately
   10:1 is an experimental response candidate only, not an approved or hard-coded ratio.
C. From 50/100/107, moving the 50 deck to 60 should be able to bring the others to 90 by the
   gesture endpoint. No automatic motion continues after the gesture ends.
D. With decks already compatible at 60/120, a deck joins playing at 80. Moving it down favors
   the 60 relationship without unnecessarily changing the 120 deck; moving up favors 120
   without unnecessarily changing the 60 deck.

### Decisions still required before algorithm implementation

No universal convergence formula is approved. Define gesture magnitude/direction response,
global-control behavior before convergence, multi-deck priorities, compatible-target selection,
ties/hysteresis, unavailable BPM/stretch limits, first-participant eligibility and reference
changes when that deck leaves. Empty/ineligible deck participation is not an invented BPM.
Examples A/B start with an already-compatible 2:1 pair yet request movement toward equal BPM;
clarify when gestures preserve that ratio versus favor equal BPM. Example C's 60/90 endpoint
is not automatically a standard compatible relation: clarify whether it is a partial-convergence
state or another intended interpretation. It does not authorize advanced 3:2 matching.
Some example targets exceed the current experimental 0.8–1.2× range; preserve that implemented
limit and resolve future available-target behavior separately. Distinguish audio parameter
smoothing from forbidden autonomous post-gesture target convergence.

The old load-time average-BPM and view-dependent rules remain historical code/test contracts,
not the new continuous-group model. Pure helper calculations remain valid in their own scope;
do not silently retrofit their callers or tests. Saved settings, UI and audio integration
require separate approval. Keep product matching separate from Signalsmith experiments.

## 15. Future MIDI mapping and input-independent controls — design requirements only

1. All meaningful interactive controls must be designed for future MIDI mapping: deck/transport,
   tempo, pitch, EQ, stem levels, cues, synchronization controls and applicable global settings.
2. Future UI controls need stable, unique control identifiers, including deck identity where
   appropriate. Identifiers must not depend on visible labels, interface layout, or input device.
   Participation control IDs are now stable (section 20); identifiers for other future controls remain to be designed. No MIDI system is implemented.
3. Keep control behavior separate from mouse, touch, keyboard and MIDI input handling. All
   input paths must invoke the same underlying actions and validation, without duplicating
   transport, musical calculations or synchronization logic for each input source.
4. Do not implement MIDI routing or learn now. Mapping UI, MIDI learn, controller feedback,
   configuration persistence, and continuous/relative control semantics require later discussion.
5. MIDI design is independent of experimental Signalsmith audio settings. No MIDI or new
   synchronization functionality is introduced during the current audio investigation.

## 16. Signalsmith release experiment

1. Experimental Signalsmith Pause/playing Stop/Eject use an adjustable 5 ms gain release,
    independent of opt-in persistence. Pause resumes from the rate-aware release-end coordinate;
    Stop/Eject reset application state immediately and retire only the original session after
    render-clock confirmation. Play/Load require a fresh click after release; interruption or
    stalled clocks produce explicit unverified-release errors and bounded cleanup recovery.


## 17. Unified cross-platform library and four-deck direction — approved product requirements, not implemented

1. **One underlying four-deck system.** All four decks remain operational regardless of how many are visible. A two-deck view is a presentation of two of the four decks, not a separate playback or synchronization mode. Switching layouts must never by itself load/unload audio, stop playback, change settings, or trigger matching. This supersedes the historical two-/four-deck loading distinction in sections 2–4; section 14 defines approved future participation-based matching. Historical code must not be silently rewritten as implemented future behavior.
2. **Consistency first.** Desktop browsers, iPad, iPhone, and other supported devices share the same library model, controls, and actions. Prefer responsive layout and user-selectable presentation modes over separate platform-specific implementations. Keep the v40 interface as a visual/interaction benchmark; experimental test UI is not the final consumer design.
3. **Shared library; approved phone exception.** Phone portrait uses playlists left and songs right beneath the mixer, with provisional playlist width 26% of library width. This supersedes the previous independent-panel default on phone. Other platforms retain the two-independent-panel direction; the following independent-panel behavior remains a shared layout proposal for phone and the default direction elsewhere: Either panel can list playlists, open a playlist to show its songs, and use a Back-to-Playlists control to return. Neither panel is permanently assigned to playlists or songs. Each retains its own navigation, search, selection, and scroll state. Support touch-friendly dragging of songs to decks and between playlists/panels, with clear drop targets and an accessible alternative to difficult drag gestures.
4. **Optional library layouts — proposals, shared implementation.** A traditional linked two-panel layout (especially useful on iPad) displays playlists on the left and songs from the selected playlist on the right. A single-panel layout (especially useful on iPhone) offers the same playlist navigation and search in one full-width panel. Make layouts user-selectable where practical, including on other platforms, and preserve navigation state when switching where feasible.
5. **Universal search in either panel.** Search playlists, songs, and artists regardless of the panel's current view. When browsing playlists, rank playlist matches first; when viewing a playlist's songs, prioritize song and artist matches. Priority changes ranking, never category availability. Mixed results must be distinguishable and must not destroy the user's previous navigation context.
6. **Approved phone portrait direction, not implemented.** Four visible decks in a 2×2 grid, with a full-width global-controls strip above them. The mixer provisionally occupies 40% of the application screen; below it is the playlist-left/song-right library. Playlist width is provisionally 26% of the library width. Validate these proportions, global-strip inclusion in mixer height, touch targets and scrolling on devices. This supersedes the two-visible-deck direction; preserve iPad layout flexibility and the same underlying four-deck system.
7. **Three independent features (section 14 is authoritative):** beatmatching, tune matching, and automatic stem handoff. Turning one on/off must not implicitly change the others. Decks retain independent transport and stem controls regardless of matching. Do not infer synchronization participation from which decks are visible. Beatmatching/tune-matching default-on requirements previously approved in section 14 remain confirmed; continuous participation and playing/nonplaying joining behavior are now defined in section 14; remaining convergence mathematics and reference edge cases still need design.
8. **Stem categories and range.** Four functional stems: Transients (`transients`) primarily drums/percussive attacks; Flow (`flow`) primarily bass; Tune (`tune`) melodic/harmonic material other than bass/vocals; Voice (`voice`) primarily vocals. These are functional categories, not rigid instrument classifications. Each stem level is in [0, 1] with 0.01 increments. Application initialization follows section 21; subsequent loading/replacement behavior is unresolved. The older all-zero newly-loaded-deck rule is superseded, not inferred from startup. This supersedes the older placeholder names in section 8.
9. **Stem handoff defaults and participation.** All four decks participate by default, with independent exclusions and saved starting defaults separate from session changes. Section 21 defines approved gesture-driven sharing and session authorization. Immediate joining normalization and instantaneous cap enforcement are historical/superseded. Automatic cue/track continuation belongs to stem handoff and is available only for participating decks; selection, activation and transitions remain unresolved. Do not implement autoplay.
10. **Saved preferences.** Allow users to choose per-deck default stem-handoff participation for future launches; distinguish saved defaults from temporary session changes. Prefer versioned, offline-capable local settings, with backup/export considered; do not assume cross-device sync or persistence after browser data is cleared. Behavior when enabling/disabling participation mid-playback must avoid abrupt loudness changes and requires detailed design before implementation.
11. **Implementation status and scope.** All rules in this section are product requirements, not assertions that library UI, stem handoff, preferences, or matching have been implemented. Keep Signalsmith persistence opt-in and its 5 ms release experiment separate. Do not change playback code or audio algorithms merely to update these rules.


## 18. Architecture boundaries and remaining decisions

1. Keep one four-deck domain/audio system independent of visibility and library layout. The
   historical interfaceMode-triggered matching remains in code/tests; no changes are authorized.
   Future visibility does not define a synchronization mode. Section 14 supersedes the old
   two-visible-deck no-auto-sync exception with continuous participation-based matching.
2. Preserve independently selected default-enabled beatmatching and tune matching; section 14
   now defines joining/re-enable behavior. Convergence mathematics and reference edge cases remain open.
   Automatic stem handoff is independent of both, using the stemHandoff field in the same authoritative per-deck participation store, not a second map.
3. Stem names are transients, flow, tune and voice. Section 21 owns the approved startup,
   effective-gain, authorization and gesture-driven handoff behavior. The previous immediate
   equal-reduction joining rule and instantaneous shared cap are superseded, not implementation contracts.
4. Participating decks share corresponding stem categories; nonparticipants retain independent
   control. Established shared allocation totaling 1 is the reference relationship, not an
   instantaneous invariant imposed when participation is enabled. It is not a global clipping limit.
5. Live participation changes preserve playback and existing levels initially. Upward gestures
   drive convergence; exact response, multi-deck distribution, rapid commands and rounding still require design. Do not invent them.
6. Factory handoff defaults are all four ON. Explicitly saved user defaults override them at
   initialization; temporary session changes do not implicitly overwrite saved defaults.
   Use versioned offline local settings; no cloud sync is assumed.
7. Recommended mixed search presentation: a reversible results view with type-labelled groups,
   preserving underlying navigation/selection/scroll and a return-to-results route. This is a
   proposal; artist activation, ranking details, linked-panel result routing and drag/drop
   copy/move/duplicate policy remain open. Never hide a category solely due to navigation context.
8. Phone portrait follows section 17: four-deck grid above a playlist-left/song-right library.
   Independent, linked and single library presentations remain shared-component proposals where
   appropriate; other-platform independent-panel direction is preserved. Retain panel state where practical.
9. Main visual work stays in the design phase; use shared components, responsive CSS, generous
   touch targets, intuitive drop targets and accessible alternatives. v40 is a visual/interaction
   reference, not code to merge. Preserve the stable-control-ID/shared-action requirements for
   future MIDI. No MIDI implementation is authorized.
10. This update changes requirements only. Signalsmith's 5 ms release, opt-in persistent context,
    all playback code and existing tests remain untouched. The user reports successful Safari listening with the 5 ms release plus persistent context: previously audible pops were eliminated in tested scenarios, not universally proved absent.


## 19. Advanced features — permanent principle and future-experiments backlog

An **advanced feature** means something the designer eventually wants to experiment with,
not a current priority, prerequisite or reason to delay foundational work. Record it here;
implementation requires separate approval. Do not let advanced ideas redirect the core roadmap.

**Deferred experiment: metric modulation/rhythmic subdivisions.** Optional 3:2, 2:3 and 4:3
relationships could support subdivision-based synchronization, one-shot calculated relationship
application without continuous beatmatching, or continuous following of an explicitly selected
ratio. No controls, formulas or implementation milestone are approved. Keep this distinct from
standard automatic same-/half-/double-time compatibility. See the existing roadmap in the design
document; core foundations, stem/library and responsive UI come first.


## 20. Shared participation state/actions — implemented, no audio/UI wiring

1. `appState.participation` is the only authoritative runtime participation snapshot for four
   decks, with schemaVersion 1 and byDeck records. Every record has independent Boolean
   `beatmatching`, `tuneMatching`, `stemHandoff`, all true by default. There is no visibility,
   loaded-song or playing-state prerequisite. Starting defaults can be validated and supplied once before session actions; normal startup uses factory defaults. No storage is read or written.
2. `appActions.participation` provides get/set/toggle/dispatch, initialize and controlId helpers. Stable
   control IDs are `deck.<1..4>.participation.<capability>`. GUI, keyboard and future MIDI input
   can invoke the same actions; none is connected to controls or audio in this increment.
3. `participation.set` requires a Boolean value; `participation.toggle` inverts only its target.
   Invalid deck/capability/action/schema inputs reject before state assignment. Repeating a
   set to the current value is an idempotent no-op. Actions report whether state changed.
4. Frozen, serializable snapshots and a pure reducer keep decisions separate from action
   application. Read current state through appState or get(), rather than retaining an old
   snapshot as a second store. No legacy deck participation aliases remain.
5. This implements membership only, not group tempo/reference, convergence, tune DSP, stem
   redistribution, end-of-song playback, persistence or advanced rhythmic matching. Current
   UI/audio and historical metadata synchronization triggers remain untouched.

### Versioned participation starting defaults and initialization — implemented

- The input format is `{ schemaVersion: 1, participationByDeck: { "1": { beatmatching,
  tuneMatching, stemHandoff }, "2": { ... }, "3": { ... }, "4": { ... } } }`.
  Every capability must be a Boolean. This describes starting preferences, not live session state.
- `validateParticipationDefaults(input)` is pure. It returns `{ valid, defaults, error }`.
  A valid result contains a deeply frozen copy. Require exactly the documented fields and deck
  IDs; reject missing/extra fields, unsupported versions, arrays, non-record objects, accessors,
  hidden/symbol properties and non-Boolean settings. No coercion or partial application occurs.
- `appActions.participation.initialize(input)` validates again and applies a separate frozen
  runtime snapshot through the existing authoritative store. Return `{ initialized, source,
  error }`, with source `provided` or `factory`. Missing (`undefined`) input uses factory defaults
  without error; invalid input reports the rejection and uses factory all-ON defaults atomically.
- Initialization is once per application object, shared across all its action adapters. Repeated
  calls return initialized false with an explanation and preserve the existing snapshot. A valid
  session set/toggle/dispatch, including a no-op, also closes initialization; rejected actions do not.
- Normal startup calls initialize with no input immediately after creating appActions. Later
  callbacks cannot apply defaults and reset an active session. A future storage bootstrap must
  supply its record at that startup boundary before closing it, not hydrate after session edits.
- Session actions never alter supplied defaults or write storage. No saved-defaults store,
  automatic saving, explicit Save Defaults behavior, migrations, matching or audio wiring is
  implemented. Future persistence is a separately approved milestone.

## 21. Stem state/actions implemented; gesture-driven handoff approved but not implemented

### Initialization and gain meanings

- All four decks participate in stem handoff by factory default, independent of beatmatching,
  tune matching, visibility, transport and loaded songs. Existing participation/defaults APIs
  remain authoritative; no competing store is permitted.
- In the implemented audio-independent stem foundation, all four main deck volumes initialize at 0. At application
  initialization, Deck 1 has Transients, Flow, Tune and Voice levels of 1; Decks 2–4 have all
  four levels at 0. These metadata controls do not alter the existing real audio output.
- Startup values do not establish subsequent load, replacement, Eject or restoration behavior.
  Those transitions remain unresolved. Do not silently reset or preserve levels by assumption.
- Effective stem gain = deck volume × allocated stem level. This is a control coefficient,
  not measured loudness, output peak/RMS, or guaranteed clipping protection. Fixed headroom,
  transport envelopes and de-click smoothing must not be confused with human authorization.

### Session authorization from direct human gestures

- Automatic effective-gain increases must not exceed the highest effective level explicitly
  authorized by qualifying direct human control gestures for that stem category during the
  session. There is one global ceiling per category shared across participating decks, not
  a separate ceiling for the deck that established it. Lowering controls retains that ceiling; it is not merely the latest
  value or a moving ceiling reduced by automatic changes.
- Initialization and automatic handoff adjustments do not independently grant authorization.
  With no qualifying gesture, no positive automatic-increase authorization is established.
  Implemented authorization is session-only, resets on application restart, and is not saved.
  Future authorization persistence is now explicitly undecided, separate from the approved
  future ON/OFF preference persistence; this reopens the earlier permanent no-persistence
  product requirement without changing current code. Direct tracking and the scoped two-deck
  automatic allocation limits are implemented; no new enforcement is added here.
- Deck-wide example: directly raising main volume to 0.7 with all four allocated stems at 1
  establishes a global effective-gain ceiling of 0.7 for each of the four categories across
  participating decks (unless higher authorization already exists).
  Lowering the main volume afterward does not revoke those ceilings.
- Individual-stem example: directly moving a stem to 1 at deck volume 0.7 authorizes effective
  gain 0.7 for that globally shared category, not 1. Previously higher session authorization remains retained.
- Gesture origin must distinguish direct human control from automatic/internal adjustments.
  For this milestone a qualifying action must be valid direct input with a gestureId, change
  a control value, target a deck currently participating in stem handoff, and have global
  automatic stem handoff permission enabled. A same-value
  action records intent but cannot establish/increase authorization. Non-human actions never
  qualify. Future physical-input binding and sampling during smoothing remain separate work.
- Excluded decks remain controllable, but their direct gestures do not affect global ceilings.
  Joining/leaving preserves the ceiling snapshot; excluded gestures never authorize retroactively.
  A same-value action after rejoining still does not qualify.
- Zero effective gain leaves an unestablished category null. A positive qualifying gain can
  establish it; subsequent gains only raise the high-water mark, never lower or revoke it.
- Main-volume actions evaluate all four current allocated stem levels with the new main volume.
  Zero allocated stems contribute zero. Individual-stem actions evaluate only that category,
  using its resulting allocated level and current main volume. Requested levels are not used
  as a substitute for allocated gain.

### Convergence and established sharing

- Enabling handoff preserves current stem levels initially, even if 0.6 + 0.7 = 1.3.
  Do not immediately normalize them to 1 or apply equal reduction on joining.
- Handoff responds to effective gain (main deck volume × allocated stem level), not stem
  fader position alone. A deck at main volume 0 must not automatically reduce another deck
  merely because its own stem level is above 0.
- Upward gestures drive smooth convergence toward shared effective gain totaling 1. Reduction of
  another stem is delayed until needed to approach that relationship. Exact mathematical
  response, thresholds and multi-deck priority are unresolved; no formula is approved.
- Before sharing is established, lowering a stem does not automatically raise another.
- After sharing with effective gains totaling 1 is established, raising one stem lowers another; lowering
  one may raise another, subject to retained effective-gain authorization ceilings. Do not
  exceed a ceiling to fill unused capacity. Multi-deck distribution and what happens when
  ceilings prevent maintaining a total of 1 remain unresolved.
- **Approved future interaction, not implemented:** automatically moving stem controls must
  track the timing and speed of the human gesture. Their visible positions must reflect
  actual allocated gain changes without artificial animation lag. Do not implement display-only
  easing that trails allocation, or autonomous handoff/convergence as part of authorization tracking.
- Enabling/disabling handoff does not enable/disable beatmatching or tune matching. Direct
  controls and playback remain available independently of participation.

### Continuous bidirectional handoff — approved performance requirement, not implemented

A continuous direct fader gesture must support immediate handoff in both directions, including
reversals before mouseup/touchend. With two eligible participating Flow stems, main volumes 1,
established sharing and sufficient authorization: start [Deck 1 = 1, Deck 2 = 0]; raising Deck 2
to 1 reduces Deck 1 to 0 automatically. Without releasing Deck 2, lowering it must immediately
restore Deck 1 toward 1. Repeated back-and-forth movement must work within the same gesture.
This is essential for live performance, including alternating complex bass growls.

Automatic zero must not erase return eligibility or retained contribution weights. Restoration
must respond to gesture updates, not wait for release, a new gesture, or a nonzero contribution
from the suppressed stem. Keep untouched zero, automatically suppressed zero, and directly
controlled zero distinguishable. A direct zero retains priority while the fader is controlled;
do not infer permanent eligibility revocation from either reaching zero or releasing there.
For an established eligible two-deck pair, reaching zero or releasing the fader does not
end handoff; the relationship remains active until explicitly disabled. This supersedes the
previous release-at-zero uncertainty for that case. Eligibility introduction before sharing
and three-/four-deck return policy remain unresolved.

The isolated two-deck calculator below now tests the complementary mathematics. No live
redistribution, convergence, audio routing, UI changes or general multi-deck formula is implemented.

### Pure two-deck calculator — integrated with individual stem state/actions only

- `two-deck-stem-handoff.js` implements calculateTwoDeckStemHandoff(input). It is loaded
  by the app and test entry points. Individual stem actions now call it for exactly two
  participants on an effective-gain change; audio playback and startup defaults are unchanged.
- Two decks means exactly two handoff participants for the category, independent of loaded
  songs or visible decks. Supply four deck snapshots with id, volume, allocatedLevel,
  participating and returnEligible; derive participation from the authoritative store in
  any future integration, not a competing state map. Zero/one/three/four participants reject.
- Input also supplies directDeckId, directStemLevel, authorizationCeiling (null or [0,1]),
  relationshipEstablished (Boolean), and trigger (directGesture or participationChange).
  Prior sharing state and return eligibility are explicit caller-owned inputs; this
  function infers only the approved below-unity upward-crossing transition described below;
  other activation, convergence and introduction rules are not inferred by the calculator;
  session eligibility and the newly approved already-unity lifecycle are described below.
- Approved sequence (main volumes 1): [0.60,0.20] → [0.60,0.30] (inactive) →
  [0.60,0.40] (sharing established) → [0.50,0.50] → [0,1]. Returned sharing remains
  active during reversal to [0.25,0.75] and [1,0], and across later gestures until explicitly
  disabled. Activation does not bypass authorization or eligibility limits on later increases.
- Established sharing is latched until explicitly disabled. The sequence [0.60,0.20] →
  [0.60,0.40] → [0.50,0.50] → [0.80,0.20] → [0.30,0.70] preserves that latch after
  reaching 1. Reversal, zero, release/reengagement and capacity-constrained deficits never
  reset it. Callers must carry the returned flag across gestures, not initialize it per gesture.
- A direct proposal is preserved. In established sharing, target other effective gain is
  1 minus direct effective gain. Automatic increases require return eligibility and established
  authorization, and are bounded by the receiver's volume × maximum stem level 1. Existing
  gain above a ceiling may be maintained or reduced; the increase limit does not retroactively
  clamp it. At receiver volume 0, effective capacity is 0 and its existing fader is preserved.
- A participationChange preserves every allocation and sharing flag. Before sharing, direct
  proposals change only the direct deck until an upward effective-gain gesture starting below
  unity reaches or crosses total 1. Then return relationshipEstablished true and apply the
  constrained complement. A single event may cross the boundary. Lowering, no-op and muted
  fader gestures do not establish sharing; other activation/convergence remains unspecified.
  No release or direction latch is needed after establishment. Zero never switches sharing off.
- Results are immutable allocation/effective-gain maps plus combinedGain, targetGain 1,
  deficit, excess, status and resulting relationshipEstablished. Callers must carry returned
  allocations and sharing state into subsequent proposals; the function mutates neither input
  nor application state. Exact continuous proposals
  are not rounded to 0.01 in this numerical layer; committing/quantizing future automatic
  controls remains a separate decision. The calculator never changes main volume, requested
  levels, provenance, authorization, eligibility, participation or runtime state.
- Deficit/excess are reported rather than overriding the human value or exceeding capacity.
  Three-/four-deck distribution, activation from an already-unity but inactive state,
  unestablished above-unity convergence remain outside the calculator. The session lifecycle
  below now defines eligibility and already-unity re-enable metadata; individual-stem calculator integration is implemented below; audio integration is deferred.
- Run tests/two-deck-stem-handoff-tests.html or the full automated runner. These numerical
  results do not establish audio timing, gain smoothness or live UI behavior.

### Session eligibility and pair relationship lifecycle — implemented

- Eligibility is independent of participation and global authorization. At application startup,
  Deck 1's four stems are eligible; Decks 2–4 are ineligible. This startup exception grants no
  authorization. Changing an individual stem to a positive value introduces its eligibility,
  even at main volume 0 or while excluded. Same-value actions do not introduce eligibility;
  main-volume actions do not introduce individual stems.
- Once eligible, a stem remains eligible through direct zero, automatic allocation suppression,
  release/reengagement and repeated gestures. An untouched zero remains ineligible, including
  for future three-/four-deck sharing. No automatic action may introduce eligibility or human
  authorization. Automatic dispatch remains unimplemented/rejected; tests model allocation-only
  suppression to verify the independent state boundary, not actual redistribution.
- appState.stemSession owns frozen eligibilityByDeck and relationshipsByStem alongside global
  authorization and provenance. Participation remains exclusively in appState.participation.
  Each relationship is null or { deckIds: sortedPair, established: true }, keyed by category.
  These are session-only records, reset to factory values on restart; nothing is persisted.
- For exactly two participants, a changed participating direct stem gesture evaluates its
  category's relationship; a changed main-volume gesture evaluates all categories. Metadata
  establishment occurs at the approved rising crossing from below 1, or on the next qualifying
  gesture when the previous total is already complementary (within 1e-12 numerical tolerance).
  No-op, initialization or participation-change events establish nothing. This records sharing
  independently of audio. Individual stem actions now combine this metadata with calculator
  allocation proposals below; main-volume actions now also prepare per-category redistribution as documented below.
- Disabling or changing the participant pair clears mismatched relationships across categories,
  preserving allocated/requested levels, eligibility, volume and global authorization. Re-enabling
  starts inactive and preserves levels; returning to an old pair never resurrects its old latch.
  Re-enabling at total 1 waits for the next qualifying gesture before establishing metadata.
  Turning beatmatching/tune matching on/off cannot invalidate an unchanged stem pair.
- Existing participation actions reconcile relationship metadata before committing their new
  participation snapshot (also during startup-default initialization). All action adapters share
  this lifecycle. Existing stem actions atomically prepare eligibility/relationship metadata
  with direct control/provenance updates. The individual-stem integration below commits the
  calculator proposal in the same synchronous action.
- Permanent tests: tests/stem-handoff-lifecycle-tests.js, tests/stem-state-tests.html and the full
  runner. Pair/count changes, independent sessions, allocations differing from requested values,
  untouched zeros, excluded/muted introduction and already-unity re-enable are covered.

### Individual-stem action integration — implemented, audio-independent

- Validated direct stem-level actions first prepare their own requested/allocated target,
  direct-only authorization and eligibility/relationship metadata. For exactly two handoff
  participants, with the direct deck participating and an actual effective-gain change, call
  calculateTwoDeckStemHandoff using pre-change allocations and the prepared session metadata.
- A zero effective-gain change never redistributes, including muted main volume, identical
  allocated levels with changed requested intent, and same-value actions. Existing direct
  provenance/eligibility/authorization qualification remains unchanged by that guard.
- Commit the direct target, other deck's automatic allocation and resulting relationship
  together after all validation/calculation. No automatic dispatch occurs: only the human
  gesture produces direct provenance/authorization. Preserve other requested levels,
  eligibility, unrelated categories/decks, main volumes and participation.
- Keep existing Boolean action returns. Optional lastChange.handoff records that direct
  event's immutable calculator result, including deficit/excess; it is not a second human
  event, current output meter or competing allocation store. Non-redistributing actions omit it.
- Reversals, zero endpoints and re-engagement preserve the session relationship. Disable,
  re-enable and pair changes still preserve allocations; no calculator runs on participation
  actions. Three/four participants and excluded decks retain direct-only allocation behavior. Above-unity inactive convergence is not invented.
- Direct controls keep 0.01 stem increments; automatic allocated levels preserve the pure
  calculator's continuous precision. Effective gains use allocated values, and no rounding
  may silently violate constraints. Future displayed precision/input takeover is not UI work
  authorized by this milestone.
- Tests/stem-handoff-integration-tests.js permanently covers numerical sequences, constrained
  authorization/physical transitions, no-effect guards, provenance, participation lifecycle,
  requested/allocated separation and failed-calculation atomicity. No audio routing, DSP,
  UI bindings, MIDI or persistence is implemented. Main-volume domain redistribution is documented below.

### Main-volume two-deck handoff — implemented, audio-independent

Direct main-volume actions preserve the controlled deck's requested and allocated stem
records. Each category whose effective gain changes uses the same two-deck calculator,
eligibility, authorization, sharing latch, physical capacity and global suspension rules.
The calculator accepts optional `directVolume`, retaining the real pre-gesture snapshot;
omitted means unchanged volume. Participation-change proposals still preserve all levels.
The proposal validator uses the proposed volume when checking effective gains.

Prepare all four category proposals before committing volume, receiver allocations and
session metadata. Any calculator exception rolls back the entire gesture, including direct
volume, authorization and provenance. Existing rejected-proposal fallback is category-specific:
retain the direct gesture and leave that receiver category unchanged. Valid constrained results
remain accepted. Automatic allocations never change receiver requested levels or main volume,
and grant neither authorization nor human provenance. Direct volume gestures evaluate all
four resulting effective gains for high-water authorization without introducing eligibility.

Zero-effect categories, excluded decks, suspension and non-two-deck groups do not redistribute.
Participation changes never normalize allocations. No new above-unity convergence is added.
`lastChange.handoffByStem` records accepted category results/residuals; optional
`handoffRejectionsByStem` records rejection reasons. These are event metadata, not another
allocation store. Individual-stem event fields remain compatible.

Permanent tests: tests/stem-volume-handoff-tests.js covers capacity-first establishment,
reversals, zero endpoints, independent categories, authorization/physical limits, muted and
ineligible receivers, participation/count guards, suspension and third-category failure with
full rollback. No audio routing, UI or DSP is connected by this milestone.

### Global automatic stem handoff permission — implemented; UI/storage/MIDI deferred

**Implementation status / revised product direction:** the uncommitted stem-only permission
below exists in the working tree, but is not the master mixing switch. The master/individual
architecture below supersedes that interpretation. Preserve this implementation until an
approved migration; no production changes are made by this documentation update.


- Stable control ID: global.stemHandoff.enabled. The authoritative Boolean lives at
  appState.stemSession.automaticHandoffEnabled, initially true for the underlying four-deck
  system regardless of visible layout. appActions.stemHandoff provides get(), set(Boolean),
  toggle(), dispatch(action), and controlId. Dispatch types are stemHandoff.set (value required)
  and stemHandoff.toggle. Invalid values/IDs/types reject; set is idempotent. No implicit saving.
- OFF is suspension, not explicit sharing disable. Set/toggle change only this Boolean and
  preserve all deck requested/allocated levels, participation, eligibility, sharing latches,
  global authorization and last human provenance. ON likewise changes only permission;
  it does not calculate, normalize, synthesize a gesture or introduce eligibility/authorization.
- While OFF, validated manual controls still update their direct target/provenance and positive
  changed stem gestures can introduce eligibility under the existing independent rule. They
  do not redistribute, authorize new gain or establish sharing latches. Existing latches remain.
- On the next eligible intentional stem or main-volume gesture while ON, the calculator
  resumes the two-participant action path. No-effect changes do not redistribute. Explicit per-deck sharing disable/pair changes still clear their latch,
  even while global permission is OFF. Three-/four-deck redistribution remains unimplemented.
- With an established latch, valid gesture-triggered complementary reductions are accepted
  even if prior effective gains were above unity. Example [0.8,0.6], main volumes 1, then direct
  Deck 2→0.65 yields [0.35,0.65]. This is the approved existing complement, not a new convergence
  formula. An inactive above-unity pair retains the existing direct-only calculator behavior.
- assessStemHandoffProposal(input,result) performs deterministic contract/constraint checks:
  four exact deck IDs, finite bounded allocations/effective gains, arithmetic consistency,
  preserved direct target/unrelated decks/muted receiver, eligibility/authorization/physical
  limits for increases, valid sharing lifecycle and consistent totals/status/deficit/excess.
  Established results cannot have avoidable excess/deficit; inactive results cannot change
  the receiver. Existing 1e-12 tolerance is numerical arithmetic tolerance, not a musical cutoff.
- Failure rules: invalid direct input or any calculator/check exception throws before commit,
  preserving full rollback including the human gesture. A returned but rejected proposal
  commits only the validated direct target and direct-only session metadata, leaving other
  decks unchanged; lastChange.handoffRejection reports a fixed reason. Accepted constrained
  proposals are committed with their deficit/excess in lastChange.handoff. The constrained
  label alone never rejects a result. No new musical rejection threshold is approved or used.
- The permission is independent of beatmatching, tune matching and participant selection.
  Future user-preference persistence and MIDI/UI adapters must use these shared stable-ID
  actions. They are not implemented; view changes never reset permission. Authorization remains
  session-only in current code, and its future persistence remains separately undecided.
  Saving permission will not implicitly save eligibility, relationships or provenance.

### Master automatic mixing and individual preferences — approved direction, not implemented

- The master switch suspends/resumes Automatic Beat Match (beatmatching), Automatic Tune Match
  (tune matching) and Automatic Stem Handoff together. Each retains its separate selected
  ON/OFF preference. Independent feature settings and per-deck participation are not replaced
  by the master, and one feature must not implicitly toggle another's preference.
- Stable IDs: global.automaticMixing.enabled (master), global.beatMatch.enabled,
  global.tuneMatch.enabled and global.stemHandoff.enabled (individual preferences).
  These IDs do not authorize renaming existing files or executable matching APIs.
- Effective automatic permission = master enabled AND selected individual feature enabled;
  deck participation further restricts which decks a feature may affect. Derived effective
  permission is not a second stored preference. Master OFF never overwrites individual choices.
- Master OFF suspends all three automatic behaviors, preserving playback tempo, pitch,
  requested/allocated stems, authorization, latches/relationships, participation, eligibility
  and human provenance. Manual deck controls remain independent. No automatic synchronization
  or redistribution may run; explicit per-deck sharing disable remains a separate operation.
- Master ON exposes the retained individual preferences without immediate tempo, pitch or
  stem changes. Each enabled feature waits for its next appropriate qualifying action.
  The toggle creates no synthetic gesture, authorization or provenance. Stem suspension,
  latch preservation, accepted/constrained proposals, direct-only rejection fallback and
  calculator-exception rollback retain their existing approved rules.
- This is documentation/planning only. Current working-tree global.stemHandoff.enabled
  remains a stem-only Boolean, not an implemented master; beat/tune global permissions and
  this combined gating are not implemented. Never claim that OFF already suspends legacy
  metadata synchronization or cue tune preparation.
- Preserve approved individual/per-deck default-ON requirements. A proposed default-ON
  master would preserve initial behavior, but its factory default needs explicit confirmation.
  Future preference persistence and UI/MIDI adapters remain deferred; authorization persistence
  remains separately undecided. No storage or expanded settings system is authorized here.

### Historical/superseded and unresolved boundaries

The former immediate equal-reduction-with-zero-floor joining rule, including 0.80 + 0.30 →
0.75 + 0.25, and instantaneous enforcement of a combined stem cap were earlier documented
requirements. They are superseded by the gesture-driven model above and were not implemented
in an audio stem engine. The current stem foundation is state/actions only. The former all-zero newly-loaded
stem rule and two-visible-deck phone direction are also superseded. Preserve historical
notes as history only; do not recover them as the future algorithm from older documents.

Decisions still needed: convergence mathematics; when sharing becomes established or is
broken; multi-deck redistribution; future input/gesture lifecycle and smoothing-time sampling;
level behavior across track replacement and participation changes; simultaneous gestures; 0.01 rounding; smoothing;
and automatic continuation selection/activation/transitions. None is settled by this update.
The audio-independent foundation, authorization tracking and individual-stem two-deck state
handoff are implemented. Main-volume/multi-deck redistribution, above-unity convergence,
audio routing, stem playback/separation, continuation, UI and persistence require
separate approval.

### Implemented foundation API and boundaries

- `stem-state.js` loads before app.js. Each existing deck owns main `volume` plus frozen
  `stems.requestedLevels` and `stems.allocatedLevels`, keyed by the four category IDs. The
  existing appState.decks array and appState.participation remain authoritative and unchanged
  in ownership. Direct controls do not depend on participation or presentation.
- `calculateEffectiveStemGain(volume, allocatedLevel)` is pure, requires finite numbers in
  [0,1], and multiplies them without quantizing the derived result. It uses allocated levels,
  not requested levels. Individual stem actions may now redistribute the two-deck allocation
  through the existing calculator; main-volume actions evaluate all four categories independently.
- `appActions.stems.setDeckVolume(deckId, value, gestureId)` and
  `setStemLevel(deckId, stem, value, gestureId)` share a validated dispatch path. Deck IDs are
  integers 1–4; main volume is finite [0,1]; direct stem values use 0.01 increments in [0,1].
  Unknown controls, missing/blank gesture IDs, non-direct origins and invalid values reject
  before state changes. There are no GUI/keyboard/MIDI bindings yet.
- Stable IDs: `deck.<id>.volume` and `deck.<id>.stem.<category>.level`. Dispatch accepts
  `{ type: 'stemControl.set', controlId, value, origin: 'direct', gestureId }`.
- With no handoff algorithm, a direct stem action sets that stem's requested and allocated
  levels equally, without touching other stems/decks. They remain distinct snapshots so a
  separately approved automatic allocator can later differ. No other deck is reduced even
  when the sum exceeds 1; this milestone does not implement group behavior.
- Actions return whether control values changed. A valid no-op still records direct intent.
  `appState.stemSession.lastChange` records origin/control/gesture/value; initial origin is
  `initialization` with no gesture. It records only the latest change, not an event history
  or proof of physical human input. Eligibility uses the approved direct/value-change/current-
  participation rules above. Automatic actions are rejected
  until separately implemented, never mislabelled as direct.
- `appState.stemSession.authorization.ceilingsByStem` starts with four global null entries.
  `calculateStemAuthorization(authorization, volume, allocatedLevels, stem = null)` purely
  returns an immutable high-water snapshot for already-qualified input. Null stem evaluates
  all categories; a category ID evaluates only that stem. Zero and lower candidates return
  the previous snapshot unchanged; positive higher candidates raise their global category.
- Direct actions calculate the next control/allocation and authorization records before
  assignment. No-op/excluded actions preserve authorization, while still recording provenance.
  The per-session authorization snapshot is separate from participation and saved defaults;
  new application sessions reset it. No enforcement, session restoration or saving exists.
- Test with tests/stem-state-tests.html or the full automated runner. Existing metadata song
  actions retain their behavior and do not define the unresolved future stem loading policy.


## 22. Deferred integrated stem sampler — architectural requirement only

A planned central performance feature, deferred until the core application is operational,
will let users select one or multiple samples from a song's separated stems and perform them
in real time while that song plays. A stem category's normal playback can be bypassed for this
performance while other categories continue normally. Keep the sampler integrated with the
song/deck/stem model; preserve independently addressable stem audio and the future ability to
route each category through normal playback or the sampler. See TUNEFLOW_DESIGN.md section 25.

Triggering, looping, pitch mapping, synchronization, bypass transitions, and interactions with
stem handoff and authorization are unresolved. This does not amend current authorization
eligibility or grant any sampler behavior implicitly. No sampler implementation, audio-routing
change, new UI or expansion of the current milestone is authorized.

## Isolated native four-stem playback prototype — experimental

The separate experimental page supports two decks, each with four explicitly mapped,
pre-separated local stems. Both reuse the same four-stem player and one shared AudioContext;
each deck has independent transport, source position, stem gains and main volume. Within each
deck the four native sources share one start time/offset. The shared clock does not automatically
synchronize deck timelines. Stopping/ejecting a deck must not stop or close the other deck.

Within each deck, stems require identical decoded frame counts/sample rates and mono/stereo
audio; no trimming/stretching occurs. Musical alignment remains the user's export responsibility.
Both musical main volume and stem levels survive replacement and use provisional 10 ms linear
gain smoothing. Transport gain is a separate stage. The pair owns context closure; deck cleanup
retires only that deck's sources/gains. The experimental page now connects shared stem actions
through a small audio bridge. Other playback modes remain untouched. Existing main-application
startup defaults are unchanged.

The user reported successful Safari listening for both decks before handoff integration.
Listening of the newly connected automatic handoff remains pending; no universal click-free
claim is made. See
EXPERIMENTAL_AUDIO.md for instructions and remaining limitations.

### First audible two-deck handoff bridge — experimental, listening pending

The separate prototype uses its page-local authoritative appState and existing createStemActions
and participation actions. Decks 3/4 are explicitly excluded from this two-deck fixture; no main
application defaults are changed. Main volumes start at 0, Deck 1 stems at 1 and Deck 2 at 0.
A successful action commit immediately refreshes allocated fader positions, requested-value
labels and direct/automatic control-origin labels. Participation changes preserve levels.

The bridge copies allocated stem levels and main volumes into one validated audio-target batch.
Related changed gains share a context time one render quantum ahead and a 10 ms ramp. Stem gains
receive allocations; main gains receive volume, avoiding double multiplication. No calculator
runs in audio code. Unchanged gain targets do not restart automation. Mid-ramp future retargets
retain the interrupted linear segment before scheduling the next ramp.

A calculator exception leaves domain state, audio automation and notifications unchanged.
Audio scheduling failure after commit is explicitly reported, not misrepresented as transactional
rollback of native audio. Native partial-failure recovery remains a limitation. No synchronization,
transport, stretching or existing experimental playback behavior changes are introduced.

### Main application opt-in native stem source — implemented, experimental

Decks 1–2 offer explicit Complete song / Four stems source selection; Complete song is default.
Decks 3–4 keep existing playback. All four handoff participation settings remain ON at startup;
users explicitly exclude Decks 3/4 to use two-deck redistribution. No hidden exclusions or
multi-deck redistribution are introduced. Source switching requires both sources empty and
asynchronous operations/releases/closure settled; Eject is explicit and pending browser work
is not falsely considered cancelled. Existing deck transport buttons route to one backend only.

The same reusable stem component serves both pages. Main-page gestures use authoritative
appState/appActions through the bridge; allocations, requested intent and provenance remain
distinct. Native stem mode disables unsupported tempo controls, preserves musical levels on
replacement, and leaves other playback implementations and their gain behavior unchanged.
The isolated two-deck handoff passed user-reported Safari listening; main-page listening remains
pending. No authorization, eligibility, DSP, redistribution mathematics or persistence changes.

### Batch stem-file assignment — implemented

Both the main-page native-stem controls and standalone prototype offer a multiple-file picker
in addition to individual category pickers. Filename matching is case-insensitive and literal:
`drum` (including drums) -> Transients; `bass` -> Flow; `other` (including others) -> Tune;
`vocal` (including vocals) -> Voice. Substrings anywhere in the filename are recognized;
separators are irrelevant. There is no audio-content analysis or format change.

Assignments are displayed and can be explicitly changed/unassigned through per-category
review selectors. Unknown names, multi-category names and competing files for the same category
are not guessed. Automatic recognition never replaces an existing assignment. Duplicate file
use across categories is rejected, including reselected files with identical name/size/modified
time/type metadata. This is conservative identity checking, not a content hash; metadata
collisions must be reported for review; any proposed renaming requires explicit approval and workspace copies. Browser-selected originals remain read-only. Four distinct assigned categories
are required to enable Load. Extra candidates remain available for manual correction but are
not decoded unless assigned. Clear selected files affects selection only, never loaded audio.

Cancelled/empty pickers preserve previous selections and audio. Neither selection nor manual
assignment decodes, plays, changes musical levels or grants authorization. The existing explicit
Load action snapshots the reviewed mapping and retains all existing decoder/alignment validation,
transport, replacement-level inheritance, participation and handoff behavior. Deck selections
are independent. Main-page playback previously passed user Safari listening; this new batch UI
has automated Chrome verification, with Safari picker/listening verification still pending.

### Four-deck native stem playback — implemented, experimental

All four main-page decks now support opt-in complete-song or native four-stem sources, with
existing batch review/manual assignment, separate musical gains and independent transports.
One shared AudioContext owns all native decks; each session has four synchronized sources,
four stem gains, a main-volume gain and a transport gain. Stop/Eject/replacement/source switching
retire only that deck. Empty/settled-source guards and 10 ms smoothing remain unchanged.

All four participation defaults stay ON. Exactly two participants use the existing handoff
calculator for any deck IDs (including 3/4); three/four participants remain direct-only.
Native audio capability and source selection never silently change participation, authorization
or eligibility. Song replacement inherits current deck gains. Existing normal/SoundTouchJS/
Signalsmith implementations are unchanged. The standalone two-deck prototype remains supported.

Sixteen-stem playback and arbitrary-pair rendered handoff have Chrome automated coverage;
four-deck Safari listening and sustained CPU/memory capacity remain unverified. No new DSP,
separation, multi-deck redistribution or limiter is introduced.

### Bounded WAV streaming fixture — isolated experiment

A separate page tests one-deck progressive RIFF/WAVE integer PCM playback through bounded
Blob slices and native chunks. Default window is two seconds per enabled stem, with 1/5-second
comparisons. All four stems share one deck source-frame timeline; Voice starts manually dormant
and activates at a current timeline position. No activity scheduler or handoff is connected.
Only matching context-rate, equal-frame-count mono/stereo files are supported. The initial
integer-only restriction is extended below to float32 and standard extensible PCM/float.
The existing main application, native player, authorization and all other playback modes are
unchanged. See experimental/BOUNDED_WAV.md for counters, latency, test scope and Safari limits.


### Bounded WAV format diagnostics — prototype extension

The isolated reader supports RIFF/WAVE integer PCM 8/16/24/32-bit, IEEE float32, and standard
WAVE_FORMAT_EXTENSIBLE integer/float subformats. Extensible PCM valid bits are interpreted
left-aligned; only supported mono/stereo masks are accepted. Bounded reads and source files
remain unchanged in ownership/content; no normalization or resampling is added. Nonfinite
float samples reject when encountered during bounded playback reads; finite headroom is retained.
RF64/BW64, RIFX, other containers, compressed audio, float64, custom GUIDs and unsupported layouts
remain rejected with specific diagnostics. Container errors include filename and observed header
bytes. The earlier generic RIFF error did not itself identify a float/extensible encoding.


### Bounded AIFF/AIFF-C extension — isolated prototype only

The user's FORM/AIFC diagnostic confirms that the selected stems were AIFF-C despite their
WAV presentation. Standalone bounded loading now detects RIFF/WAVE versus FORM/AIFF/AIFC by
header, not extension/MIME. It supports big-endian AIFF PCM and AIFF-C NONE, little-endian sowt,
and big-endian fl32/FL32, with COMM/SSND/FVER validation, 80-bit sample-rate parsing, offset/padding
handling and bounded sample reads. Existing WAV formats remain supported. Matching context rate,
mono/stereo, supported precision and strict malformed-header checks remain; unsupported codecs
are identified explicitly. No native main-page playback, handoff, authorization or DSP changes.
See experimental/BOUNDED_WAV.md for exact limits and pending Safari checks.


### Bounded prototype Ready/timeline experiment

The standalone player asynchronously prepares a small bounded window at the selected stopped/
paused position and exposes readiness separately from transport and musical position. Ready
Play reuses PCM and preserves the selected sample. Stop resets position and retains/replenishes
starting PCM; paused seek prepares without advancing. All four stems derive position from one
deck timeline, including dormant/unprepared stems. Seeking never toggles dormancy. Playing seek
and delayed activation follow the current timeline when audio becomes schedulable; stale reads
cannot restart an obsolete transport. Gains retain the 10 ms fade.

A provisional 10 ms lead and 50 ms fallback are experimental standalone settings; Chrome tests
support faster Ready scheduling, not verified Safari/hardware latency. Counters distinguish
read/conversion/buffer preparation and predicted onset; actual audible latency remains unmeasured.
The user reported smooth Safari continuous playback before these changes. No main-app behavior,
existing playback backend, handoff, authorization, waveform UI or adaptive scheduler changes.

## Four-deck allocation Phase 1 — pure calculator only

New approved direction supersedes playback-independent membership for future integration:
first Play admits a handoff-enabled active song; Pause retains membership and allocations.
Never-played loaded/prepared songs and queued songs are not members. Eject releases membership.
Stop membership is not specified by this update and must be settled before transport integration.
Requests and allocations remain separate. Entry and live direct adjustments prioritize that
deck's prepared request; departure uses remaining members' latest effective requests as weights.
Established sharing fills capacity 1 proportionally, subject to eligibility, physical capacity
and existing session authorization. Automatic allocation never changes requests or grants
eligibility/authorization. Global OFF retains independent controls.

Implemented only in `four-deck-stem-allocation.js`, not loaded by the app: one-category pure
calculator over four snapshots, zero to four retained active members. `active` means membership,
not current audible playback; callers own membership and sharing lifecycle. Entry/direct inputs
are post-event requests/volume with pre-event allocations. `preserve` handles Pause without
redistribution; `preparation` changes only the inactive direct deck. No transport is implemented.
Established distribution may exceed a positive request to fill capacity. Zero requests have
zero weight; all-zero requests leave capacity unused rather than inventing a preference.
Before establishment, receivers are bounded by requests as well as existing increase limits.
Reductions/retention above authorization remain permitted; increases require eligibility and a
non-null ceiling. Muted faders are retained. Play honors its prepared priority but never raises
session ceilings; later restoration may therefore have a constrained deficit. The caller must
supply already-qualified authorization for a direct gesture; this calculator never updates it.

Future queue direction: swaps inherit outgoing allocations; queued songs have no independent
stem settings. Natural end swaps to a queued song if present, otherwise leaves the finished song
loaded. No queue/swap transport or natural-end membership policy is implemented here.
Sharing establishment, Stop/natural-end membership, participation-enable priority and global
re-enable triggers remain integration decisions. The existing two-deck calculator, application,
UI, audio routing, transport and smoothing are unchanged. Numerical caps are target constraints,
not proof of a continuous cap during audio ramps. Tests run in the existing automated runner.

### Phase 2A — opt-in coordinated native start scheduling

Implemented scheduling primitive only; four-deck membership/allocator transport integration
is still absent. Existing ordinary Play and two-deck actions are unchanged.
`createNativeStemMixer.startCoordinated(id, snapshot)` accepts validated gain targets for all
owned decks. After asynchronous resume/cancellation checks it schedules four joining sources
behind a silent transport, fading that transport 0→1 over 10 ms at the same boundary as other
decks' stem envelopes. The boundary follows existing ramps and has a provisional 20 ms minimum
scheduling lead. Existing playing main volumes must be unchanged; simultaneous volume/stem
retargeting needs separate continuous-product validation and rejects here. Initial settled and
final per-category audible sums must be at most 1. This is scheduling validation, not new
allocation, participation or authorization policy.

All four source starts must succeed before existing-deck automation is scheduled. Cancelled,
partial or expired starts retire the joining graph and do not report success. A true result
means scheduled successfully, not hardware-audible onset. Native AudioParam scheduling failures
can still partially alter existing automation; these reject, retire the join and must never
commit membership. This retains the existing nontransactional native-audio limitation.
Phase 2B must commit domain membership only after true success and handle cancellation and
reported scheduling errors. No queue, lifecycle membership, UI or upstream DSP changes occur.
Samplewise envelope tests pass in the macOS runner; actual browser rendering/listening and
Safari/iPad timing/click validation remain required. Click freedom is not established by mocks.

### Phase 2A.1 — interrupted coordinated allocations

The opt-in native mixer now protects subsequent `applyGainSnapshot` retargets after a successful
coordinated start. At one shared future render boundary it evaluates scheduled transport and
stem envelopes, folds the current transport coefficient into each stem, and sets transport to
unity at that same boundary. The product is continuous; all resulting effective stem gains
then interpolate linearly for 10 ms. It validates both current and target audible per-category
sums against 1. This replaces the unsafe assumption that independent stem ramps remain capped
while a joining transport is still opening. No extra fade-end delay is used. Before a source's
reserved start time, retargets use that start boundary so the source still opens at zero.

Playing main volumes must be settled and unchanged; unsupported volume changes, over-capacity
plans and invalid times reject before automation mutation. In a protected mixer, direct player
gain setters reject; callers must use a complete mixer snapshot. Ordinary Play/mixers that have
never used the coordinated API keep their existing independent-control behavior. Protection
continues for the lifetime of an opted-in mixer. These APIs remain unused by the live app.
Native partial automation failure or missed retarget deadline fails closed by pausing owned
sessions and reporting an error; it cannot claim transactional audio rollback or click freedom.
Departure remains the existing Pause/Stop/Eject operation followed by a snapshot for remaining
decks; participation/fader changes are snapshots, with no new domain policy here.

Permanent tests reproduce legacy peak 1.178888889 and verify interrupted/repeated multi-deck
retargets, effective continuity, nonunit main volumes, exclusions, departures and failure cleanup.
These are automation-envelope simulations, not browser rendering/listening. Phase 2B membership,
queue transport and allocator wiring remain absent.

### Phase 2B — main-page native handoff integration (bounded implementation)

The main page now uses `createNativeStemHandoffActions` with the existing allocator, gain
bridge and coordinated mixer. The standalone two-deck fixture and legacy domain tests retain
their existing path. Ownership is in `appState.stemSession.nativeHandoff`, participation only
in the existing store. Never-played loaded decks can prepare controls without changing other
allocations. Successful coordinated source scheduling admits a song; failed/cancelled starts
do not. Play does not grant authorization. Pause and internal Stop retain ownership; Resume
uses current allocations, not prepared requests. Natural completion leaves the song loaded and
retains ownership (same as Pause); queue advancement remains absent. Eject and replacement
loading release old-song ownership. A failed replacement retains old buffers under existing
player behavior, but requires a new successful Play to rejoin.

Entry prioritizes prepared requests. Active stem gestures preserve requests and use the pure
allocator; established sharing distributes capacity proportionally over positive effective
request weights with existing eligibility/high-water constraints. Sharing establishes when a
qualifying enabled allocation reaches unity. No untouched zero category is introduced.
All changed faders refresh on commit and audio receives complete gain snapshots. Prepared and
paused controls can change where scheduling validates. Pending async starts reject competing
musical edits; lifecycle interruption cancels the pending start rather than accepting a stale
proposal. Native events, not metadata isPlaying or polling, drive ownership lifecycle.

Safety limits: the scheduler caps ALL audible native decks, including excluded decks. A live
participation exclusion that would overfill that audible sum rejects and restores the checkbox.
Global OFF preserves allocations and makes gestures independent of the allocator, but targets
that exceed the scheduler cap still reject. Thus unrestricted live exclusion/OFF operation is
not complete. Playing main-volume changes reject; prepare volume before Play or while paused.
The native adapter exposes setEnabled; no new global control is added. Existing appActions
remain the legacy API; native callers must use mainStemIntegration.handoff for these controls.
A native scheduling failure may pause owned sessions; no failed join acquires ownership.
Departure already occurred if its subsequent redistribution fails: ownership is truthfully
released, previous coefficients retained, and an error is exposed in stem status.

Automated runner covers 1–4 ownership, takeover, retained requests, lifecycle, participation,
start failure/cancellation and fader projection. Browser tests were updated but not executed:
browser-control host was unavailable. Real Safari listening and browser UI checks are pending;
this is an experimental playable subset, not full feature/release validation.

### First Safari findings — preparation isolation regression correction

Playing main-volume changes remain unsupported in the coordinated scheduler. The settled,
unchanged-main-volume error is an intentional rejection, not evidence that the preparation
volume path is supported during playback. No live main-volume support is added here.

New regressions distinguish unloaded, loaded-never-played and retained paused owners. Unloaded
and never-played volume/stem edits preserve other decks' requests, allocations and ownership.
A defect in their audio projection was found: complete snapshots with unchanged audible targets
still normalized/restarted playing decks' envelopes. The scheduler now validates the snapshot
and audible endpoint cap, stores only silent deck coefficients when all audible targets are
unchanged, and leaves existing audio automation intact. This is an idempotent snapshot path,
not a direct-setter bypass or weaker capacity rule.

A previously played paused/stopped/finished song remains an owner even when nothing sounds.
Changing its volume can really redistribute the other silent owners. Replacement Load releases
that old ownership, after which preparation is isolated. This reproduces a possible explanation
for the Safari observation; unloaded/never-played allocation coupling was not reproduced, and
the exact observed device state remains unknown. The follow-up adds state and envelope tests;
it does not claim browser/UI reproduction or alter retained ownership semantics.

### Safari playback interruption follow-up — rejection versus native failure

Regression tests explicitly verify that unsupported playing main-volume gestures on either
deck reject before AudioParam writes, preserve domain state and leave both sessions playing.
Unloaded/never-played Deck 2 preparation also leaves playing Deck 1's transport untouched.
A retained paused Deck 2 owner can trigger a valid allocation redistribution while Deck 1
plays. Under an injected native scheduling delay, that redistribution misses the existing
render-boundary deadline and deliberately pauses owned sessions through fail-closed cleanup.
This reproduces a possible interruption mechanism, not the cause of the reported Safari event.
The unchanged-main preflight rejection itself does not call shared pause cleanup.

No deadline/cap/fail-closed policy was weakened. Add read-only diagnostics via
mainStemIntegration.handoff.getDiagnostics(): actual loaded/playing/ownership/participation
states and the last shared native scheduling failure (operation, message, sequence, scheduled
and observed context times, decks playing immediately before safety pause). Expected preflight
rejection does not create a failure record. Compare before/after records to avoid confusing a
historical failure with a new gesture. Exact Safari cause remains unconfirmed until that snapshot
and the actual error message are captured; no speculative transport workaround is implemented.

### Compact Mac live-test mixer — presentation milestone

The main page presents Decks 1/2 above Decks 3/4 in fixed 2×2 positions, using a shared compact
neon/dark stylesheet. Desktop target is at least 900×680 CSS pixels, normal browser zoom;
smaller windows remain usable with scrolling rather than scaled/clipped controls. Title,
Play, Pause, Eject, participation, source, main volume and four stem rows stay together.
Native faders are shown disabled until Four stems is selected; complete-song remains the
startup source. Numeric readouts reflect allocated levels directly during the existing refresh.
Internal Stop remains in the DOM/API but is not visible. No deck linking, waveform background
or settings persistence is introduced; accent-color Settings are deferred.

Assign & load stems expands the existing batch/manual review controls without moving other
cards. File selection/assignment alone never decodes; explicit Load selected stems remains the
loading action. Clear selection does not unload audio. Full-song/advanced and allocation
information are expandable; existing experimental panels remain under global diagnostics.
Routine native status now distinguishes no stems, loading, loaded/paused and playing while
preserving error messages. All four decks share the same existing control/action identities.
This layout does not alter source selection, participation, gain targets, allocator, scheduler,
audio lifecycle or experiment settings. Browser geometry tests cover fixed placement, overflow,
file overlays, source switching and numeric readouts; execution/listening on Safari remains pending.

Compact loading follow-up: assignment review now explicitly distinguishes incomplete/assigned,
decoding, successfully decoded matching assignments, and errors. Changing selection does not
replace decoded audio until explicit Load succeeds. Decode errors remain visible in the file
panel, including whether previous decoded audio remains. Play's UI handler also checks decoded
readiness before dispatch. This changes presentation/guarding only, not native allocation or DSP.

Matching-set investigation clarification: users select one song's matching four stems per deck.
No cross-song combination or relaxed recognition/alignment rules are authorized. The current
filename helper recognizes categories, not verified song identity or content. A second batch
retains existing assignments; the UI must explain Clear selected files before switching sets.
Read/decode errors identify the file; decoded validation errors report frames/rate/channels.
Compact panels provide Close and Escape dismissal, restore summary focus, and reserve access
to playback controls while open. These safeguards do not change allocator/scheduler behavior.

### Native silence diagnostics — read-only investigation

Allocation details offers an explicit Capture native audio diagnostics action. It snapshots
shared native context state/time, loaded buffer metadata, source start/position, modeled gain
envelopes/effective products, reported AudioParam readings, destination-connection bookkeeping
and the last Play error. It neither resumes a context nor changes transport, gains or allocation.
PCM inspection is bounded to 256 frames per channel at the current source position; zero in
that window does not establish a silent file. Connection bookkeeping records successful native
connect calls, not a hardware output measurement. These diagnostics do not authorize playing
main-volume changes or weaken any scheduler cap/deadline protection.

### Live native output measurement

The shared native output now passes through an AnalyserNode immediately before destination.
Capture diagnostics reads live left/right RMS and peak at nativeAudio.outputMeter; stereo
channels are measured separately to avoid cancellation from mono downmix. Per-session side
taps expose each source, stem-gain output, main-gain output and transport output. These taps
do not change coefficients or add an audible duplicate path. No continuous UI sampling is
added. Meters add diagnostic graph processing; read operations do not resume/start/schedule.
No real Safari signal result or root cause is claimed until a live capture is supplied.

### Idle shared-context output probe

Allocation details includes Test shared output, a deliberate 0.75-second, 440 Hz tone through
the already-created native shared context and the same final output node. It refuses active
native playback, loading, pending coordinated starts and overlapping tests; the main UI also
checks complete-song playback. It never creates a replacement context, changes destination
channels or alters deck gain/allocation/ownership. Play/Load reject during the short probe.
Tone end/owner close disconnect its nodes. This is an explicit sound-producing diagnostic,
separate from the read-only Capture action; it is not a live scheduler bypass.

### Fresh-context comparison probe

Test fresh context is a separate explicit diagnostic action beside Test shared output. It uses
the same brief waveform and metered final routing in a temporary default context, resumed in
the click handler and closed after the tone. It does not resume, close, replace or reconfigure
the production context or change loaded decks. Both probes require idle playback/loading and
cannot overlap; native Play/Load reject while a probe is active. Creation/resume configuration,
errors and temporary-close status are inspectable in capture diagnostics. Physical Apollo
routing and device-selection history must not be inferred from generic context properties.

Probe measurement clarification: shared/fresh diagnostics retain two bounded live output
observations requested at 150 and 500 ms, including context state/time and read-only page
audio-session/activation state where available. Captures remain available after temporary
context closure. Missing/delayed/unavailable readings or measurement errors are not zero
signal. No browser audio-session policy is changed.

### Separate Design Mode milestone (2026-11-13)

Implemented only in `development/design-mode/`: an independent simulated visual preview, four visible decks (2×2 in portrait), global controls above the mixer, and exactly two library panels below it: Playlists left, Songs right. The compact neon-on-dark prototype uses provisional 40% mixer / 26% playlist proportions with minimum-height usability adjustments. It does not initialize audio, persist a library, or change production behavior. Simulated fader values are visual examples, not changes to approved startup or handoff rules. Actual iPad appearance/touch review is pending before further work.

### Playable 0.1 Phase 1D — focused handoff repair (implemented; iPad retest pending)

This supersedes the historical Phase 2B restrictions on independent/OFF capacity and
immediate native participation rebalancing. Native coordinated plans now identify
capacity members from global permission, per-deck participation and retained native
ownership. OFF decks play independently outside that cohort; unit-gain validation
still applies to every deck. Main remains temporarily locked during live playback.

Per-deck/global OFF and ON preserve current allocated coefficients, eligibility,
authorization and ownership. Re-enabling does not normalize independent gains that
already exceed unity in aggregate: those preserved gains may stay level or decrease,
not grow above their existing aggregate. The next value-changing participating stem
gesture invokes the unchanged priority allocator and returns that category to its
normal cohort cap. Pause/Stop retain ownership; Release remains a departure.

### Repair R1 physical verification — Phase 1D.2 starting baseline

The user confirmed Repair R1 authorization tests 1–6 on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers: zero-level protection, joining without
premature normalization, bidirectional redistribution, full-capacity sharing and
authorization-ceiling behavior. This is physical evidence for that two-deck scope.
Independent Handoff-OFF combinations, four-deck handoff and extended stability
remain physically unverified. Phase 1D.2 live Main behavior is not yet verified.
The pre-change source archive and per-file hashes are preserved under
`development/playable/baselines/phase1d-repair-r1.*`.

### Phase 1D.2 — live Main gains (implemented; new physical verification pending)

The separate `handoff-main` test page enables Main during native playback. A direct
Main gesture scales its deck's currently allocated stem coefficients; it does not
restore suppressed historical stem requests. Those requests remain stored. Effective
authorization remains Main × allocated stem, with the existing qualifying-gesture
high-water, zero eligibility and participating-cap rules. OFF decks remain independent.

Native Main and stem nodes retain 10 ms linear ramps. The scheduler checks the
interior product of their ramps, not only endpoint gains. If simultaneous ramps would
overshoot an individual's endpoint bound or the cohort cap, reductions precede
increases in two 10 ms stages. Ordinary safe changes remain simultaneous. Neither
path changes transport position; native partial-failure protection remains active.
The older R1 test page retains its Main UI lock as a reference presentation. R1's
physical authorization pass does not verify this new Main scheduling behavior.

### Phase 1E starting verification record

R1 remains the physically verified two-deck handoff/authorization baseline (tests
1–6 reported). LIVE MAIN M1 appears correct in physical iPad Safari testing, including
live Main adjustments. A small Flow fader jump was reported; percentage-driven
geometry is a hypothesis, not yet proof of a visual-only issue. Specific independent
OFF combinations, four-deck handoff and extended stability have not been explicitly
physically confirmed. Phase 1E integration is unverified. The complete M1 source and
approved UI are archived with SHA-256 hashes in playable/baselines/phase1d2-live-main-m1.*.

### Phase 1E P1 — initial approved-UI audio integration (experimental; physical review pending)

The separate `/performance?build=1e-p1` entry reuses the physically reviewed Design Mode
components/layouts. Its four deck slots project actual native transport and the
existing appState.decks/participation values. Loaded song identity is committed only
when native loading succeeds. Main, stems and Handoff invoke the existing Phase 1D.2
native actions. No allocation, authorization, scheduling or DSP algorithm changes.
This implements an integration checkpoint, not a production release or adoption of
older, different phone-layout roadmap sketches over the current approved prototype.

The initial test host allows two loaded decks at a time, in any of four slots, with
explicit Release before replacing an already loaded song. These are temporary memory
safeguards, not four-deck product rules. Main begins at zero; test-session handoff begins
OFF as in the playable fixtures. Normal application initialization is unchanged.
EQ/filter/FX/loops/sampler, matching, tempo/pitch processing and scrubbing are inactive;
waveforms are illustrative, while elapsed/remaining time comes from the native engine.
Playlist/song browsing, links and membership remain session-only presentation state.

Section 21's Main/stem distinction, direct-gesture priority, zero eligibility,
authorization high-water and preserve-on-toggle behavior remain governed by the same
production actions. Fixed-width percentage fields and stable track geometry apply
only in the new entry. M1's reported Flow jump is not declared visual-only or physically
resolved; browser measurements confirmed a layout defect and the new entry awaits
physical drag/listening verification.

### Phase 1F starting baseline — physical Phase 1E P1 result

The user confirmed initial P1 testing on iPad: both prepared songs loaded and stem
handoff worked through the integrated UI. This is not an exhaustive pass for four
decks, OFF combinations, Main-zero behavior or extended stability. The earlier Flow
layout fix has browser evidence; no separate physical drag-jump resolution is assumed.
P1 source/UI/test hashes and a reproducible archive are preserved under
`development/playable/baselines/phase1e-p1.*` before Phase 1F changes.

### Phase 1F F1 — experimental four-deck native integration

F1 enables four persistent loaded/playing slots through the same production
allocator and native scheduler. Existing §21 authorization, direct-gesture priority,
zero-request protection and Handoff-OFF independence are preserved; no distribution
math changes. Repeated songs share validated decoded PCM with independent native
voices and transport. Initial P1 physical two-song/handoff results remain the rollback
baseline; F1 four-deck Safari verification is pending.

Main zero is unchanged: effective gain Main × allocation becomes zero after ramp,
without clearing ownership, coefficients, positive requests or session-high history.
Explicit stem zero has request weight zero; its historical eligibility latch need not
clear. Main zero is not a new explicit stem-mute rule. See
`development/playable/PHASE_1F.md` for exact semantics, automated evidence, sampled
1.4–1.5 GiB desktop renderer memory risk, rollback hashes and physical instructions.
Existing Phase 2B / 1D.2 / 1E algorithm references remain authoritative; four-deck
automated integration passes do not establish physical Safari stability or audibility.

### Phase 1F F2 — approved incremental gesture experiment (physical review pending)

For the opt-in F2 build, ordinary direct stem gestures preserve existing peers and
transfer only the effective-gain delta: current positive donors reduce proportionally
only as needed; established-sharing returns use reverse per-category direct-touch
order, respecting positive requests, eligibility, authorization and Main limits.
Explicit zero remains protected. No forced equalization or one-owner restriction.
The user confirmed first-held-touch priority within a category; distinct categories
remain independent. Touch without movement changes history only. F1 had sequential
input handling, not a physical first-touch lock. Main actions and lifecycle allocation
paths retain F1 semantics; no authorization or graph changes are approved here.

This narrowly supersedes F1's request-weighted full peer recalculation for direct
stem gestures in F2 only. Historical multi-deck/input unresolved notes above do not
override this scoped approval. Unreturnable gain remains headroom; a still-over-cap
proposal rejects atomically rather than masking an existing mismatch through a
large normalization. See `development/playable/PHASE_1F_F2.md` for reproduction,
source rollback, tests, constraints and physical steps. Initial F1 physical testing
revealed redistribution jumps, not a complete four-deck verification pass.

### Phase 1F F3 — physical F2 baseline and first-Play correction

User physically confirms F2 incremental three/four-deck handoff, manual-zero
protection, independent categories and first-held-touch priority; no audible
clicks/dropouts were observed in that test. This is not extended stability certification.
F2 is archived as `development/playable/baselines/phase1f-f2.*` before F3 changes.

The reported first-Play issue was reproduced deterministically and with actual song
buffers: a silent new participant could turn an existing automatic-zero/100 split
into 50/50 through legacy entry request weighting. F3 opts first entry into the same
incremental transfer calculator with previous effective contribution zero. Silent
entry preserves peers; nonzero entry takes only necessary gain from current donors.
Play does not update direct-touch history or authorization. This scopes the F2
legacy-entry exception down; direct gestures, Main and all other lifecycle paths,
audio scheduling/ramps, buffering and UI remain unchanged. F2 remains separately
accessible. F3 is experimental and requires physical Safari verification; see
`development/playable/PHASE_1F_F3.md` for evidence, limits and exact retest steps.

### Phase 1G G1 — persistent-audio checkpoint; lifecycle work pending

F3 first-entry correction is physically confirmed by the user. Paused gestures and
loaded-silent Release redistribution remain reported issues. F3 is preserved in
`development/playable/baselines/phase1f-f3.*`. G1 implements the highest-priority
storage workstream independently, using encoded IndexedDB blobs and metadata with
explicit native loading; listing/import never decodes all stored songs. Imports
are atomic; duplicates are byte-compared; originals remain read-only. Assignments
are manual restore hints, never automatic transport or authorization.

User selected the existing HTTP LAN address for first storage review. Cached audio
needs no media server access, but app-shell opening still requires the Mac server;
fully offline shell delivery awaits secure-origin setup. No persistent-storage or
Safari eviction guarantee is made. See `development/playable/PHASE_1G_STORAGE.md`.

Approved next lifecycle behavior (NOT implemented in G1): only playing and Handoff-
enabled decks join live redistribution; Pause preserves faders without restoring
others, paused stem gestures prepare only that deck, Resume gives prepared levels
incremental entry priority. This supersedes retained-paused-membership notes only
when that separately tested workstream is implemented. Silent Release must preserve
peer allocations; diagnosis/correction is pending. G1 retains F3 lifecycle behavior.
The Advanced resume-preview indicator is recorded as deferred, with no UI or logic.

### Phase 1G G2 — live-only handoff / non-redistributing Release (experimental)

G1 is now the approved physical storage baseline: two songs survived Safari reload,
loaded without retransfers and played with handoff. F2 gestures/F3 first entry are
physically confirmed. G1 is preserved in playable/baselines/phase1g-g1.*; no expanded
storage retention or stability certification is implied.

G2 implements the approved live-only rule: paused/stopped/ended decks retain
prepared faders but do not donate, receive or redistribute live allocation. Pause
does not restore peers. Resume re-enters incrementally with current prepared
coefficients, not historic suppressed requests. Native playing state and proposed
entry determine live capacity; the authoritative participation store is retained.
Release preserves peer gains and skips legacy departure normalization. Loaded
silent Release reproduced 0/100 -> 50/50 from Playing and Paused before correction.

This scoped G2 behavior supersedes prior retained-paused-capacity and departure-
rebalance notes for G2 only; earlier rollback hosts preserve their prior behavior.
F2/F3 math, Main/authorization, native timing, storage, touch protection and layout
remain unchanged. Physical G2 verification is pending. Evidence and exact tests:
`development/playable/PHASE_1G_G2.md`. Next UI/Cue/matching ideas remain deferred.

### Phase 1H H1 — separate compact Design Mode (not live integration)

User physically confirms G2 persistent storage, paused preparation, Resume handoff
and Release behavior. G2 source/route are preserved; its source snapshot is
`development/playable/baselines/phase1g-g2.*`. This does not add extended stability
or storage-retention claims.

H1 is isolated under `development/design-mode/compact/`, reusing shared simulated
UI state/library/knob components. Four fixed tablet columns and the explicitly
requested 2×2 phone grid are prototype-only; the current G2 single-deck phone view
and older Design Mode variants remain unchanged. Per-deck Tempo/Pitch occupy the
header; matching and compact Play/Main stay stationary above page content.
Waveform/Cue share one toggle; Cue prototypes contain repeat/loop/jump controls.
Controls contains stems/EQ/FX. Layout variables are temporary design controls.

No native audio, allocation, transport timing, IndexedDB or production musical rules
are changed. H1 matching/Handoff/Cue functionality is simulated and must not be
reported as implemented audio. See `development/design-mode/compact/README.md`
for exact range semantics, geometry, review images, tests and phone space tradeoffs.
H1 awaits physical design review; no subsequent live integration is authorized here.

### Phase 1H H2 — flexible Design Mode experiment

H2 is a separate visual/interaction prototype under `development/design-mode/flexible/`.
H1 remains unchanged for comparison; G2 audio/storage/routes remain untouched.
The user likes H1's horizontal waveform orientation; H2 retains it, without discarding
H1's arrangement. Matching moves into independent per-deck D-label popovers with
status indicators. One combined Waveform+Stems/Cue selector shares a pinned overview;
Play/Main and header stay fixed. Controls keeps EQ/FX above bottom-positioned stems.
Overview visibility on Controls is an experimental layout toggle, not a finalized
product setting. Temporary design controls expose heights, spacing and density.

All musical functionality remains simulated. No sampler, live integration, DSP or
production musical rule changes are implemented. H2 recovers 27 CSS px per deck at
the checked defaults without increasing deck heights. Small phone 2×2 content scrolls
below the pinned overview; all stems cannot be simultaneously visible there with
full-sized controls. See `development/design-mode/flexible/README.md` for measurements,
comparison captures, tests, limitations and the physical-review checkpoint.


## Phase 1H H3 — fixed-stem Design Mode experiment (2026-11-15)

Implemented separately at `development/design-mode/fixed/`; physical review pending.
H3 uses four tablet columns and restores a single full-width selected phone deck,
with four persistent simulated decks. This phone presentation is limited to H3;
H1/H2 remain unchanged comparison builds. Wave/Cue/Controls share one center,
selected by tap or captured continuous slide. Overview, transport and one fixed
stem group remain stationary. Library takes over the entire deck and returns to
its previous presentation without changing simulated playback. Eight cue previews
include Shift deletion. A secondary matching-popover timing preview explores
BeatMatch-following quantization with an independent override; it does not establish
or implement production quantization behavior. Live dimensions and H3 reset remain
available. No G2, storage, allocator, audio lifecycle or musical rules are changed.
See `development/design-mode/fixed/README.md` for measurements, screenshots, checks
and short-phone inner-scroll tradeoffs. Stop at physical review.


## Phase 1H H4 — responsive Library/queue prototype (2026-11-16)

H4 is isolated at `development/design-mode/responsive/`, based on H3's approved
UI direction. G2 playable audio/storage and H1–H3 comparison builds remain unchanged.
All H4 playback, gain, matching, cues and queue actions are simulated; physical UI
review is pending. This does not authorize live queue behavior or change production
musical rules.

Implemented: independent in-memory portrait/landscape dimensions and current-
orientation reset; requested landscape targets with safe center contraction;
expanded Cue/Controls within the fixed center; stationary overview/stems/transport;
full-panel Library Songs/Playlists/Links tap/slide navigation, contextual sorting,
shared normal/Manage row geometry, expanded manual links and membership checkboxes.
Manage playlist navigation retains its original linking source and browser context.
External playlist source groups are explicitly fictional, with no service access.
H3's four landscape columns, tablet portrait 2×2 and single selected phone deck
remain the responsive presentation; no deck state changes on rotation.

A successful simulated load returns only its destination to Wave. Playing decks
queue without replacing the current waveform or levels; empty/nonplaying decks
load without autoplay. A compact NEXT indicator exposes title/artist; explicit
Swap consumes the queued song, starts its preview at zero and inherits outgoing
levels without altering peers. Queue overflow policy was unspecified: H4 retains
one slot and reports an occupied queue instead of silently overwriting it. Expanded
queue policies and real swap timing remain unresolved for future approval.

See `development/design-mode/responsive/README.md` for exact presets, measured
sizes, screenshots, tests and short-screen internal-scroll compromises. All earlier
rollback routes remain available. Stop at H4 physical review; no audio integration.


## Phase 1H H5 — phone performance/Transition/Wave prototype (2026-11-16)

User reports very positive physical H4 feedback. H5 is a separate Design Mode at
`development/design-mode/performance-preview/`; H1–H4 and G2 remain unchanged.
No new playable audio or storage verification is implied. H5 physical review is pending.

Implemented experimentally: independent phone dimension preset; phone deck-button
position indicators and deliberate downward slide to choose Wave/Cue/Controls/
Transition on release, with a tap/keyboard alternative; compact vertical phone stems
and captured track/handle gestures; two-deck Transition bound to the same deck values.
Main moves to Controls/Transition; the space beside Play becomes a distinct empty/
ready queue control with deliberate simulated Swap. H4 occupied-queue protection,
load-to-Wave, tablet presets, horizontal tablet stems, matching and Library workflow
remain. Library sorting uses continuous sliding, selection uses background only,
and Back/Manage use local SVG icons.

Wave ± simulates next-boundary integer beat skipping at displayed tempo with BeatMatch
on, and labeled temporary ±5% nudging off, without changing the Tempo value. A separate
lower surface scrubs the preview position in either state. This uses an assumed
uniform preview beat clock, not analyzed audio, DSP or production scheduling. Pending
request replacement, paused pending requests and scrub cancellation are prototype
policies only. No meaningful-stem entrance detection or live Swap is implemented.

See `development/design-mode/performance-preview/README.md` for exact interaction
semantics, tests, comparison screenshots and small-phone inner-scroll compromises.
Stop at physical review; no live integration, storage, research or G2 algorithm changes.


## Phase 1H H5.1 — isolated correction pass (2026-11-16)

H5 was physically reviewed on iPad/iPhone: retain its successful indicators,
phone vertical stems/slide navigation, Library sorting/icons and moving waveform;
correct the reported UI regressions separately at
`development/design-mode/corrections-preview/`. G2 and H1–H5 remain unchanged.

H5.1 restores compact Play / EMPTY-or-READY Swap / Main in one 36px row. Main is
available throughout performance views. Phone selected-deck taps cycle the four
views; different-deck taps select without cycling; downward slide still commits a
highlighted view on release. The extra phone view badge is removed. Transition is
phone-only; tablets retain H4's three views and expanded layouts. Wave skip/nudge
zones now overlay its upper corners; lower scrubbing is reversed (left advances,
right rewinds). Captured pointer ownership separates the interactions. Explicit
stem rail/handle geometry aligns numeric, visible and touch endpoints while keeping
the full handle visible. All activity remains simulated; no real DSP or timing changes.

The guarded load route queues on playing decks without changing current song,
position, playing flag, Main or stems; occupied queues reject replacements. Swap
starts the queued preview and inherits levels. An explicit real-clock served-browser
sequence passed in H5.1 AND unchanged H5, so the physical H5 queue defect was not
reproduced or causally explained. Do not claim that physical failure resolved until
H5.1 is retested on-device. No new audio/storage verification is implied.

See `development/design-mode/corrections-preview/README.md` for tests, endpoint
measurements, screenshots, short-screen inner-scroll limitations and physical steps.
Stop at physical review; no live integration or further features are authorized here.


## Phase 1H H5.2 — approved cue UI contract / isolated refinement (2026-11-16)

User physically reviewed H5.1. H5.2 is a separate Design Mode implementation at
`development/design-mode/final-preview/`; H1–H5.1 and G2 remain unchanged. Physical
H5.2 review is pending; no production audio/storage/DSP or handoff changes are made.

Approved UI contract: tablet primary views are Wave + Cue / Controls. Phone retains
those plus Transition via colored-deck navigation. Wave stays visible with cue pads
in the lower workspace; Controls owns the single four-stem group. For playing,
paused and never-started loaded songs, empty cue sets the exact playhead position;
assigned cue jumps preserving transport state; held Shift deletes only an assigned
cue; Shift+empty does nothing. Cue actions never affect the queued song. Pads and
zoom markers show cues. This supersedes earlier prototype cue quantization controls,
which are removed; native matching/beat-grid behavior is not altered.

Compact Play / EMPTY–READY Swap / Main, overview, guarded queue loading, inherited
Swap levels, Library, SVG icons and presets are retained. Phone Transition uses two
read-only full-song overviews and right-header partner slide/tap selection. Each
side has Main | High/Mid/Low | Filter/FX-type/FX-amount. Captured Main pointer mapping
fixes endpoints independently of unchanged stem controls. Both strips fit without
scrolling, with 44px knobs through the tested 320×480 viewport. At reduced heights,
decorative title spacing/readouts compact before touch targets are reduced.

FX type and beat length now use vertical slide/tap choices with keyboard alternatives;
no native performance dropdowns remain. Phone skip/nudge zones move to the waveform
side edges at mid-height; left scrub advances, right rewinds. All scheduling is the
same assumed simulated beat clock, not production audio. Session-only cue sets are
associated with the deck's song; no cue persistence or audio analysis is implemented.

See `development/design-mode/final-preview/README.md` for tests, screenshots, Shift
release-order traces and the physical checklist. Stop at physical review before
any production audio work or integration.


## Phase 1H H5.3 — portrait correction / themed choices (2026-11-16)

H5.2 was physically reviewed positively on iPad/iPhone. H5.3 is isolated at
`development/design-mode/portrait-preview/`; physical H5.3 review remains pending.
G2, H1–H5.2, native audio/storage/DSP/handoff/beat analysis remain unchanged.

Implemented: iPad Controls is non-scrolling while its gestures remain active and
Library scrolling is retained. Tight tablet portrait defaults reclaim small header /
overview spacing to keep 44px knobs visible. FX selectors now open dark, deck-accent
body-level popovers: tap then choose, or hold/slide/release; keyboard alternatives
remain and amount values are independent. Portal positioning avoids locked-panel
clipping. No native performance dropdown or new effect DSP is introduced.

Phone Transition retains both approved three-column strips and endpoint-correct
Main faders. Full-song overview edges now independently nudge their respective decks
using the existing temporary preview rate, or the same next-boundary beat skip when
BeatMatch is on. Centers never seek/scrub. Right overview center taps cycle partners;
hold/slide selects through a themed picker, excluding the primary and preserving
positions/playback. Touch ownership separates central selection from edge nudges.

For phone Transition only, existing Play/Queue form a narrow stack beside taller
paired overviews and redundant standard Main is hidden. Both mixer Main faders bind
the same existing deck state. Other phone views and all iPad transport remain the
compact Play / EMPTY–READY Swap / Main. No new Main state or playback engine exists.

See `development/design-mode/portrait-preview/README.md` for exact gestures, tests,
screenshots, viewport fit and the physical review checklist. Stop after review build;
no production audio integration, phone landscape redesign or sampler work is authorized.

## Phase 1H H5.3.1 — touch stabilization prototype (2026-11-16)

The user physically reviewed H5.3 on iPad/iPhone and approved its overall layout,
while reporting touch reliability issues. That supersedes the earlier H5.3
review-pending status, not its archived implementation. H5.3.1 is a separate,
simulated build at `development/design-mode/touch-preview/`; physical review is pending.

Approved interaction correction: continuous controls retain their initiating pointer
until release/cancel; independent controls support simultaneous touches. Main faders
retain their visual dimensions and endpoints while using larger invisible hit areas.
Performance browser zoom, accidental selection and callouts are suppressed in layers;
Library scrolling, editable search and keyboard access remain available. Browser/OS
accessibility behavior is not a guarantee that every Safari zoom path can be blocked.

FX selector quick taps now cycle once without opening a menu. Deliberate hold opens
the existing themed picker; sliding highlights and release commits once. Enter cycles,
Arrow keys open choices; amount knobs remain separate. Partner selection retains its
H5.3 interaction. No musical rules, production audio, G2 storage, previous builds,
layout dimensions, source-separation research or sampler behavior are changed.

See `development/design-mode/touch-preview/README.md` for verification and device
checks. Stop for physical review before any production integration.
