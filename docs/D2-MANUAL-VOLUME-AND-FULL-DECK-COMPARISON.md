# D2 manual volume and full-deck comparison

Starts from physically approved `0921da8`. Deck shades, comparison and the shared
four-second default zoom are retained. No push; physical iPad verification follows.

## Increment 1: manual Main response

Path: native range input in Visual mixer `playback.js` → existing bound callback in
Visual `application.js` → Behavior `deck.js` validates 0–1, calls Audio, records
`deck.mainVolume` → Audio `deck-audio.js` changes the existing Main GainNode.
Rendering follows the Audio call. There is no debounce, throttle, animation-frame
queue, promise or worklet message in this gain pathway. Mapping remains percent/100.

Previously Audio used a 15 ms linear Main ramp, modeling its interpolated value for
rapid retargeting. It now cancels pending Main automation and sets the requested gain
at the current context time. Obsolete ramp bookkeeping is removed; no new node,
controller or state is introduced. The separate transport gate and its 4 ms opening
ramp, source replacement and safety muting are unchanged. Human rate-limit comments
and the deferred Audio readability work are preserved.

Only production `app/audio/deck-audio.js` changes in this increment: it owns actual
gain processing and retains one existing Main GainNode per deck. Visual/Behavior
already call it directly and require no new decisions. The playback regression adds
immediate AudioParam assertions during four-deck playback, repeated rapid movements
and mute, alongside existing real post-gain signal and transport checks.

An instantaneous nonzero-sample gain change can produce clicks or zipper noise.
Removing the ramp removes intentional smoothing, not browser input delivery,
main-thread load, Web Audio render-quantum delivery, device/output buffering or
hardware latency. No end-to-end latency number is claimed. Physical Safari fader
responsiveness and listening remain required.

Increment 1 verification: Visual Playback and Queue browser suites passed, including
four-deck rapid gain commands, current-time scheduling, signal ratios, exact requested
mute and transport/source continuity. Native Chromium mouse and touch fader movements
reached Audio through the existing input pathway during four-deck playback. The first
new assertion incorrectly expected the AudioParam value getter to update synchronously;
it now inspects the actual command/timestamp and retains rendered-output measurements.
No listening or physical Safari latency claim is made. Editor diagnostics/whitespace
checks passed. No directly relevant responsibility duplication was introduced.
