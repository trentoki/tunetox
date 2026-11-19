# TuneTox — Developer and Coding-Assistant Instructions

## Project purpose

TuneTox is an evolving music application built with readable JavaScript, HTML, and CSS. It should ultimately work across desktop browsers, iPad, iPhone, and Android devices, with installable/PWA behavior planned.

**All final decisions regarding product design and development will be made by humans.**

The application is designed around **four underlying decks**.

## Documentation authority

- `AGENTS.md` is the authoritative development workflow and safeguard document.
- `RULES.md` specifies approved product behavior and clearly labeled historical implementation.
- `TUNETOX_PLAN.md` specifies architecture, development context, roadmap, and unresolved decisions.
- Approved technical specifications in `specs/` are authoritative extensions of `RULES.md` for their respective subsystems. They must remain consistent with approved product rules.

## Workflow and Collaboration

### General collaboration rules

These rules apply to all TuneTox developers, whether human or AI.

- **Human decision-making:** All final product and development decisions are made by humans. Once a task is approved, developers may carry out its agreed implementation steps without repeatedly requesting approval. New product decisions or significant changes in scope require approval.
- **Understand the project:** Before substantial work, review `AGENTS.md`, `RULES.md`, `TUNETOX_PLAN.md`, and relevant source and test files. Source code and tests show what is implemented; `RULES.md` specifies approved product behavior; the plan document provides development context, roadmap, and unresolved decisions.
- **Communicate clearly:** Explain significant proposed changes in plain English, including what will change, why, which files are involved, and how the changes will be tested.
- **Work incrementally:** Keep changes small, independently testable, and grouped by related subsystem. Do not switch from unfinished work to an unrelated subsystem without agreement.
- **Agree on the next task:** Identify the smallest coherent next task in the agreed roadmap. Clarify expected behavior and unresolved decisions before implementation.
- **Write readable code:** Use descriptive, consistent names, short functions, focused modules, clear comments, and straightforward JavaScript. Avoid duplicated logic, unnecessary abstractions, deeply nested control flow, and excessively large files.
- **Keep components interconnected:** Organize application state, musical decision logic, UI presentation, and audio processing (DSP) into clearly defined but interconnected components. Ensure changes remain synchronized so that what users see, what the application calculates, and what they hear accurately reflect one another.
- **Support multiple input methods:** Prefer shared, input-independent actions that can either be invoked by mouse, touch, keyboard, or MIDI, without requiring separate implementations for each input method.
- **Protect working functionality:** For meaningful behavior changes, add or update automated regression and edge-case tests, including negative cases and transitions, along with relevant browser integration tests.
- **Report completed work accurately:** After making changes, identify which files and behaviors changed, which tests were run, which checks remain necessary, and any failures, risks, or limitations. Distinguish automated tests from browser, device, and listening verification. Review code readability and maintainability separately from functional correctness. Report only work and verification actually completed.
- **Make careful Git commits:** When commits are authorized, keep them focused and independently verified. Use meaningful commit descriptions explaining what changed, why, and how it was checked. Stage only the files relevant to the approved task, preserving unrelated work.
- **Maintain documentation:** When a product decision is approved, update `RULES.md`; update `TUNETOX_PLAN.md` and the roadmap as needed. Keep `AGENTS.md` relatively stable, changing it when collaboration practices or durable safeguards change.

### AI-specific safeguards

These additional rules apply to AI coding agents, including Codex.

- **Respect human authority:** Do not independently resolve unspecified product behavior or introduce new musical rules. Present options and obtain human approval.
- **Respect implementation boundaries:** Obtain approval before broad refactoring, major rewrites, architectural changes, dependency installations, new frameworks, or project-wide renaming, unless explicitly included in the approved task.
- **Do not assume success:** Never claim that real audio behavior, browser compatibility, or production readiness has been verified solely because unit or state tests pass.
- **Report accurately:** Clearly distinguish implemented, approved but not implemented, experimental, and unresolved behavior. State which tests were actually run, their results, and any limitations.
- **Explain unfamiliar technical concepts:** Use accessible language when communicating with human collaborators. Do not assume familiarity with programming terminology.
- **Preserve approved decisions:** Do not silently change requirements, remove established functionality, or expand the agreed scope. Raise conflicts or uncertainties for human review.

### Testing workflow

Developers should select tests according to the functionality affected by their work and the potential consequences of their changes.

Before significant implementation changes, establish the current behavior using relevant existing tests where practical. After implementation, rerun those tests and add or update tests when necessary to verify the intended behavior, edge cases, and previously discovered problems.

Changes affecting audio playback, musical coordination, or signal processing require appropriate audio-related tests. Where audible behavior may be affected, verify the results through actual browser playback and listening, not automated tests alone.

Interface changes require verification of the affected interactions and layouts on relevant devices and browsers. Documentation-only changes generally require consistency checks rather than playback testing.

**Historical tests:** Earlier TuneToss development included additional tests and verification work. When relevant to a current task, developers should consult the historical repository and protected baseline for potentially reusable tests, test cases, and previously discovered bugs. Review their applicability to the current architecture before adapting or restoring them. Do not assume historical tests remain executable or that earlier successful results establish current correctness.

Use the current project's existing test files and tools, verifying their availability before running them. Report what was tested, what passed or failed, and what remains unverified.

## Function-first organization and code quality

These standards apply to all developers.

- **Organize by function, not device.** Organize TuneTox's code according to its responsibilities, using a shared application architecture across Mac, iPad, iPhone, and Android devices. Avoid creating separate applications or duplicating musical logic for different devices. Keep audio processing, application state, interface presentation, and device-specific behavior clearly defined and interconnected, while allowing each to have its own responsibilities.
- **Explicit dependencies and public interfaces.** Make dependencies (what one part of the application requires from another) and public interfaces (the defined ways different parts of the code communicate) clear and easy to trace. Document inputs and outputs (information received and produced), side effects (changes beyond returned results), and load-order requirements (which code must be available before other code runs).

  When moving or renaming a module (a file or organized unit of code), check all affected executable HTML/script paths (references used to load application code), test runners (tools that execute tests), and server mappings (rules connecting addresses to served files). Update active references while preserving historical records of earlier implementations.
- **Explain complex behavior.** Document important architectural decisions, module responsibilities, public interfaces, invariants (conditions that must remain true), and non-obvious algorithms (procedures whose behavior is not immediately apparent from the code).

  For audio changes, explain allocation and authorization calculations, requested versus committed values (what was requested versus what was actually accepted or applied), units of measurement, timing and ramp constraints (limits governing how quickly values change), state transitions (changes between operating conditions), cancellation, and failure behavior.

  Code comments should explain the purpose of a decision and any constraints, rather than merely describing what the code visibly does.
- **Review code design separately from correctness.** Evaluate code readability and maintainability independently of whether automated tests pass. Working code is not necessarily well-designed.

  Review naming, responsibility boundaries (which parts of the code are responsible for which tasks), dependency clarity, duplicated logic, nesting (code structures placed inside other structures), and file size. Keep tests understandable and representative of intended behavior.

  Identify existing problems and recommend focused improvements, but do not treat this requirement as permission to reorganize or rewrite large portions of working code without approval.

### English-language technical specifications and code comments

Maintain detailed technical specifications for complex musical behavior in a shared `specs/` folder, organized by subsystem.

Specifications should explain approved behavior, calculations, constraints, and important edge cases in clear English.

Relevant code comments should explain how the implementation follows these specifications, including the reasoning behind non-obvious decisions. Reference the corresponding specification where useful.

When approved behavior changes, update the relevant specifications, code comments, and tests together.

Avoid unnecessary duplication: specifications provide the complete explanation, while code comments provide the context needed to understand the implementation.

### Folder responsibilities

The current TuneTox D1 application starts from `index.html` in the repository's root folder. Its JavaScript and CSS files are organized primarily under `app/interface/`, `app/audio/`, and `app/integration/`.

These folders contain interconnected parts of the application with different responsibilities. Preserve working file paths and references, including older relative paths in `index.html`, unless a change has been approved and tested to ensure the application continues to load and function correctly.

**Future folder organization:** As TuneTox grows, organize new files according to their responsibilities and relationships with existing code. Prefer extending appropriate existing folders over creating unnecessary new ones. Create new folders when they provide a meaningful improvement in clarity, organization, or maintainability. Avoid duplicating functionality across folders or creating separate application structures for different devices. Keep dependencies and public interfaces clear, and ensure that any reorganization preserves working functionality.

`tests/` contains the focused D1 regression and audible-output browser checks. As TuneTox grows, organize new tests alongside related tests, covering new features, interactions, edge cases, and previously discovered bugs. Keep tests understandable and maintain them as functionality changes.

`vendor/` retains pinned optional third-party audio libraries, which are not currently loaded by D1. Read `vendor/README.md` before considering them for integration. As TuneTox grows, document the purpose, version, license, and usage status of each third-party library. Avoid introducing unnecessary dependencies or removing libraries without reviewing their purpose and obtaining appropriate approval.

`docs/` contains D1 inventories and audits. Verify claims about current functionality against the actual source code and tests. As TuneTox grows, organize documentation by subject, keep active documentation consistent with approved decisions and current implementation, and clearly distinguish historical records from current instructions. Preserve useful historical information without allowing outdated documentation to misrepresent the application.

Historical `development/`, `experimental/`, and `research/` paths mentioned elsewhere in project documentation refer to earlier prototypes, not directories currently present in this branch.

**TuneToss was an earlier working name for TuneTox.** The original TuneToss checkout and protected Git baseline preserve earlier versions of the same evolving application and remain historical references.

Do not treat historical file paths as active dependencies, and do not discard approved design decisions simply because their original implementation files are no longer part of the current application.

As TuneTox develops, preserve useful historical research, experiments, decisions, and implementation records. Clearly distinguish historical material from current instructions and working code. Before removing or replacing historical material, check whether it contains information or approved decisions that have not yet been preserved elsewhere.

**Accessing the protected baseline:** The protected historical Git branch is `baseline/h531-direct-06-working`. Consult it when investigating earlier functionality, recovering lost implementation details, comparing behavior, or verifying historical decisions. Access it through Git history or a separate working copy without changing the active development branch. Treat the baseline as read-only: do not commit changes to it, delete it, or overwrite it. Any functionality recovered from the baseline must be reviewed, approved where necessary, and tested before integration into the current application.

## Architecture and product-design safeguards

1. **One four-deck system.** TuneTox has four persistent underlying decks (Decks 1–4), regardless of how many are currently visible. Changing the interface layout must not, by itself, synchronize, reset, unload, or interrupt any deck. Musical synchronization must follow the approved matching rules independently of interface layout.
2. **Three independently configurable musical capabilities.** Beatmatching, Tune Matching, and Stem Handoff are distinct but interconnected systems. Each deck's participation in these capabilities must be independently configurable and recorded in one authoritative participation store (the shared application state that determines which decks participate in each system).

   Preserve the approved musical matching rules, including using the current sounding pitch when determining pitch relationships between decks. Changes to terminology or code structure must preserve established behavior and be reviewed and tested before implementation.
3. **Stem foundation safeguards.** All four decks should initialize with their main volumes at 0% and their four stem levels at 100%. This startup behavior is approved but not yet implemented.

   **This is an intentional safety feature:** Starting with main volumes at 0% prevents unintended audible output while allowing stem levels to be prepared at 100%.

   Stem levels alone do not authorize audible gain increases. Authorization is based on qualifying human adjustments to effective stem gain (main volume × stem level). For example, manually raising a deck's main volume to 100% while its stems are at 100% authorizes all four stem categories up to 100% for the session.

   Enabling Handoff alone does not change stem levels. When a participating deck's main volume is raised during playback, Handoff redistributes effective stem gains across participating decks according to the approved allocation and authorization rules. Do not invent unresolved multi-deck distribution formulas. Distinguish approved target behavior from currently implemented and verified behavior.
4. **Saved preferences.** Support persistent user preferences (settings retained between application sessions), including default participation settings for each deck. Distinguish saved preferences from temporary changes made during a performance.

   Design saved settings to work offline and use versioned data formats so they can be updated safely as TuneTox evolves. Clearly distinguish settings stored on the current device from settings synchronized across devices. Do not claim cross-device synchronization is available until it has been implemented and verified.
5. **Cross-platform consistency.** Develop TuneTox as one interconnected application that adapts to desktop computers, iPad, iPhone, and Android devices. Prefer shared interface components, responsive CSS (styling that adapts to different screen sizes and orientations), and common underlying actions across devices.

   Device-specific layouts and interactions may differ when appropriate for usability, accessibility, or technical requirements, but should not require duplicating the application's underlying musical functionality. Significant platform-specific differences require human approval.
6. **Shared library functionality.** Maintain common library functionality across devices, including navigation, searching, selection, scrolling, and drag-and-drop interactions.

   Support searching playlists, songs, and artists, including searching and filtering by BPM and musical key. Search context may influence the order of results but should not unnecessarily restrict which content users can find.

   The library may be opened from different decks, allowing flexible use of library views across the four-deck interface. These views share the same underlying library functionality and established internal layout. Do not interpret this flexibility as permission to redesign the library's internal panel arrangement or create separate library implementations for individual decks.
7. **Audio protection.** Protect TuneTox's working audio functionality when making changes to other parts of the application. Changes to the interface, library, or documentation must not unintentionally alter playback engines, digital signal processing (DSP), audio worklets, audio lifecycle behavior, or experimental audio settings.

   Intentional improvements to audio functionality are encouraged when included in an approved development task. Make such changes carefully, preserve established musical behavior unless a change is explicitly approved, and verify the results through appropriate automated tests and real browser/audio testing.

   TuneTox D1 currently uses native Web Audio for playback. Earlier experiments with Signalsmith Stretch and SoundTouchJS are retained as historical or optional resources, but neither library is currently connected to D1 playback. Pitch-preserving tempo stretching is not a required D1 feature.

   Preserve third-party library licenses, attribution, and provenance (records identifying where external code originated). Automated test success alone does not establish that Safari playback is free of audible clicks or that native audio memory is properly released.
8. **State ownership.** Maintain a single authoritative source for shared application state (the information that represents the application's current condition), so different parts of TuneTox do not maintain conflicting versions of the same information.

   The current implementation uses `appState.decks` to store information about the four decks and `appState.participation` to manage their participation in Beatmatching, Tune Matching, and Stem Handoff. Keeping participation separate is the preferred approach because these musical systems coordinate relationships between decks.

   Preserve these structures unless an alternative architecture is explicitly approved, implemented, and tested. Do not introduce competing sources of state or reorganize established state structures without reviewing their effects on the rest of the application.
9. **Flexible MIDI controller mapping.** Design TuneTox's controls around stable identities and reusable actions so they can support mouse, touch, keyboard, and MIDI input without duplicating musical functionality.

   Future MIDI support should allow users to configure which MIDI messages control which TuneTox actions directly within the application. Support both MIDI Learn (assigning a control by operating a connected MIDI device) and manual assignment of MIDI messages.

   Allow flexible mappings across compatible MIDI controllers without unnecessarily restricting users to predefined devices or fixed control assignments. MIDI mappings should remain independent of the visual interface layout and should be saveable and editable.

   This is an approved future design direction, not authorization to implement MIDI mapping as part of unrelated development tasks.

## Engineering quality, security and release safeguards

- **Original audio safety.** Protect users' original audio files from unintended modification or deletion. TuneTox should treat imported audio as read-only source material unless a separate, explicitly authorized operation requires otherwise.

  Development, testing, audio analysis, and conversion should not rename, move, overwrite, or delete original music files. When modifications or conversions are necessary, work on separate copies in an appropriate project workspace.

  Never perform bulk changes to a user's music library without explicit human approval. When investigating file-related problems, use the actual filenames and paths rather than assuming or automatically correcting them.

  **Future file organization:** TuneTox should support creating, saving, and organizing its own audio files, including separated stems, processed audio, and copies of imported recordings. These files may be organized into a dedicated TuneTox folder structure, with clear relationships to their original source recordings. Users should be able to access and manage their creations without risking changes to the original music files.

  This is an approved future design direction, not a requirement to implement file management during unrelated development tasks.
- **Security boundaries.** Protect TuneTox users, their music, personal information, and creative work from unauthorized access, unintended changes, and unnecessary exposure.

  Validate untrusted inputs, including imported files, audio metadata, messages, and saved settings, before allowing them to affect application state or consume substantial system resources. Handle invalid, corrupted, or unexpectedly large inputs safely.

  Never hardcode passwords, API keys, or other private credentials into application code. Do not expose sensitive information through public files, logs, exports, or source-control repositories.

  **Security should support creative freedom, not unnecessarily restrict it.** Design protections around genuine technical and privacy risks rather than imposing arbitrary limitations on what musicians can create, import, process, or combine.

  When a security measure requires restricting an action, make the reason understandable and, where practical, provide a safe alternative that preserves the user's creative control.
- **Dependency and platform review.** When introducing or modifying external software libraries, browser permissions, file access, network connections, or storage functionality, review the relevant security, compatibility, and licensing considerations.

  For third-party libraries (software developed outside TuneTox), verify their source, version, licensing requirements, known security vulnerabilities, and compatibility with the application's existing architecture.

  For browser and device functionality, review permissions, privacy implications, and potential risks involving files, network access, and stored information. Do not assume that files or information are safe simply because they originate from the user's own device or are accessed offline.

  Keep these reviews proportional to the changes being made. Minor changes that do not affect dependencies, permissions, or security-sensitive functionality should not require unnecessary additional reviews.

  Prefer reliable, maintainable solutions that preserve users' creative freedom and avoid unnecessary dependencies or restrictions.
- **Audio performance and reliability.** Design TuneTox's audio systems to respond quickly, smoothly, and predictably during musical performance. Prioritize low latency (minimal delay between an action and its audible result), uninterrupted playback, and accurate coordination between decks, stems, and other musical controls.

  Audio processing must respect real-time timing requirements. Avoid unnecessary memory allocation, blocking operations (tasks that prevent other work from proceeding), file or network operations, and continuous diagnostic logging in time-critical audio processing.

  Use predictable calculations and state transitions (changes between operating conditions). Keep audio processing workloads within appropriate time limits to reduce the risk of clicks, dropouts, glitches, or interruptions.

  When developing or modifying audio functionality, evaluate performance on relevant browsers and devices. Do not claim that an implementation meets specific latency, processing-capacity, or reliability requirements without appropriate testing and measurements.

  **Creative responsiveness matters:** Controls should provide immediate and consistent feedback, allowing musicians to perform expressively without the software introducing unnecessary delays or interruptions.
- **Release readiness and version management.** Maintain a reliably playable version of TuneTox while allowing ongoing development, testing, and experimentation.

  **Playable branch:** `tunetox-d1` is the designated branch for the current playable application. During the present restructuring, it remains under development until its functionality has been verified. Once established as playable, protect it from untested or disruptive changes.

  **Development and experiments:** Use separate Git branches for substantial new features, experiments, or changes that could disrupt the playable application. Feature branches develop functionality intended for integration; prototype branches can contain standalone visual/design experiments, including Design Mode, without requiring the full audio application. Test and review changes before incorporating approved results into the playable branch. Small, low-risk changes may be made directly when appropriate and approved.

  **Historical versions:** Preserve important playable milestones using Git tags so earlier working versions can be identified and recovered. Retain `baseline/h531-direct-06-working` as a read-only historical reference. Do not overwrite or repurpose historical milestones.

  **Development and testing builds:** Encourage frequent testing on relevant browsers and devices. Experimental builds may contain incomplete functionality, provided their limitations are understood and they do not unnecessarily endanger user data, original audio files, or working functionality.

  **Public releases:** Before general distribution, perform appropriate security, privacy, accessibility, compatibility, performance, dependency/licensing, and platform-specific checks. Verify important musical functionality through automated tests and actual browser/device testing, including listening tests where relevant.

  Document verification results, known limitations, and unresolved issues. Automated tests alone do not establish release readiness. Stable releases need not contain every planned feature; prioritize reliable functionality and continued incremental improvement.
- **Version control and branch safety.** Use Git to preserve TuneTox's development history, protect working functionality, and support experimentation without disrupting the playable application.

  Before making changes, verify the current branch, inspect existing modifications, and identify any work that must be preserved. Keep changes focused and avoid accidentally including unrelated files in commits.

  **Playable branch:** Once `tunetox-d1` has been verified as reliably playable, protect it from untested or disruptive changes. Incorporate substantial changes only after appropriate testing and human approval.

  **Feature and prototype branches:** Develop substantial new functionality and experimental designs on separate branches. These branches may contain incomplete work and can be tested independently. Incorporate approved results into the playable branch without unnecessarily transferring experimental code or unrelated changes.

  **Historical preservation:** Preserve important playable milestones using Git tags. Retain `baseline/h531-direct-06-working` as a read-only historical reference. Do not overwrite, delete, or repurpose preserved historical versions.

  **Safe Git operations:** Prefer focused, reversible changes. Never discard existing work, reset shared history, force-push, delete important branches or tags, or perform other destructive operations without explicit human authorization. Explain potentially destructive operations and their consequences before requesting approval.

  If Git or another source-control system is unavailable, report that limitation rather than claiming changes can be recovered through version history.

## Handling conflicts and migrations

- **Identify and resolve conflicts.** When existing code, tests, or documentation conflict with newer approved TuneTox requirements, explicitly identify the differences before making changes.

  Distinguish current implementation from approved product behavior, experimental ideas, and historical records. Do not assume an approved feature has already been implemented or that historical behavior remains an active requirement.

  Propose a focused, testable migration (a planned transition from the existing implementation to the approved behavior). Explain which files and functionality would be affected, preserve relevant historical information, and obtain approval before making significant changes.

  Do not silently overwrite approved decisions, delete valuable historical records, or change working functionality merely to resolve a documentation inconsistency.
- **Protect user data during updates and migrations.** Updating TuneTox must not unintentionally erase, overwrite, corrupt, or make inaccessible users' existing information or creative work.

  Preserve saved preferences, playlists, music libraries, deck and session information, stems, samples, recordings, musical creations, and other user-generated content when updating the application or changing its internal architecture.

  When changes to data structures, storage formats, or application functionality require a migration (transferring existing information into a new format or system), design the migration to preserve existing data and maintain compatibility wherever practical.

  Prefer reversible changes, appropriate backups, and explicit validation that existing information remains accessible and correct after an update.

  If a proposed change cannot safely preserve existing information, clearly explain the risks and obtain explicit human approval before proceeding. Never silently delete or replace user data as part of an application update.

## Important files and project references

- **`AGENTS.md`** — Development workflow, collaboration practices, and durable architectural and safety safeguards.
- **`RULES.md`** — Approved TuneTox product behavior, including distinctions between current implementation, future requirements, and historical behavior.
- **`TUNETOX_PLAN.md`** — Architecture, development roadmap, project context, and unresolved decisions.
- **`index.html` and `app/`** — The current TuneTox application and its underlying implementation.
- **`tests/`** — Current automated and browser tests. Select tests according to the functionality being changed, as described in the Testing workflow.
- **`vendor/README.md` and `vendor/`** — Information about optional third-party libraries, their origins, licenses, and historical experiments.
- **`docs/`** — Architecture inventories, audits, and supporting documentation. Verify claims about current behavior against the actual application code and tests.
- **Historical Git references** — Earlier TuneToss implementations, tests, and preserved playable milestones, including `baseline/h531-direct-06-working`. Consult when relevant, without treating historical behavior as current requirements.

Keep this reference list accurate as files and folders evolve. Update active references when approved migrations or reorganizations occur, while preserving useful historical information.
