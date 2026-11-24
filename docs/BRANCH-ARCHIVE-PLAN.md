# TuneTox historical archive and branch removal plan

Prepared 24 November 2026. Desired final branches: `tunetox-reorganization` and
`tunetox-d1`. All nine annotated tags below exist **locally only**. No remote tags,
branches, settings or commits have been changed. Removal remains approval-gated.

## Exact archive manifest

Each tag points to the original commit, not a reconstructed copy or a new commit.
Its complete tracked tree and parent history are retained. Annotated tag-object
IDs differ from commit IDs; compare the peeled `^{commit}` value when verifying.

| Retiring branch | Local annotated archive tag | Original commit |
| --- | --- | --- |
| `baseline/h531-direct-06-working` | `archive/baseline-h531-direct-06-working` | `33ba695003083562b3c6e3c8e5142955d8e5f100` |
| `checkpoint/tunetox-g2-h531-review-20261116` | `archive/checkpoint-g2-h531-review-20261116` | `7584ee2b945b380fa636435f30a67ca6869ada4e` |
| `deploy/tunetox-d1-preview` | `archive/deploy-d1-preview` | `9e099d2b73b6361c80fe4822ca40eaf556951bb0` |
| `docs/tunetox-d1-handoff` | `archive/docs-d1-handoff` | `8ece19bb8258d1097f24cd30aebeb3ce00bfe679` |
| `integration/h531-audio-adapter` | `archive/integration-h531-audio-adapter` | `0f5dba6b16c5b159654971e7e404a1305f9b2a4d` |
| `main` | `archive/main-ui-design` | `3c371f535d9e6a27e67eaaf37847dbf057e59fc5` |
| `organization/tunetox-architecture` | `archive/organization-architecture-ui-verification` | `2b00beeaed2e79056b1c6e8a1516b744fe161dd8` |
| `repair/h531-playable-state` | `archive/repair-h531-playable-state` | `33ba695003083562b3c6e3c8e5142955d8e5f100` |
| `research/source-separation-architecture-review-5e` | `archive/research-source-separation-5e` | `300cebbffda0856ebdf0c2f4d5bb9c91bec4dfda` |

One tag per retiring branch preserves provenance even when tips coincide. Neither
retained branch will be merged, reset, renamed or included in branch deletions.

## Verification already completed

- GitHub live branch tips matched all nine original commits in this manifest.
- Every local tag's peeled commit and tree exactly matched its original branch.
- Git object connectivity passed (`git fsck --connectivity-only --no-reflogs
  --no-dangling`). Historical files were read through tag names, not working copies.
- The baseline archive retrieves `experimental/signalsmith-transport.js`, and
  retains its recorder, context controls and diagnostic implementations.
- The research archive retrieves the complete source-separation snapshot and its
  architecture review. Current working-tree research residue is not a substitute.
- UI design and developer guidance are retrievable through the main/docs tags.
  The architecture/UI verification archive contains 95 review files in total,
  including the 86 files added by its unique verification commit.
- The deployment archive preserves the original forced homepage redirect:
  `/  /development/integration/h531-approved-live.html  302!`.

Verified tree IDs (same order as the manifest):

```text
2960b0d577e68928ac8822a0277461ba2febedb0
b60614ddbaf6b2878a51c04dc66cd0c27d5e185c
d678ef02e0577257689429cfa1eae2973fb0fb2a
17219f909663447403347fa0323c674685bfd22c
aab0231154f2ea76718cbc64014663f76af32589
43c0bc776865d3a1b73f1aa74430dbc2124ad858
1053e9231819465f3bcd1d7db3e4a7145b541936
2960b0d577e68928ac8822a0277461ba2febedb0
0aa4a8168c161eb54b3fe78fbd2623cc56c62703
```

For example, without changing the development checkout:

```sh
git rev-parse 'archive/baseline-h531-direct-06-working^{commit}'
git show archive/baseline-h531-direct-06-working:experimental/signalsmith-transport.js
git ls-tree -r archive/organization-architecture-ui-verification
```

Tags preserve Git-tracked content. They do not capture current uncommitted work,
ignored music, external files, or hosting-service settings. No original music was
moved, modified or deleted. Remote retrievability cannot be claimed until tag
publication and an independent fetch have succeeded.

## Dependencies and safeguards

| Item | Verified state | Action before deletion |
| --- | --- | --- |
| Default branch | GitHub reports `tunetox-d1` | Retain it; no default-branch change is required. |
| Open pull requests | GitHub reports none | Recheck immediately before execution; no current PR needs retargeting. |
| Remote archive tags | GitHub reports none at preparation time | Publish exactly these nine tags; reject conflicting names rather than replacing them. |
| Branch protection | All eleven live branches report `protected: false` | No enforced branch rule was found to migrate. Preserve the baseline's existing policy-level read-only protection on the archive. |
| Tag/ruleset enforcement | GitHub rulesets API returns 403: private repository requires Pro/public for this feature | Do not change plan, billing or visibility. `archive/*` is protected by explicit repository safeguards, just as the baseline is today. Stronger server-enforced protection requires a separately authorized supported plan/ruleset. Tags alone are not technically undeletable. |
| Repository safeguards | AGENTS repeatedly names the baseline branch as read-only | A migration notice now names the exact archive/commit and forbids updating/deleting archive tags. Keep the branch until approved remote verification/deletion. After success, make the archive the primary retrieval reference; preserve old names in historical records. |
| Existing audit | The earlier audit accurately records the pre-fix/pre-tag state | Keep it historical, with a dated follow-up linking this plan and the implemented fixes. |
| GitHub Pages | Repository metadata reports `has_pages: false` | No Pages branch dependency found. |
| Historical Actions workflow | Archived workflow triggers pushes to `integration/h531-audio-adapter`; it is absent from current development | Preserve it in the archives; do not reactivate old tests against today's architecture. No active development workflow needs retargeting. |
| External deployments | Deployment tip and D1 combined status have zero entries; no current checkout hosting config. Connector disallows deployment API; browser is not signed in | External Netlify/other service settings remain unverified. Confirm no site uses a retiring branch, or retire/retarget it explicitly and verify before deletion. Zero status entries do not prove no deployment exists. |
| Git transport | GitHub connector can read the private repo; command-line HTTPS previously lacked credentials | Verify authenticated `git ls-remote` and atomic-push support before execution. Do not expose or store tokens in repository files. |

For an obsolete preview site, retiring/disconnecting it preserves the historical
configuration in the tag without publishing today's app. If it is still needed,
agree its retained build branch and correct entry path first. Do not silently point
the old redirect at the new app or infer authorization to publish it.

## Single approved execution procedure

This is the complete intended transaction, **not executed now**:

1. Obtain explicit approval for this manifest, deletion list and any required
   documentation commit/publication. Code/docs remain uncommitted now; do not
   include unrelated files or credentials in a future checkpoint.
2. Resolve external hosting and authenticated Git access first. Recheck default
   branch, open PRs, rules, all nine remote tips, and absence of conflicting tags.
   If a tip changed, stop and preserve/review its new work rather than deleting it.
3. Confirm local tag objects still peel to these exact commits/trees and that
   active safeguard documentation is published as authorized. Never force-update tags.
4. Publish only the nine tag refs with an atomic push. Independently fetch/read all
   nine remote tag objects into a temporary verification location and compare
   peeled commits, trees and required files against this manifest. Do not delete a
   branch merely because tag publication returned success.
5. Delete the exact nine branch refs in one atomic, expected-tip-guarded batch.
   Use deletion leases against the manifest commits to reject changed tips. This
   authorizes no force-update or history rewrite of retained branches or tags.
   If atomic support/verification fails, stop rather than falling back to partial,
   unguarded deletions. Archives safely remain published if deletion cannot finish.
6. Verify GitHub now exposes exactly the two retained branches, its default remains
   `tunetox-d1`, and every remote archive tag still resolves correctly. Prune stale
   local remote-tracking refs only after verified remote completion, without
   switching branches or modifying the working tree.

The publication/verification/deletion stages can run as one approved maintenance
operation, but should not be a single unchecked push: remote archives must be
verified before branch removal. Local tags alone are not a remote backup.

## Timing fixes and regression status

[Behavior Play](../app/behavior/mixer/deck.js) now derives successful completion
from Audio's current paused state. [Audio natural end](../app/audio/deck-audio.js)
checks the existing transport action number before reporting a stop-reply failure.
No DSP, scheduler command, theme/layout, queue rule or approved Audio name changed.
The historical Clean Deck prototype remains untouched.

The [existing playback suite](../tests/visual-playback-tests.html) now delays real
worklet acknowledgements to test a source ending before Play resolves, an old end
failure after a newer paused seek, successful restart afterward, and a current end
failure that must still be reported. The complete playback/touch suite passes.
The deliberate current-failure fixture is reloaded before subsequent tests.
The focused theme/control suite, legacy core (3/3 groups), startup/routing and
native-output measurement suites also pass. Syntax checks pass for 65 JS/CJS
files; editor diagnostics and Git whitespace checks are clean. The vendored
Signalsmith checksum remains unchanged.
Physical Safari/iPad and audible music quality remain separate manual checks.
