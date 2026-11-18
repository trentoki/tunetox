# Shared Handoff modules

These are the existing classic-script implementations, relocated without changes
to their algorithms or public function names. Keep their established load order.

- `stem-state.js`: stem factories, requested/allocated levels, direct actions,
  eligibility, session authorization and legacy pair relationships.
- `two-deck-stem-handoff.js`: pure legacy pair allocation calculation.
- `four-deck-stem-allocation.js`: pure four-deck allocation and incremental transfers.

Executable references include the root application, metadata demo, standalone stem
prototype, browser fixtures, JXA runners and the playable LAN server. The server
keeps its existing `/handoff-deps/...` public URLs through explicit file mappings.
Older documentation, source snapshots and hash manifests retain historical paths;
they are records, not executable imports, and are intentionally unchanged.

Verification: `osascript -l JavaScript tests/run-tests.js` and
`python3 -B tests/handoff-path-tests.py`. The path checks cover browser script paths,
focused JXA runner inputs and allowlisted source mappings. Physical Safari audio
behavior is not established by these checks. No Design Mode or research code changes.
