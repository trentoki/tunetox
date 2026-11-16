# Physically verified Repair R1 rollback source

`phase1d-repair-r1.tar.gz` captures the pre-Phase-1D.2 native source, fixture and
related tests/docs. The JSON records HEAD plus individual and archive SHA-256 hashes;
it includes uncommitted source, so HEAD alone is not the rollback point.

For a non-destructive reproduction, extract into a NEW empty directory:

```sh
mkdir /tmp/tunetox-r1-review
tar -xzf development/playable/baselines/phase1d-repair-r1.tar.gz -C /tmp/tunetox-r1-review
```

After stopping the current local media test server, run the extracted
`development/playable/serve-hypnotic.py` to serve the captured R1 fixture at port
8766. It reads the same original, external music without modifying it. Do not extract
onto the active repository or overwrite later work. No automatic rollback is performed.
The archive contains source/tests/docs only; no song WAVs or research outputs.

## Phase 1D.2 LIVE MAIN M1

`phase1d2-live-main-m1.tar.gz` additionally captures the approved UI and M1 code before
Phase 1E. Use the same fresh-directory extraction approach (substitute this archive
name). The adjacent JSON records hashes and the precise physical-evidence scope,
including the unresolved Flow jump. This is not a claim that every OFF/four-deck or
stability combination passed physical testing. Never overwrite the active checkout.

## Phase 1E P1

`phase1e-p1.tar.gz` preserves the physically reviewed initial two-deck integrated
baseline before F1. Extract into a NEW empty directory, never over the checkout:

```sh
mkdir /tmp/tunetox-p1-review
tar -xzf development/playable/baselines/phase1e-p1.tar.gz -C /tmp/tunetox-p1-review
```

Stop the current port-8766 server before running the extracted server. The adjacent
JSON provides file hashes and physical scope. No music is included or changed.

## Phase 1F F1

`phase1f-f1.tar.gz` captures F1 before incremental F2 changes, including uncommitted
source. JSON records archive/file hashes. F1 was running on physical iPad but the
user reported redistribution jumps; this is a rollback point, not a claimed
successful four-deck handoff baseline. Extract into a new empty directory only.
Current F1 entry remains `/performance-four?build=1f-f1`; F2 uses a separate opt-in
entry. No music or generated research audio is included in the archive.

## Phase 1F F2

`phase1f-f2.tar.gz` and its JSON preserve physically tested F2 before the first-Play
investigation. Physical scope and the reported first-Play concern are recorded in
the manifest. Extract only into a fresh empty directory; never overwrite the checkout.
No music is included. The original F2 URL remains available alongside opt-in F3.

## Phase 1F F3

`phase1f-f3.tar.gz` and JSON preserve F3 before G1 storage changes. User confirms
first-entry correction; paused/Release problems remain recorded, not certified fixed.
Extract into a fresh directory only. Original audio is excluded. F3 URL remains available.

## Phase 1G G1

`phase1g-g1.tar.gz` / JSON preserve physically approved storage before G2. The
physical scope is two songs across Safari reload with local loading and playback.
Extract into a fresh directory only; originals are excluded. G1 and F3 URLs and
their earlier archives remain available. G2 uses the same IndexedDB origin/schema.

## Phase 1G G2

`phase1g-g2.tar.gz` and JSON preserve G2 before H1 Design Mode. User physically
verified storage, paused preparation, Resume handoff and Release. Extract into a
fresh directory only; music is excluded. H1 does not modify G2 source or route.
