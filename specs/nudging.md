# Manual nudging and Tempo reset

## Approved behavior and units

Each persistent Behavior deck retains its established tempoRatio (0.5–2) and
temporary nudgeDirection (-1, 0, +1). One Behavior-owned session-local nudgePercent
(2–50, default 2) is shared by all decks. Effective
Audio rate = tempoRatio × (1 + direction × percent / 100). Thus 50% means half or
one-and-a-half of established speed. The effective range is .25–3; the established
Tempo control's range remains .5–2. Nudge never overwrites established Tempo.
Changing Tempo during a hold changes the base immediately; release restores that
latest base, not a saved anchor. The elapsed phase adjustment remains: no seek or
position rewind occurs on release. Pitch/semitones remain unchanged.

The backward/forward hold buttons occupy the scrolling waveform's lower corners;
the single percentage control is beside global Waveform Zoom. Direction buttons
are more translucent. All nudge controls are excluded from pointer and
keyboard waveform seeking, including paused/disabled directional controls. Gaps and
other waveform areas retain existing dragging. Only loaded, playing, ready decks
can start a directional hold; percentage remains adjustable while paused/empty.

## Responsibilities and interfaces

- Behavior mixer/nudging owns validated percentage/direction changes and computes
  effective rate from the same existing deck object; no second clock/store.
- Behavior nudge-controls interprets pointer and keyboard holds, percentage drags
  and cancellation. Visual waveform/nudge-controls creates/renders directional pairs and one global amount.
  Global amount changes directly reapply the existing rate to currently held decks;
  there are no synchronized per-deck percentage copies.
- Audio setAudioPlaybackRate validates .25–3 and calls the existing
  changeTempoOrPitch scheduling function on the same Signalsmith node, transport
  gates and source-time reference. Legacy setAudioTempo retains its .5–2 contract.
- Behavior waveform-seeking now owns the existing absolute-overview and grabbed-
  scrolling gesture/preview code. Visual reads its transient position and draws
  both waveforms/cues; Audio remains the only advancing clock.
- Behavior vertical-roller retains the existing Futuristic drag behavior. Behavior
  tempo-controls owns the existing logarithmic input mapping and reset gestures.

Requested Behavior settings update immediately; Audio reanchors source position at
its old-rate/new-rate scheduling boundary and preserves semitones. Its DSP reply is
an acknowledgement, not a second committed tempo. Existing latest-request guards
prevent obsolete failures from affecting a newer action. Current Audio failures
retain existing stop/report behavior; nudging does not auto-resume failed playback.

## Cancellation and interaction decisions

One hold per deck; additional overlapping holds on that deck are ignored. Different
decks accept simultaneous touches. Pointer release/cancel/lost capture, key release,
keyboard-control blur, window blur/resize, hidden document/control/deck, view/theme change,
source replacement and transport operations restore established tempo. Coordinator
operations restore before proceeding; pause/load/seek/eject public actions also
cancel an active nudge. Natural end/error clears the temporary direction. No extra
player or decoding is used for a nudge.

Implementation choices available for human refinement: initial nudge is the minimum
2%, percentage uses 1-point steps and four vertical CSS pixels per percentage point.
Up increases/down decreases; dragging saturates at 2/50. Keyboard arrows change one
point; Home/End select the limits. Space/Enter hold directional buttons.

Mouse double-click resets Tempo to 1.0. Touch reset requires two stationary primary
taps within 350 ms/24 px; each lasts at most 300 ms and moves at most 10 px. Dragged,
cancelled and multifinger gestures do not reset. Single/native range and Futuristic
roller interactions remain. Duplicate touch-generated double-click is suppressed.

## Verification limits

Real Chromium tests measure .25/.5/1.5/3 rates and a 220 Hz tone's preserved pitch,
continuous source position, current-base restoration, cancelled holds, pointer/key
operation, seek isolation and retained four-deck nodes/sources. Existing regression
suites cover waveform dragging, cues, queues and Tempo/Pitch races. Signal tests do
not certify audible clicks, extreme-rate quality or physical Safari touch feel.
Physical Safari listening and input review remain necessary.
