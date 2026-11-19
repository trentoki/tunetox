# TuneTox D1 — Control Connection Audit

This document records **source-code connections**, not successful browser or audio tests. It is intended to help developers distinguish native musical behavior from presentation-only interactions.

Source inspected: `development/integration/h531-approved-live-app.js` on the `tunetox-d1` branch.

| Control / action | Current path | Source-code classification | Runtime verification |
| --- | --- | --- | --- |
| Play / Pause | `actions.play` → `audio.togglePlayback` → native player / Handoff | Native audio connected | Pending |
| Main volume | `actions.level` → `native.handoff.setMainVolume` | Native audio connected | Pending |
| Stem faders (four categories) | `actions.level` → `native.handoff.setStemLevel` | Native audio connected | Pending |
| Handoff participation toggle | `actions.toggle('handoff')` → `native.handoff.setParticipation` | Native audio connected | Pending |
| Load four local stem files | File dialog → `native.player(id).loadFiles` | Native audio connected | Pending |
| Beatmatching toggle | `actions.toggle` → `m.setDeckControl`, preview notice | Presentation only in this host | Pending |
| Other non-Handoff toggles | `actions.toggle` → `m.setDeckControl`, preview notice | Presentation only in this host | Pending |
| Cue controls | `actions.cue` → `d.compact.cueAction`, preview notice | Presentation only in this host | Pending |
| Waveform interactions | `actions.wave` → `d.h5.waveAction` | Presentation-state action; audio connection not shown | Pending |
| Queue swap | `actions.swap` → `d.h4Queue.swap`, preview notice | Example/presentation state | Pending |
| Performance controls | `actions.performance` → `m.setPerformanceControl` | Presentation-state action; audio connection not shown | Pending |
| Partner selection | `actions.partner` → `d.h5.setPartner` | Presentation-state action; audio connection not shown | Pending |
| Library columns | `d.createColumnLibraries` | Requires deeper component audit | Pending |
| Design tools | `d.compact.createDesignTools` | Presentation tools; requires deeper audit | Pending |

## Important boundaries

- Native mixer and Handoff state are authoritative for live musical behavior.
- The page also creates presentation state for the existing interface.
- A control's appearance is **not** proof that it affects audio.
- A connected native method is **not** proof that it behaves correctly on every browser.
- No controls have been recolored or disabled as part of this audit.

## Future visual status

A consistent visual status (for example, red-shaded areas for preview-only controls) may be added after the classifications are complete and the owner approves the design. Styling must remain separate from musical logic.

## Next checks

1. Trace nested dependencies and the implementation of presentation-only controls.
2. Test the root `index.html` in a real browser.
3. Test local stem loading and playback.
4. Verify native stem/Handoff behavior against approved rules.
5. Update each runtime-verification field only after testing.
