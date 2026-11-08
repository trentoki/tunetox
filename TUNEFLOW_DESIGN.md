# TuneFlow — Product Design and Development Handoff

Working product name: **TuneToss**, formerly TuneFlow. Existing paths and executable identifiers remain unchanged.


**Purpose:** Share architecture, design context, roadmap and unresolved decisions. This is
not a claim that every feature is implemented. AGENTS.md owns workflow/safeguards; RULES.md
owns approved product behavior and labelled historical implementation. Updated-named older
copies, if present, are historical and cannot override those three authoritative documents.

**Status labels:** implemented = verified in source; approved but not implemented = future
product requirement; experimental = isolated prototype, not a universal guarantee;
historical/superseded = retained context, not current policy; unresolved = no algorithm or
behavior may be silently chosen. RULES.md section 21 owns the latest stem decisions.

## 1. Vision and working style
TuneFlow is an iPad-first DJ application, rebuilt from an earlier working prototype with emphasis on stability, understandable code, and a coherent user experience. The developer is learning JavaScript and wants to participate in decisions rather than have an assistant generate an opaque application.

Guiding principle: **The code should reflect the sequence of the user's experience whenever practical.** The user opens the app, sees decks, selects songs, optionally triggers synchronization, and then plays/mixes. Function declarations may appear before initialization; their execution should still follow user actions.

Initial technology: plain HTML + JavaScript + CSS in VS Code on a Mac, tested in Safari. Responsive browser operation on iPad/iPhone/Mac is intended. Offline-first PWA behavior, persistent music library, actual audio engine, and advanced DSP are later milestones.

## 2. Shared deck architecture — confirmed
- **Implemented:** four deck objects exist in appState.decks, one shared array. Historical interfaceMode metadata distinguishes two-/four-deck modes; it does not define the approved future responsive layout. Preserve object identity and current array ownership; no decksById rewrite is authorized.
- Switching interfaces alone must not duplicate decks, restart audio, or trigger synchronization.
- Each deck has state such as `id`, `song`, `isPlaying`, `tempo`, `pitchShift`, `volume`, and `eq` (`low`, `mid`, `high`). Participation is separate from those musical/transport values.
- **Implemented:** initial metadata state is empty/paused with null tempo, zero pitch and EQ, and main volume 0. The audio-independent stem foundation initializes Deck 1 requested/allocated stem levels at 1 and Decks 2–4 at 0; loading/replacement rules remain open (section 22). Participation now uses one appState.participation store with all three capabilities ON for all four decks. Unused beatmatch/keyMatch deck fields were removed, not mirrored; section 21 documents the API.
- `song.bpm` is the **original recorded BPM**. `deck.tempo` is the **current playback BPM**. `appState.globalTempo` is the shared synchronized target BPM.
- `appState.interfaceMode` is `"twoDeck"` or `"fourDeck"`. Global state also includes `globalPitchShift` (initially 0) and `referenceKey` (initially null).
- `globalPitchShift` is a continuous relative pitch offset in semitones, potentially fractional, not scale-quantized. Time stretching should adjust tempo independently of pitch.

## 3. Loading songs — historical prototype triggers and retained cue behavior
- Loading a song assigns song metadata to a deck, starts it paused, sets playback tempo initially to its original BPM, and resets its deck pitch shift to zero (current simple implementation).
- `loadSong()` simulates metadata; it does **not** load or play real audio. The separate temporary four-deck audio player described below loads real local files without changing this metadata path.
- **Two-deck mixer:** loading a song does not automatically synchronize its tempo or key with other decks. Manual synchronization is a future interaction.
- **Four-deck mixer:** loading a song into **any deck** triggers synchronization of **all loaded decks**, including Decks 1 and 2.
- **Switching to the four-deck mixer without loading a song does not synchronize anything.** Switching back does not itself trigger a new synchronization.
- Each deck also has an independent cue slot. `cueSong()` prepares a song there without replacing the active song or changing playback. Preparation uses the current global tempo when available, otherwise the song's original BPM, and a deck-specific pitch adjustment for tune matching; cues are excluded from average-tempo calculations. This fallback does not establish global tempo.
- `playCuedSong()` activates the prepared cue by replacing that deck's active song, applying the prepared tempo and pitch, marking it as playing, and clearing the cue. An empty cue does nothing. It does not change global tempo, the synchronization reference, or other decks. The state transition is implemented; actual audio playback, quantization, and crossfading are not.

## 4. Historical prototype tempo selection — superseded as the future matching model

The load-time averaging, priority and view-dependent model below remains implemented history. Section 16 supersedes it for future continuous beatmatching, compatible tempo relationships and group joining. Preserve helper tests and cue behavior until a separately approved migration; equal BPM is not required for rhythmic compatibility.
On a song-load event in the four-deck mixer:
1. Choose a global tempo using the state of the decks **at the appropriate point in the load event**. Preserve the previously playing decks' state before replacing the target song if needed; event ordering should be reviewed when implementing more cases.
2. If **no decks are playing**, calculate the arithmetic mean of the **original BPMs** of all loaded songs (including the newly loaded song). Example: 120, 106, 130 BPM → 118.666… BPM.
3. If **exactly one deck is playing**, use its **current playback BPM** as the target. Example: Deck 2 playing at 106, Deck 1 paused at 120, new Deck 3 song originally 130 → all loaded decks target 106.
4. If **multiple decks are playing at different tempos**, loading Deck 3 prioritizes Deck 1 if playing; loading Deck 4 prioritizes Deck 2 if playing. If that preferred deck is not playing, select another playing deck. The complete fallback/tie-breaking rule and priorities when loading into Decks 1/2 are **not yet fully specified**.
5. If multiple playing decks are already at the same tempo, that shared tempo is the natural target.
6. Apply the chosen tempo to **every loaded deck**, never to an empty deck; preserve each song's original `song.bpm`.
7. Store the target in `appState.globalTempo`.

Design preference: keep **choosing** the tempo (a pure decision, e.g. `chooseGlobalTempo(...)`) separate from **applying** synchronization (e.g. `synchronizeLoadedDecks(...)`). Do not implement unspecified fallback behavior without asking.

### Examples
| Situation | Expected outcome |
|---|---|
| Two-deck mode: load A=120, B=106 | Deck tempos remain 120 and 106 |
| Switch to four-deck mode only | No change |
| Four-deck mode: load C=130 while none playing | A, B, C become 118.666… BPM; empty D stays null |
| Four-deck mode: Deck 2 playing at 106, load C=130 | All loaded decks become 106 BPM |

## 5. Tune matching and parent-scale calculations
**Match to a reference song's current sounding musical pitch, not simply its original recorded key.**

Example: Deck 1's original key is C minor, but it has been shifted +2 semitones and currently sounds in D minor. A deck joining tune matching should align to the **D minor sounding reference**, not blindly to C minor. Existing cue calculations retain their own documented behavior.

Track/distinguish:
- Original song key (e.g. `song.key`).
- Per-deck pitch adjustment (`deck.pitchShift`).
- Global pitch adjustment (`appState.globalPitchShift`).
- Current sounding key derived from the relevant original key and applied shifts.

A global pitch shift should move synchronized songs together while maintaining their relative relationships. The meaning/storage of `referenceKey` needs careful implementation so it does not double-apply global pitch or become stale. Earlier discussion distinguished the matching reference from subsequent global transposition; **do not assume the stored `referenceKey` must always be overwritten with the audible post-global-shift key**. Agree on the precise representation first.

**Open:** How synchronization establishes or updates `referenceKey`, and how to handle missing or unsupported key metadata. Unlike BPM, musical keys cannot be averaged arithmetically.

### Cue tune matching — confirmed
- Song keys use `{ tonic, mode }` and retain their actual tonic/mode. Support Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, and Locrian, with major/minor aliases for Ionian/Aeolian.
- Normalize each mode to its relative-major diatonic collection. For example, C Dorian, G minor, and B-flat major all normalize to B-flat major.
- `calculateParentScaleTransposition(firstSong, secondSong)` is pure and returns the shortest signed semitone shift to move the first song's parent collection to the second song's. `calculateSymmetricalParentScaleShifts(firstSong, secondSong)` returns equal-and-opposite half-shifts, including fractional values.
- These calculations return pitch adjustments without mutating either song's tonic or mode. They are separate from cueing, playback, global pitch changes, and synchronization.
- Pentatonic keys use `{ tonic, scaleType }`, where `scaleType` is `majorPentatonic` or `minorPentatonic`; their intervals are `[0, 2, 4, 7, 9]` and `[0, 3, 5, 7, 10]`. C major pentatonic and A minor pentatonic are relative scales with identical pitch-class collections.
- `getSongPitchClassCollection(song)` builds actual pitch classes and returns `null` for an undefined/null song, a missing or invalid key, or an unsupported scale type. `comparePitchClassCollections(first, second)` reports equality and containment without relying on scale names. This permits matching a five-note pentatonic collection with any seven-note mode that contains all five notes.
- `findSmallestCompatibleScaleTransposition(firstSong, secondSong)` chooses the compatible relative movement with the smallest absolute semitone distance. Its `matchedPitchClassCollection` is the contained set before midpoint shifts. For equally minimal candidates, choose the lexicographically lowest sorted matched collection using C=0 through B=11, not a preferred positive or negative direction.
- `calculateSymmetricalScaleCompatibilityShifts(firstSong, secondSong)` divides that movement equally and oppositely, including fractional offsets. It returns `matchedPitchClassCollection` and separate `firstSongSoundingPitchClasses` / `secondSongSoundingPitchClasses` arrays after midpoint shifts. For C minor pentatonic with C Locrian, it returns `-1` and `+1` semitone shifts.
- Prepare a cue by transposing the whole song the shortest pitch interval needed to match the reference's current sounding normalized collection. Keep global pitch separate and apply it once; cueing does not change `referenceKey`.
- A playing deck is the key reference. Deck 3 prefers Deck 1, Deck 4 prefers Deck 2, and otherwise the lowest-numbered valid-key playing deck is used. With no decks playing, use `appState.referenceKey`, then the lowest-numbered loaded deck with a valid key. If no reference exists, leave the cue at its original key.
- Key and mode are read from supplied `song.key` metadata. TuneFlow does not currently detect keys or modes from audio.

## 6. Four-deck stem-mixing vision — planned, not implemented
A landscape-oriented mixer concept uses multiple decks that can control the functional stems Transients, Flow, Tune and Voice. A key design idea is **shared allocation of each stem type across decks**: as one deck claims more of a stem's available volume, the other decks' allocation of that stem is reduced, enabling smooth stem handoffs. Per-deck cueing and crossfading between stems within/across decks are part of the broader vision.

Use RULES.md section 21 and section 22 below for gesture-driven sharing and session authorization. Immediate equal-reduction joining and instantaneous caps are historical/superseded; do not implement them or invent convergence math. Stem separation and audio processing remain future milestones.

## 7. Implementation progress — verify against local files
At the end of the recent coding session, the following JavaScript logic had been introduced and browser-console tested incrementally:
- `createDeck(id)` creates a deck object with initial state.
- `loadSong(deck, song, appState)` assigns metadata and calls synchronization only if `appState.interfaceMode === "fourDeck"`.
- `calculateAverageTempo(decks)` filters loaded decks and averages `deck.song.bpm`, returning `null` when none are loaded.
- `appState` contains the interface mode, global settings, and an array of four created decks.
- `synchronizeLoadedDecks(appState)` retains the historical **no-decks-playing** implementation: average original BPM, store `globalTempo`, and assign that tempo to all loaded decks. It intentionally does not yet synchronize if any deck is playing.
- Each deck has a separate `cue` slot. `cueSong()` prepares a cue without changing the active song; `playCuedSong()` applies it to that deck only. Pure parent-scale and pentatonic compatibility calculations are tested separately from cueing. Browser assertions also cover key preparation, scale containment, deterministic ties, cue activation/replacement, empty cues, preservation of global and other-deck state, and unchanged two-deck loading. Connecting these metadata cue actions to actual audio playback remains future work.
- The extracted legacy demonstration tests explicitly verify independent two-deck loads, no synchronization on view change alone, and the no-decks-playing four-deck load path. This validates metadata behavior, not audio synchronization.

Normal application startup now creates four empty metadata decks, retains the declared
`twoDeck` presentation, and performs no demonstration loads or embedded tests. `app.js`
groups state/actions, metadata loading/cueing, pure harmonic calculations, sounding-pitch
reference/cue policy, and legacy synchronization utilities. The average-tempo helper remains
beside its legacy synchronization caller; it is not the current Beatmatching foundation.

The preserved tests are defined in `tests/metadata-model-tests.js` and run explicitly through
`tests/metadata-model-tests.html` or `osascript -l JavaScript tests/run-tests.js`.
Open `development/metadata-demo.html` and click **Run metadata demonstration** to reproduce
the 120/106 BPM loads, unchanged tempo after switching views, and 130 BPM load yielding
118.666… BPM. The demonstration uses independent state and never changes `appState`.
All explicitly called metadata behavior and participation APIs remain unchanged; no audio
engine, DSP, or temporary playback controls were changed by this cleanup.

Cleanup verification: the full macOS automated suite passed, as did headless Chrome checks
for actual index.html empty startup, metadata tests, participation, explicit demonstration
isolation, ten persistent-context sessions, six rendered startup-gain cases, two rendered
release cases, and the recorder. The existing SoundTouch/Signalsmith real-time smoke tests
showed `Real processor should advance` failures in headless Chrome; both failures also
reproduced with the saved pre-cleanup app.js. SoundTouch also passed on reruns. This does not
establish the cause of those smoke-test failures or replace interactive Safari validation.
Historical cleanup checkpoint: defaults initialization was deferred then; the approved validator and one-time boundary are now implemented in section 21.

## 8. Roadmap — proposed subsystem grouping, not implementation authorization

Retain Phase 1/B2.6 as the bounded audio-stability task. This supersedes the old next-step
ordering, which mixed historical prototype work with later UI, without assigning new phase IDs.

| Workstream | Scope and exit criteria | Placement |
|---|---|---|
| Existing B2.6 audio validation | Successful user-reported Safari release+persistence result recorded; preserve opt-in/fallback and document long-run/native limits | Validation handoff; no new audio changes authorized |
| Four-deck domain/actions/settings | Shared membership state/actions and twelve stable control IDs completed; bounded app.js cleanup and explicit demo/test separation completed; versioned defaults validation and one-time initialization completed; storage remains separately approved; reference/convergence remain pending design | Foundations before main UI; no DSP wiring yet |
| Stem state/actions — implemented | Startup volumes 0; Deck 1 stems 1 / others 0; separate requested/allocated levels; pure effective gains; validated direct actions/IDs and provenance; global session authorization tracking; independent eligibility and pair lifecycle; existing participation retained | Individual-stem two-deck state handoff integrated; no audio or multi-deck allocation |
| Gesture-driven stem handoff — later | Specify convergence, established sharing, global category authorization enforcement (tracking implemented), effective-gain convergence/restoration, multi-deck distribution and interruption rules; pure tests before separately approved gain integration | Supersedes immediate joining normalization; group related stem work |
| Two-deck calculator — integrated for individual stem actions | Pure complementary proposals for exactly two participants; explicit sharing/eligibility inputs; authorization/physical bounds; deficit/excess reports; atomic domain action commits, no audio wiring | Below-unity upward crossing implemented; Already-unity session establishment implemented separately; pure calculation unchanged; individual-stem adapter now integrated; above-unity convergence and 3–4 decks remain unresolved |
| Stem transport / continuation — later | Aligned assets and one source timeline per deck; isolated native-stem proof and Safari/iPad resource measurements before stretch integration; continuation only after selection/transition rules | Separate approval; no current playback rewrite |
| Library/navigation/search | Stable entity IDs/relationships; independent panel state; one ranked search engine; drag/drop action contracts and offline repository boundary | Shared subsystem before full library visual implementation |
| Main responsive design | v40 review, shared deck/panel components, three library presentations, touch/keyboard/drop-target validation | Planned design phase after state/action boundaries |
| Later separately approved work | Stem separation/DSP, meaningful-entrance analysis, PWA/media persistence, MIDI learn/mapping/feedback/persistence | Keep separate from current foundations |
| Advanced future experiments | Metric modulation/subdivision ratios (section 24) | After foundations, core stem/library and responsive UI; separate approval only |

State/action design can proceed independently, but implementation needs separate approval.
No platform-specific duplicate library/search implementations. No new audio architecture is
approved by this roadmap; existing temporary backends are not automatically expanded to four.

## 9. Open musical decisions — do not invent a formula

- Convergence magnitude/direction response, the unapproved approximately 10:1 candidate,
  multi-deck priorities and global control behavior before convergence.
- When 2:1-compatible decks should preserve that relationship versus converge toward equal BPM
  (examples A/B), and how example C's 60/90 endpoint should be interpreted without implicitly
  implementing advanced 3:2 matching.
- Reference changes when the first participating deck leaves, missing BPM, target ties,
  hysteresis, stretch-limit handling and precise beat-phase alignment.
- Tune-group reference selection, pitch limits/smoothing and nearest-key display tie handling;
  preserve existing harmonic/cue rules and fractional sounding pitch.
- Stem convergence mathematics, established-sharing entry/exit, multi-deck distribution, gesture qualification and smoothing-time sampling, and ceiling lifecycle across loading/exclusion/reset.
- End-of-song stem-handoff selection, activation and transition behavior; no autoplay yet.
- Remaining stem-level raising/leaving/rounding and live-transition semantics from section 22.

Already decided: visibility does not govern participation; each capability has independent deck
participation; playing beatmatching joins preserve initial tempo, nonplaying joins align a
compatible target; tune matching aligns immediately on join without audible discontinuities.

## 10. Key principle
**The user defines behavior in English first. Codex implements it in small, readable, tested steps, without silently expanding scope.**

## 11. Local audio playback foundation

- `audio-engine.js` provides `createAudioEngine()` with `loadFile`, `play`, `pause`, `stop`, `eject`, `setTempo`, and `getState` operations keyed by deck ID. Independent deck players share one lazily created Web Audio context.
- `audio-controls.js` uses one `createDeckAudioControls(deckId)` function and the HTML template in `index.html` to create four independent file pickers and Play/Pause/Stop/Eject controls. Each displays its own position, duration, and loading errors. One refresh timer updates all four displays.
- Pause saves elapsed audio-context time; resume uses a fresh buffer source starting at that saved offset because Web Audio buffer sources are single-use. Stop resets the offset to zero. Natural end leaves position at the duration, and Play restarts from zero.
- Local audio remains separate from `appState` and all existing simulated examples and tests. No BPM/key is inferred; audio does not use simulated tempo or pitch settings. Cue activation still changes metadata state only. Connecting these models is future work.
- Loading uses whole-file decoding into memory. Successful replacement pauses at zero; failed replacement retains previous audio. Concurrent selections cannot allow an older decode to replace a newer file.
- All four decks can play simultaneously. Eject stops/disconnects only its deck, clears the decoded buffer and file information, resets position/duration, and invalidates pending loads and Play requests. The shared context stays available for other decks.
- No audio synchronization, pitch-preserving time stretching, stems, or persistent storage is implemented. Temporary rate-based tempo adjustment is described below.
- `Map` stores independent players by deck ID. `async`/`await` lets file reading, decoding, and audio-context resumption finish before subsequent steps without blocking the browser.

### Safari verification
1. Open `index.html` in Safari. Four empty players should appear with disabled transport controls. Load a supported local WAV or MP3 into each deck; loading must not autoplay.
2. Press Play on all four. Listen for simultaneous playback and check all four position displays advance.
3. Pause one deck. Its position should freeze while others continue. Press Play on it to resume at the saved position. Repeat on the other decks.
4. Stop one deck, then Play: it should restart from zero while others continue. Repeat for each deck.
5. Eject a playing deck: only its audio should stop; its filename, position, and duration should clear and transport controls should disable. Reload the same file and play again. Also test ejecting paused/stopped decks and ejecting while a file is loading.
6. Let a short file finish, then Play: it should restart. Try an invalid replacement file: an error should appear only on that deck, retaining its previous audio. Canceling a picker should do nothing.
7. Open `tests/audio-engine-tests.html` and inspect the console. Expect the four existing success messages plus `Audio engine tests passed`. Transport tests simulate the audio clock and cover four-deck independence, simultaneous sources, per-deck pause/resume, stopping, ejecting, reloading, pending operations, and unchanged metadata/cue/synchronization state. They do not verify audible output.

## 12. Independent rate-based tempo prototype

- Each real audio player now has separate original and target BPM fields, initially unknown. The browser accepts manual BPM entry and applies it explicitly with Apply tempo; no BPM detection or metadata inference is added. Successful file loads and Eject clear BPM and restore 1×. Stop and Pause retain applied settings.
- `calculatePlaybackRate(originalBpm, targetBpm)` is a pure decision returning target/original, or `null` for invalid inputs or unrepresentable ratios. `Number.isFinite` rejects nonnumeric and infinite values; `Math.fround` checks whether the ratio fits Web Audio's 32-bit numeric representation. `setTempo` rejects invalid changes without disturbing applied settings or transport state.
- `setTempo` updates the existing buffer source's playback-rate AudioParam in place. Before a rate change it saves the source position accumulated at the old rate and resets the clock anchor. Future position advances by elapsed audio-context time multiplied by the new rate. Paused/stopped changes never trigger Play.
- The temporary interface explicitly labels this as rate-based: pitch changes with tempo. This is not pitch-preserving time stretching, synchronization, or integration with musical matching/cues. `app.js` remains unchanged.
- Automated tests retain prior playback and musical assertions and add ratio validation, all-four-deck independence, no source restarts, changing-rate position tracking, paused/stopped behavior, resume rate, and BPM reset checks.

### Safari tempo verification
1. Open `index.html`, load local audio on at least two decks, and Play both. Without BPM they should play normally at 1×.
2. On Deck 1 enter original BPM 120 and target BPM 150, then Apply tempo. The displayed rate should be 1.250×, with faster playback and higher pitch, continuing from the current position. Other decks should stay unchanged.
3. Apply target BPM 60: rate should be 0.500×, slower and lower pitched, without restarting. Repeat on Decks 2–4.
4. Pause a deck, change its target BPM, and wait. Its position should stay fixed. Play should resume there at the new rate. Stop then Play should begin at zero with that same rate.
5. Try blank, zero, and negative BPM inputs. An error should appear without changing the applied rate or interrupting playback. Correct the inputs and apply again.
6. Load another file or Eject: BPM fields should clear and rate return to 1×. Confirm other decks continue.
7. Open `tests/audio-engine-tests.html`. Console output should include all four original success messages, `Tempo tests passed`, and `Audio engine tests passed`. These simulate the clock and audio parameters; audible Safari verification remains manual.

## 13. B2.2 isolated Deck 1 prototype

The approved experiment is implemented in `experimental/deck-one-transport.js` and
`experimental/deck-one-processor.js`, using locally pinned SoundTouchJS AudioWorklet 2.1.1.
The upstream bundle is byte-for-byte preserved; a second copy adds only an export of the existing
Stretch class. The transport feeds original PCM into the unchanged WSOLA Stretch stage.
The normal engine and `app.js` are unchanged. Only empty Deck 1 can switch to experimental
mode; its separate context avoids changing the working normal context or other decks.

Pause retains DSP history/output; Stop resets DSP and source coordinates; Eject disconnects
and releases the experimental node/PCM. The displayed read, consumed, rendered, and estimated
audible positions expose buffering rather than treating source read-ahead as audible position.
Rendered provenance and hardware latency are estimates; exact musical alignment, tail
trimming, click-free changes, Safari quality, and sustained CPU capacity still require tests.

See `EXPERIMENTAL_AUDIO.md` for architecture, local-server instructions, license/provenance,
automated tests at 44.1/48 kHz using real DSP and simulated worklet time, and a real-browser
smoke-test page. Browser tests are supplied but not claimed as executed in Safari.

Future synchronization must analyze original-audio transient patterns and recurring activity.
The highest-level incoming stem determines meaningful entrance, ignoring isolated earlier
sounds when sustained/recurring activity starts later. Beat-aware timing will align that
entrance to the outgoing endpoint and choose direct entry or pre-roll for accuracy and
continuity. Preserve original source-timeline coordinates; implement none of this analysis
or scheduling in B2.2.

## 14. B2.5 Signalsmith comparison prototype

The approved isolated Signalsmith 1.3.2 backend is implemented in
`experimental/signalsmith-transport.js`. Its vendored ES module, DSP, and wrapper are unchanged.
The three-way empty-Deck-1 selector preserves Normal and SoundTouchJS; all other deck calls
still route to the original engine. The normal engine, musical calculations, queues/cues,
stem behavior, and synchronization implementation are unchanged.

Signalsmith owns its own context, original PCM cache, output gate and source/context schedule.
Pause bookmarks come from that planned source timeline rather than library inputTime read-ahead.
Stop/Eject close the dedicated context for explicit DSP cleanup. Resume and natural-end tail
handling differ from SoundTouch FIFO freezing and require Safari listening checks. Source
coordinates remain available for later analysis; no synchronization analysis is implemented.

Both experimental paths share -12 dB headroom and sampled level meters; no DSP algorithm was
replaced. Exact audible provenance, unexposed DSP counters, automatic loudness normalization,
click-free changes, and four-stretcher performance are not claimed. See EXPERIMENTAL_AUDIO.md
for licensing/provenance, tests, local-server steps, lifecycle behavior, and outstanding checks.
The user reported the seven SoundTouch Safari tests and prior browser smoke test passed.

## 15. B2.6 Signalsmith loading recovery

The following records historical investigation stages. Section 18 is the current validation
status; earlier requests for listening evidence are not a claim that the new result is pending.

The approved adapter-only reliability fix protects session construction, logs stage/file/context
metadata, adds bounded initialization/acknowledgement waits, propagates candidate processor
errors, and separates UI recovery from browser cleanup completion. Stable module URLs and
fresh contexts avoid unsafe registration retries. A small Signalsmith-only file-picker reset
permits retrying the same failed file. The selector, normal engine, SoundTouch implementation,
musical calculations, cues, stems, and synchronization are unchanged.

Timeouts abandon waits rather than claiming to abort browser decode/import/WASM work. Late
results are excluded, and unresolved context closure stays visible. Pre-ready wrapper errors
cannot be observed directly before it exposes a node; readiness deadlines cover this gap.
Deterministic regression tests cover injected failures and recovery. Historical failures were investigated before the later successful explicit-Load/persistent-context tests; see EXPERIMENTAL_AUDIO.md for exact steps.

B2.6 activation experiment adds a Signalsmith-only Load selected file button without changing
the processing architecture. Selection retains the File; the direct click invokes synchronous
context creation/resume before reading or decoding. Activation availability/flags join existing
state/stage logs. Sequence/recovery regressions pass; later user-reported Safari results are recorded in section 18. This temporary diagnostic UI is not an agreed permanent loading workflow.

B2.6 startup smoothing experiment adds an adjustable 4 ms Signalsmith-only gain ramp at the
existing scheduled audio start, before playback acknowledgement. No source coordinates,
tempo, DSP, wrapper, or other backend is changed. Both fresh Stop/restart and Pause/resume
use the envelope; completion planning retains it and stale requests cannot affect a newer
opening. Regression automation passes; Safari click reduction and attack quality remain
listening checks. The explicit Load-button solution was confirmed working by the user.

B2.6 independent completion scheduling separates the Signalsmith startup envelope from
completion-cutoff management in the existing adapter, without changing the audio graph.
Acknowledgement leaves the 4 ms ramp intact; tempo changes replace the tracked session
cutoff. Explicit trim changes still adjust gain and restore completion scheduling. Late
acknowledgements cannot reopen completed output. This is a targeted reliability experiment;
remaining intermittent clicks still require Safari listening verification. A separate
OfflineAudioContext test page checks rendered gain automation with a stub processor.

B2.6 measurement instrumentation adds an opt-in Signalsmith-only two-input recorder branch.
It captures synchronized pre/post-gain startup PCM and timing/lifecycle metadata with bounded
storage and local JSON/float-WAV exports. Recorder initialization is independent of transport
readiness; cancellation/closure marks unfinished data incomplete without waiting. Audible
routing, 4 ms smoothing, explicit Load, DSP, wrapper and existing context lifecycle remain
unchanged. The recorder is temporary diagnostic tooling; no further audio-quality correction
or conclusion about the reproducible startup clicks is included.

B2.6 adds a reversible Signalsmith-only context-closure serialization experiment. Pending
actual closure blocks new Load/Play actions without blocking Stop/Eject or auto-retrying.
Resolution restores fresh-click availability and preserves synchronous Safari activation.
Timeout/rejection remain explicit; no closure is assumed from a deadline. Lifecycle timestamp
logs and focused mock/UI tests cover the guard. DSP, source coordinates, four-millisecond
ramp, diagnostic recorder, and other backends are preserved. Safari comparison of stale-audio
fragments remains required before attributing their cause or making this permanent.

B2.6 diagnostic-only extension adds first-available Load/resume windows and best-effort Stop
snapshots alongside the existing four-channel startup capture. Export metadata links bounded
cross-session lifecycle events and labels unobserved pre-tap/retired-output intervals. Load-only
exports require no Play. No transport scheduling, DSP, fade, coordinate, or context-lifecycle
behavior changes are included; serialized closure remains enabled. Safari evidence collection,
including external output capture for pre-tap audio, is documented in EXPERIMENTAL_AUDIO.md.

B2.6 diagnostic corrections add exact frame-anomaly ranges and per-channel PCM validity; unknown
float-WAV samples are NaN rather than asserted silence. Bounded periodic checkpoints replace
on-demand Stop delivery, with explicit pre-Stop age/coverage. Timing separates tap connection,
first render callback, first observed processor-channel block and nonzero block; pre-tap DSP
output remains unobservable. No playback or context-lifecycle correction is included.

B2.6 adds an explicitly opt-in persistent-context comparison, defaulting to the existing
context-recreation control. The first explicit Load creates/resumes audio in its gesture;
fresh session processors reuse the retained context across Stop/Eject. Context ownership is
separate from session disposal, with explicit disable/shutdown and diagnostic-listener cleanup.
Repeated mock/real-wrapper lifecycle tests verify identity and graph/port retirement. Historical note: subsequent user-reported Safari release+persistence listening succeeded (section 18); CPU/native reclamation remain unverified.
No DSP changes, extra output stages, delays, or native-only comparison are included.


## 16. Musical matching model — participation implemented; musical integration deferred

Beatmatching is rhythmic tempo matching/synchronization; tune matching is harmonic/pitch
matching (formerly key matching); stem handoff is coordinated stem levels plus associated
automatic playback behavior. Each capability has independently selectable deck participation.
The unused deck participation fields (`beatmatch`, `keyMatch`) were replaced by the canonical store in section 21; musical/DSP function names remain unchanged. Visibility,
layout and experimental Signalsmith options do not determine membership.

Beatmatching defaults enabled. A single participant remains independent; the first participant
establishes the initial global tempo reference. Disabling preserves current tempo/playback.
Joining while not playing immediately aligns a compatible target; joining while playing keeps
current tempo initially. Control gestures drive convergence and stop driving when movement
stops; no automatic convergence continues afterward. Once converged, participant tempo controls
and global tempo move the same relationship together. No abrupt re-enable tempo jump is allowed.

Standard relationships include 60/60, 60/120 and 60/30 without a permanent half-/double-time
selector. Prefer compatible playback BPM closest to original BPM within stretch limits.
Keep actual BPM, rhythmic interpretation and beat phase distinct; compatibility does not prove
phase alignment. Current Deck 1 experimental stretch limits remain 0.8–1.2×; examples may exceed
that implementation range and do not authorize changing it. Future limit handling remains open. This supersedes view-gated song-load matching and universal equal-BPM/average
references as future product policy, not the existing prototype implementation/tests.

### Preserved gesture examples — musical intent, not complete mathematics

- A: Playing 100/50; second deck joins. First deck 100→99 moves the second 50→51; approaching
  75 brings both toward 75; shared movement follows once converged.
- B: From 100/50, increasing the first deck should cause faster convergence. Approximately
  10:1 is an experimental possibility only, not an approved constant or universal algorithm.
- C: From 50/100/107, moving 50→60 can bring the others to 90 by the gesture endpoint; no
  subsequent autonomous convergence tail.
- D: Existing compatible 60/120, joining deck 80. Downward movement favors 60 without
  unnecessarily changing the 120 deck; upward favors 120 without unnecessarily changing 60.

Do not invent a convergence formula. Section 9 records open algorithmic choices, including
already-compatible 2:1 examples that request equal-BPM movement and the 60/90 interpretation.
The advanced backlog does not authorize 3:2 as standard matching merely because it occurs
numerically in example C.

Tune matching aligns automatically and immediately on joining an existing group. Individual
pitch is fluid/continuous; shared global pitch moves only participants and preserves their
harmonic relationships. Do not restrict global pitch to 12 semitones or snap it to keys.
Preserve fractional-semitone values internally. Display the nearest conventional key as a
label, never as quantization of pitch. Immediate alignment means an immediate target decision
with audio application avoiding discontinuities; DSP limits and smoothing remain unresolved.
Retain current-sounding-pitch reference, parent-scale/pentatonic and cue semantics in section 5.

Membership state/actions are implemented (section 21), with no musical integration: interfaceMode metadata triggers and separate audio controls are unchanged. Convergence math, musical interpretation, phase analysis and DSP remain deferred. Product participation remains
separate from saved defaults and temporary audio settings.

## 17. Future MIDI mapping — shared actions and stable control identity

Design all meaningful interactive controls for future MIDI mapping, including deck controls,
transport, tempo, pitch, EQ, stem levels, cues, synchronization controls, and global settings
where appropriate. Future controls need stable unique identifiers, with deck scope where
needed, independent of labels and visual layout. Participation IDs are now implemented (section 21); schemas for other controls remain open.

Control behavior belongs in shared actions/validation, separate from mouse, touch, keyboard,
and future MIDI input adapters. A graphical interaction and its MIDI mapping must invoke the
same action rather than duplicate musical or transport logic. This is a design constraint for
future work, not a request to refactor existing controls during audio debugging.

MIDI mapping UI, MIDI learn, controller feedback, persistence and input-value semantics will
be discussed later. No MIDI system or new synchronization functionality is implemented now.

## 18. Audio validation status — successful user-reported Safari result

The user completed Safari listening tests with Signalsmith's 5 ms release and persistent
AudioContext enabled, and reports elimination of the previously audible pops in those tested
scenarios. This is a successful user-reported listening result, not universal click-free
operation, an established Safari root cause, or proof of native WASM reclamation. Earlier
investigation paragraphs describe historical stages, not outstanding repeats of this listening
validation. Persistent context remains experimental, opt-in and OFF by default unless a separate
default change is approved; context-recreation fallback and explicit shutdown remain available.

Existing release-end Pause bookmarks, immediate logical Stop/Eject reset, audio-clock cleanup,
stale-command guards and interrupted/frozen-clock recovery remain unchanged. Automated tests
passed previously. Long-run native CPU/memory behavior remains unverified. Interpret context,
processor, port and disposal records as JavaScript evidence only. No audio processing, UI,
lifecycle or tests are modified by this documentation update.

## 19. Unified four-deck system and independent capabilities — confirmed future direction

One underlying four-deck architecture serves all layouts. Hidden decks remain independently
operational; presentation must not create separate two-/four-deck audio modes. Preferred
phone portrait direction is four visible decks in a 2×2 grid with a full-width global-controls
strip above. The mixer provisionally occupies 40% of the application screen; below it are
playlists left and songs right, with playlists provisionally 26% of library width. These
proportions require device testing, including how the strip contributes to mixer height.
This supersedes the two-visible-deck phone direction; retain iPad layout flexibility. Layout changes do not reset transport, musical settings
or stem levels, and alone never trigger synchronization.

Beatmatching, tune matching and stem handoff are independent capabilities with independently selectable deck participation (section 16). Preserve default-enabled matching and no-reset disable behavior. Handoff uses separate per-deck
participation and never becomes contingent on matching. Meaningful-entrance analysis remains
separate from automatic stem-level redistribution.

Resolved product conflict: the approved continuous participation model in section 16
supersedes historical interfaceMode-gated triggers. The old prototype and tests remain intact
until approved migration; unresolved convergence/reference details are not license to retain
visibility as future synchronization policy.

## 20. Shared cross-platform library and search — confirmed plus proposed interaction

**Approved phone portrait direction:** playlist-left/song-right library beneath the mixer,
with provisional playlist width 26%. **Other platforms:** retain the independent two-panel
default direction. **Alternative layout proposals:** two independent panels, linked panels
and a single full-width panel share the same underlying library functionality. In the
independent-panel presentation, each panel shows playlists, opens playlist songs, supports
Back and universal search, and preserves its own navigation, selection and scroll. Neither
independent panel has a permanent playlists-only or songs-only role. Linked presentation
coordinates playlist selection on the left with songs on the right. Shared data/search/actions,
components and responsive CSS serve all layouts; preserve navigation state across switches
where practical. The previous every-platform independent-panel default is superseded on phone
by the approved linked presentation. Optional layout selection and exact narrow-screen behavior
remain proposals, not a different app or authorization to implement UI.

Search context changes ranking only: playlist view boosts playlists; playlist-song view boosts
songs/artists. All categories remain searchable at every depth. Proposed interaction: a
reversible mixed-results view with type badges/category groups, saved underlying location and
scroll, and a return-to-results path when opening results. Artist result activation, exact
ranking/grouping/empty-query rules, linked-panel routing, drag/drop copy-versus-move and
playlist duplicate handling remain open. No search functionality is implemented here.

Recommended panel model (proposal): stable libraryA/libraryB IDs, each owning `location`,
back stack, query/search context, result selection, selected entity IDs and scroll anchors
keyed by location/query. Keep a pre-search return location; prefer entity ID plus offset over
pixel-only scroll restoration. Search results derive from shared entities/indexes; request IDs
prevent stale async results replacing newer queries. A presentation controller owns library
layout mode, active panel and linked playlist ID. Single-panel mode can expose one panel while
preserving the other; linked mode coordinates navigation without destroying independent saved
states. Validate these transition proposals during design rather than silently finalize them.

## 21. Domain/settings boundaries — participation/defaults initialization implemented, persistence proposed

- **Implemented ownership:** appState.decks remains the four-deck array. A prior decksById[1..4]
  sketch is a historical proposal, not permission to rewrite state. Future stem state/actions
  must fit that ownership without duplicating participation. Integer hundredths for 0.01 controls
  are a representation proposal; effective gains and audio smoothing may remain continuous.
- `appState.participation` (implemented): one byDeck map of independent beatmatching/tuneMatching/stemHandoff Booleans; no duplicate membership maps in matching or handoff subsystems. Those subsystems can later derive their participating deck lists.
- Future relationship/reference/gesture state belongs outside participation. Actual playback BPM and rhythmic interpretation remain distinct; no convergence or group reference is created by toggling membership.
- `presentation`: visible deck IDs/page plus library layout and panel state only.
- `savedPreferences`: versioned defaults separate from factory defaults and runtime session
  settings. Hydrate a validated runtime copy; only explicit Save defaults persists participation.
- `experimentalAudio`: separate Signalsmith/backend/testing settings, not product sync defaults.

### Implemented participation API and integration

`participation.js` loads before app.js. appState owns a frozen JSON-compatible snapshot:

```js
{ schemaVersion: 1, byDeck: {
  1: { beatmatching: true, tuneMatching: true, stemHandoff: true },
  // Decks 2, 3, 4 have the same independent defaults.
} }
```

All twelve initial values are true; no settings are saved/read. `createParticipationState()`
creates independent installation/fixture defaults. `reduceParticipation(state, action)` is
pure and returns the same snapshot for a no-op or a new frozen snapshot for a changed flag.
`appActions.participation` reads/replaces appState.participation without caching a second copy:

```js
appActions.participation.get(1, 'beatmatching');
appActions.participation.set(1, 'beatmatching', false);
appActions.participation.toggle(4, 'stemHandoff');
appActions.participation.dispatch({
  type: 'participation.set',
  controlId: 'deck.2.participation.tuneMatching',
  value: false
});
appActions.participation.controlId(2, 'tuneMatching');
```

Set/toggle/dispatch return true for change, false for no-op. Errors reject invalid numeric deck
IDs, capability names, action/control IDs, non-Boolean set values and unsupported schema version.
Snapshots resist accidental direct mutation; callers should fetch current state, not hold a
stale snapshot as authoritative. The runtime version remains separate from the validated starting-defaults format below.
Validation and one-time initialization are implemented; storage and migrations are not.

Compatibility: removed deck.beatmatch/deck.keyMatch were unused by existing domain/audio logic.
They are not writable aliases. Future callers use the shared actions/selector; legacy prototype
load/cue/tempo calculations remain unchanged and are not gated by participation yet. No GUI,
keyboard or MIDI bindings, subscribers or audio side effects were added. Classic-script entry
points that load app.js must now load participation.js first; the app and existing test pages
were updated. Test at `tests/participation-tests.html` or run `osascript -l JavaScript tests/run-tests.js`. The full suite and the dedicated browser page passed in headless Chrome. These verify state isolation, not audible matching. Audio engine/controls and experimental audio source files were verified unchanged.

### Implemented versioned starting-defaults boundary

`validateParticipationDefaults(input)` in participation.js accepts this distinct defaults record:

```js
{
  schemaVersion: 1,
  participationByDeck: {
    1: { beatmatching: true, tuneMatching: true, stemHandoff: true },
    2: { beatmatching: true, tuneMatching: true, stemHandoff: true },
    3: { beatmatching: true, tuneMatching: true, stemHandoff: true },
    4: { beatmatching: true, tuneMatching: true, stemHandoff: true }
  }
}
```

It returns `{ valid: true, defaults: frozenCopy, error: null }` or
`{ valid: false, defaults: null, error: explanation }`. Exact fields/deck IDs and actual
Booleans are required throughout. Unsupported versions and malformed/incomplete/extra fields
reject, without mutating or freezing caller-owned input. Only ordinary plain JSON-style data
fields are accepted. No partial fallback per deck or implicit schema migration is performed.

`appActions.participation.initialize(record)` accepts either raw input or the validator's
`defaults` value (not its result envelope), validates it, and copies valid settings into the
existing authoritative runtime snapshot. It returns `{ initialized: true, source: 'provided',
error: null }`. Missing input uses factory defaults with source `factory` and error null;
invalid input uses factory defaults with source `factory` and the validation explanation.
Saved starting inputs and session snapshots do not share mutable records; session actions
never update starting preferences. There is no second live participation store.

A WeakSet holds only lifecycle metadata per application object; it is not a preferences store
and does not retain applications after they are otherwise unreachable. Initialization closes
after its first call (including fallback), or the first valid session action (including no-op).
Reads and rejected actions do not close it. All action adapters share this guard. Later calls
return `{ initialized: false, source: null, error: explanation }` and preserve session identity.
Normal app.js startup immediately calls initialize() for all-ON defaults before other scripts;
it neither loads demonstration songs nor changes the declared presentation.

A future storage adapter must obtain and validate its input before that startup boundary is
closed. Do not asynchronously overwrite a running session. Browser storage, Save Defaults UI,
auto-saving, migrations and session restoration remain unimplemented. Existing get/set/toggle/
dispatch/controlId APIs and audio/model behavior remain unchanged. Tests run in the full macOS
suite and tests/participation-tests.html, including malformed records, missing defaults, guard
sharing, input isolation and protection against late initialization.

### Proposed saved-settings repository (not implemented)

Recommend a replaceable offline repository that reads/writes the versioned participation-defaults
record above. This replaces the earlier illustrative stem-only settings envelope; a broader
settings envelope can be designed later without silently reinterpreting version 1. A local IndexedDB
repository can provide atomic updates and later share a boundary with the library; saving
preferences must not depend on implementing media persistence. Validate IDs/booleans; test
pure schema migrations; do not overwrite an unsupported newer schema. Missing data uses
factory all-ON defaults; save failure reports unsaved preferences without breaking runtime
controls. Session toggles do not auto-save. Browser data clearing can remove local defaults;
cloud sync is not assumed. Decide how eventual session restoration interacts with defaults.

## 22. Stem architecture and gesture-driven handoff — approved direction, no implementation

RULES.md section 21 is the product authority. Current source implements the audio-independent
stem state/action foundation, authorization tracking and individual-stem two-deck handoff, not stem audio routing or
automatic cue/track continuation. Metadata main volume initializes at 0; real audio remains
separate from metadata volume/EQ/stem controls. Do not claim that
existing participation tests verify stem mixing or audible synchronization.

### Approved behavior — individual-stem two-deck state handoff implemented, audio deferred

- Four functional categories: Transients (percussive attacks), Flow (primarily bass), Tune
  (melodic/harmonic material excluding bass/vocals), Voice (primarily vocals). Levels remain
  0..1 with 0.01 control increments; no stem renaming or rigid instrument classification.
- Factory participation is ON for all four decks, independently configurable through existing
  appState.participation. Implemented application startup main volumes are all 0; Deck 1's four
  stem levels are 1 and Decks 2–4 are 0. This says nothing about later track loading/replacement.
- Effective stem gain = main deck volume × allocated stem level. Separate that coefficient
  from measured loudness, clipping protection, fixed headroom and temporary transport envelopes.
- Retain the highest session effective-gain authorization established through qualifying direct
  human gestures globally per stem category across participating decks, not per originating deck.
  Implemented ceilings are session-only, reset on application restart, and are not persisted.
  Future authorization persistence is undecided, separate from future ON/OFF preference storage. Subsequent lowering does not revoke it; initialization
  and automatic adjustments do not independently authorize increases.
- Direct main-volume raise to 0.7 while all four stems are 1 authorizes a global 0.7 for all
  four categories across participating decks. Direct individual stem movement to 1 at deck volume 0.7 authorizes 0.7 for that
  globally shared category, not 1. Previously higher authorization is retained.
- Enabling handoff keeps existing levels initially: 0.6 + 0.7 remains 1.3. Upward gestures
  drive smooth convergence toward shared effective gains totaling 1, delaying other-stem reductions
  until needed. No universal response formula or automatic joining normalization is approved.
- Handoff responds to effective gain. A zero-main-volume deck cannot reduce another deck
  merely because its stem fader is above zero; allocated fader values alone do not drive handoff.
- Before sharing is established, lowering does not automatically raise another stem. Once
  effective-gain sharing totaling 1 is established, raising one lowers another and lowering one may raise
  another, subject to authorization ceilings. Do not exceed ceilings simply to fill capacity.
- **Approved future interaction, not implemented:** automatically moving stem controls must
  track the timing and speed of the human gesture. Their visible positions must reflect
  actual allocated gain changes without artificial animation lag. Do not implement display-only
  easing that trails allocation, or autonomous handoff/convergence as part of authorization tracking.
- Automatic continuation belongs only to handoff participants; track selection, preparation,
  activation and transitions remain unresolved. Nonparticipants retain manual controls.

### Implemented state/action foundation and future audio boundaries

`stem-state.js` defines pure factories/calculations and shared direct-control actions. It loads
before app.js in each classic-script entry point. Existing deck objects own `volume` and frozen
`stems: { requestedLevels, allocatedLevels }`; there is no decksById rewrite or second volume
store. A direct stem change sets its own requested/allocated values and, when eligible for
two-deck integration, applies the calculator proposal to the other allocation only. Control values remain separate from derived effective gain.

`appActions.stems` exposes setDeckVolume, setStemLevel, dispatch, getEffectiveGain,
stemControlId and volumeControlId. IDs are deck.<id>.volume and deck.<id>.stem.<category>.level.
Direct actions require a nonempty gestureId; dispatch requires origin direct and type
stemControl.set. Validation rejects unknown IDs, nonfinite/out-of-range values and direct stem
values outside 0.01 steps. Main volume and pure allocated-gain calculations permit continuous
values. No input bindings or audio side effects are installed.

`appState.stemSession.authorization.ceilingsByStem` starts with global category slots all null.
The pure calculateStemAuthorization(authorization, volume, allocatedLevels, stem = null)
computes high-water updates for already-qualified input. It multiplies main volume by allocated
level, updating all four categories for main-volume gestures or only the selected stem for
individual gestures. Positive gains establish/increase authorization; zero leaves null and
lower/equal gains preserve the prior immutable snapshot. Requested levels do not stand in for
allocation. Inputs/prior snapshots are never mutated.

The action layer owns eligibility: valid direct-origin input with gestureId, an actual control
value change (the existing action change result), and current stemHandoff participation on the
target deck. Same-value actions still record provenance but cannot authorize. Excluded decks
remain independently controllable; their gestures never affect shared ceilings. Joining/leaving
retains ceilings and never retroactively imports excluded gestures, including a repeated
same-value action after rejoining. No GUI/keyboard/MIDI binding or physical-event verification
is implied by caller-supplied direct provenance.

Actions prepare control/allocation, authorization and lastChange records before assignment.
Non-human/automatic origins remain rejected without any state update. Initialization records
no gesture and grants nothing. Authorization is shared globally by category, separate from
participation/saved defaults, and reset for every new application session. No persistence,
audio gain enforcement, above-unity convergence or multi-deck allocation is implemented.
Individual-stem two-deck state redistribution is now integrated below.
The existing requested-versus-allocated state/action behavior remains otherwise unchanged.

Tests in tests/stem-state-tests.js / .html and the full runner cover actual startup, independent
four-deck controls, separate requested/allocated snapshots, pure gains, invalid inputs, direct
provenance, no-op intent, shared action ownership and new-session isolation.
Tests in tests/stem-authorization-tests.js also cover global sharing, high-water retention,
zero gains/stems, category-only/deck-wide evaluation, exclusions, rejoining, non-human origins
and pure update validation. They verify domain
state, not audible stems. Subsequent track loading/replacement policy remains unresolved; the
existing metadata loading functions were not changed by this milestone.

Runtime audio nodes must later own rendering mechanics, not infer human authorization from
GainNode values or programmatic UI events. Only the explicitly scoped individual-stem
two-deck state allocation below is automatic; no audio behavior is implied.

A future deck transport should own one source timeline for four aligned stem assets. Asset
validation, synchronized scheduling, processor latency/phase behavior, bounded preparation
and cancellation require their own approved milestone. No extension of the current Signalsmith
wrapper, context lifecycle or DSP is authorized by this document. Audio-clock smoothing must
remain separate from musician-driven target convergence; its duration and interruption rules
need design. Resource measurements on Safari/iPad must precede claims about sixteen streams.

### Implemented session eligibility and relationship lifecycle

appState.stemSession now includes frozen eligibilityByDeck[1..4][category] and
relationshipsByStem[category]. Relationships are null or { deckIds: sortedPair, established: true }.
They do not duplicate participation: pair IDs derive from the existing authoritative store.
All are session state, never saved. Deck 1 starts eligible for all categories; others start
ineligible. Authorization still starts null for every category, independently of eligibility.

Changed positive individual-stem actions introduce eligibility even while muted or excluded;
same-value actions do not. Main-volume actions do not introduce stems. Eligibility is sticky
through direct zero, allocation-only automatic suppression and separate/repeated gestures.
There is no release reset API or automatic eligibility introduction. Untouched zeros remain
ineligible for future multi-deck allocation. Non-human dispatch is still rejected.

calculateGestureHandoffState prepares session metadata for the existing validated direct
actions; it never invokes the handoff calculator itself; the action adapter now integrates it after
preparing metadata, for qualifying individual-stem changes only. With exactly two participants, a changed
participating stem action can establish its category on an upward unity crossing, or when
its previous total is already 1. A qualifying main-volume change evaluates all categories.
Existing relationships persist through reversal, zero and repeated gestures. Main-volume actions still do not redistribute. Individual stem changes now use the prepared
relationship metadata and calculator to commit the complementary or constrained allocation.

reconcileHandoffRelationships derives the new pair from participation and invalidates any
relationship not matching it. Participation set/toggle/default initialization run this pure
reconciliation before assignment. Pair/count changes clear sharing but preserve levels,
eligibility, authorization and provenance. Re-enable at total 1 remains inactive initially;
the next qualifying direct gesture records sharing. Returning to a former pair does not restore
a stale relationship. Other capability toggles and valid no-op participation actions preserve
matching records. Applications without stemSession retain participation-only behavior.

Tests in tests/stem-handoff-lifecycle-tests.js permanently cover these boundaries, including
allocated levels different from requested levels, multiple action adapters and fresh sessions.
Allocation-only suppression is modelled in fixtures; actual automatic allocation, gesture/UI
bindings and audio are not implemented or verified by those tests. Existing calculator eligibility and sharing inputs now come from those session records in
the individual-stem action adapter; the calculator itself remains pure.

### Individual-stem two-deck state-action integration — implemented

The validated action prepares its direct requested/allocated target, direct authorization,
eligibility and pair metadata first. If the direct deck participates, exactly two decks have
handoff enabled, and its allocated effective gain changes, it invokes the existing calculator
with pre-change deck allocations, prepared authorization, eligibility and relationship state.
This supplies the already-unity re-enable lifecycle without changing the pure calculator.

The synchronous commit installs the direct target, optional other-deck allocation and updated
session metadata after all calculations succeed. The receiver's requested record is retained;
only its selected allocation changes. Automatic changes bypass direct dispatch and cannot
introduce eligibility or authorization, overwrite human provenance, or modify main volume.
lastChange.handoff optionally records the immutable calculator result for that direct event,
including deficit/excess. The existing Boolean action return contract remains unchanged.

No-effect changes, excluded decks and unsupported participant counts do not call the calculator.
Main-volume gestures now evaluate each changed effective-gain category independently. Membership changes still only invalidate
relationships while preserving levels and authorization. Automatic allocations retain full
calculator precision, while direct input validation retains 0.01 steps. No UI animation,
input binding, display quantization or takeover behavior is added.

Permanent tests cover the approved numerical sequences, automatic zero/restoration, limited
capacity/authorization, direct-only authorization growth, ineligible receivers, main-volume
and no-effect guards, requested/allocated separation, disable/re-enable, and atomic failure.
Earlier lifecycle tests that asserted no redistribution were updated only at those now-approved
integration points; their relationship/participation and preservation checks remain.

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

### Global automatic handoff permission — implemented, UI/persistence/MIDI deferred

**Working-tree checkpoint:** the preceding implementation is uncommitted and implements a
stem-only permission. The revised master/individual model below is approved design, not code.
Existing source and tests remain untouched pending a separately approved migration.


appState.stemSession.automaticHandoffEnabled is the single permission Boolean, factory true
for the four underlying decks. It is independent of participation, beatmatching, tune matching
and layout. appActions.stemHandoff exposes get/set/toggle/dispatch and the stable controlId
 global.stemHandoff.enabled. Dispatch accepts stemHandoff.set (Boolean value) or
stemHandoff.toggle. This adds no settings UI, input adapter, storage or identifier rename.

Set/toggle replace only the permission field; all existing deck records, authorization,
eligibility, relationships and lastChange provenance remain identical. OFF suspends the
individual-stem calculator path and prevents new direct authorization/sharing latches while
allowing independent manual controls and eligibility introduction. ON never calculates or
creates a gesture; the next eligible intentional action resumes existing handoff. Explicit
participation disable/pair changes still clear their own relationship, including while OFF.
Main-volume redistribution, multi-deck allocation and inactive above-unity convergence remain
outside scope. Switching views does not reset the preference.

An already established pair can accept the existing calculator's complement from above unity:
[0.8,0.6] followed by direct Deck 2→0.65 gives [0.35,0.65] when constraints allow. The permission
toggle itself never produces this adjustment. This resolves the prior concern about whether
that numerically valid existing handoff reduction is unexpected normalization.

### Proposal acceptance, fallback and atomicity — implemented

assessStemHandoffProposal(input,result) is a pure deterministic result-contract check, not
another convergence algorithm. It checks structure and exact deck IDs, finite unit-range
values, effective-gain multiplication, direct-target priority, unchanged unrelated/muted
controls, eligibility/authorization/physical increase bounds, sharing lifecycle and internally
consistent totals/status/residuals. It rejects an avoidable deficit/excess in established
sharing and receiver changes while inactive. The existing 1e-12 tolerance handles numerical
arithmetic only. A constrained result is accepted when its deficit is imposed by capacity;
there is no amplitude, timing or musical threshold for rejecting an otherwise valid result.

1. Invalid direct input, a calculator exception, or an exception while checking a proposal:
   throw/report the error, commit nothing. Existing full-rollback regression is preserved.
2. Successful calculation, deliberately rejected result: prepare an explicit direct-only
   fallback using the validated human target, authorization, eligibility, relationship and
   provenance metadata. Leave every other deck untouched. lastChange.handoffRejection reports
   a fixed reason; invalid result data is not committed as a handoff snapshot.
3. Accepted result (balanced, inactive or valid constrained): retain the prior atomic action
   commit, including calculator deficit/excess reporting in lastChange.handoff.

This resolves the earlier transaction ambiguity without catching calculator exceptions as
fallback. Structural/constraint violations supply rejection criteria already required by
existing rules; no new musical rejection policy has been invented. Any future additional
musical rejection policy still requires approval. Toggles cannot overwrite human provenance.

Permanent tests/global-stem-handoff-tests.js covers validated shared controls/idempotence,
suspension identity guarantees, OFF-state independent control without authorization/new latches,
re-enable without a synthetic event, view preservation, explicit disable while suspended,
above-unity resumption, valid constrained outcomes, rejection fallback and acceptance defects.
Existing forced-calculator-exception tests remain unchanged. No audio/DSP behavior is altered.

### Deferred persistence and input adapters

Persisting the user's Boolean preference is approved future work, independent of session
authorization persistence (still undecided). A later versioned offline adapter must validate
before initialization, handle unsupported versions and failures, preserve preferences across
views and not silently extend the strict participation-defaults v1 format. No browser storage
exists for this permission yet; new application sessions currently use the factory ON value.
Do not infer permission to save ceilings, eligibility, pair latches or gesture history.

Future mouse/touch/keyboard/MIDI adapters call the same setting actions using
 global.stemHandoff.enabled, and retain existing deck.<id>.stem.<category>.level and
 deck.<id>.volume actions. MIDI learn, feedback, configuration persistence and settings UI
remain separately approved milestones. Automatic allocations never masquerade as human input.

### Proposed master/individual automatic-mixing architecture — not implemented

One authoritative preferences record should own masterEnabled and the selected beatMatch,
tuneMatch and stemHandoff Booleans. Names/record location are proposals, not executable API
renames. Proposed layout:

```js
// Proposed only; do not add alongside an authoritative duplicate stem permission.
automaticMixing: {
  masterEnabled: /* explicit factory default still to confirm */,
  features: { beatMatch: true, tuneMatch: true, stemHandoff: true }
}
```

Stable controls: global.automaticMixing.enabled, global.beatMatch.enabled,
global.tuneMatch.enabled, global.stemHandoff.enabled. Shared validated set/toggle actions should
own behavior; future UI, mouse/touch/keyboard and MIDI adapters invoke those actions. Compute
effective permission as masterEnabled && features[feature], then apply the existing per-deck
participation restriction. Never store another effective-state copy or rewrite the three
individual preferences when master changes. Master ON therefore uses retained choices rather
than replacing them with all-ON defaults or a stale snapshot.

Master OFF preserves playback tempo/pitch, stem requests/allocations, latches, authorization,
eligibility, participation and human provenance, while suspending every automatic feature.
Master ON changes only permission; each enabled feature waits for its appropriate qualifying
action. Stem handoff keeps the approved suspension/latch/calculator/fallback rules, including
no immediate normalization. No synthetic gestures, human authorization or implicit MIDI input.
An explicit sharing disable/pair change remains distinct from master or feature suspension.

### Conflicts and smallest safe implementation sequence — proposal only

1. **Migrate permission ownership first, with tests.** The current uncommitted
   stemSession.automaticHandoffEnabled is the individual stem preference, not the master.
   Move ownership to the agreed shared record (or an agreed equivalent) with no second writable
   Boolean. Preserve stable global.stemHandoff.enabled identity; add the master and beat/tune
   IDs/actions. Keep session authorization/eligibility/relationships separate. Confirm master
   factory default first; default ON is recommended to preserve current initial behavior.
2. **Gate the existing stem action path by the derived permission.** Either master OFF or
   individual stem OFF must suspend redistribution/new authorization/new latches while retaining
   state; manual gestures remain direct. Master ON must respect individual OFF preferences.
   Preserve the current calculator algorithm, rollback/rejection distinctions and atomic commits.
3. **Explicitly reconcile existing metadata synchronization before claiming master OFF works.**
   loadSong still calls synchronizeLoadedDecks when interfaceMode is fourDeck; that stopped-deck
   averaging path ignores participation and global permissions. cueSong independently prepares
   tempo/pitch from global/reference state. These historical paths are not continuous matching
   and cannot be silently left active under a supposedly suspending master. Specify and test
   which applying/preparation actions are automatic, including cue fallback when matching is
   disabled, without changing pure harmonic calculations or inventing convergence behavior.
4. **Add feature gating without implementing new matching algorithms.** Cover feature-specific
   action boundaries only after step 3 is approved; beatmatching/tune-matching qualifying resume
   actions are not fully defined yet. Toggling master/features never applies tempo/pitch/gain.
   No stem/audio integration or unrelated metadata reset is implied.
5. **Verification:** all master/feature Boolean combinations; retained individual choices through
   OFF/ON and view changes; explicit sharing disable vs suspension; unchanged levels/tempo/pitch/
   provenance/authorization; manual controls while suspended; no immediate work on ON; correct
   qualifying-action resumption; existing calculator/failure regressions; legacy load/cue negative
   cases; full suite and relevant browser checks. No production-readiness claim from state tests.
6. **Later:** versioned offline preference storage and UI/MIDI adapters through shared IDs/actions,
   with no implicit authorization persistence. Do not change strict participation-defaults v1
   format or rewrite uncommitted work as a side effect of planning.

This sequence expands the proposed milestone beyond a stem-only switch but authorizes no code
now. Preserve the existing uncommitted implementation and tests for review. No files/directories
or existing TuneFlow identifiers are renamed; audio/DSP behavior remains unchanged.

### Mathematical design constraint: continuous reversal without release

**Approved essential performance behavior, not implemented.** One continuous direct fader
gesture must support immediate bidirectional stem handoff and repeated reversals. The intended
use includes alternating complex bass growls. Restoration cannot depend on mouseup, touchend,
a new gesture, or waiting for the suppressed stem to produce a positive current weight.

For the approved two-deck example only—both Flow stems eligible and participating, main volumes
1, established sharing, sufficient authorization—the required relationship is:

`effectiveFlow1 = 1 - effectiveFlow2`

The human-controlled Deck 2 value has priority. Illustrative updates within **one gesture**:

| Update | Deck 2 direct Flow | Deck 1 automatically allocated Flow | Total |
|---|---:|---:|---:|
| Start | 0 | 1 | 1 |
| Raise | 0.4 | 0.6 | 1 |
| Upper endpoint, still held | 1 | 0 | 1 |
| Reverse without release | 0.75 | 0.25 | 1 |
| Lower endpoint, still held | 0 | 1 | 1 |
| Reverse again | 0.5 | 0.5 | 1 |

These values constrain established, feasible two-deck sharing; they do not define convergence
from unestablished above-unity totals or initially-unity inactive states, multi-deck distribution, or responses when authorization/physical
capacity is insufficient. Automatic controls must track gesture timing/speed and actual
allocated changes without artificial animation lag; no animation or audio smoothing is added.

Proposed future state must preserve zero provenance separately from current allocated gain:

| Zero case | Required distinction |
|---|---|
| Untouched zero | No prior human introduction may be inferred merely from global authorization. |
| Automatic suppression to zero | Preserve eligibility and retained contribution weights for immediate return. |
| Direct movement to zero | Honor the direct value and retain provenance. In an established eligible two-deck pair, zero/release does not end handoff; eligibility persists through direct zero/release; wider-group allocation remains unresolved. |

For more than two decks, current-gain-only proportional weights lose information when all
recipients become zero. Retained weights therefore cannot be destroyed or overwritten with
zeros by automatic suppression. Exact weight capture/update rules and proportional restoration
among several eligible recipients remain design decisions; this requirement does not select
an algorithm. Existing requested/allocated records and global ceilings alone do not supply that
weight history. Session eligibility/pair state is now implemented above, but no retained
contribution-weight state or multi-deck restoration algorithm is implemented.

**Design cases and numerical test coverage:**

- The isolated calculator tests now replay the table without release-dependent state, preserve
  explicit eligibility inputs and verify direct priority/complementary endpoint reversals. Live
  gesture-ID handling, UI response and multi-deck retained-weight state are not implemented.
- Reverse immediately after automatic zero, and repeat endpoint/partial reversals; no release
  gate, dead interval or loss of return eligibility is permitted.
- Compare explicit ineligible zero with eligible automatically suppressed zero. For established
  two-deck handoff, zero/release must not end sharing; session eligibility introduction is now implemented, with wider-group allocation still deferred.
- For three/four decks, verify that suppression preserves existing retained weights. Once the
  weight policy is approved, test proportional return, rather than invent expected ratios now.
- Verify participation, effective-gain authorization, zero-main-volume and physical limits
  remain respected. When capacity is insufficient, do not force an unauthorized total of 1;
  the two-deck calculator now reports remaining deficits/excesses while preserving the direct
  proposal. Multi-deck constrained redistribution still requires approval.

**Clarified:** in an established eligible two-deck relationship, reaching/releasing at zero
does not end handoff; it remains active until explicitly disabled. **Unresolved:** initial
above-unity activation/convergence, weight capture/
refresh and multi-deck distribution. No live handoff, audio or UI is authorized.

### Isolated pure two-deck calculator — implemented

calculateTwoDeckStemHandoff(input) lives in two-deck-stem-handoff.js, loaded by its dedicated
numerical test page, full runner and application entry points. It stays pure; the existing
stem action adapter invokes it only for individual effective-gain changes with exactly two
participants. No audio or UI adapter is connected.
The input API, validation, results and constraints are specified in RULES.md section 21.

The function accepts prior sharing state and explicit receiver eligibility. It now establishes
sharing only on the approved rising effective-gain crossing from below unity; it does not
choose other activation/convergence rules or decide which untouched stems may return. There are always four deck snapshots, but exactly two participating IDs define the
pair. Loaded songs/layout are irrelevant. Snapshot flags are calculation inputs, not a second
runtime participation store; live integration must read the authoritative participation state.
Three/four participants explicitly reject rather than using an invented multi-deck algorithm.

For a direct gesture in established sharing:

- Preserve the proposed direct allocation and calculate its effective gain gD.
- Desired receiver effective gain is 1 − gD.
- Receiver automatic-increase capacity is min(main volume, category authorization), or zero
  when ineligible/unestablished. Allow existing receiver gain above that limit to stay or
  decrease: maximum feasible gain = max(current gain, automatic-increase capacity).
- Choose the lesser of desired and maximum feasible receiver gain; divide by receiver volume
  to obtain allocation when volume is positive. Preserve its fader at zero volume.
- Report the actual participating total, deficit/excess relative to 1, and balanced/constrained
  status. The balanced status uses a 1e-12 floating-point tolerance; reported residuals retain
  their actual arithmetic values. This is not an audible gain or allocation quantization rule.

A participationChange trigger preserves allocations and the sharing flag, including above unity.
For an inactive pair, compare previous effective gains against the proposed direct effective gain.
When the previous total is below 1 and the direct gain rises, preserve the other allocation
while the proposed total stays below 1. When it reaches or crosses 1, return established sharing
and use the existing constrained complementary calculation. No exact boundary event or release
is required. A downward, same-value or zero-effective-change gesture cannot establish sharing.
An inactive state already at/above unity retains the previous calculator behavior; choosing its
activation/convergence remains outside the calculator. The new session lifecycle separately
records already-unity establishment on the next qualifying gesture; individual-stem domain
integration now uses that record, without audio integration.

The approved numerical sequence is [0.60,0.20] → [0.60,0.30] → [0.60,0.40] → [0.50,0.50]
→ [0,1]. The returned flag becomes true at [0.60,0.40]. Tests then reverse to [0.25,0.75]
and [1,0], repeatedly, without deactivation. The caller must carry both returned allocations
and relationshipEstablished into subsequent calculations, across held or separate gestures.
The exact approved persistence regression is [0.60,0.20] → [0.60,0.40] → [0.50,0.50] →
[0.80,0.20] → [0.30,0.70]. Sharing becomes established at total 1 and remains latched through
subsequent reversals, zero and release/reengagement. Tests rebuild proposals between updates
using returned allocations/state, exercising both held-gesture and cross-gesture mathematics;
they do not simulate browser pointer events or claim UI integration. Authorization/physical
shortages may produce a deficit, but do not clear established sharing. The flag belongs to the
handoff relationship, not the lifetime or direction of an input gesture.

Explicitly supplying inactive sharing disables it; this calculator owns no live session state. No release event or direction-dependent latch is
required. Input records, volumes, requested levels, provenance, authorization and eligibility
never mutate. The returned sharing flag may change only through the approved below-unity crossing. Authorization remains caller-supplied; this function does not establish/increase
ceilings. Continuous allocations are mathematical proposals, not changes to direct fader steps.

Numerical examples now covered: [1,0]→[0.6,0.4]→[0,1]→[0.25,0.75]→[1,0]; either deck taking
direct control; inactive [0.3,0.4] with direct second 0.2 gives [0.3,0.2] and deficit 0.5;
joining [0.6,0.7] preserves excess 0.3; direct gain 0.2 with authorized receiver capacity 0.4
gives deficit 0.4; receiver main volume 0.3 caps its allocation at 1 and reports deficit 0.5.
Tests also cover null authorization, eligible/ineligible zeros, physical limits, non-unity
volumes, a pair using Decks 2/4 and unsupported participant counts. These are state/numerical
checks only. Session eligibility/pair lifecycle is implemented separately above; contribution weights,
above-unity convergence, live redistribution, audio, DSP and UI remain unimplemented.

### Historical/superseded

The prior immediate equal-reduction joining example (0.80 + 0.30 → 0.75 + 0.25), zero-floor
joining algorithm and instantaneous shared cap were earlier documented requirements, not
implemented stem functionality. They no longer define future handoff. The prior all-zero
newly-loaded-stem rule is also superseded; do not infer replacement-track behavior from startup.
Older updated-named documents and the read-only v40 reference do not override current RULES.md.

### Unresolved decisions before affected behavior is implemented

- Convergence response, thresholds, gesture endpoints and multi-deck priorities/distribution.
- Establishing, retaining and breaking sharing; behavior when ceilings prevent a total of 1.
- Future physical-input bindings, simultaneous-gesture handling, smoothing-time sampling
  and 0.01 rounding/residuals for future redistribution. Current direct action qualification
  and zero-gain behavior are approved and implemented above.
- Stem-level behavior across loading, replacement and Eject. Global authorization remains session-only and is not a saved default.
- Automatic cue/track selection, activation, preparation failure and transition behavior.

**Milestones completed:** stem state/actions, session eligibility/pair lifecycle and isolated
individual-stem two-deck action integration. Authorization and physical bounds apply to the
automatic receiver through the existing calculator. Next work requires separate approval:
multi-deck redistribution, above-unity convergence, audio routing, separation,
continuation, UI/MIDI bindings and persistence. No general automatic allocator is authorized.

## 23. Visual reference, implementation status and boundaries

v40 is the visual/interaction benchmark; retain/improve perceived functionality, usability and
polish with shared readable architecture. The experimental interface is not final design.
Main visual implementation remains in its planned phase. Earlier choices must support
intuitive drag/drop, generous touch targets, accessible alternatives and efficient iPhone/iPad
workflows. Preserve future MIDI's stable control IDs and shared input-independent actions.

Implemented: shared metadata decks, independent local audio, isolated Deck 1 stretch experiments,
and musical/cue tests. The 5 ms release experiment is implemented and automated tests passed;
Safari listening succeeded according to the user in the tested release+persistence scenarios (section 18). Persistence remains opt-in; universal click freedom and native reclamation are not established. No playback or experimental setting changes
are made here.

Confirmed requirements are distinguished from recommended schemas/interactions/roadmap and
open design decisions. Library/search/layouts, browser persistence of defaults, multi-deck handoff, above-unity convergence and
MIDI are not implemented. Individual-stem two-deck domain handoff is integrated; no audio
gain routing is connected. Participation state/actions and validated one-time starting-default initialization are implemented; the stem state/action foundation is also implemented; storage and audio integration are not. Existing interfaceMode triggers remain until an
approved migration. Convergence mathematics, reference edge cases, remaining handoff precedence and live transition
semantics are prerequisites for the affected implementation; unrelated musical/cue rules stay.


## 24. Future-experiments backlog — permanent advanced-feature policy

An idea labelled **advanced** means an eventual experiment, not a current development priority
or foundational prerequisite. It must not delay or redirect foundations and requires separate
implementation approval. Keep such ideas here without promoting them in the immediate roadmap.

**Metric modulation and rhythmic subdivisions — deferred.** Optional 3:2, 2:3 and 4:3 ratios
could support subdivision-related synchronization, a one-shot calculated relationship without
continuous beatmatching, or continuous following of an explicitly selected ratio. No controls,
algorithms or current milestone are approved. Standard same-/half-/double-time compatibility
remains in the core model; advanced ratios do not complicate its initial implementation.

Preserve development sequence: audio validation → shared domain/actions/settings foundations →
core stem and library subsystems → responsive UI → separately approved advanced experiments.
The approved participation-defaults validator and one-time initialization boundary are now
complete (section 21). A future separately approved milestone can define the offline repository
and explicit Save Defaults contract, keeping session edits distinct from starting preferences. Do not implement storage or audio integration implicitly. Membership state/actions
are now complete; convergence, group reference edge cases and gesture-driven handoff mathematics remain
separate design work. The audio-independent stem state/action foundation in section 22 is complete. Global
authorization tracking and session eligibility/pair lifecycle are also complete. Individual-stem two-deck domain handoff is now integrated; further redistribution and
audio gain integration require separate approval. Offline storage remains deferred.
Preserve existing executable prototype behavior until approved integration; superseded stem
joining requirements are historical documentation, not implemented behavior to preserve.


## 25. Integrated stem sampler — planned central performance feature, deferred

**Approved high-level concept; not implemented.** The sampler is intended to become a central
TuneFlow performance feature, but development is explicitly deferred until the core application
is operational. It does not expand the current milestone or delay foundational functionality.
Implementation requires separate approval.

Users can select one or multiple samples from a song's separated stems. While that song is
playing, the user can bypass a stem category's normal playback and perform with those selected
samples in real time. Other stem categories continue normal playback. The sampler belongs to
the existing song/deck/stem architecture rather than operating as an unrelated audio player.

**Architectural implication for future work:** preserve independently addressable stem audio
and its song/deck/category identity. Allow a stem category to be routed through normal playback
or the future sampler. This is a design constraint to keep that option open, not permission to
add routing nodes, sampler state/actions, DSP, controls or a new playback backend now.

**Unresolved:** sample triggering, looping, pitch mapping, synchronization, bypass transitions,
and interactions with automatic stem handoff and effective-gain authorization. Do not infer
that sampler activity grants authorization, inherits a particular ceiling, or changes handoff
participation. These behaviors need later design and explicit approval; existing rules and
current audio routing remain unchanged.

### Isolated native four-stem fixture — two-deck extension implemented experimentally

`createFourStemPlayer` remains the reusable transport. `createTwoDeckStemPlayer` lazily owns
one shared AudioContext and exposes `getDeck(1|2)` plus pair-wide `close()`. Each borrowed-context
player owns its buffers, position, loading/command versions and session graph; individual close
cannot close the pair's context. Pair shutdown invalidates both decks' pending work before
closing the context once. One-deck construction still owns its own context for compatibility.

Each session routes four sources through four musical stem GainNodes, then a musical main-volume
GainNode, then a separate transport GainNode to the shared destination. No common master limiter
or normalization is introduced. Main-volume and stem adjustments independently retain current
linear-envelope values on retarget and use the provisional 10 ms ramp. The standalone player API defaults to unity; the integrated page now initializes its audio
targets from domain defaults (volumes 0, Deck 1 stems 1, Deck 2 stems 0).
Both controls survive audio replacement. Within-deck starts/offsets are identical; deck timelines
remain independent. Pause/Stop still use immediate retirement, without a new release envelope.

The existing page now provides two separately labelled panels and Close all audio. Stable
control IDs now use existing deck volume/stem/participation IDs and dispatch shared actions
through the isolated bridge. Existing normal/SoundTouchJS/Signalsmith code is unchanged.

Validation remains conservative: identical decoded length/rate per deck, mono/stereo only;
no musical-offset detection. Different decks may use different-duration songs. Eight decoded
stem buffers and transient replacement buffers require Safari/iPad memory/CPU measurement.
The user-reported two-deck Safari listening pass is recorded; newly connected automatic
handoff listening remains pending. Native reclamation, transport clicks and long-running stability are not established.

Tests cover borrowed context ownership, simultaneous independent transports, within-deck
resume synchronization, gain isolation/reversals, retained levels, cancellation, repeated
sessions and full cleanup. Browser tests decode generated WAVs and render two-deck sums and
independent main-volume ramps, then exercise simultaneous native playback. No audio handoff
claim follows from the earlier transport tests. The bridge below now adds experimental handoff
audio; stretching, separation and beat/tune matching remain absent.

### Shared-action audio bridge — isolated prototype implementation

`experimental/stem-handoff-audio-bridge.js` invokes the existing stem/participation action
factories against appState, then schedules a projection of committed allocations and volumes.
No duplicate mathematical policy or writable participation store is introduced. The separate
page loads domain scripts, excludes inaudible Decks 3/4 and initializes audio targets before
loading any files. No context is created until an explicit Load gesture.

`createTwoDeckStemPlayer.applyGainSnapshot` validates both targets before scheduling changes
at one shared future context time. Existing setters accept an optional scheduling time; old
callers retain their behavior. Gain ramps keep their unfinished segment during future-time
retargeting. Automatic allocations update the actual fader positions immediately after commit;
requested labels preserve intent, while per-control labels distinguish direct and automatic
updates. Range displays allow fractional allocations; direct input still uses 0.01 increments.
The 100 ms timer only refreshes transport status, not handoff movement.

Calculator exceptions schedule nothing and preserve full rollback. Native AudioParam failures
cannot be rolled back transactionally after a domain commit: errors are surfaced. Gain ramps
are provisional smoothing, not claims of instantaneous effective-gain-cap enforcement while
separate volume/stem envelopes move. Replacement retains current domain/audio targets; transports
remain independent. Tests include stereo-isolated rendered Flow [1,0] -> [0.5,0.5] -> [0,1],
main-volume once, independent categories, participation, rapid retarget continuity and failure
rollback. Safari listening, device latency and long-run resource validation remain pending for
this integration. No normal/SoundTouchJS/Signalsmith files or DSP are changed.

### Main-page source integration — experimental bounded implementation

`stem-source-router.js` routes transport/file calls to the existing complete-song router or
the tested two-deck native player. Mode defaults to complete song, only Decks 1/2 can opt in.
Switch guards inspect both backend states plus pending operation counts; Eject clearing a load
flag cannot bypass a still-pending browser promise. Source mode is backend selection, not a
second participation/volume store. No new processing engine is created.

`main-stem-integration.js` mounts the reusable `experimental/stem-controls.js`, owns the stem
pair/bridge, and adds source and participation controls to the four existing panels. It passes
existing appActions to the bridge and preserves four-deck participation defaults. The prototype
host remains separate and retains its explicit fixture exclusions. Neither host duplicates the
calculator. Complete-song controls/diagnostics retain the previous router API and context
ownership. Existing Play/Pause/Stop/Eject buttons serve stem mode; the mounted component adds
mapped files, Load and musical controls without duplicate transport handlers or polling timers.

Main-page volume/stem controls affect native stems, not legacy complete-song gain routing.
No new metadata load/cue synchronization is triggered. Unsupported stem tempo controls are
explicitly disabled. Shared-action commit callbacks immediately refresh both musical panels;
the existing 100 ms loop handles transport status. Source switching leaves domain allocations,
authorization and eligibility intact. As before, a native scheduling error after a successful
domain commit cannot be represented as transactional audio rollback.

Regression coverage adds source-router mocks and tests/main-stem-browser-tests.html for four
startup defaults, source locks, exclusive routing, manual exclusions, immediate handoff displays,
replacement, stale loads, normal-playback return and prototype mounting. Existing rendered
handoff and experimental-backend tests remain applicable. Main-page Safari listening and long-run
CPU/memory validation remain pending; earlier isolated two-deck handoff listening passed.

### Batch stem-file selection — bounded reusable preparation layer

`experimental/stem-file-assignments.js` owns only a deck-local candidate pool and category-to-file
mapping. `recognizeStemFilename` returns every matching category rather than picking one;
`createStemFileAssignments` adds non-destructive batch proposals, explicit manual assignments,
completeness checks and selection clear. It does not know about audio or domain gain state.
Candidates use conservative name/size/lastModified/type identity to reject duplicate assignments
across dialogs, without reading or hashing file content. Metadata collisions remain a limitation.

`experimental/stem-controls.js` reuses that layer on both pages. A multiple-file input feeds
recognition; four review dropdowns display/correct assignments while individual file pickers
remain explicit fallbacks. Existing mappings survive conflicting batches; users explicitly
unassign/reassign to resolve conflicts. File cancellation is a no-op. Candidate/option lists
are rebuilt only when candidates change, so periodic transport refresh does not close an open
review dropdown. Filenames are inserted as text. Load is gated on a complete distinct mapping
and calls the existing loader with a snapshot; no decoder or musical action runs on selection.
No audio engine, gain routing, DSP or handoff policy changes are introduced.

Tests: tests/stem-file-assignment-tests.js (full runner) and tests/batch-stem-browser-tests.html
(real selection UI, deferred decoding, correction, replacement and playback). Existing main-page,
prototype, rendered handoff and backend regressions remain in the validation set. Safari batch
picker UX remains to be checked; existing full-buffer memory/validation limitations are unchanged.

### Four-deck native playback extension — implemented experimentally

The native context owner is generalized as `createNativeStemMixer(contextFactory, deckIds)`;
main-page ownership is [1,2,3,4]. `createTwoDeckStemPlayer` remains a compatibility wrapper
using [1,2], so the standalone prototype keeps the same behavior without a second engine.
The frozen `deckIds` list describes audio ownership only, not handoff participation. All players
reuse `createFourStemPlayer` and borrow the same lazily created context. Pair-wide shutdown
becomes owner-wide shutdown; individual retirement still cannot close that shared context.

The source router tracks selection and pending operations for every owned deck, the bridge
projects canonical state for those IDs, and main integration mounts the same stem controls on
all four panels. No additional timer, DSP callback or matching logic is introduced. Contexts
for existing complete-song backends remain separate under their original owners.

Tests add four-deck loading, sixteen actual sources with one context, within-deck alignment,
independent pause/resume/stop/eject/replacement/source switching, batch controls on all four,
control isolation and cleanup. Rendered measurements cover sixteen-source sums and gain
isolation, plus existing stereo-isolated handoff for pairs [1,2], [3,4] and [1,4]. Three/four
participants retain direct-only actions; no authorization or eligibility semantics change.

Performance limitation: all stems are decoded into memory. Sixteen stereo stems at 48 kHz
use about 6.144 MB of float PCM per second of equal-duration material (~1.84 GB for five
minutes), before encoded files, old buffers retained during replacement, decoder overhead and
browser/device allocations. Mono uses half that PCM. Short generated tests do not establish
long-file iPad/Safari capacity, native reclamation or sustained glitch-free operation. Native
mixing introduces no stretching DSP; CPU, device latency, clipping and lifecycle stability
still need real-device measurement/listening. Do not claim production capacity from tests.

### Bounded WAV streaming feasibility fixture — isolated implementation

`experimental/bounded-wav-reader.js` parses RIFF chunks and converts bounded integer/float32 PCM regions.
`bounded-wav-player.js` schedules 250 ms chunks from a single deck timeline, bounded to selectable
1/2/5-second windows. The standalone HTML/controls expose transport, seek, independent gains,
manual dormancy and logical buffer/latency/underrun counters. No existing application module
imports this experiment. There is no new DSP, resampling or handoff policy.

This first fixture uses main-thread conversion/native chunk scheduling, a 25 ms maintenance
timer, and a 50 ms start/activation lead after preparation. It is not the proposed worker/worklet
architecture and does not establish older-device performance. Cancelled reads can remain pending;
generation checks discard results. Rendered tests compare source samples across chunks, seeks
and dormant activation; real-time tests cross the initial window through refills. Counters are
logical ownership estimates, not process memory/native reclamation measurements. Safari testing,
listening, longer runs and worker-based comparisons remain separate follow-up work.


The isolated WAV reader now distinguishes container/signature, RF64/BW64, RIFX, encoding tags,
widths, extensible GUIDs and malformed chunk errors. It adds ordinary IEEE float32 and standard
extensible PCM/float without replacing the transport or decoding complete files. Format headers
read at most 40 bytes per fmt chunk; the player status includes successful per-stem encoding,
bit depth, valid bits, channels, rate and frame count. Original-container failure remains
unidentified without a failing header or the new diagnostic; this extension does not claim
that float/extensible support fixes an invalid RIFF/WAVE signature. See experimental/BOUNDED_WAV.md.


The standalone bounded reader now uses header dispatch to WAV or AIFF/AIFF-C metadata parsing,
then one endian-aware bounded PCM reader and the unchanged source-frame timeline. AIFF metadata
is normalized into the same rate/frames/align/offset/encoding representation. AIFF-C supports
NONE, sowt and fl32/FL32; other codecs reject explicitly. This extension reads no complete
recording and introduces no resampling/DSP. Status exposes detected container/encoding fields.
Original WAV rendering tests remain and are repeated with mixed AIFF/AIFF-C stems. No main
application or existing transport backend imports this experiment. User-file compression type
and actual Safari listening still require a retry; FORM/AIFC alone identifies only the container.


The standalone bounded prototype now separates transport/starting, shared source-frame timeline,
and PCM preparation/readiness. One cached covering chunk per enabled stem enables Ready Play
without payload reads or AudioBuffer allocation. The cache shares the existing bounded ownership
with streaming chunks; no full-song/start-cache duplication is introduced. A serialized preparation
queue and coalesced timer pump prevent concurrent stale payload allocations. Read and conversion
are timed separately in the existing bounded reader; create/copy and startup stage timing live
in the player. Context/performance-clock onset estimates are explicitly not audible measurements.

Delayed activation and playing seeks map their scheduled output time back to current source
frames and trim buffer offsets, preserving the timeline during preparation. Paused seek retains
its exact sample; Stop retains/replenishes frame-zero PCM. Generation/command/stem epochs guard
all asynchronous transitions. The experimental lead is 10 ms with a 50 ms fallback, and gains
retain 10 ms opening. Under controlled Chrome tests the previous 55.0–57.4 ms predicted startup
became 10.0–10.1 ms for Ready starts; Safari and hardware output still require validation.
See experimental/BOUNDED_WAV.md for methodology, metrics, regression scope and limitations.
This is not authorization to change the main application or adopt worker/worklet/adaptive handoff.

### Four-deck handoff Phase 1 — isolated allocation foundation

`four-deck-stem-allocation.js` adds `calculateFourDeckStemAllocation` without loading it in
index.html or changing the existing two-deck path. It reuses stem-state gain/ID validators and
the existing one-category authorization ceiling/return eligibility concepts. Four validated
snapshots supply id, volume, requestedLevel, allocatedLevel, active retained membership,
participating and returnEligible. Permission, established sharing, trigger and optional priority
ID are explicit inputs; no state, transport, UI or authorization mutation occurs.

Triggers: entry/directGesture prioritize the supplied request; departure/rebalance distribute
remaining requests; preparation isolates inactive adjustments; preserve retains allocations.
Effective request weights are volume × requestedLevel. Bounded proportional water filling
redistributes capped shares among remaining positive weights in at most four passes. Existing
effective allocations bound retention; eligibility and session ceilings bound increases.
Established sharing fills capacity beyond positive requests when permitted; zero weights are
not invented. Unestablished redistribution caps receiver targets at requests. Numeric deck-ID
sorting makes results independent of input order. Frozen outputs include allocations, retained
requests, membership IDs, effective gains, deficit/excess and status.

Tests cover the entry/Pause/Eject example, updated requests, zero through four members,
all permutations, bounded randomized-pattern cases, authorization/eligibility, muted and zero
weights, OFF controls and invalid inputs. They verify numerical proposals, not actual playback.
Next: settle sharing activation, Stop/natural-end membership and participation/re-enable policy,
then add transport notifications and action integration as separate tested steps. Preserve
paused membership (new direction), queued allocation inheritance and no implicit Play authorization.
Queue transport, smoothing integration and continuous audio-cap verification remain future work.
See the latest RULES.md Phase 1 section for precedence over historical pair-only plans.

### Phase 2A — shared timeline start primitive

Native mixer `startCoordinated(id, snapshot)` and bridge forwarding method are opt-in, currently
unused by the application. Reuse the native player's guarded start path: ordinary Play still
initializes unity transport; coordinated starts initialize the target musical coefficients
behind zero transport and ramp transport to unity over 10 ms. Successful source scheduling
precedes existing gain retargets, using one reserved context time after outstanding envelopes.
A 20 ms minimum lead is provisional and a missed reservation rejects. Pending coordinated starts
are serialized by rejection, not a queue. Snapshots are copied before asynchronous resume.

With existing main volumes held fixed, each effective contribution interpolates linearly from
its settled initial value to its target (joining initial contribution is zero). Thus their sum
is a convex combination of validated capped endpoints. Existing-volume changes reject rather
than assuming products of ramps are linear. Existing musical ramps, independent transports,
source offsets and context ownership are reused; no allocator or membership is wired in.
Partial source-start failures disconnect all new paths without modifying existing automation;
native automation failure after scheduling begins is surfaced but cannot claim full rollback.
No membership is stored/committed in this phase. The caller must treat only true success as a
candidate membership admission; later lifecycle cancellation remains Phase 2B work.

Tests reconstruct scheduled AudioParam envelopes at 48 kHz throughout two-/three-existing-deck
joins, verify common boundaries and unchanged source starts, cancellation, concurrent requests,
partial-start cleanup, expired deadlines, endpoint rejection and outstanding-ramp settling.
These are deterministic automation tests, not actual OfflineAudioContext rendering or audible
click measurements. Browser rendering and Mac/iPad listening remain separate validation steps.

### Phase 2A.1 — retargeting scheduled products safely

The prior uninterrupted-join proof did not cover a stem retarget while transport was ramping.
A permanent regression reconstructs its 1.178888889 peak. Native player session metadata now
tracks transport envelopes as well as musical envelopes. Mixer snapshots in coordinated mode
prepare every deck before writes: evaluate the actual scheduled coefficients at a shared time,
validate effective endpoints including fixed main volumes, then normalize transport into the
stem coefficients without changing the effective product at that boundary. Subsequent 10 ms
stem ramps form a convex combination of capped effective endpoints, including interruptions.
Transport normalization retains the preceding ramp segment up to the boundary. Main-volume
changes/unfinished main ramps reject rather than approximating nonlinear products. No lookup
of AudioParam.value or previous target is used as the current moving coefficient.

Preparation and application methods on players are mixer-internal scheduling helpers. Direct
gain setters in a coordinated mixer reject to prevent bypass; the bridge already uses snapshots.
Ordinary mixers retain prior behavior. Pause/Eject removes sources normally; the next complete
snapshot redistributes among actual remaining sessions without restarting them. Native partial
write failures/missed deadlines pause owned sessions and throw; future integration must not
commit membership after an error. Membership/action events remain Phase 2B work.

The runner includes permanent samplewise regression tests, repeated interrupt fractions with
up to four audible decks, simultaneous categories, nonunit volumes, continuity, participation-
style snapshots, departures and safe rejections. Existing cancellation/start-failure coverage
remains. Simulated cap evidence does not establish browser click freedom or hardware onset;
Safari/Mac/iPad rendering/listening is still required before release claims.
