# Controls and Settings — Technical Specification

**Status:** Detailed extraction and reconciliation pending. This is not a claim that the feature is implemented.

**Scope:** Direct participation, stable control IDs and validated preferences.

## Implemented Main Volume

The active application uses the approved `main-volume-fader` in each deck's existing header position. The slider sends 1% input changes to Behavior's `setMainVolume`; `deck.mainVolume` is the single authoritative requested value in 0–1 units, initialized to zero. Invalid values (including non-numbers, non-finite values, and values outside 0–1) are rejected without changing state or sound settings. The display shows the requested percentage.

Audio routes each persistent HTML Audio player through its own Web Audio GainNode into one shared context. Initial gain is zero. New targets ramp linearly over 15 ms, starting from the modeled current gain if another ramp is underway; zero is reached exactly. Gain changes do not restart, reload, or seek media, and do not affect another deck. Context resume and media Play are initiated together during the Play gesture; failure pauses that player and uses existing playback error reporting. Main is retained across loading, queue swaps, pause/resume, and view changes; it is not saved across page reloads. No Handoff, stem gain, or normalization is connected by this change.

The prior full-volume preview exception is superseded. Stems remain disabled 100% previews. Main's audible smoothness and Safari/iPad gesture behavior require physical listening/device verification.

The approved product-level requirements are in [RULES.md](../RULES.md). The full pre-consolidation technical and historical record is preserved in [legacy-rules.md](legacy-rules.md). Before implementing or changing this subsystem, extract its relevant approved details from that record, distinguish superseded experiments and unresolved mechanics, and synchronize code comments and tests. Do not invent missing decisions.
