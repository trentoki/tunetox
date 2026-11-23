> Historical reference: relocated with the older D1 application. Original path names and implementation claims below are preserved as historical records, not current application instructions. Some experimental paths were already absent before relocation. See [current application](../../tunetox.html).

# TuneTox D1 — Application map

This map describes the active root page and its current boundaries. It is intentionally a dependency map, not permission to move or delete files.

The root `index.html` is the application entry point. Its `<base href="development/integration/">` is historical, but it affects how the active relative URLs resolve and must be preserved until browser verification.

```text
app/
├── interface/      # Visual elements and user controls (51 files)
├── audio/          # Sound generation, playback, and Handoff (6 files)
└── integration/    # Connects interface to audio (3 files)
```

## Integration files

- `app/integration/participation.js` — Shared participation state and actions.
- `app/integration/app.js` — Initializes the four-deck application state and shared actions.
- `app/integration/live-app.js` — Starts the live mixer and Handoff connection, handles audio-file loading, and connects interface actions to audio.

**Load order matters:** participation and audio/Handoff definitions must exist before `app.js` and `live-app.js` use them. Follow the script order in `index.html`.

## Authoritative state boundary

- `appState` in `app/integration/app.js` owns the four metadata decks, participation, stem-session metadata, and retained metadata matching state.
- `app/audio/handoff/` owns stem authorization, eligibility, allocation, native lifecycle coordination, and the bridge from domain state to Web Audio.
- `app/audio/four-stem-player.js` owns native transport and Web Audio resources. It is the protected audio engine.
- `TuneToxDesign` state in `app/interface/presentation/state.js` is session-only presentation state for example songs, layouts, queues, waveform/cue previews, library browsing, and other preview controls.
- `app/integration/live-app.js` is the boundary host. It creates both state systems, routes Main/stem levels, Play/Pause, and Handoff participation to native actions, and keeps the visible presentation deck values synchronized through getters. Cue, waveform, matching, queue, effects, and library actions remain presentation-only in this host.

The presentation model must not be treated as a second source of live audio truth. The native mixer/Handoff state and `appState` are authoritative for currently connected musical controls.

## Active UI dependency chain

`index.html` → participation and audio/domain scripts → presentation model/components → layered H1–H5.3.1 presentation overrides → shared `app/interface/decks/deck.js` → `app/integration/live-app.js` host actions.

The active page directly references the presentation files under `app/interface/presentation/`, including `compact/`, `fixed/`, `responsive/`, `performance-preview/`, `corrections-preview/`, `final-preview/`, `portrait-preview/`, and `touch-preview/`. Their historical names describe development milestones; they are active dependencies until a later approved cleanup proves otherwise.

## Current verification

- All 60 direct JavaScript and CSS URLs in `index.html` resolve to tracked files after the three-folder reorganization.
- These are **static path checks only**, not proof of browser execution or audible output.
- Original historical files and existing tests remain in place; they have not been deleted or rewritten.
- Indirect asset references and browser behavior still require verification before removing historical copies.

## Test sequence after organization

1. Open root `index.html` through the local development server on Mac; check that the interface loads without console errors.
2. Load known audible local stem files, play and pause, and confirm actual sound and output meters.
3. Check stem faders, main volume, and Handoff transitions between decks.
4. Check phone/tablet layouts and controls separately. Only then consider consolidation of interface files.

Existing test files under `tests/` include historical and experimental suites. Do not assume every suite is part of the D1 release check without reviewing its dependencies and purpose.

## Browser smoke test

`tests/browser-smoke-tests.html` loads the real root page in an iframe and checks startup, four visible decks, the authoritative four-deck state, the live diagnostics API, Main-volume routing, and Handoff participation routing. It is a routing/startup check only; it does not establish audible playback, Safari compatibility, or Handoff correctness under real audio.
