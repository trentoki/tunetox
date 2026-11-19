# TuneTox technical specifications

The consolidated [RULES.md](../RULES.md) states approved user-facing behavior. This directory holds detailed English implementation contracts and edge cases, organized by subsystem. The [complete preceding RULES.md](legacy-rules.md) is preserved here as source material for migration; its historical prototypes and experiments are not automatically approved behavior.

Specifications to extract and reconcile, without inventing unresolved mechanics:

- [Musical matching](matching.md): detailed harmonic rules, beat convergence examples and open formulas.
- [Stems and Handoff](stems-handoff.md): gesture authorization, eligibility, sharing, pause/stop, multi-deck allocation.
- [Library](library.md): song links, ordering (BPM/key), search, selection and drag/drop.
- [Sampler](sampler.md): kits, pads, attenuation and routing.
- [Recording](recording.md): Bin, loops, metadata and overdubs.
- [Interface](interface.md): responsive views, cue controls, design experiments.
- [Controls and settings](controls-settings.md): participation, control IDs, preferences.
- [Data](data.md): persistence, transfer, conflicts, export and deletion.

Do not silently replace a prior approved technical contract with a speculative implementation. Keep specifications, code comments and tests synchronized as implementation proceeds.
