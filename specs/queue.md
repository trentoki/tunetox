# Queue — implemented development contract

Implements the one-slot Queue rules in [RULES](../RULES.md#1-decks-and-playback).
The active host remains one four-deck system using Visual, Behavior and Audio.

## Loading and occupied slots

Each persistent Behavior deck owns `song`, `queue` and temporary `loadingSong`.
Sending to an empty/paused deck uses the existing non-autoplay Load action.
Sending to a playing deck stores one queued song without changing its source,
position, cues, Main, Tempo or stem settings. As approved in the current refinement,
intentional assignments replace an occupied prepared slot while playing. Numbered
selection, numbered drops, overview drops and explicit Queue drops all invoke the
same Behavior loadQueue assignment. Paused explicit Queue assignment still returns
false/queue-full when occupied. Coordinator guards still protect an in-flight swap;
replacement never creates another playback path. Existing URL cleanup releases a
superseded prepared resource while preserving the sounding source.

Queued files are local read-only references, not predecoded second players.
Decoding/worklet preparation begins when a swap is requested. Queue metadata and
READY therefore do not certify that an audio file is decodable. No additional
deck, musical state store, input-specific action or integration layer is created.

## Manual and automatic swap

READY invokes the existing guarded Behavior `playQueue` action, including while
paused. The real natural `ended` event requests the same action if a queue exists.
Seeking exactly to the end remains paused and does not count as natural completion.
When Play/seek is still awaiting acknowledgement, the coordinator retains one
natural-end intent tied to the outgoing song and queued object. It waits for the
guard, then checks that both still match and Audio is still ended before swapping.
Errors invalidate this intent. Manual/preparing swaps suppress duplicate automatic
advancement; failures cannot become an automatic retry loop.

The per-deck guard rejects overlapping transport/load/READY actions during the
swap. Other decks continue independently. Main and stem faders retain their
existing actions; Tempo is disabled under the existing busy policy. Hidden phone
decks follow exactly the same natural-end coordination as visible decks.

`loadAudio(audio, song, { preservePlayback: true })` prepares a candidate with its
own cancellation controller while the outgoing node, clock, signal and current
controller remain live. It reuses the existing decode, validation, pinned
Signalsmith, buffers, latency and waveform calculations. Waveform analysis finishes
before the replacement boundary. An invalid candidate is disposed without muting
or replacing the outgoing source. Eject or a superseding load cancels the candidate;
late nodes cannot commit. Current-source processor errors remain reportable even
after a failed candidate attempt.

At acceptance Audio connects the prepared candidate, gates/disconnects the old
node, replaces the source metadata and resets source time to zero in one synchronous
boundary. Outgoing buffer/port cleanup is bounded and does not delay Play.
Behavior then commits the accepted song, clears cues when the song object changes and
consumes that exact queue slot before invoking the existing Play action. The deck's
Main, Tempo and stem-level object remain intact. The existing 4 ms transport gate
and 15 ms Main ramps, DSP, licenses and units are unchanged.

## Failure and verification limits

Before acceptance, failure retains the outgoing song and queued song, restores
the available controls and reports the error. Playing outgoing audio continues;
an already ended outgoing song remains ended. The failed slot is retained for an
explicit retry, not automatically cleared. Once accepted, a subsequent Play failure
leaves the replacement loaded and paused with the queue consumed; an explicit Play
can retry. There is no rollback to a discarded source or misleading READY state.

Explicit assignment now provides playing-slot replacement; the earlier occupied
rejection policy for playing decks is superseded. No new Queue removal gesture or
editor is introduced. Paused explicit Queue assignment retains its prior rule.

No gapless, beat-quantized, crossfaded or sample-accurate handoff is claimed. At
natural end the next source still needs decoding/preparation and DSP lead-in, so a
gap can occur. Browser background suspension, long-file memory/CPU, physical Safari
activation and audible transition quality remain device/listening verification.
The [Queue browser tests](../tests/queue-tests.html) use generated sources and real
worklets, including measured output during preparation; they cannot certify those
physical-device properties.
