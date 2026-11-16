# TuneToss — Product Design and Development Handoff

Project name: **TuneToss**, including the DJ application and broader music/audio research (formerly TuneFlow). TuneFlow is not the name of a separate ongoing research project; any future name is undecided. Existing paths and executable identifiers remain unchanged for compatibility.


**Purpose:** Share architecture, design context, roadmap and unresolved decisions. This is
not a claim that every feature is implemented. AGENTS.md owns workflow/safeguards; RULES.md
owns approved product behavior and labelled historical implementation. Updated-named older
copies, if present, are historical and cannot override those three authoritative documents.

**Status labels:** implemented = verified in source; approved but not implemented = future
product requirement; experimental = isolated prototype, not a universal guarantee;
historical/superseded = retained context, not current policy; unresolved = no algorithm or
behavior may be silently chosen. RULES.md section 21 owns the latest stem decisions.

## 1. Vision and working style
TuneToss is an iPad-first DJ application, rebuilt from an earlier working prototype with emphasis on stability, understandable code, and a coherent user experience. The developer is learning JavaScript and wants to participate in decisions rather than have an assistant generate an opaque application.

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
- Key and mode are read from supplied `song.key` metadata. TuneToss does not currently detect keys or modes from audio.

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
TuneToss performance feature, but development is explicitly deferred until the core application
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

### Phase 2B — bounded native lifecycle/action adapter

`native-stem-handoff.js` stages a copied domain proposal, reuses direct action validation and
eligibility with the legacy calculator suspended in that copy, applies existing high-water
qualification, then invokes the pure allocator. Audio validates/schedules through the existing
bridge before authoritative allocations/requests/participation are committed. Native ownership
and multi-deck sharing live inside stemSession; no competing participation or metadata playback
store is created. Native-player subscribe notifications cover started, pause, eject, replacement
and ended; internal Stop emits pause and retains ownership. First successful scheduling commits
ownership, while Resume runs coordinated source scheduling with existing allocations and no
new allocator entry. Source-router Play optionally dispatches this adapter; legacy callers keep
the original router and fixture APIs. No new engine, polling, queue or visible controls.

Lifecycle events invalidate pending proposals and cancel pending native Play. Musical actions
reject during an async start. Native departure updates ownership even if redistribution rejects;
the error remains inspectable and appears in the reusable component's existing status area.
The main page loads the allocator/action adapter and routes the existing controls through it.
Callback-driven refresh uses allocated levels; requested intent is retained separately.

Implementation limits remain explicit: protected snapshots include all audible native decks,
so live exclusion and global-OFF changes that overfill that total reject. Playing main-volume
changes also reject. Supporting uncapped independent/excluded cohorts requires a separately
validated scheduler boundary; this adapter does not bypass safety. Global native permission is
available through mainStemIntegration.handoff.setEnabled; no new UI is introduced and legacy
appActions are not replaced. Paused/finished songs retain ownership, internal Stop preserves
compatibility, and replacement attempts release it before decoding. No queued song participates.

Tests add native adapter integration with real mixer mocks, actual source-start failure and
cancellation, 1–4 owners, Voice takeover, requests, UI projection callbacks, lifecycle and safe
participation rejection. Main/four-deck browser tests now exercise native playing membership;
standalone two-deck expectations remain. Browser execution was unavailable in this session.
Next: Mac Safari manual validation, then iPad; settle independent-cohort scheduling before
claiming unrestricted global OFF/live participation behavior.

### Safari follow-up — isolated preparation must not retime another deck

The native isolation tests now start with genuinely unloaded players instead of loading every
deck in the fixture. They cover volume sweeps before/after Load, preparation while Deck 1 is
playing, stem edits after Eject, and retained paused-owner redistribution followed by replacement.
No unloaded/never-played allocation or membership coupling was reproduced. However, the new
assertion that preparation preserves existing AudioParam event lists failed: protected mixer
snapshots always retargeted every audible session, even with identical targets.

The minimal correction is inside retargetSnapshot: if every playing session has unchanged
main/stem targets, validate the complete snapshot and audible cap, then update silent players'
stored coefficients only. Existing source and gain envelopes stay untouched; normal coordinated
retarget validation/failure handling is unchanged for audible changes. Paused membership remains
intentional; a paused owner's volume can change others' allocations even with no audible decks.
Load/replacement releases that ownership. Exact Safari observation remains unverified without
its loaded/ownership state; do not label it a confirmed UI wiring bug.

Supporting playing main-volume changes safely still requires coordinated effective-product
trajectories (main × stem × transport), physical stem bounds including volume zero, interruption
and reversal tests, and native failure handling. The unchanged-main restriction remains intact.

### Safari interruption diagnosis — preserve failure boundaries

Tests now assert transport survival and unchanged AudioParam event lists for expected main-
volume rejection, both deck directions, and preparation on unloaded/never-played Deck 2.
Retained paused ownership differs: accepted volume changes can require real native scheduling.
A test injects elapsed context time during AudioParam writes and reproduces Deck 1 pausing in
the existing missed-deadline cleanup. State proposals remain uncommitted; retained ownership
remains paused truthfully. This does not establish what happened on Safari.

Mixer fail-closed catch sites now share the same pause cleanup plus a frozen, read-only last
failure snapshot. No preflight rejection enters that function. The native action adapter exposes
getDiagnostics() with loaded/playing/ownership/participation and that snapshot, without polling,
continuous logging, new controls or scheduling changes. Native exceptions are preserved.
Capture diagnostics immediately before/after a Safari gesture plus its exact error to distinguish
ordinary rejection from actual native failure (including scheduled vs observed context time).
Do not expand the deadline or suppress shared safety cleanup based only on the reported symptom.

### Compact four-deck live-test surface

`mixer-layout.js` is a one-time presentation adapter over already-mounted controls: it moves
existing DOM nodes into persistent card headers, transport strips, fader rows and expandable
file/advanced panels. It creates no playback/domain events or timers. `mixer.css` supplies the
2×2 desktop layout, responsive spacing, deck accents and overlay panels. Fixed IDs, listeners,
player/context ownership and component closures remain intact. v40 is a reference direction;
no v40 visual asset was found in this checkout for direct comparison.

The reusable stem component adds output elements refreshed from domain allocations and an
optional controlsEnabled callback. Main-page complete-song mode shows inactive native faders
instead of hiding the whole component; the callback disables native faders/Load until stem
source selection. Standalone prototype defaults remain enabled. The integration captures its
original complete-song file label before layout moves nodes, avoiding a dynamic first-file
query accidentally hiding the batch picker. Audio-controls changes are routine native status
presentation only; errors and playback actions are preserved. Stop is hidden, not removed.

Target desktop footprint is 900×680 CSS pixels and up at normal zoom. Smaller layouts retain
2×2 order and allow scrolling. Browser test page `tests/compact-mixer-browser-tests.html`
checks common viewport sizes, bounds, fixed cards on panel expansion, current values and
unchanged control identities. It requires actual browser execution; native Safari preview
access timed out and browser automation host was unavailable in this session. The macOS
regression runner and changed-script syntax checks remain executable. No waveform work,
settings/color persistence, library redesign or audio changes are part of this milestone.

### Compact loading investigation follow-up

Confirmed presentation defects: the absolutely positioned footer details became the containing
block for their own overlay, constraining assignment controls to footer width; assignment status
unconditionally advertised Load even after success; source-selection status was excluded from
routine native status refresh. Expanded footer details now use the card as their containing block.
The reusable component refreshes immediately after invoking Load in the original click stack,
tracks successfully decoded assignment identities, and exposes decoding/readiness/errors beside
the file controls. The transport handler checks readiness before dispatch.

Inspection found retained picker/listener/File-model references through DOM moves. Native player
and Phase 2B Play already reject unloaded/loading decks. No decoder, allocator, scheduler, handoff
or engine changes were made in this follow-up. The reported Safari silence has not been reproduced;
these presentation fixes alone do not establish audible recovery.

Verification: full macOS regression runner passed, including UI-handler readiness checks;
changed JavaScript syntax and git diff whitespace checks passed. Browser assignment tests now
check moved Load dispatch, decoding state, readiness, corrupt-file errors and retry; geometry
tests require card-width overlays. Those browser tests and audible Safari checks remain unexecuted.

Safari verification (serve checkout over local HTTP, normal zoom):
1. Open index.html at 1280×720 or larger; reload, select Four stems on Deck 1.
2. Open Assign & load stems. Confirm all assignments/status fit within the Deck 1 card;
   opening it must not move or cover controls outside that card.
3. Assign the four previously working aligned files, individually and then via batch after
   Clear selected files. Review each category. Before Load, Play must remain disabled.
4. Click Load selected stems once. Confirm Loading / decoding, disabled Load and Play, then
   Four stems loaded — ready to play, nonzero duration and enabled Play.
5. Prepare Deck 1 main volume 1 and four stem levels 1 before Play. Click Play; confirm
   advancing position, Stems playing, and audible output. Pause/resume and Eject; Eject disables Play.
6. Repeat on Deck 2 with its intended prepared levels, then verify the existing Deck 1/2
   handoff behavior and unchanged playing-main-volume restriction.
7. Eject, assign four invalid audio files with recognizable category names and Load.
   Confirm visible decode error and disabled Play. Clear, reassign valid files and retry.
8. Repeat loading on Decks 3/4; check panel geometry on bottom-row cards and at 900×680.
9. Open tests/batch-stem-browser-tests.html and tests/compact-mixer-browser-tests.html;
   click Run tests on each and record results. Generated batch WAVs are silent fixtures:
   use the original stems for the listening checks.
If silence persists, capture the visible file-panel error, Allocation details player state and
mainStemIntegration.handoff.getDiagnostics() immediately after Load and Play in Safari's console.

### Matching-set investigation (correction)

The report concerns two separate, internally matching four-stem song sets; one worked and one
failed. No mixing of songs is requested. At the time of that investigation, the actual failed filenames, formats and Safari error
were not available. The exact filenames have since been supplied below; the error remains unavailable.

Examined boundaries:
- Recognition remains literal case-insensitive drum/bass/other/vocal substring matching.
  Category terms in the song title can make otherwise matching filenames ambiguous. This
  existing rule is tested and preserved; no category or song-identity guessing was added.
- New batches retain existing assignments. Tests now reproduce selecting a second complete
  song set, retaining all first-set mappings, then clearing and selecting the second set with
  no stale references. UI explains this intentional retention and explicit switching path.
- Native decoding remains sequential and snapshots mapped File objects. Errors now include
  category/filename; validation failures include all decoded frame counts/rates/channels.
  Exact frame equality, sample-rate equality and mono/stereo validation remain unchanged.
  A matching song set can still have an unsupported encoding or a one-frame export mismatch.
- Previous validated audio survives replacement failure, while an initial failed load cannot
  play. Error/readiness text distinguishes those cases; tests cover both boundaries.
- Compact panels now include Close and Escape dismissal with summary-focus restoration.
  Their top follows the transport strip and their bottom reserves the footer; transport remains
  above the panel. Geometry/close/hit-testing assertions were added to the browser fixture.

Run tests/batch-stem-browser-tests.html and tests/compact-mixer-browser-tests.html in Safari.
For the user's two sets: Clear, select all four from the working song, review and Load; record
ready state and listen. Clear, select all four from the failed song; record assignment messages
before Load and the exact error afterward. This distinguishes recognition/retention from actual
read/decode/validation failure. Check each assignment filename, Play readiness and whether old
audio was retained. Test Close, Escape, and Play/Pause/Eject accessibility with the panel open
on every card. Browser geometry/listening remains unverified in this session.

Executed verification for this follow-up: full macOS regression suite passed, including new
assignment-switching and filename/decoded-validation diagnostics checks; all seven changed
JavaScript files passed syntax parsing; git diff --check passed. Browser fixture additions
were syntax-checked only, not executed. No commit or push was performed.


### Exact reported AIF filenames and original-file safety

The user supplied these names verbatim; no original audio file was accessed or modified for this test:

```text
Blessing Cassian Remix Harris Bass Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif
Blessing Cassian Remix Harris Drums Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif
Blessing Cassian Remix Harris Others Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif
Blessing Cassian Remix Harris Vocals Calvin Harris, Clementine Douglas - Blessings (Cassian Remix).aif
```

Tests run these exact strings through the production recognizer and assignment model using
frozen metadata objects, including empty MIME metadata. Expected mapping is Bass -> Flow,
Drums -> Transients, Others -> Tune, Vocals -> Voice. Each name has one category match.
Tests also cover existing-assignment retention and explicit clear/reselect with these names.
This checks filename/assignment handling only, not the bytes, codec or alignment of the originals.
The .aif extension is not filtered by the native loader and does not establish actual encoding.

Scoped file-safety audit: main native selection retains File references; loading calls
arrayBuffer and decodeAudioData. No original-file rename, move or write-back path was found
in the inspected project loading code. The diagnostic download creates a separate capture
download, not a write to selected originals. Synthetic File construction in tests creates
in-memory fixtures. No audio rename command occurred in the visible Codex work for this
conversation. This is not an audit of other sessions, applications or OS file history, and
does not establish who or what changed the names. Original audio outside this project was
not inspected. All selected originals must remain read-only; conversion/renaming requires
explicit approval and workspace copies.

Next diagnostic: in Safari, Eject if starting an empty-deck test, Clear selected files,
select precisely these four files together, and record the assignment message and four
review dropdown names. If ready, click Load once and copy the complete resulting status/error.
A read/decode error identifies that boundary; decoded validation errors report frames/rate/
channels. If Load never becomes available, capture source mode and assignment messages.
No working-set filenames or actual failed-set error have been supplied; neither is inferred.

Verification for the exact-name follow-up: full macOS regression suite passed, including
verbatim filename mapping, frozen-reference preservation and clear/reselect tests.
Changed test JavaScript syntax and git diff --check passed. No original-file decoding or
Safari listening was performed. No commit or push was performed.

### Phase 2B native Safari silence investigation

Latest user evidence: multiple song sets load, category matching works and handoff faders
respond; playback remains inaudible. This supersedes failed-loading as the current priority.
A definite Safari root cause has not been established.

The inspected native graph is source -> per-stem gain -> shared deck main-volume gain ->
deck transport gain -> the mixer's shared AudioContext.destination. Sources share a future
start time and offset. Ordinary starts use unity transport; coordinated starts set transport
zero then ramp it to unity over 10 ms. Retargeting normalizes the scheduled transport product
into musical coefficients; unchanged-audible-target preparation skips live automation. Native
resume errors, non-running state and missed deadlines reject; no output workaround is added.
Playing-main-volume automation remains unsupported and unchanged.

createFourStemPlayer.getDiagnostics() snapshots state without context creation/resume, graph
changes or AudioParam writes. It includes context clock/state/rate/latency, source start time/
count and remaining sources, position, decoded metadata, bounded PCM peaks, modeled stem/main/
transport coefficients and their effective products, reported AudioParam.value readings,
successful destination-connection bookkeeping and the most recent Play error name/message.
Scheduled envelope models are distinguished from AudioParam readings; neither measures actual
speaker output. The 256-frame/channel PCM window is not a whole-recording silence scan.
Snapshots are frozen and contain no node/buffer references. They are sampled only on request.

The native mixer aggregates these snapshots; handoff.getDiagnostics().nativeAudio adds them to
existing allocation/participation and last scheduler-failure diagnostics. Allocation details
has a Capture native audio diagnostics button rendering a snapshot, refreshed only by another
explicit capture. No polling, analyser, new output routing or continuous logging was added.
Playback wrapper retains resume/start exceptions for diagnostics and rethrows unchanged.

Regression coverage reconstructs the source/stem/main/transport/destination connections,
coordinated silent reservation, in-flight ramp product, settled nonzero product and advancing
clock, silent preparation during the start ramp, suspended state without auto-resume,
resume rejection, pause disconnection and deep-frozen read-only snapshots. Existing cap,
retarget/interruption, lifecycle, matching and loading suites remain required. This evidence is
mock scheduling/PCM inspection, not Safari rendering/listening or an autoplay-policy diagnosis.

Exact Mac Safari verification:
1. Serve this checkout over local HTTP (python3 -m http.server 8000) and open
   http://localhost:8000/index.html in Safari. Reload. Check the tab and macOS output volume,
   mute state and intended output device.
2. Select Four stems on Deck 1; clear selections, select one matching four-stem song set and
   Load. Wait for ready. While paused, set main volume 1 and all four stem levels 1 using
   direct controls. Leave other decks paused. Do not adjust main volume while playing.
3. Open Allocation details and click Capture native audio diagnostics; retain the snapshot.
   Alternatively in Web Inspector Console evaluate
   JSON.stringify(mainStemIntegration.handoff.getDiagnostics(), null, 2).
4. Close the panel, click Play directly, wait at least one second, capture again, then wait
   another second and capture a third time. Use original audible stems, not silent test WAVs.
   Save complete snapshots and any deck error/Console error verbatim. Do not continuously poll.
5. Compare nativeAudio.contextState/contextTime and nativeAudio.decks[1].position between
   captures. Running clock/position should advance before the song ends. Inspect
   sourceStartCalls (4), sourceClockReachedStart, connectedToDestination, modeledTransport
   (1 after the ramp), mainVolumeTarget/modeledMainVolume and per-stem modeledEffectiveGain.
   For this isolated Deck 1 preparation the effective gains should be nonzero. Inspect
   sampledPcmPeak across several captures; zero in one short window is inconclusive.
6. Inspect lastPlayError and lastSchedulingFailure for native/resume/deadline errors.
   A suspended/interrupted context, frozen clock, zero effective coefficients, absent source
   starts or disconnected bookkeeping identifies different boundaries. Running/nonzero
   bookkeeping alone cannot prove Safari/hardware output or rule out external muting.
7. Pause/resume Deck 1 and capture again. Repeat isolated playback on another deck, preparing
   that deck's main and stem levels before Play; then test the existing two-deck handoff
   and capture before/after a stem gesture. Do not change the playing-main-volume restriction.
8. If silence persists, provide the before/after JSON plus exact Safari/macOS versions and
   output device. No inference about actual Safari autoplay restrictions is possible without
   its state/error evidence.

No audio originals were modified, and no commit or push is part of this investigation.

Executed checks for this silence-diagnostic change: full macOS regression runner passed
(including new graph/envelope/read-only diagnostics checks), all four changed JavaScript
files passed syntax parsing, and git diff --check passed. Real Safari state/error capture,
browser rendering and audible output verification remain outstanding.

### Safari final-output regression: historical comparison and live meters

Read-only Git comparison used cd5e6f8 (before coordinated starts), d142490 (coordinated starts),
c022f0d (retarget correction), and the preserved working-tree diff. cd5e6f8 RULES records prior
main-page Safari playback success and isolated two-deck listening success; the exact user-tested
commit is not established. Its native route was source -> stem gain -> main gain -> transport
(unity) -> destination. Current route before this instrumentation had the same destination
connection; coordinated starts add zero-to-unity transport automation, retargeting accounts for
transport products, and Phase 2B adds lifecycle notifications/ownership/action staging. Inspection
did not identify a definite final-route regression. Nothing was checked out/reset/discarded.

Latest live evidence supplied by the user: running 44.1 kHz context, advancing time, successful
source starts, unity reported gains, nonzero decoded PCM, connection bookkeeping true, no errors,
but complete silence. This narrows the investigation but does not measure rendered output.

New shared inline analyser feeds the final destination once. Each meter uses a channel splitter
and separate left/right time-domain analysers (2048 frames), avoiding opposite-phase stereo
cancellation in AnalyserNode's mono data. Per-session side taps measure source outputs, stem
gain outputs, main gain output and transport output. They are installed after successful
deadline-sensitive start scheduling and disconnected during retirement; they do not feed an
additional audible destination. Extra graph processing is diagnostic overhead, not a performance
guarantee. Measurement failures are exposed; unavailable mocks retain direct output routing.
If shared meter creation fails, playback retains the direct destination path and outputMeter
reports unavailable/error instead of falsely reporting zero.

Capture nativeAudio.outputMeter for final left/right RMS/peak, and
nativeAudio.decks[1].liveMeters for transientsSource/transientsStemGain (and flow/tune/voice),
main and transport. Captures are explicit, bounded reads with context timestamps. No snapshot
is hardware loopback; final nonzero proves signal at the destination input, not speaker output.
Stereo mix cancellation between stems/decks is also possible: compare individual stage signals
and combined main/transport/final signals before blaming routing.

Precise Safari procedure:
1. Serve project locally; reload index.html. Load one known audible matching set on Deck 1.
   Leave other decks paused; prepare main/stem gains to 1 before Play.
2. Click Play; during an audible musical passage open Allocation details and Capture native
   audio diagnostics three times, about one second apart. Save full JSON. The same snapshot
   is available from JSON.stringify(mainStemIntegration.handoff.getDiagnostics(),null,2).
3. Inspect nativeAudio.outputMeter.available and left/right rms/peak. Do not classify an
   unavailable meter, a short silent passage or an ended song as graph silence.
4. If both final channels remain zero: inspect Deck 1 liveMeters backward, transport -> main
   -> each StemGain -> each Source. A nonzero upstream/zero downstream pair localizes the
   boundary. Compare current context timestamps and gain/error state. Report all snapshots.
   If individual stems are nonzero but their main sum is zero, check cancellation rather than
   assuming a disconnected node. No boundary has yet been observed in live Safari.
5. If final output is nonzero but inaudible: unmute this Safari tab using its audio control;
   in macOS System Settings > Sound > Output select the intended physical device and check
   output volume/Mute. Test Built-in Speakers to isolate Bluetooth/USB/HDMI/aggregate routing;
   record active device and any third-party per-app routing/mute utility. Compare another known
   audible source on the same device. Re-select output and reload/retest; do not alter scheduler.
6. Open tests/native-output-browser-tests.html and click Run audible native output test.
   This generates a quiet 440 Hz tone and measures real source/stem/main/transport/final signal,
   Pause silence and Resume recovery. Record PASS/FAIL separately from whether you hear it.
   No original files are involved. Repeat main-page test after handoff and Pause/resume.
7. Supply JSON, test result, Safari/macOS versions and selected output device. The browser
   fixture and live listening have not been executed by Codex in this session.

References: Web Audio specification https://www.w3.org/TR/webaudio/ (AnalyserNode passthrough,
unconnected analysis outputs and mono time-domain downmix); Apple Safari tab mute guide
https://support.apple.com/en-ca/guide/safari/ibrwae910b47/mac and Sound output guide
https://support.apple.com/guide/mac-help/change-the-sound-output-settings-mchlp2256/mac.

Executed verification: full macOS regression suite passed, including stereo meter arithmetic,
read-only captures, stage-meter lifecycle and existing coordinated cap/failure tests. All three
changed/new JavaScript files passed syntax parsing; git diff --check passed. The new real Web
Audio browser fixture is added and syntax-checked but unexecuted. No original audio was modified;
no commit/push or working-tree reset occurred.

### Apollo Twin isolation: working test versus application context

New user hardware evidence: built-in speakers work; Apollo output from TuneToss is silent
with nonzero internal final stereo readings and no Apollo Console activity. YouTube and the
native-output browser fixture work on Apollo. Therefore Safari Web Audio/Apollo output is
possible; a general hardware mute or universally broken Web Audio route is not established.

Comparison of working fixture with main app:
- Both use createNativeStemMixer, native players, shared output analyser/destination, and
  startCoordinated. Thus the fixture already tests the same scheduler and final graph code.
- Fixture creates a fresh default AudioContext and awaits resume in the Run click before
  passing it to the mixer. Main app constructs only the owner at startup, creates its default
  context lazily during explicit Load, constructs output metering, then invokes resume before
  file reads. Play resumes again; the context persists across song loads/pauses/ejects.
- Neither explicitly sets sample rate, sink/device, destination channelCount/countMode or
  channelInterpretation. No hardcoded Apollo routing/channel map is present. Unknown browser
  sink fields remain null; they are not proof of a physical device selection.
- Fixture closes the context at test completion; main app closes on pagehide. Existing
  complete-song backends own separate contexts, created lazily by their own operations.
- Historical cd5e6f8 used default lazy shared-context creation and persistent ownership too;
  direct destination routing and unity ordinary transport preceded coordinated scheduling.
  Prior Safari success is documented, but the exact hardware/tested commit is unspecified.

No definite Apollo-specific code defect is established. Do not force stereo/sample rate,
recreate/suspend the live context or rewrite scheduling based on this evidence alone.

A controlled idle-only probe now plays 0.05-amplitude 440 Hz mono PCM (same waveform as the
working fixture's individual generated stems, shortened to 0.75 seconds with 5 ms edge ramps)
through the actual retained context's shared output node/destination. It does not use another
context or another device. It reports before/after-resume context state and destination config,
creation-time config and most recent statechange snapshot. No automatic device-change reset,
routing write or continuous log is added. The probe is deliberate sound generation, not a
read-only capture. It refuses playback/loading/pending coordinated starts, and its lock prevents
new native Play/Load until it ends. UI additionally refuses any current complete-song playback.
It preserves buffers, positions, gains, domain allocations, participation and ownership.
Owner close cancels it; failures retain the actual error and release its lock.

One Safari verification step: with Apollo selected, reproduce silent song playback, Pause all
decks (do not Eject or reload, preserving the suspect context), open Allocation details and click
Test shared output — pause all native decks. Report whether the brief tone is heard and Apollo
Console meters move; include Capture JSON afterward for contextAtCreation/contextNow and
lastDiagnosticTone. If the probe is silent too, the retained shared output/context boundary is
implicated; if audible, the normal source/graph lifecycle needs further isolation within that
same context. Neither result alone identifies a specific browser/driver defect.

Executed verification for the Apollo probe: full macOS regression suite passed, including
active-playback rejection without automation changes, existing-destination tone routing,
overlap/Load/Play exclusion, natural-end cleanup, resume failure recovery and owner-close
cleanup. Four changed JavaScript files passed syntax checks; git diff --check passed.
The browser fixture includes shared-probe output assertions but was not executed here;
Apollo hardware verification remains with the user. Original audio and uncommitted work
were preserved; no commit or push was performed.

### Retained versus fresh context comparison

User result: the existing shared-context tone was silent with no Apollo Console response after
pausing the silently playing deck without reload/eject. The standalone native-output test was
audible with Apollo meters responding. This further isolates decoded material and allocator
from the symptom, but does not establish a specific context or downstream routing mechanism.

Source comparison remains: both contexts use default AudioContext construction, default
destination channel settings and the same shared analyser output topology. The standalone
test creates/resumes immediately in its Run click then closes; the production context is
retained from Load and resumed again by Play/shared-probe gestures. Code does not select
Apollo or react to device connection/selection by rebuilding/rerouting the production context.
Creation/current sample rate, destination channelCount/maxChannelCount/countMode/interpretation,
optional sink ID and last statechange are captured. These properties do not identify physical
output channels or reconstruct when Apollo was connected/selected. No device permissions,
automatic context reset, forced sample rate or channel changes are introduced.

A new Test fresh context button constructs/resumes a separate default temporary context in
the explicit click, attaches the same output meter, and plays the same shared helper's
0.75-second 440 Hz waveform with 5 ms edges. It closes/disconnects only the temporary graph
after natural end, error or owner shutdown. The retained production context is neither resumed
nor replaced by this comparison. Loaded buffers, position, allocations and gains are preserved.
Mutual probe/Play/Load exclusion prevents accidental overlap; UI also rejects complete-song
playback. nativeAudio.lastFreshDiagnosticTone records creation/resume settings, production
configuration alongside them, actual error and temporaryContextClosed status;
freshOutputMeter exposes live temporary output while the short tone is active.

Simple Safari test: reproduce Apollo silence, Pause all decks without eject/reload, then in
Allocation details click Test shared output, wait for it to finish, and click Test fresh context.
Keep the macOS output device fixed throughout. Report heard/not-heard and Apollo meter
movement for each; Capture after both retains both context records. Fresh-only sound supports
a retained-context/output-state difference; both silent in this page despite audible standalone
output calls for a broader page/context comparison. No individual browser/driver fault is proven.

Controlled device-order investigation, if required after that comparison: record whether Apollo
was already connected and selected before first Load/context creation. In a separate deliberately
fresh page run, compare that order with first Load on Built-in Speakers followed by selecting
Apollo and repeating the two probes without reloading. Capture settings and hardware response
at each boundary. Never recreate the production context automatically. This hardware/order
experiment has not been executed by Codex, and its outcomes must not be invented.

Verification: full macOS regression suite passed, including separate-context creation/resume,
production-state preservation, mutual exclusion, natural-end/error cleanup and shutdown.
All four changed JavaScript files passed syntax checks; git diff --check passed.
Browser fixture assertions were added/syntax-checked, not executed. Safari/Apollo comparison
remains outstanding. No original audio or unrelated uncommitted work was discarded; no commit/push.

### Confirmed page comparison and a probe measurement gap

Latest user evidence supersedes the stale-context hypothesis: normal playback, shared tone
and fresh tone are silent in the main Safari page on Apollo, while the standalone native-output
fixture is audible and built-in speakers work. Fresh-only success must no longer be assumed.
This suggests page/output interaction, but does not identify its mechanism.

Concrete source comparison:
- Standalone handler creates/resumes a default context synchronously from Run before its first
  await; it decodes four 3-second mono PCM16 WAVs at the context rate, each amplitude 0.05 and
  frequency 440 Hz, then starts four sources through the same mixer/scheduler/analyser path.
  Their in-phase combined signal is approximately 0.20 before metering.
- Main fresh handler's guards and mixer call are synchronous before its first await. Its default
  temporary context is created/resumed in that click stack. It uses a single direct AudioBuffer
  at the context rate, amplitude 0.05, frequency 440 Hz, duration 0.75 seconds with 5 ms edges,
  through a gain into the same type of shared analyser/splitter/destination topology. It skips
  stem decoding, allocator and deck transport, so it is not an identical stimulus to standalone.
- Neither writes destination channel count/mode/interpretation, sample rate, sink/device or
  navigator.audioSession/mediaSession settings. Fresh probe checks running before starting;
  errors propagate into the visible diagnostics area. Hardware silence does not itself prove
  that the probe reached running/nonzero rendered output.
- Experiment factories initialize ownership/state but create contexts lazily; their panels
  read status until explicit user actions. No page-wide AudioContext constructor replacement,
  suspend loop, hidden media playback or audio-session override was found in inspected code.
  pagehide closes engines; normal compact toggles/resize/status refresh do not.
- UI audit still maps visual IDs 1–4 to persistent players 1–4 in one native owner. Play goes
  through Phase 2B action staging/coordinated scheduling; Pause/Eject/Load target the same ID;
  main/stem gestures use validated snapshots and allocator, while UI refresh reads domain/player
  state. Other decks' fader changes can be intentional allocation. Complete-song mode retains
  its separate backend. No current wrong-deck/duplicate active-handler wiring was found.
- Read-only Git comparison of cd5e6f8 and c022f0d versus working tree shows DOM moves plus
  concurrent Phase 2B action changes. Historically direct Play becomes coordinated Play; lazy
  native context ownership remains. Earlier Safari listening is documented without an exact
  verified build/hardware reference. No causal compact-UI or CSS-only fault is established.

Confirmed diagnostic defect: the fresh UI initially read live analyser samples immediately
after scheduling the tone in the future, then discarded the meter at tone end. Thus a later
capture could not verify its live output. Corrected by two bounded observations at requested
150/500 ms offsets, retained in lastFreshDiagnosticTone.observations (and equivalent shared
observations). Each records context clock/state, measured stereo peak/RMS and read-only page
activation/audioSession/mediaSession/visibility state. Entry activation is captured before await.
Timers can be delayed by the browser; missing measurements are not evidence of silence.
Measurement failures are recorded as errors, not substituted zeros. Samplers stop on retirement;
no continuous polling or output/state-policy modification is added.

Smallest next Safari diagnostic: reproduce in the main page, Pause all decks, run Test fresh
context, wait one second and Capture. Supply nativeAudio.lastFreshDiagnosticTone, especially
observations, atCreation/afterResume, entryPageState/pageState, error and close status.
Running clock plus nonzero live output in those retained observations moves the unexplained
boundary downstream of the fresh graph; zero or errors first require resolving that observed
boundary. Compare the same fields with the standalone fixture rather than assuming the tests
are identical. Do not force an audio-session type or recreate production contexts speculatively.

Executed verification: full macOS regression suite passed, including bounded observation
retention, measurement-error reporting, cancellation and all existing allocation/scheduling
checks. Changed JavaScript syntax checks and git diff --check passed. Browser fixture includes
real retained-fresh-measurement assertions and prints its fresh result alongside playback;
browser/hardware execution remains outstanding. No original audio, commits or pushes.

## Envelope Analysis Lab — isolated research, 2026-11-10

Implemented a standalone [Envelope Analysis Lab](experimental/envelope-lab/README.md)
for inspecting decoded waveform, timestamped RMS and positive RMS changes at 1/5/10/20 ms.
Shared zoom/pan, numerical attack/decay inspection and visual-only 0.5–2× time mapping
are implemented. This is a research observation tool, not a stretching algorithm or
production feature. Optional frequency bands and automatic segmentation are deferred.
No production audio, BPM behavior or Beat Match harness was modified. The requested BPM
estimator/harness reference is absent from this checkout; algorithm parity remains unverified.
Next research step: inspect short percussive/sustained clips in Safari, compare resolutions
and supply the intended estimator source before drawing algorithm-design conclusions.
See [research code index](CODE_INDEX.md) and the lab methods/verification procedure.

### Experimental source separation: 1C staged investigation

Implemented only under `research/source-separation/`: independent primary-separation
presence/tail experiments, followed by an optional read-only cross-component
relationship report. See `README_01C.md` there for heuristics, tests and limitations.
Earlier algorithms/results remain available; no application integration or new
product musical behavior is introduced. Relationship hypotheses do not authorize
automatic reassignment. General overlapping-tail recovery remains unresolved.

### Source-separation research performance target

The eventual production goal is full-length-song separation in approximately three
minutes or less on target hardware. Exact hardware, song duration and acceptance
corpus remain to be specified. Treat computational optimizations that preserve the
separation behavior separately from algorithmic improvements, and evaluate each
independently. Experiment 3 uses unchanged 1C mathematics: its 16-second input took
242.15 seconds on the current host (with a brief concurrent profiling probe), so
this implementation does not meet the future target. Its preserved listening
outputs, timing evidence, bottlenecks and unimplemented optimization proposals are
under `research/source-separation/results/experiment-03-simplishsong1-01c/`.

### Independent Design Mode — first milestone (2026-11-13)

`development/design-mode/index.html` is a separate interactive, simulated UI entry. Fictional data, pure preview-state actions, callback-driven DOM components, host wiring and responsive CSS are separate files. It imports no production scripts and leaves the live application's four-deck state, audio lifecycle and diagnostics intact. Exactly two library panels are shown (Playlists left, Songs right); this prototype does not resolve broader optional library presentation controls. No production layout migration has begun. Next checkpoint: actual iPad visual/touch review, followed by a separately scoped UI milestone. Source-separation research remains paused at 5E.

### Playable 0.1 Phase 1D repair — native participation boundary

Physical Phase 1A/1B/1C results are confirmed by the user on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers. Repaired handoff listening is still pending.
The regression report in development/playable/PHASE_1D_REGRESSION.md is preserved
as pre-repair history; PHASE_1D_REPAIR.md records the corrective implementation.

The native action adapter adds explicit `capacityMember` metadata to every gain
snapshot, derived from the authoritative permission/participation/ownership stores.
The mixer uses that same cohort in coordinated start and retarget validation. Plans
without this metadata retain the old strict unity validation for compatibility.
Independent decks receive unchanged native scheduling/routing outside the cohort.
Pure allocation mathematics, target/return eligibility and authorization are unchanged.
Permission toggles no longer call the allocator. Preserved over-unity allocations on
re-enable are allowed to remain or converge, never increase their aggregate excess;
a subsequent participating gesture applies the normal allocator. No toggle gain jump.

Protected retargets reserve 20 ms, matching the existing provisional start lead; the
10 ms ramp remains. Expiry detected before native writes rejects without transport
cleanup. Actual partial native failure/deadline overrun still invokes failClosed.
`nativeAudio.lastRetargetReservation` reports beganAt, scheduledTime, finishedAt,
leadSeconds and deadlineMissed. This is bounded diagnostic state, not render logging
or a guarantee that Safari cannot exceed the reservation under extreme stalls.

The isolated handoff host refreshes allocated faders on commits, clears stale errors,
and defers heavy meter/JSON reads to its 250 ms timer. Re-enabling one deck after global
OFF selects that deck without reviving other retained flags. Main controls remain
locked whenever either test deck plays. Manual/single-song fallback files are unchanged.
No Design Mode, DSP, source-separation, matching or original music changes are included.

### Repair R1 physical verification — Phase 1D.2 starting baseline

The user confirmed Repair R1 authorization tests 1–6 on iPad Pro 11-inch M4,
iPadOS 26.6.1 Safari, built-in speakers: zero-level protection, joining without
premature normalization, bidirectional redistribution, full-capacity sharing and
authorization-ceiling behavior. This is physical evidence for that two-deck scope.
Independent Handoff-OFF combinations, four-deck handoff and extended stability
remain physically unverified. Phase 1D.2 live Main behavior is not yet verified.
The pre-change source archive and per-file hashes are preserved under
`development/playable/baselines/phase1d-repair-r1.*`.

### Phase 1D.2 — separate Main/stem gain scheduling

The old live-Main prohibition is superseded for coordinated retargets (not concurrent
Main mutation during an async deck start). `prepareRetarget` captures actual modeled
Main and stem/transport gain at the reservation time. Native retargeting updates the
existing Main GainNode and stem GainNodes; there is no gain-node replacement, DSP,
additional audio path, simulated gain or normalization. Allocator mathematics is unchanged.

For u in [0,1], simultaneous linear parameter ramps yield each effective gain
(M0 + deltaM*u)(S0 + deltaS*u). `quadraticMaximum` checks both each deck/category and
the participating category sum, including an interior maximum when concave. Safe
plans use concurrent 10 ms ramps. Unsafe plans reduce all decreasing parameters over
10 ms, then raise increasing parameters over 10 ms. During stage 1, every effective
gain is nonincreasing; during stage 2 it is bounded by its valid endpoint. Both stages
are continuous, with no artificial waveform or hidden output limiter. A short gain
dip is an explicit conservative tradeoff, requiring listening review.

Pending future increases can be cancelled/replaced by another gesture. Envelope
modeling holds the initial value before a delayed ramp starts. Existing partial-ramp
segments are preserved at the shared reservation boundary, including transport folding.
The 20 ms reservation and pre-write versus partial-write failure distinction remain.
`lastRetargetReservation.gainPlan/gainDuration` identify the selected plan.

For Main gestures only, native action snapshots give the direct priority deck its
allocated coefficient as the priority request. Historical requested stem levels are
not changed, and remain the receiver weights. This avoids a lowered Main unexpectedly
restoring an old suppressed stem request. The existing effective-gain authorization
update occurs before applying the unchanged allocator to the new Main.

`/handoff-main?build=1d2-m1` shares the isolated host with an explicit page capability;
`/handoff` retains the R1 UI lock. Both use the same updated native code. An exact
pre-change R1 source archive plus SHA-256 manifest is available under playable/baselines
for independent reproduction; HEAD alone was insufficient because R1 was uncommitted.
No Design Mode/sampler/research/recording changes are included. Phase 1D.2 is awaiting
physical verification; do not extend the R1 pass to independent OFF, four-deck or soak tests.

### Phase 1E starting verification record

R1 remains the physically verified two-deck handoff/authorization baseline (tests
1–6 reported). LIVE MAIN M1 appears correct in physical iPad Safari testing, including
live Main adjustments. A small Flow fader jump was reported; percentage-driven
geometry is a hypothesis, not yet proof of a visual-only issue. Specific independent
OFF combinations, four-deck handoff and extended stability have not been explicitly
physically confirmed. Phase 1E integration is unverified. The complete M1 source and
approved UI are archived with SHA-256 hashes in playable/baselines/phase1d2-live-main-m1.*.

### Phase 1E P1 — approved UI integration boundary

`development/playable/performance.html` imports the existing Design Mode CSS/components
unchanged, plus the production metadata/domain/native scripts, and uses a separate host.
`playable-controller.js` supplies real catalog metadata and native audio commands.
Presentation decks contain read-only getters for song, position, playing, Main, stems
and Handoff. Native player state owns transport; appState.decks and participation own
musical state. UI state owns layout, library navigation, search, links and session
playlist edits. There is no optimistic duplicate musical state or call to historical
metadata matching/transport actions. Original `index.html` and Design Mode entry are
unchanged; no second playback engine or constructor override is installed.

Column library load commands use the same adapter as global targets. Sequential native
decoding and the existing eight-file LAN allowlist are reused. A test-host limit of two
loaded decks and Release-before-replace avoids deliberately retaining replacement buffers
on top of both songs. Four persistent slots remain usable in any pair. This is a bounded
initial integration limit, not approval to reduce the four-deck architecture.

The new entry keeps the four landscape combinations, phone single-deck/Transition
presentation, independent library navigation and fixed visible-viewport behavior. Audio
fields render from committed targets after accepted/rejected commands; ramps still have
the normal native settling interval. Unsupported controls are inert/disabled and labelled
OFF. Illustrative waveform geometry is not decoded waveform data; native time is real.
`Audio` opens live diagnostics and Stop/Release actions without replacing the interface.

The M1 source plus approved UI snapshot is stored in baselines/phase1d2-live-main-m1.*
with per-file and archive SHA-256 hashes. Its physical result is recorded as "appears
correct including live Main", with the reported Flow jump and unconfirmed physical
combinations retained. Hash comparison verifies 48 baseline UI/algorithm files unchanged
in this integration, including native scheduling/allocator code.

### Playable verification / algorithm checklist — existing phase identifiers

| Existing reference | Invariant / evidence | Phase 1E status |
| --- | --- | --- |
| RULES §21; createNativeStemHandoffActions | One authoritative four-deck gain/participation state; direct priority; zero eligibility; high-water | Unchanged source; integrated UI actions tested; new physical verification pending |
| calculateFourDeckStemAllocation | Participating effective cap and receiver allocation | Unchanged source; existing numerical regressions plus integrated bidirectional Flow tests |
| calculateStemAuthorization; Phase 1D R1 | Qualifying human gestures, ceilings, joining without premature normalization | R1 authorization tests 1–6 physically confirmed; integrated controls awaiting physical review |
| Phase 1D.2 LIVE MAIN M1 | Separate Main × allocated stem; validated 10 ms / staged ramp plans | Source unchanged; M1 appears correct physically, with unresolved Flow jump; P1 UI/native checks passed |
| Phase 2B; createNativeStemMixer | Coordinated native start, reservation, cancellation, partial-failure protection; Pause/Stop retain ownership | Source unchanged; existing regressions and actual integrated native transport tests passed |
| Phase 1B / 1C | Real four-stem files, aligned within each deck, independent transports | Physically confirmed baseline; reference pages retained; browser regressions passed |
| Phase 1E P1 | Approved responsive components, committed-value projection, stable drag geometry | Experimental new entry; automated tests only, physical review required |
| Independent OFF / four-deck / soak | Scope beyond explicit user physical confirmation | Do not claim physical verification; OFF has automated coverage, four-deck and stability review remain pending |

No separate application-wide algorithm-checklist file exists in this checkout; this
checklist links existing rules, function identifiers and phase records rather than
inventing a replacement specification. Research CODE_INDEX.md remains unrelated/unchanged.

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

## Phase 1H H5.3.1 — isolated gesture stabilization (2026-11-16)

H5.3 has now been physically reviewed on iPad/iPhone. Its design remains the visual
baseline; H5.3.1 (`development/design-mode/touch-preview/`) is a simulated touch-only
review build. It reuses the frozen H5.3 state, layout CSS, deck construction, Wave/Cue,
Library, matching, queue and Transition composition. Local copies of the affected UI
modules prevent behavior changes to any earlier preview.

Responsibilities: `ownership.js` owns transient pointer/control capture only;
`performance-controls.js` and `knob-reset.js` retain existing model callbacks and knob
math; `faders.js` supplies pointer-owned hit surfaces and the same handle geometry.
`browser-guards.js` / `touch.css` isolate browser gestures and noneditable selection
without disabling single-finger Library scrolling. `popover.js` / `effects.js` separate
FX tap cycling from deliberate hold selection. `overview-nudge.js` no longer releases
a pointer-held nudge merely because another control takes keyboard focus. No duplicate
musical state or audio engine is introduced. No new dependencies are installed.

Desktop Chrome/CDP checks include real multi-contact dispatch and direct layout
rectangle comparisons; these do not establish physical Safari reliability. Safari
accessibility zoom, callouts, browser chrome and touch cancellation still require device
review. Previous preview and G2 hashes are recorded in the new build's review directory.
See its README for exact tests and the physical checklist. Production integration,
phone landscape redesign and sampler work remain outside this task.
