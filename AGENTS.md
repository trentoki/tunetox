# TuneFlow — Instructions for Codex

## Project purpose
TuneFlow is an evolving, offline-first DJ and music application built with readable JavaScript, HTML, and CSS. It should ultimately work across desktop browsers, iPad, and iPhone, with installable/PWA behavior planned. The human is the product designer and final decision-maker. The application is designed around **four underlying decks**, regardless of how many are visible at once.

## Documentation authority
- `AGENTS.md` is the authoritative development workflow and safeguard document, incorporating the intended replacement formerly named AGENTS_updated.md.
- `RULES.md` owns approved product behavior and clearly labelled historical implementation; `TUNEFLOW_DESIGN.md` owns architecture, context, roadmap and unresolved decisions.
- TUNEFLOW_RULES_updated.md is an older historical document, if present, and must never override RULES.md. Do not recover superseded algorithms from it as current requirements.
- Use beatmatching, tune matching and stem handoff for the three independent capabilities. Preserve existing executable API names until a separately approved refactor.

## How to collaborate
- Start each substantial task by reading `AGENTS.md`, `RULES.md`, `TUNEFLOW_DESIGN.md`, and relevant source and test files. Source code and tests show what is **implemented**; `RULES.md` records **approved product behavior**; the design document provides context, roadmap, and open questions.
- Explain proposed changes in plain English before significant edits: what, why, which files, and how to test. Keep changes small, independently testable, and grouped by related subsystem. Do not abruptly switch from an unfinished subsystem to an unrelated one without agreement.
- Ask before major rewrites, new frameworks/dependencies, architectural changes, or resolving unspecified musical behavior. Do not silently invent DJ rules.
- Keep code beginner-friendly: descriptive names, short functions, clear comments, and straightforward JavaScript. Avoid duplicated logic and unnecessary abstractions; document architectural/responsibility changes. Explain unfamiliar syntax when useful.
- Separate application state, pure musical/decision logic, UI presentation, and audio/DSP side effects. Prefer shared, input-independent actions that can later be invoked by mouse, touch, keyboard, or MIDI.
- Preserve working behavior. For meaningful behavior changes, add/update automated regression and edge-case tests, including negative cases and transitions, plus relevant browser integration tests. Never claim real audio behavior or production readiness from unit/state-only tests.
- Clearly distinguish **implemented**, **approved but not implemented**, **experimental**, and **unresolved** behavior in reports and documentation.
- When a product decision is approved, update `RULES.md`; update `TUNEFLOW_DESIGN.md` and the roadmap as needed. Keep `AGENTS.md` relatively stable and update it only when collaboration practices or durable safeguards change.

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
5. Run relevant automated tests; explicitly distinguish checks actually executed, not run, and still needed, including browser/device/manual verification. Report failures and limitations accurately; claim an audit only for the scope actually examined.
6. Update the relevant documentation, then report precisely which files and behavior changed, verification results, remaining risks/limitations, and the next recommended step.

## Engineering quality, security and release safeguards
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
