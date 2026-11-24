# TuneTox — Approved Visual Naming Specification
These names were established through our UI planning discussions. They are authoritative for the new visual code structure.

Do not replace them with names found in the existing repository.

**Current revision — independent performance sections (2026-11-22):** This structure supersedes the original Wave + Cue / Controls switch. The original H5.3.1 images and Version 1 PDF remain historical references for visual styling, not the current content hierarchy. The editable guide source includes a current-layout addendum.

## 1. Application structure

- `app` — entire application
- `mixer-header` — global mixer header
- `mixer-decks` — container holding the four decks
- `mixer-footer` — global mixer footer
- `deck` — individual deck container
Each deck has two main views:

- `performance-view`
- `library-view`
The performance view contains:

- `performance-header` — persistent portion of the performance interface
- `performance-content` — container for two independently switchable sections
The performance content contains:

- `performance-upper-section`
  - `wave-view` — scrolling waveform and current playback time
  - `stems-view` — four stem faders
- `performance-lower-section`
  - `cues-view` — cue pads and loop controls
  - `controls` — filter, EQ, and effects; no stem faders

Each section shows exactly one of its two views. Each deck independently retains its upper and lower selection, including when Library is opened and closed. All four decks default to Wave + Cues in performance-view. Switching either section or workspace does not change playback, queue state, or the other section's selection.

The two sections contain views only, with no selector rows. Their controls are two independent toggle buttons in the original compact header selector slot; they add no header height and consume no performance-content space.

`wave-and-cue` is retired. The intermediate `performance-upper-selector` and `performance-lower-selector` segmented controls are superseded by the header toggles below.
The library view contains:

- `library-header`
- `library-content`

## 2. Performance header

- `deck-participation-button`
- `tempo-slider`
- `pitch-slider`
- `library-button`
- `song-title`
- `performance-selector` — original compact header slot, containing exactly two independent toggle buttons
  - `performance-upper-toggle` — shows Wave or Stems; activation toggles only the upper section
  - `performance-lower-toggle` — shows Cues or Controls; activation toggles only the lower section
- `play-pause-button`
- `queue-button`
- `main-volume-fader`
- `waveform-overview`

The toggles reuse the original view-selector button positions and sizes. Other header controls retain their geometry. The guide's earlier section-selector placement is superseded by this correction; the guide is not regenerated.

## 3. Upper Wave and lower Cues

`wave-view` contains `scrolling-waveform`, `playhead`, and `current-playback-time`. `cues-view` contains `cue-pads` and `loop-controls`. Existing child names and cue attributes remain unchanged.

- `scrolling-waveform`
- `current-playback-time`
- `playhead`
- `cue-pads`
- `cue-pad` — eight individual buttons, identified using `data-cue="1"` through `data-cue="8"`
- `loop-controls`
- `halve-loop-button`
- `loop-toggle-button`
- `double-loop-button`

## 4. Controls

- `filter-knob`
- `eq-knob` — shared class for Low, Mid, and High, distinguished by `data-frequency-band="low"`, `"mid"`, or `"high"`
- `effects-controls`
- `effect-selector`
- `effect-knob`
Each effect selector corresponds to the effect knob directly beneath it.

### Upper Stems

- `stem-faders` — container inside `stems-view` holding four range inputs, distinguished by `data-stem="beat"`, `"bass"`, `"tune"`, or `"voice"`

The four stem faders retain their existing visual design and remain inactive previews. Moving them does not authorize new audio behavior.

## 5. Library

- `section-selector` — Songs / Playlists / Links
- `back-to-performance-button`
- `song-sort-selector`
- `search`
- `search-results`
- `search-result`
- `song-title`
- `artist`
- `playlist-title`
- `send-to-deck-one`
- `send-to-deck-two`
- `send-to-deck-three`
- `send-to-deck-four`

## 6. Folder organization

- `folder-contents`
- `folder-back-button`
- `folder-title`
- `folder-item`
- `folder-expand-button` — toggles expansion and collapse
- `create-folder-button`
- `rename-folder` — provisional action name
Folder and playlist organization should remain flexible. Do not invent additional UI controls.

## 7. Historical Version 1 PDF requirements
The following records the completed original PDF task. Its combined switching hierarchy is superseded by Section 1 above. Preserve its six approved images as visual design references.
Use the original H5.3.1 screenshot.

Document:

1. Deck 1 — Wave + Cue
2. Deck 2 — Controls
3. Deck 3 — Library
For each, accurately crop the deck and outline the actual visible interface sections.

Connect the visual sections to the approved names above.

Show intended HTML hierarchy, CSS selectors, and JavaScript responsibilities.

The PDF is a **specification for the new code**, not a description of the old naming conventions.

## 8. Historical first checkpoint (completed)
Before generating the PDF:

1. Produce three separate, accurately cropped images of Decks 1, 2, and 3. (distinguish between landscape and portrait)
2. Preserve the screenshot's original proportions.
3. Do not draw any outlines across neighboring decks.
4. Show the images for visual approval.
Do not modify application code.

Do not proceed to the PDF until the three deck crops have been approved.

## Functional cue-marker extension

Within `waveform-overview`, `cue-markers` is a noninteractive presentation layer;
`cue-marker` identifies each numbered cue line (`data-cue-number="1"` through
`"8"`). Existing cue-pad buttons retain their approved `data-cue="1"` through
`"8"` identities. Both pads and markers read Behavior-owned song cue positions.
The existing Shift control clears cues by hold or latch; it is not another cue store.
