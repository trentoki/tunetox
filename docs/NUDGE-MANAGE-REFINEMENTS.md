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
