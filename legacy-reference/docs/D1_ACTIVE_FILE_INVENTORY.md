> Historical reference: relocated with the older D1 application. Original path names and implementation claims below are preserved as historical records, not current application instructions. Some experimental paths were already absent before relocation. See [current application](../../tunetox.html).

# TuneTox D1 — Active File Inventory (Phase 1)

This inventory describes the **current** `tunetox-d1` application entry point. It is a migration aid, not the final folder structure. It does not claim that playback or browser behavior has been tested.

## Entry point

- `index.html` is the application entry point.
- Its `<base href="development/integration/">` changes how its relative JavaScript and CSS URLs resolve.
- The page has **60 direct JS/CSS references**, all resolving to tracked files on the branch at the time of this inventory.
- Their current locations are: **50** in `development/design-mode/`, **5** in `development/audio/`, **1** in `development/interface/`, **1** in `development/integration/`, **1** in `experimental/`, and **2** at repository root (`app.js`, `participation.js`).

## Directly referenced modules by responsibility

| Responsibility | Current files / directories | Notes |
| --- | --- | --- |
| Entry page | `index.html` | Keep at root |
| Audio and Handoff | `development/audio/handoff/` (5 direct scripts) | Live-audio dependency; preserve load order |
| Audio player | `experimental/four-stem-player.js` | Despite its folder name, directly loaded by D1 |
| Shared application / participation | `app.js`, `participation.js` | Directly loaded by D1 |
| Deck interface | `development/interface/decks/h531-deck.js` | Shared deck component |
| Interface presentation | `development/design-mode/` (50 direct JS/CSS files) | Includes deck views, controls, responsive layouts, library presentation and historical preview naming |
| Live integration | `development/integration/h531-approved-live-app.js` | Connects interface actions to native audio where implemented |

## Migration safeguards

1. **Do not move a directory wholesale based on its name.** The application loads files from `experimental/` and `design-mode/`.
2. Inspect nested imports, dynamic URLs, worker/worklet references, HTML `<base>` behavior, CSS `url(...)` references, and tests before moving a file. This inventory covers **direct HTML references only**.
3. Preserve the order of scripts and styles when changing paths.
4. Keep the protected baseline untouched; migrate on `tunetox-d1` in small reversible commits.
5. Verify the root page in a browser, then test real stem loading, playback and Handoff. **Static path checks alone do not verify audio.**
6. Keep historical research and snapshots outside the eventual minimal developer package; do not delete them from the repository as a side effect of packaging.
7. Select a concise set of tests only after identifying their real dependencies and the current audio implementation.

## Next migration step

Trace nested dependencies of the live integration, native player, audio modules and CSS before the first file move. Then migrate one small group, update paths, and validate it before proceeding.

Internal filenames retain historical version identifiers for compatibility. User-facing documentation should refer to the product as **TuneTox D1**.
