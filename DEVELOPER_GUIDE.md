# TuneTox D1 — Developer Quick Start (draft)

**Status:** Developer handoff preparation. D1 is not yet a verified release.
**Working reference:** DIRECT 06, combining the approved H5.3.1 interface with the G2 native mixer and Handoff implementation.
**Preserved reference branch:** `baseline/h531-direct-06-working`.

## Run locally

Clone the private GitHub repository after being granted access. From the repository root, start a static HTTP server.

**Mac** (with Python 3 installed):
```sh
python3 -m http.server 8000
```

**Windows** (with Python 3 and the Python launcher installed):
```powershell
py -m http.server 8000
```

Open **http://localhost:8000/development/integration/h531-approved-live.html**.

**Important:** Do not use the repository-root `index.html` as the D1 entry point: it opens a historical TuneToss interface, not the approved H5.3.1 interface.

## Audio testing

The current live page offers a test-file loader for four audio stems per deck: Transients, Flow, Tune, and Voice. Prepare the relevant deck main and stem levels before playing. The test loader is **not** a finished music-library workflow. Test audio files must be provided separately; no included audio set is guaranteed.

The host initializes `createNativeStemMixer()` and `createNativeStemHandoffActions()` directly. The native mixer, Handoff actions, and application state govern musical behavior; interface presentation state is not authoritative for audio.

Key files:
- `development/integration/h531-approved-live.html` — approved live entry page and script dependencies.
- `development/integration/h531-approved-live-app.js` — UI-to-native-audio integration.
- `development/interface/decks/h531-deck.js` — shared deck presentation.
- `AGENTS.md` — development safeguards and workflow.
- `RULES.md` — approved behavior (with explicitly historical sections).
- `TUNEFLOW_DESIGN.md` — architecture, design context, roadmap, and unresolved decisions.

## Verification and limitations

DIRECT 06 has been manually reported working on Mac and iPhone. This does **not** establish comprehensive Safari, Windows, or automated regression coverage. Some interface controls, library data, and presentation behaviors remain experimental or simulated; do not represent them as completed audio features.

Before changing audio or Handoff behavior, compare the proven G2/DIRECT 06 path against the proposed change. Avoid adding parallel routers, allocators, or control paths without a demonstrated need. Preserve the baseline, make focused changes, and test the actual playable entry page.

## Remote preview

A private Netlify project exists, but hosting credits currently prevent further production deployments. The approved interface was verified at the **full path** `/development/integration/h531-approved-live.html`. Do not assume the Netlify homepage points to it. A private Netlify site is not automatically accessible to a GitHub collaborator.

## D1 handoff still to do

- Audit required UI and audio dependencies.
- Clarify implemented versus simulated controls.
- Establish reproducible smoke/regression tests on target browsers.
- Verify a clean clone and fresh local startup.
- Confirm repository access and supply non-sensitive audio test fixtures.
- Approve the final developer-facing entry point and D1 release candidate.
