# H5.3.1 audio integration — initial mapping (read-only contract)

Status: planning only. This branch begins from `organization/tunetox-architecture`. No existing UI or audio files are modified by this checkpoint.

## Design Mode (currently simulated)
- `development/design-mode/components.js`: `slider()` creates stem range inputs (0–1, step 0.01); `createDeckCard()` maps the four stems using `actions.level(id, index, value)`; `render()` displays `deck.stems[i]`.
- `development/design-mode/vertical-fader.js`: phone pointer adapter maps upward movement to increasing 0–1 value; calls the same level action.
- `development/design-mode/app.js`: `actions.level(id, index, value)` currently calls `model.setLevel(state, id, index, value)` and rerenders.
- `development/design-mode/state.js`: `setLevel()` updates simulated `deck.stems[index]` or `deck.volume`; `togglePlay()` toggles simulated `deck.playing`.
- The Design Mode README explicitly states that this preview has no production audio.

## Existing audio/Handoff implementation
- `experimental/stem-controls.js`: existing prototype adapter calls `bridge.setStemLevel(deckId, name, value, gestureId)` and `bridge.setMainVolume(...)`, then refreshes from allocated levels.
- `development/audio/handoff/native-stem-handoff.js`: `createNativeStemHandoffActions()` coordinates gestures, authorization, participation, four-deck allocation and publication; verify host configuration and actual API before integration.
- `development/audio/handoff/four-deck-stem-allocation.js`: pure `calculateFourDeckStemAllocation()`.
- `development/audio/handoff/stem-handoff-audio-bridge.js`: audio gain snapshot bridge. There are multiple adapter paths; do not assume the legacy two-deck bridge is the active four-deck entry point.

## Required behavior
1. Preserve the approved Design Mode presentation and all existing touch/gesture behavior.
2. Same musical behavior for vertical phone and horizontal tablet faders; up/right increases level.
3. Four stem names, in order: Transients, Flow, Tune, Voice. Convert UI indices to existing domain category identifiers explicitly; inspect existing category definitions rather than guessing casing.
4. Send direct user gestures through the established performance/Handoff action API, preserving gesture identity and authorization.
5. Render **allocated** levels from authoritative performance state, not stale requested values or an independent simulated state; automatic changes on other decks must refresh their faders too.
6. Preserve navigation without interrupting transport. Play/Pause must use the existing coordinated native transport lifecycle, not a new Boolean toggle.
7. Keep `development/design-mode/` isolated and non-audio until a dedicated, tested integration entry point is introduced.
8. Never replace working DSP, allocation, or matching logic simply to make the interface work.

## Next inspection before code changes
- Identify the *active* four-deck native mixer bootstrap, its action methods, and how the browser loads those modules.
- Identify how that host publishes allocation/transport changes and how it maps song/stem sources.
- Build a minimal, separately loadable adapter with focused tests; no changes to the approved visual baseline until the wiring is verified.

## Verified root mixer bootstrap (2026-11-18)
- Root `index.html` loads `main-stem-integration.js` before `audio-controls.js`, followed by `mixer-layout.js`. Design Mode `index.html` is a separate simulated page.
- `audio-controls.js` constructs `mainStemIntegration = createMainStemIntegration(completeSongEngine)`, then chooses `mainStemIntegration.router` as `audioEngine`.
- `main-stem-integration.js` creates `createNativeStemMixer()`, `createNativeStemHandoffActions(appState, mixer, onCommit)`, and `createStemSourceRouter(complete, mixer, bridge)`. It exposes `{ router, mount, mixer, handoff }` to the root page; the Handoff onCommit callback calls `refreshAll()`.
- `stem-source-router.js` routes `play(id)` through `nativeActions.play(id)` when the deck is in stems mode, while complete-song mode uses the existing complete-song engine. It exposes `pause(id)`, `eject(id)`, `getState(id)`, `getSourceMode(id)`, `setSourceMode(id, mode)`, and `loadStems(id, files)`.
- `native-stem-handoff.js` exports `setStemLevel(id, name, value, gestureId)`, `setMainVolume(id, value, gestureId)`, `play(id)`, `setParticipation(id, value)`, and `synchronizeAudio()`. Its onCommit supplies direct/automatic control identifiers.
- The root page's current four-stem source is explicitly native experimental playback without tempo/pitch processing. Do not imply that BeatMatch/TuneMatch or real prepared library imports are integrated.

## Next isolated implementation gate
- Inspect the exact Design Mode deck/stem shape and root appState allocation shape before implementing a read-only translation adapter. Never pass the Design Mode simulated state into native actions.
- Preserve browser audio gesture activation, async Play, file/stem loading, and source-mode routing. A fader-only prototype must not claim playable audio without actual loaded stems.
- Implement an independent adapter module and focused tests on this branch; do not edit Design Mode or root mixer files yet.
