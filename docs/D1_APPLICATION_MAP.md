# TuneTox D1 — Application map

The root `index.html` is the application entry point. Its `<base href="development/integration/">` affects how relative script and stylesheet URLs resolve; preserve that behavior until browser verification.

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
