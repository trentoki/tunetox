# TuneTox codebase audit and branch preservation plan

Reviewed 24 November 2026 on `tunetox-reorganization`, committed tip
`350982c8499c579cc77158e64a31c54486c822f6`, plus the existing uncommitted work.
The application is a compact, understandable foundation with meaningful browser
regression coverage. It does not need a new architecture or broad rewrite.
Two additional asynchronous edge cases were reproduced and remain unfixed pending
approval. Passing regression suites do not cover those cases yet.

**Subsequent approved follow-up:** Both timing bugs have now received targeted
corrections and real-worklet regressions in the existing playback suite. The
historical prototype is unchanged. The checkpoint was committed and pushed as
`b913bfb238db77014ba5296e7e542f3b9bf73345`. On 24 November 2026, independent
GitHub API reads verified all nine published annotated tags and their target commits
and trees against the manifest. Eight historical branches have been removed;
`deploy/tunetox-d1-preview` remains untouched pending separate hosting review. See the
[exact archive manifest and maintenance prerequisites](BRANCH-ARCHIVE-PLAN.md).
The findings and pre-migration observations below remain the original audit record.

## Scope and architecture

- [Active entry](../tunetox.html): four persistent decks assembled by
  [Visual startup](../app/visual/mixer/application.js).
- [Behavior](../app/behavior/mixer/deck.js): authoritative song/queue, requested
  Main/Tempo/stem levels, cue positions, and guarded playback coordination.
- [Audio](../app/audio/deck-audio.js): one shared context, per-deck processing and
  gain, source clock, cancellation, bounded worklet waits and object-URL cleanup.
  [Waveform overview analysis](../app/audio/waveform/overview-waveform.js) (originally
  app/audio/waveform-summary.js at audit time) reads decoded PCM without
  changing the source or gain.
- [Visual component](../app/visual/mixer/playback.js): DOM, section selections,
  waveform display, native faders, rollers and seek gestures. Touch protection and
  theme selection remain separate, focused Visual modules.
- The eight active JavaScript modules and their relative imports resolve. Three
  stylesheets support Default, Glass Hardware and Futuristic. No build framework,
  package installation or additional application layer is required.
- [Legacy reference](../legacy-reference/) retains 75 files. Its old native stem
  engine and Integration code are historical, not duplicate active dependencies.
  The Clean Deck prototype deliberately shares current Behavior/Audio.
- [Research](../research/) is reference material, not an application dependency.
  Its current 153 retained files do not include the complete historical experiment
  source. Preserve branch/history references before removing historical branches.

Requested Behavior values and Audio's applied scheduling state serve different
purposes; their coexistence is not an unnecessary duplicate state store. Likewise,
the song generation, transport action and processing request counters protect
different asynchronous lifetimes. Collapsing them merely to shorten code is unsafe.
Main and transport gain nodes also have distinct responsibilities.

## Safe cleanup performed

1. Renamed the private `previewRange` helper to `createRangeField`, updating all
   four call sites. It constructs real controls as well as previews. Its DOM,
   defaults and interaction behavior are unchanged.
2. Removed the unused `number` argument from the private `createWave` helper.
3. Corrected two Audio comments that incorrectly referred to a processor variable
   instead of the old-rate boundary/older request. No Audio executable logic changed.
4. Updated the active README: overview data is real, seeking/cues are functional,
   stems have stored levels without DSP, and Pitch Demo remains Visual-only.
5. Corrected vendor documentation's stale D1 paths and library usage description.
6. Clarified current specification status and the Pitch Demo exception, without
   changing approved product rules or implementation contracts.

Theme CSS, Signalsmith, Behavior, legacy files, certificates and server code were
not changed. No functions with public/approved Audio names were renamed. Existing
uncommitted work, including the earlier Plasma removal, was preserved.

## Confirmed problems requiring approval

### Short songs can leave Behavior reporting playback after Audio has ended

In [playDeck](../app/behavior/mixer/deck.js), `deck.isPlaying = true` runs after
awaiting `startAudio`. Audio begins before its scheduling acknowledgement returns.
If the song ends during that wait, the coordinator's ended handler first records
false, then the later Play completion overwrites it with true.

A real Chromium/worklet probe with a generated 0.1-second file and delayed Play
reply reproduced: Audio was paused/ended before and after the reply, but Behavior
changed from false to true afterward. No original music was used.

Suggested focused correction: reconcile successful completion to actual transport
state rather than unconditionally writing true. Add short-song/delayed-reply and
processor-failure-during-start regressions. Do not broadly rewrite coordination.

### An obsolete natural-end failure can poison a newer paused seek

The [startClock](../app/audio/deck-audio.js) natural-end scheduling catch checks
node identity and paused state, but not the transport action number. A later
successful paused seek still has the same node and paused state.

A generated 0.2-second file reproduced this: after natural end, a paused seek to
0.05 seconds succeeded with no error; rejection of the older end acknowledgement
then populated `audio.error`. Future Play rejects that stored error until reload.

Suggested focused correction: capture/check the existing transport generation or
action identity for natural-end completion, as Tempo/Pitch already do. Add the
overlapping end/seek/restart regression before implementation.

### The shared Clean Deck prototype cannot currently demonstrate audible gain

Its [historical presenter](../legacy-reference/app/visual/mixer/deck.js) has no
Main control, while current `buildDeck()` correctly initializes real Main gain at
zero. Load/Play/Pause/Eject may operate successfully and remain silent. That
presenter also creates unreclaimed blob URLs and bypasses current coordination
guards; these are historical prototype limitations, not active-host behavior.

Preserve the zero-volume safety rule and legacy source. If this prototype must be
audibly testable again, approve a minimal compatibility update separately. Do not
silently set Main to full volume or create copied Audio modules.

## Other risks and optional improvements

- **Resource verification:** a new load can temporarily retain decoded PCM,
  copied transfer buffers and an old processor. Decode cannot be cancelled by
  AbortController. Cleanup is bounded and late nodes are disposed, but sustained
  four-deck/long-file Safari memory reclamation is not established. Do not impose
  arbitrary file limits without a product decision and measurements.
- **Future teardown:** document-level listeners and the shared gain/context paths
  intentionally live for the four persistent decks. They are not evidence of a
  current navigation leak, but a future dynamically mounted app needs teardown.
- **Presentation cost:** `render()` rebuilds cue markers and Library rows on some
  control updates. Time ticks already use the smaller `updatePlaybackTime` path.
  Optimize further only after profiling; do not add a state cache speculatively.
- **Theme updates:** color changes recreate the selected stylesheet and trigger
  theme-change cancellation. Separating color/style refresh could reduce churn,
  but changes interaction semantics and is deferred.
- **Naming/location:** the shared functional cue presenter remains under Glass
  Hardware with the historical name `cue-preview.js`. Its header explains this.
  A future approved move into existing mixer Visual code would improve discovery;
  no second cue implementation is needed.
- **Prepared API is not dead code:** `setAudioPitch` is deliberately reserved.
  SoundTouchJS is inactive but retained for historical comparison with licenses.
  No unused active runtime module was identified for safe deletion.
- **Documentation:** the editable Version 1 guide's supposedly current addendum
  still shows superseded in-content selector rows and disabled-control claims.
  Its PDF/screenshots are historical references. Current authority is
  [APPROVED-NAMING](visual-verification/APPROVED-NAMING.md) and the subsystem specs;
  a separately reviewed guide revision is preferable to regenerating its PDF here.
- **Deferred functionality:** stem DSP/Handoff, matching, musical Pitch, EQ/effects,
  loops, full Library manipulation, scrolling waveform and session persistence are
  not made functional by this cleanup. There is no active Eject button; Eject exists
  in Behavior and the shared prototype.

## Verification results

- Complete HTTPS Chromium playback/touch suite passed before and after cleanup:
  four decks, measured pitch-preserving Tempo, gain, seeks, cues, queue rules,
  loading/Eject cancellation, processor failures and existing asynchronous races.
- Focused Glass Hardware/Futuristic suite passed before and after cleanup, including
  restored Default/Glass appearance, stem values, rollers and cue persistence.
- All three themes retained four decks without horizontal overflow at measured
  CSS viewports 1093×819 and 614×819 (landscape/portrait). Empty overviews contained
  no waveform rectangles. These are emulated viewport checks, not iPad screenshots.
- Legacy core: 3/3 groups passed. Legacy startup/routing passed. Native output
  measurement passed source/stem/Main/transport/final-signal, Pause/resume and probes.
- Syntax checks passed for 65 JavaScript/CJS files across active code, tests and
  preserved legacy modules. Reviewed current Markdown links resolve locally.
- Signalsmith module SHA-256 matches the pinned upstream record:
  `97530b11d5bc01015af4cde40d6aa55ff10c40aa1294ca4c8c5762027d517a46`.
- HTTPS remains running, with protected Git/certificate paths returning 400. HTTP
  was not running initially; the unchanged server was started and returned 200 for
  the active page and 400 for hidden Git/certificate paths. No trust settings changed.
- The two targeted race probes above reproduced failures; they are not counted as
  passing regressions. Their test instances were ejected and blob URLs revoked.
- Physical Mac Safari/iPad, audible music transitions, long-file memory and sustained
  CPU performance were not verified by this audit. Chromium signal measurements
  and touch emulation do not establish those results.

## Branch audit

Only `tunetox-reorganization` exists locally. Eleven remote branches were listed
through GitHub; all live tips matched local remote-tracking refs. Command-line
remote authentication was unavailable, so the GitHub connector supplied live
verification without fetching or modifying refs. There are no local Git tags;
remote tags were not inventoried and must be checked before choosing archive names.
The stored `origin/HEAD` points at `tunetox-d1`; it is a symbolic reference, not an
extra branch. Before any future deletion, recheck live tips/default/deployment use.

“Unique” below counts commits not reachable from either retained branch, not files
missing from today's checkout. Ancestor code remains recoverable in Git even when
later removed from the working tree. No branch or tag was created or deleted.

| Branch | Tip | Unique commits | Purpose and proposed action |
| --- | --- | ---: | --- |
| `tunetox-reorganization` | `350982c` | 0 | Retain as development. Earlier uncommitted work is not yet a recoverable Git milestone. |
| `tunetox-d1` | `83def8f` | 0 | Retain as the exact D1 preservation branch. It is an ancestor of development (52 commits behind). |
| `baseline/h531-direct-06-working` | `33ba695` | 0 | Protected working baseline and complete historical Signalsmith experiment. Retain under current safeguards. To reach only two branches, explicitly approve replacing its branch reference with an immutable archive tag and updating safeguards first. |
| `checkpoint/tunetox-g2-h531-review-20261116` | `7584ee2` | 0 | G2/H5.3.1 review milestone; ancestor of retained history. Prefer an archive tag for discoverability, then branch deletion after approval. |
| `integration/h531-audio-adapter` | `0f5dba6` | 0 | Earlier H5 audio adapter/native diagnostics; ancestor of retained history. Branch deletion loses no unique commits. |
| `repair/h531-playable-state` | `33ba695` | 0 | Same tip as protected baseline. Redundant branch; deletion loses no unique commits while baseline is preserved. |
| `deploy/tunetox-d1-preview` | `9e099d2` | 2 | Unique `_redirects` deployment changes. Archive tip before deletion; first confirm no deployment service still selects this branch. Do not merge obsolete redirects into the active app. |
| `docs/tunetox-d1-handoff` | `8ece19b` | 2 | Historical developer quick start and handoff README. Exact versions are absent from retained tips. Archive tip before deletion; do not make their old paths current instructions. |
| `main` | `3c371f5` | 1 | Unique historical `UI_DESIGN.md`, with design decisions differing from today's interface. Also reachable through the research branch. Archive before deleting both; preserve as historical guidance, not current specification. |
| `organization/tunetox-architecture` | `2b00bee` | 1 | Adds 86 design screenshots/measurements/verification files, absent byte-for-byte from retained tips. Archive before deletion; approved current screenshots are not a replacement for this earlier evidence. |
| `research/source-separation-architecture-review-5e` | `300cebb` | 2 | Historical source separation snapshot plus the unique UI design ancestor. Research commit is patch-equivalent to retained-history `0aa480f`, but complete sources were later removed; current research residue is incomplete. Archive tip before deletion for exact history and easy recovery. |

The protected baseline contains the original Signalsmith transport, context and
diagnostic controls, recorder and related experiments. They are absent from both
retained branch tips, but their ancestral commit/tree remains reachable through
both histories. Deleting a redundant branch would not erase those objects, yet it
would remove the deliberate retrieval name. Preserve that named milestone.

## Recommended sequence for approval

1. Approve focused fixes and permanent regressions for the two confirmed races.
2. Verify those fixes on Safari/iPad with real music and repeated Load/seek/Eject.
3. Review and checkpoint the existing uncommitted feature work separately from this
   small cleanup. Include untracked theme files, tests, docs and the intentional
   frozen reference snapshot; never include local certificate/key material.
4. Approve archive tags (or an independently verified full Git bundle) for unique
   historical tips and named milestones. A bundle kept only on this Mac is not a
   remote backup; archive preservation must be verified before deleting remote refs.
5. Approve any exception needed for the protected baseline safeguard, then remove
   only the explicitly approved branches. Leave the two retained branches intact;
   do not merge or rewrite history merely to simplify the branch list.
