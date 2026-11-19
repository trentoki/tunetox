# TuneToss — Instructions for Codex

## Project purpose
TuneToss names the entire current project, including the DJ application and broader music/audio research. Do not retain TuneFlow as a separate research-project name; any future name is undecided. Preserve historical names and technical identifiers only where needed for accuracy or compatibility.

TuneToss is an evolving, offline-first DJ and music application built with readable JavaScript, HTML, and CSS. It should ultimately work across desktop browsers, iPad, and iPhone, with installable/PWA behavior planned. The human is the product designer and final decision-maker. The application is designed around **four underlying decks**, regardless of how many are visible at once.

## Documentation authority
- `AGENTS.md` is the authoritative development workflow and safeguard document, incorporating the intended replacement formerly named AGENTS_updated.md.
- `RULES.md` owns approved product behavior and clearly labelled historical implementation; `TUNEFLOW_DESIGN.md` owns architecture, context, roadmap and unresolved decisions.
- TUNEFLOW_RULES_updated.md is an older historical document, if present, and must never override RULES.md. Do not recover superseded algorithms from it as current requirements.
- Use beatmatching, tune matching and stem handoff for the three independent capabilities. Preserve existing executable API names until a separately approved refactor.

## How to collaborate
- Start each substantial task by reading `AGENTS.md`, `RULES.md`, `TUNEFLOW_DESIGN.md`, and relevant source and test files. Source code and tests show what is **implemented**; `RULES.md` records **approved product behavior**; the design document provides context, roadmap, and open questions.
- Explain proposed changes in plain English before significant edits: what, why, which files, and how to test. Keep changes small, independently testable, and grouped by related subsystem. Do not abruptly switch from an unfinished subsystem to an unrelated one without agreement.
- Obtain approval before broad refactoring, major rewrites, architectural changes, dependency installations, new frameworks, project-wide renaming, or resolving unspecified musical behavior. Do not silently invent DJ rules.
- Keep code human-readable and beginner-friendly: descriptive, consistent file/function/variable/data-structure names, short functions, focused modules, clear comments, and straightforward JavaScript. Avoid duplicated logic, unnecessary abstractions, deeply nested control flow, and excessively large files. Explain unfamiliar syntax when useful.
- Separate application state, pure musical/decision logic, UI presentation, and audio/DSP side effects. Prefer shared, input-independent actions that can later be invoked by mouse, touch, keyboard, or MIDI.
- Preserve working behavior. For meaningful behavior changes, add/update automated regression and edge-case tests, including negative cases and transitions, plus relevant browser integration tests. Never claim real audio behavior or production readiness from unit/state-only tests.
- Clearly distinguish **implemented**, **approved but not implemented**, **experimental**, and **unresolved** behavior in reports and documentation.
- When a product decision is approved, update `RULES.md`; update `TUNEFLOW_DESIGN.md` and the roadmap as needed. Keep `AGENTS.md` relatively stable and update it only when collaboration practices or durable safeguards change.

## Function-first organization and code quality
These standards apply to human contributors and AI coding agents alike.

- **Function first, platform second.** Organize by responsibility (audio, Handoff, interface, library, state), then isolate necessary platform-specific adapters within the owning subsystem. Do not create competing iPad/iPhone/desktop application trees or duplicate musical logic. Keep audio processing, application state, interface presentation and platform handling clearly separated.
- **Explicit dependencies.** Make public interfaces, inputs/outputs, side effects and load-order requirements easy to trace. When moving a module, inspect executable HTML/script paths, test runners and server mappings separately from documentation and historical references. Update active paths without rewriting historical snapshot records.
- **Explain complex behavior.** Document important architectural decisions, module responsibilities, public interfaces, invariants and non-obvious algorithms. For audio changes, explain allocation and authorization math, requested versus committed values, units, timing/ramp constraints, state transitions, cancellation and failure behavior. Comments should explain intent and constraints, not merely repeat statements.
- **Review design separately from correctness.** Assess readability and maintainability independently of automated test success. Working code is not automatically well-designed. Review names, responsibility boundaries, dependency clarity, duplication, nesting and file size; keep tests understandable and representative of intended behavior. Identify existing violations and recommend focused improvements, but do not use this standard as permission for a broad cleanup.

### Folder responsibilities
The current organization is incremental; this map does not authorize moving unrelated files.

```text
development/
  audio/
    handoff/       Shared Handoff state, allocation, native adapter and audio bridge
  design-mode/     Simulated UI, shared presentation modules and retained H-series builds
  playable/        Real-audio integration hosts, local storage/server tools and baseline records
  metadata-demo.*  Retained metadata/synchronization demonstration
research/
  source-separation/
    diagnostic_*/  Independent analysis implementations and tests
    tests/         Research regression tests
    audio/         Read-only original research inputs
    results/       Historical experiment implementations AND generated artifacts
```

Research remains independent of production playback. Files under `results/` can be executable dependencies; do not treat the directory as disposable output. Existing root application files, `experimental/` implementations, root `tests/` and pinned `vendor/` code retain their current roles until a specific migration is approved. Directory names alone do not establish whether code is active, experimental or historical.

H5.3.1 (`development/design-mode/touch-preview/`) is the preferred visual and interaction reference, including its layout, proportions and overall feel; its behavior remains simulated. G2 is the protected real-audio foundation. Future integration must preserve the approved interface and verified engine rather than blindly replacing either. Preserve earlier prototypes, source snapshots, baseline records and unrelated/untracked files during organization work.

## Architecture and product-design safeguards
1. **One four-deck system.** Decks 1–4 are persistent underlying objects. Showing two decks, four decks, or switching visible pairs is a UI/layout decision, not a different audio mode. Changing layouts must not itself synchronize, reset, unload, or interrupt any deck. The older interface-dependent synchronization behavior in existing code/docs is legacy behavior to be reconciled in a separately approved implementation task; do not silently rewrite it.
2. **Three separate capabilities.** Beatmatching, tune matching and stem handoff must be independently configurable through the authoritative participation store. Preserve current-sounding-pitch reference rules. Terminology updates do not authorize code renaming.
3. **Stem foundation safeguards.** Follow RULES.md section 21: all decks participate by default; future startup main volumes are 0; Deck 1 stem levels are 1 and Decks 2–4 levels are 0. Initialization does not authorize automatic gain increases. Preserve session-high authorization from qualifying direct human gestures. Enabling handoff does not normalize levels; immediate equal-reduction joining and instantaneous caps are superseded. Do not invent convergence or multi-deck distribution math. This is approved future behavior, not implemented audio.
4. **Saved preferences.** Plan offline-capable, versioned local settings, including per-deck default stem-handoff participation, distinct from temporary session changes. Do not claim settings sync between devices unless that feature is actually built.
5. **Cross-platform consistency first.** Prefer one recognizable interface, shared components, responsive CSS, and common actions across desktop, iPad, and iPhone. Do not create separate platform-specific applications or interaction models without a clear usability/technical reason and approval. Treat TuneFlow v40 as a visual/interaction reference, not necessarily a code reference.
6. **Shared library functionality.** Preserve shared navigation, search, selection, scroll and drag/drop behavior. Search playlists, songs and artists at every navigation level; context affects ranking, not category availability. The approved phone portrait layout uses playlists left and songs right below the mixer. Other platforms retain the documented independent-panel direction; optional independent/linked/single presentations share one implementation.
7. **Layout proposals.** Independent two-panel, linked two-panel and single-panel modes remain shared-component proposals where appropriate; exact selection controls remain unresolved. Preserve navigation state across presentation changes where practical. Do not treat a presentation mode as a separate library or audio engine.
8. **Phone portrait direction.** Four visible decks in a 2×2 grid with a full-width global-controls strip above; provisional mixer share 40% of the application screen. Below: playlists left, songs right, provisional playlist width 26% of library width. Validate proportions and touch ergonomics on devices before finalizing UI. This supersedes the two-visible-deck direction and does not authorize UI work.
9. **Audio protection.** Do not alter playback engines, DSP, worklets, Signalsmith upstream code, audio lifecycle, or experimental toggles as a side effect of UI/library/documentation tasks. Keep the Signalsmith persistent-context and 5 ms release experiments separately documented and tested; automated success does not establish Safari click-free playback or native memory reclamation.
10. **State ownership.** Keep the existing four-deck appState.decks array and authoritative appState.participation store. Proposed structures such as decksById are design sketches, not authorization for a state rewrite or competing participation store.
11. **MIDI-ready actions.** Design controls with stable identities and reusable actions, without prematurely implementing MIDI mapping or tying behavior to a specific UI layout.

## Current workflow
1. Inspect the relevant files and summarize the present implementation and the user's requested outcome.
2. Identify the smallest coherent next task in the agreed roadmap; state expected behavior and unresolved decisions.
3. Propose targeted edits and a reproducible test plan before significant implementation.
4. Implement only the authorized scope, preserving unrelated code and behavior.
5. Run relevant automated tests and perform the independent readability/maintainability review above; report these as separate checks. Explicitly distinguish checks actually executed, not run, and still needed, including browser/device/manual verification. Report failures and limitations accurately; claim an audit only for the scope actually examined.
6. Update the relevant documentation, then report precisely which files and behavior changed, verification results, remaining risks/limitations, and the next recommended step. When commits are authorized, make small, independently verified commits with meaningful descriptions of what changed, why and how it was checked. Stage explicit related paths; do not indiscriminately include untracked files.

### Existing macOS JXA testing workflow
Run the main suite from the repository root using the existing macOS JavaScript for Automation (JXA) runner:

```sh
osascript -l JavaScript tests/run-tests.js
```

Run relevant focused JXA runners and browser/path/server checks for the affected subsystem as well. For organization changes, verify executable references and behavior before each related commit; preserve module contents when the task is relocation only. Do not install dependencies or replace the testing framework merely to run existing checks. Some browser/research runners write artifacts: inspect their output behavior before running them during a read-only task or when historical results must remain unchanged. Automated checks do not prove physical Safari audibility, gesture reliability or long-term stability.

## Engineering quality, security and release safeguards
- **Original audio safety:** Treat browser-selected audio files as read-only inputs. Do not rename, move, overwrite, delete or otherwise modify original audio outside the project. Do not run bulk filename corrections against a music library. Any proposed renaming or conversion requires explicit approval and must operate on copies in an appropriate project workspace. Investigate with exact existing filenames.
- **Security boundaries:** Validate untrusted files, metadata, messages and settings at appropriate entry points before committing state or allocating substantial resources. Never hardcode secrets, commit credentials or expose them in client assets, logs or exports.
- **Dependency and platform review:** For relevant changes, review dependency provenance, pinned versions, known vulnerabilities and license notices, along with browser permissions and file, network and storage risks. Treat local/offline input as untrusted; do not equate local operation with security.
- **Audio deadlines:** Prioritize deterministic calculations, explicit/predictable state transitions and low latency. Avoid unnecessary allocation, blocking work, I/O or continuous logging in time-critical audio processing; keep render work bounded and measure performance on target browsers/devices before claiming capacity or timing guarantees.
- **Release readiness:** Before distribution, perform and record security, privacy, accessibility, compatibility, dependency/licensing and platform-specific release checks. Document evidence and unresolved findings; passing unit tests alone is not release approval or proof of production readiness.
- **Version control:** Inspect repository status and existing user changes before editing. Use focused diffs and reversible source-control safeguards; preserve unrelated work. Do not reset, discard, delete history, force-push or perform other destructive operations without explicit authorization. If source control is absent, report it rather than claiming rollback/history protection exists.

## Handling conflicts and migrations
- Do not assume a new product rule is already implemented. Where older `RULES.md`, `TUNEFLOW_DESIGN.md`, `AGENTS.md`, or code conflicts with a newer approved direction, **identify the conflict explicitly** and propose a safe migration; do not silently delete historical implementation notes or change code.
- Current source behavior remains authoritative for debugging the present application. Approved requirements guide future implementation. If the desired behavior is ambiguous, ask the human before choosing.
- Protect user data, saved preferences, playback state, and backwards compatibility when proposing migrations. Prefer reversible changes and explicit validation.

## Important files
- `AGENTS.md`: durable Codex collaboration instructions and safeguards.
- `RULES.md`: evolving approved user-facing behavior and clearly labeled implementation notes.
- `TUNEFLOW_DESIGN.md`: design context, roadmap, decisions, and open questions.
- `index.html`, `app.js`, and relevant JavaScript/CSS modules: actual current implementation.
- `EXPERIMENTAL_AUDIO.md`: experimental audio implementation, diagnostics, limits, and manual validation.
