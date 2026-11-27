# Nudge, Tempo reset and Manage refinement

Starts from physically accepted checkpoint 2e8cf54. Prior research files remain
untouched and outside these commits. No BPM mathematics or unrelated effects change.

## Increment 1 — manual nudge, Tempo reset and relevant gesture ownership

New Behavior mixer modules: nudging (effective-rate decisions using canonical deck
fields), nudge-controls (hold/drag/key/cancel interpretation), tempo-controls (existing
logarithmic mapping and double reset), waveform-seeking (extracted existing pointer/
keyboard seeking and preview), vertical-roller (extracted existing theme gesture).
New Visual waveform/nudge-controls owns placement and rendering only. Existing Visual
mixer playback supplies DOM and render callbacks; extracted gesture state is no longer
owned there. CSS overlays only the requested controls, leaving seekable gaps.

Behavior deck adds session-local percentage/direction and restores nudge around
transport operations. Audio deck-audio adds validated effective-rate access to the
same continuous schedule function/node, retaining existing established-tempo API
bounds. Data flow: input -> Behavior -> existing Audio scheduling; authoritative
Audio time/Behavior state -> Visual. No alternate playback path or duplicate clock.
See [technical specification](../specs/nudging.md) for units, boundaries, defaults,
request/acknowledgement semantics and cancellation/failure behavior.

New nudge browser tests use disposable storage and generated tones; they verify
measured effective speed/pitch, source continuity, controls, restoration and node/
source independence. Existing playback and Queue suites passed. Editor diagnostics
reported no errors. Physical Safari listening/touch remains a human check.

## Increment 2 — Manage disclosure and simultaneous input

Manage starts with All Songs collapsed. Search opens it to expose matches; it can
still be collapsed manually. Each playlist has a separate membership checkbox and
expand button; multiple nested branches stay open. Songs in those branches use the
same canonical link IDs as All Songs, so editing any occurrence updates every one.
Managed-song self-links remain excluded. Existing 100-row paging is reused.

| Production file | Responsibility, owned information and direct connections |
| --- | --- |
| `app/behavior/library/song-management.js` | Owns per-deck Manage expansion, search interpretation, paging and actions. Reads canonical songs, memberships and links from library management; calls existing tree derivation and sends rows to Visual. No metadata cache or playback state. |
| `app/visual/library/song-management-view.js` | Builds All Songs, playlist disclosure/membership and repeated song-link presentation from supplied rows/IDs. Exposes DOM controls to Behavior; owns no relationship or expansion decisions. |
| `app/visual/library/library.css` | Styles separate checkbox/disclosure hit areas within the existing Manage body. No navigation decisions. |
| `app/behavior/mixer/nudge-controls.js` | Pointer holds survive another deck taking focus; only keyboard holds cancel on control blur. Window/capture cancellation remains. Visibility observation ignores unrelated per-frame DOM changes. |

Updated Library interface tests cover collapsed/open All Songs, search, independent
membership/disclosure, several expanded levels and consistent links in three song
occurrences. Updated nudge tests cover simultaneous deck touches. No storage schema,
BPM detector, relationship representation or playback pathway changes.

## Production ownership review for increment 1

| File | Why it belongs here, owned information and connections |
| --- | --- |
| `app/behavior/mixer/nudging.js` | Validates/sets canonical deck nudge fields, derives effective rate, calls Audio directly. No independent tempo/clock. |
| `app/behavior/mixer/nudge-controls.js` | Interprets hold/percentage gestures and cancellation; owns transient pointer/key records, calls nudging, supplies state to Visual controls. |
| `app/behavior/mixer/tempo-controls.js` | Interprets existing logarithmic slider and double-reset gestures, calls existing host tempo action. Owns only tap recognition. |
| `app/behavior/mixer/vertical-roller.js` | Owns existing theme roller drag interpretation, updates existing inputs; no musical state. Extracted without redesign. |
| `app/behavior/mixer/waveform-seeking.js` | Owns existing absolute/relative seek gestures and temporary preview, calls existing seek action; reads authoritative Audio time. |
| `app/behavior/mixer/deck.js` | Existing canonical deck and transport coordinator; adds nudge fields and cancellation around operations, delegates effective rate to nudging. |
| `app/audio/deck-audio.js` | Processes validated effective rates on the existing Signalsmith node and authoritative time reference; no gesture decisions. |
| `app/visual/waveform/nudge-controls.js` | Creates/displays three controls; receives percent/direction/enabled state. No input listeners or musical decisions. |
| `app/visual/mixer/playback.js` | Existing deck composition/rendering; directly connects Behavior gestures and Visual controls, displays authoritative state. Removes the relevant seek/roller gesture ownership. |
| `app/visual/mixer/playback.css` | Places controls over the existing waveform, preserving underlying layout and seekable gaps. |

No new adapters, synchronization stores, duplicated cue/relationship data or playback
clocks were introduced. Existing unrelated workspace-toggle and cue-input handling
still lives in Visual playback; it was not rewritten in this focused task. This is
a remaining responsibility-boundary concern, not a new architecture to copy.

Physical Safari touch/listening remains required, especially extreme-rate sound
quality, cancellations when leaving Safari, and the chosen 2% default/4-pixel steps.

## Verification completed

Automated browser suites passed: nudging, Library storage, Library interface,
Library analysis, Queue, Visual playback, iPhone layout and Glass Hardware.
Measured tones confirm pitch retention while effective rates change; these are
signal checks, not listening approval. The simultaneous-rate test waits for the
existing resume gate to open before measuring, so startup lead-in is not mistaken
for a nudge speed change. Native Chromium input checks passed percentage touch
dragging, concurrent two-deck touch holds/cancel, captured mouse release, and Tempo
mouse double-click/touch double-tap. Editor diagnostics and whitespace checks passed.
Both existing detached HTTP/HTTPS servers respond successfully. V40 code/math and
library storage schemas are unchanged; no personal library data is included.
Native layout checks also passed Manage fixed Back/exact Library scroll restoration
and nudge-control bounds/no horizontal overflow at 1114×768, 768×1024 and 390×844
in Default, Glass Hardware and Futuristic themes.
