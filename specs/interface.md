# Interface and Customization — Technical Specification

**Status:** Detailed extraction and reconciliation pending. This is not a claim that the feature is implemented.

**Scope:** Responsive views, cue controls and tested design interactions.

## Current approved performance layout

Touch/viewport safeguard: the new entry retains deliberate pinch zoom, uses a bounded dynamic-viewport shell, and adds targeted second-tap handling for Safari versions with WebKit bug 319664. Native scrolling and dragging remain unblocked. See [gesture contract and verification limits](../docs/CLEAN_PLAYBACK.md#scope-and-limitations). This supersedes the earlier CSS-only assumption; physical iPad verification is outstanding.

The new [Clean Playback entry](../tunetox.html) uses a persistent performance header and two independent sections per deck. [APPROVED-NAMING.md](../docs/visual-verification/APPROVED-NAMING.md) specifies the current names and hierarchy.

- Upper: Wave (scrolling waveform and playback time) or Stems (four existing faders).
- Lower: Cues (pads and loop controls) or Controls (filter, EQ and effects).
- Defaults: Wave + Cues in the Performance workspace for all four decks.
- Each component owns only its two presentation selections and workspace. Changing one section cannot modify the other section, another deck, deck behavior, or audio state.
- Library round trips preserve both selections. View nodes and audio players remain mounted; visibility changes use the existing hidden attribute contract.
- Two keyboard-operable toggle buttons share the original compact performance-header selector slot. performance-upper-toggle switches Wave/Stems; performance-lower-toggle switches Cues/Controls. Their visible labels show the current view; aria-pressed is true for Stems or Controls. There are no selector rows inside either content section and no added header height.
- Original child control names, data-cue, data-frequency-band and data-stem identities remain unchanged. Musical controls remain inactive.

The Version 1 PDF and its annotated screenshots record the preceding combined layout. Preserve them as historical styling references. The editable guide begins with a current-layout addendum; its original pages are explicitly historical. Playback behavior and audio modules are unchanged by this interface task.

The approved product-level requirements are in [RULES.md](../RULES.md). The full pre-consolidation technical and historical record is preserved in [legacy-rules.md](legacy-rules.md). Before implementing or changing this subsystem, extract its relevant approved details from that record, distinguish superseded experiments and unresolved mechanics, and synchronize code comments and tests. Do not invent missing decisions.
