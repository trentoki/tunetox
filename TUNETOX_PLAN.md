# TuneTox — Product and Development Plan

## Purpose

This document specifies TuneTox's overall product direction, development priorities, implementation roadmap, and unresolved design questions.

It connects the application's long-term vision with practical, achievable development milestones.

`AGENTS.md` specifies development workflow and safeguards. `RULES.md` specifies approved product behavior.

The plan should be updated as development progresses, clearly distinguishing completed work, approved future work, and decisions still requiring discussion.

## 1. Vision and Product Goals

**Guiding question:** What are we building, and why?

TuneTox is a music application designed to give people greater freedom to explore, perform, create, and interact with music and sound.

Its central goal is to make musical possibilities more accessible through an interconnected set of tools for playback, mixing, sound manipulation, sampling, recording, and musical exploration.

TuneTox is built around the idea that musicians should retain creative control. The application should support experimentation, discovery, and individual expression rather than prescribe how music ought to be made or which sounds belong together.

At the same time, TuneTox aims to make relationships between songs and sounds—including tempo, rhythm, harmonic structure, and musical key—clearer and easier to explore. By making these relationships more visible and understandable, users can create with greater awareness of the musical possibilities available to them, without limiting their creative choices.

**Product goals**

- **Creative freedom:** Give users flexible control over music and sound without unnecessary restrictions.
- **Musical responsiveness:** Make interactions feel immediate, expressive, and connected to what users hear.
- **Musical understanding:** Help users recognize and explore relationships between songs, sounds, rhythms, tempos, and harmonic structures.
- **Interconnected tools:** Allow different musical capabilities to work together within one coherent application.
- **Accessibility:** Make powerful musical tools understandable and usable across different devices and levels of experience.
- **Reliability:** Preserve musical continuity, user creations, and working functionality as the application develops.
- **Extensibility:** Build a foundation that can support new musical capabilities without unnecessarily complicating existing ones.

## 2. Development Roadmap and Priorities

**Guiding question:** What are we working toward, and in what order?

The roadmap provides a flexible guide to TuneTox's development. It identifies current priorities, potential milestones, dependencies, and opportunities without prescribing an inflexible order of implementation.

Development priorities and their sequence should be determined collaboratively by the developers involved, with all final release builds and updates requiring approval from Trent.

### 2.1 Current Priorities

**Independent performance sections (2026-11-22):** The new Clean Playback entry now gives each deck an upper Wave/Stems section and a lower Cues/Controls section, defaulting to Wave + Cues on all four decks. Both selections survive Library navigation independently of playback. Stem faders move to upper Stems; lower Controls retains filter, EQ and effects. Musical controls remain previews. This approved structure supersedes the preceding combined switch; see [current names](docs/visual-verification/APPROVED-NAMING.md) and [interface contract](specs/interface.md). The Version 1 PDF and screenshots are historical styling references; its editable source carries a current-layout addendum.

**H5.3.1 Clean Playback checkpoint (2026-11-22):** [tunetox.html](tunetox.html) is the new, separately testable visual entry point. It uses the approved naming specification and shared four-deck presentation around the existing Clean Deck playback behavior. Load, Play, Pause and the preserved queue action are connected; other musical controls remain previews. The old application and prototype are preserved. See [scope, usage and verification](docs/CLEAN_PLAYBACK.md). This checkpoint is not a release or a completed visual/behavior migration.

Identify the work currently receiving attention, why it matters, and any relevant dependencies or obstacles.

Multiple priorities may progress simultaneously.

### 2.2 Development Milestones

Maintain a provisional set of milestones describing intended outcomes, progress, dependencies, and completion criteria.

Milestones may be reordered, combined, divided, postponed, or replaced as development evolves.

### 2.3 Creativity and Exploration

Creativity is an ongoing development priority.

Encourage new ideas, experimentation, unexpected discoveries, and alternative approaches throughout development.

New discoveries may introduce features, change priorities, or inspire entirely new directions. The roadmap should accommodate these possibilities rather than discourage them.

### 2.4 Roadmap Maintenance

Review and update priorities as development progresses, decisions change, or new opportunities emerge.

Distinguish approved commitments from provisional plans and exploratory ideas.

## 3. Feature Checklist and Development Status

**Guiding question:** What's actually working today?

TuneTox's product specifications describe its intended functionality independently of the implementation status of any particular build.

Implementation progress is tracked through a master feature checklist, which covers core functionality, planned improvements, experimental capabilities, and advanced features.

### 3.1 Master Feature Checklist

Maintain a comprehensive, organized checklist of TuneTox's capabilities.

Each feature should have a stable identifier, a reference to its approved specification where applicable, and an implementation status.

The checklist should distinguish:

- **Verified Functional:** Functionality demonstrated through appropriate testing.
- **Work in Progress:** Functionality currently being developed or integrated.
- **Experimental:** Functionality being investigated or prototyped.
- **Planned:** Approved functionality awaiting implementation.
- **Proposed or Advanced:** Ideas and future possibilities not yet approved for implementation.

### 3.2 Verification Records

Record relevant builds, testing environments, results, and known limitations when functionality is verified.

Historical working builds may serve as references without determining the application's future architecture or capabilities.

### 3.3 Development Progress

Update the checklist as features are implemented, integrated, tested, or revised.

A feature's implementation status does not change its approved product requirements.

### 3.4 Documentation Consistency

Keep the checklist, development plan, and approved behavior rules consistent.

New product decisions should be reflected in `RULES.md`. Changes to development priorities should be reflected in Section 2.

The checklist should provide an accurate view of implementation progress without turning the product specifications into a history of unfinished work.

## 4. Application Architecture

**Guiding question:** How is TuneTox organized so its different capabilities can work together reliably?

TuneTox should use a coherent, modular architecture that allows its musical systems to interact while remaining understandable, maintainable, and independently testable.

### 4.1 Shared Application Foundation
TuneTox is one application with four persistent decks and shared musical state across supported devices and interface layouts.
Changes in presentation should not unnecessarily interrupt playback, reset musical state, or duplicate application functionality.

### 4.2 Musical Subsystems
Organize the application into identifiable subsystems, including deck transport, audio processing, musical matching, stem handoff, library management, sampling, recording, and user interface controls.
Subsystems should have clear responsibilities and communicate through defined interfaces.

### 4.3 State and Actions
Maintain a clear distinction between application state, user actions, musical calculations, and audio execution.
Shared musical behavior should remain consistent regardless of whether an action originates from touch, mouse, keyboard, MIDI, or another supported input method.

### 4.4 Code and Folder Organization
Organize files and folders according to their responsibilities, with descriptive names and understandable relationships.
Prefer improving existing working code over unnecessary rewrites. Preserve verified functionality during restructuring.

### 4.5 Target Architecture (Approved Direction; Not Yet Implemented)

The following describes the agreed organizational direction, **not** the current folder layout or a request to move working code immediately. Existing files must be inventoried, dependencies traced, and changes separately approved and tested before relocation.

- `interface/visual/`: visual presentation, layout, styling, and visible controls.
- `interface/behavior/decks.js` (proposed): maintain each of the four decks' information and settings, including loaded and queued songs, playback commands, volume, EQ, tempo, pitch, manually corrected key information, stem settings, and whether BeatMatch, TuneMatch, and Handoff participation are enabled. This does not itself perform audio processing.
- `audio/analysis/`: determine musical information such as keys, rhythms, and other analyzed song characteristics; keep analysis distinct from matching.
- `audio/matching/`: shared tempo and pitch coordination across participating decks, using musical information supplied by analysis or user corrections.
- `audio/handoff/`: shared stem-allocation and handoff calculations.
- `audio/transport/`: actual playback timing, positioning, and transport execution; user playback commands are represented in deck behavior.
- `audio/engine/`: audio execution and processing, including applying deck volume and EQ settings.
- `audio/sampler/`: retained as a planned subsystem; exact separation of sampler visual, behavior, and audio responsibilities remains to be finalized.

Loading or queueing a song is a deck behavior; reading and decoding its audio data belongs on the audio side. A deck's setting is distinct from the shared algorithm that responds to it and from the audio processing that applies it.

**Open organization questions:** whether the existing `participation.js` should remain a distinct file (and where); the eventual location of audio-file loading, diagnostics, and test-host code; and the final layout for sampler behavior and shared utilities. No folder renames, file moves, or runtime changes are authorized by this subsection alone.

### 4.5 Integration and Extensibility
New capabilities should integrate with existing systems through clear boundaries.
The architecture should accommodate experimentation and future expansion without requiring unrelated systems to be rebuilt.

### 4.6 Architectural Documentation
Keep an accessible overview of the current architecture, including major subsystems, their relationships, and important implementation boundaries.
Document significant architectural changes as they are approved and implemented.

## 5. Core Features and Subsystems

**Guiding question:** What are TuneTox's major capabilities, and how do they work together?

TuneTox brings together interconnected musical tools for playback, performance, manipulation, creation, and exploration.

Each subsystem should have a clear purpose while remaining capable of interacting with other subsystems through shared application state and defined actions.

### 5.1 Decks and Playback
Four persistent decks provide independent song loading, playback, transport, tempo, pitch, and mixing controls.
Decks share the underlying application architecture while remaining independently controllable.

### 5.2 Musical Matching and Relationships
Beatmatching and Tune Matching help users explore and manipulate rhythmic, tempo, and harmonic relationships between songs.
These capabilities operate independently, with user-controlled participation and shared musical relationships where enabled.
Musical analysis should inform creative decisions without prescribing which sounds should be combined.

### 5.3 Stems and Handoff
Four functional stem categories—Beat, Bass, Tune, and Voice—allow users to control different musical components.
Stem Handoff enables coordinated redistribution of these components across participating decks, supporting expressive transitions and combinations.

### 5.4 Library and Musical Organization
A shared library provides access to songs, playlists, musical metadata, and user-created relationships.
Search and navigation should help users discover and organize material without restricting creative combinations.

### 5.5 Sampler and Sound Manipulation
An integrated sampler allows users to extract, prepare, organize, and perform sounds from songs and stems.
Sampling should complement deck playback and stem mixing while supporting independent creative performance.

### 5.6 Recording and Creations
Recording tools allow users to capture, preserve, revisit, and develop musical performances and creations.
Saved creations should retain relevant musical context and relationships wherever practical.

### 5.7 Musical Analysis and Exploration
Analysis tools help users investigate sound characteristics, patterns, structures, and relationships.
These may include tempo, rhythm, key, harmonic structure, spectral characteristics, and source separation.
Analysis results should be presented transparently, including uncertainty where appropriate.

### 5.8 External Controls and Integration
TuneTox should support flexible interaction through touch, mouse, keyboard, and future MIDI controllers.
Controls should connect to shared application actions so that different input methods produce consistent musical behavior.

### 5.9 Subsystem Integration
Capabilities should work together without unnecessary duplication or interference.
Detailed approved behavior belongs in `RULES.md`. Implementation progress belongs in Section 3, and development priorities belong in Section 2.

## 6. Interface and Cross-Platform Design

**Guiding question:** How should TuneTox look, feel, and function across different devices?

TuneTox should provide a coherent, expressive, and responsive musical environment across supported devices.

The interface should adapt to different screen sizes and input methods while preserving the underlying musical capabilities and application state.

### 6.1 Unified Interface
TuneTox uses one underlying four-deck application across desktop, tablet, and phone interfaces.
Different layouts may present controls differently, but changing layouts should not interrupt playback, reset musical settings, or change the behavior of musical relationships.

### 6.2 Visual Design and Creative Experience
The interface should feel engaging, inspiring, and responsive to musical interaction.
Prioritize clear visual feedback, readable controls, intuitive gestures, and immediate connections between user actions and audible results.
Visual design should support creativity without unnecessarily complicating the experience.

### 6.3 Responsive Layouts
Layouts should adapt flexibly to screen size, orientation, and available space.
Important controls should remain accessible, with thoughtful use of panels, scrolling, and alternate views where necessary.
Specific proportions and arrangements may evolve through design experiments and user testing.

### 6.4 Mixer and Deck Presentation
The mixer should make playback, musical relationships, stem levels, and performance controls understandable and accessible.
Waveforms, transport controls, and relevant musical information should provide useful feedback during performance.

### 6.5 Library Navigation
The library should provide consistent access to songs, playlists, search, and musical information across devices.
Users should be able to navigate and interact with their music without unnecessarily disrupting active playback or losing their place in the library.

### 6.6 Input and Interaction
Support appropriate interactions for touch, mouse, keyboard, and future external controllers.
Shared actions should behave consistently across input methods while allowing device-specific interaction patterns.

### 6.7 Design Experimentation
Allow interface concepts to be explored and compared through isolated prototypes or Design Mode.
Experimental layouts should not automatically replace working interfaces or modify underlying audio behavior.
Promising designs can be integrated after review and appropriate verification.

### 6.8 Visual Customization and Themes
TuneTox should allow users to personalize the application's visual appearance.
Customization may include individual deck colors, coordinated waveform and control accents, and selectable visual themes.
Users should be able to create distinct visual identities for different decks while maintaining a coherent and readable interface.
The customization system should be flexible enough to accommodate new themes, appearance settings, and creative visual possibilities as the application develops.
Exact customization controls, available themes, and persistence behavior can be determined through design and testing.

## 7. Unresolved Decisions

**Guiding question:** What still needs discussion, experimentation, or approval?

This section tracks questions and possibilities that have not yet been fully resolved.

Its purpose is to make uncertainty visible, preserve creative possibilities, and help developers identify where additional decisions are needed.

### 7.1 Open Decisions

Record specific, genuinely unresolved requirements when identified. Do not reopen approved product behavior merely because a particular build has not been tested or historical documentation has not yet been reconciled.

Current topics to review against approved rules include:

- **Beatmatching:** Final convergence mathematics, reference and multi-deck edge cases, and precise phase alignment.
- **Tune Matching:** Reference changes, missing or unsupported key information, and pitch-processing limits.
- **Stem Handoff:** Established core functionality with approved product behavior. Developers should implement and maintain the specified behavior. Only genuinely new or ambiguous requirements need further product decisions.
- **Other subsystems:** Specific unresolved implementation-facing product choices for sampling, recording and creation persistence, cross-device transfer, and future MIDI integration.

The list is provisional and must be reconciled with `RULES.md`; it is not an instruction to reopen settled decisions.

### 7.2 Ideas and Possibilities

Maintain a space for creative ideas, alternative approaches, and potential features that have not yet become approved requirements.
Ideas may be explored, developed, combined, or abandoned without requiring immediate commitment.
Advanced possibilities include rhythmic relationships, expanded sampling, source separation, musical analysis, and new performance tools. The master feature checklist should provide a comprehensive inventory.

### 7.3 Research and Experiments

Identify questions that would benefit from prototypes, technical investigation, musical experimentation, or user testing.
Record findings that could inform future decisions without automatically treating experimental results as approved product behavior.

### 7.4 Decisions Awaiting Review

Identify proposed decisions that are ready for discussion or approval.
Distinguish these from decisions already approved and documented in `RULES.md`.

### 7.5 Decision Maintenance

Review unresolved questions as development progresses.
When a decision is approved, update the relevant product rules or development plan and remove or mark the corresponding question as resolved.
Unresolved decisions should not unnecessarily prevent unrelated development from proceeding.

## 8. Testing, Milestones and Release Planning

**Guiding question:** How do we establish that something works, decide when it's ready, and prepare it for release?

TuneTox development should prioritize reliable musical functionality while allowing experimentation, iteration, and creative exploration.

Testing and release planning should provide confidence in the application without imposing unnecessary obstacles to development.

### 8.1 Testing and Verification

Test functionality according to its purpose, complexity, and potential impact on other systems.

Use appropriate automated tests, interactive testing, listening tests, and device-specific verification.

Distinguish successful code execution from verified musical behavior and reliable real-world performance.

### 8.2 Milestone Completion

Milestones should have clear intended outcomes and practical completion criteria.

A milestone may be considered complete when its agreed functionality has been implemented and appropriately verified.

Milestone scope and completion criteria may evolve through collaborative development.

### 8.3 Protecting Working Builds

Preserve known working builds as reference points for development, comparison, and recovery.

Experimental changes should not unnecessarily compromise verified functionality.

Maintain clear distinctions between preserved baselines, experimental builds, and candidates for release.

### 8.4 Integration and Regression Testing

When integrating new features or restructuring existing code, verify that previously working functionality remains intact.

Testing should focus on affected systems and important interactions between subsystems.

Use incremental integration where practical to make problems easier to identify and correct.

### 8.5 Release Preparation

Before a release, identify its intended features, known limitations, supported environments, and outstanding issues.

Perform appropriate testing of the complete release candidate, including important musical workflows.

Release preparation should be proportional to the scope and impact of the changes.

### 8.6 Release Approval

All final release builds and updates require approval from Trent.

Development builds, prototypes, and experimental implementations should remain clearly distinguished from approved releases.

Approval of a feature or experiment does not automatically constitute approval of a release.

### 8.7 Continuous Improvement

Use testing results, development experience, and user feedback to guide improvements.

Testing procedures and release practices should evolve as TuneTox grows, supporting both reliability and creative progress.
