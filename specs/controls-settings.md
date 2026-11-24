# Controls and Settings — Technical Specification

**Status:** Current implemented controls are documented below. Detailed extraction
and reconciliation of participation, preferences and deferred controls remain pending.

**Scope:** Direct participation, stable control IDs and validated preferences.

## Implemented song cues

`buildDeck()` owns `cuePositions`: eight source-second values or `null` (empty).
Zero is an assigned cue. The existing coordinator's `cue(number, clear=false)`
validates integer pads 1–8 and boolean clearing. With a loaded/ready song, an empty
pad snapshots Audio's current source coordinate synchronously; assigned recall
uses the same guarded `seek` batch as overview gestures. No new Audio command,
clock, play/pause toggle or cue-position store is introduced. Assignment is ignored
while another operation is pending, preventing capture of a seek's transient paused
coordinate. Assigned recalls can retarget an active seek batch; paused batches
remain paused and playing batches preserve playing intent. End targets stay paused.

Clearing only writes `null` and requests rendering, even during a pending recall;
the already-requested seek may finish, but no async cue operation can restore that
assignment. Successful replacement by a different song object clears all positions;
queue preparation and failed loads preserve current-song cues. Eject clears them
synchronously. There is no library-wide cue persistence or cross-session storage.

Visual reuses the existing Shift button/latch in the former cue-preview module.
Pointer-held and keyboard Shift are transient modifiers, not duplicate cue state.
A used hold does not latch on release. Secondary touch activation routes through
the same cue action and suppresses its possible duplicate compatibility click.
Pointer cancellation, removal and blur release held state; theme/view changes
never reset musical cues. Theme-only unloaded-pad assignment is superseded.

## Implemented stem-level controls (audio disconnected)

The four existing native range inputs edit `deck.stemLevels` through Behavior's
`setStemLevel(deck, stem, value)`. Stable keys are `beat`, `bass`, `tune`, `voice`;
each starts at 1. Behavior rejects unknown stems and non-finite/out-of-range values,
then rounds accepted 0–1 values to 0.01 steps. Visual shows 0–100 in integer 1%
steps and derives the thumb position, percentage and Glass Hardware track fill
from that same deck state on render, including after programmatic updates.
The host callback follows the existing Main pattern: update Behavior, then render.
There is no pointer-specific state or custom drag system. Settings persist across
view/theme/song changes, but are not saved across page reloads. Stem DSP, Handoff,
matching and gain authorization are not connected by these settings. Filter/EQ/
Effects knobs still lack defined current-host ranges and actions and stay disabled.

## Implemented Main Volume

The active application uses the approved `main-volume-fader` in each deck's existing header position. The slider sends 1% input changes to Behavior's `setMainVolume`; `deck.mainVolume` is the single authoritative requested value in 0–1 units, initialized to zero. Invalid values (including non-numbers, non-finite values, and values outside 0–1) are rejected without changing state or sound settings. The display shows the requested percentage.

Audio routes each deck's buffered Signalsmith source through a separate transport gate and its own Main GainNode into one shared context. Initial gain is zero. New targets ramp linearly over 15 ms, starting from the modeled current gain if another ramp is underway; zero is reached exactly. Gain changes do not restart, reload, or seek media, and do not affect another deck. Context resume is initiated in Load/Play gestures; Signalsmith preparation and scheduling are awaited under the deck operation guard. A failed start mutes that transport and uses existing error reporting. Main is retained across loading, queue swaps, pause/resume, and view changes; it is not saved across page reloads. No Handoff, stem gain, or normalization is connected by this change.

The prior full-volume preview exception is superseded. Stems have real Behavior-owned level controls but no DSP. Main's audible smoothness and Safari/iPad gesture behavior require physical listening/device verification.

## Implemented Tempo and source transport

Visual keeps `tempo-slider` in the existing header box, with no extra row. A transparent native range spans integer positions 0–1000: `ratio = 2 ** (2 * position / 1000 - 1)`. Positions 0/500/1000 mean 0.5×/1.0×/2.0×; the inverse is `(log2(ratio) + 1) * 500`. Behavior's `tempoRatio` starts at 1 and `setTempo` rejects non-finite/out-of-range values. Main and Tempo remain deck-local and survive pause/resume, queue replacement, and Library round trips. The display shows a ratio rather than inferred BPM. Pitch remains disabled except for Futuristic's Visual-only travel demo; `setAudioPitch` accepts finite semitones for later approved use, defaulting to zero. No pitch control or pitch range is introduced in Behavior/Visual yet.

Audio public commands are `buildAudio`, `loadAudio`, `startAudio`, `pauseAudio`, `seekAudio`, `setAudioTempo`, `setAudioPitch`, `setAudioMainVolume`, `ejectAudio`, and `createAudioFileURLs`. `buildAudio` returns a persistent EventTarget with read-only `currentTime`, `duration`, `paused`, `ended`, `readyState`, `src`, and `error` information; it is not an HTML media element. Visual continues receiving metadata/time/end/error events from this transport. `loadAudio`, start/pause/seek/eject and processing setters may be asynchronous. Do not invoke native media methods on the transport.

`loadAudio` resumes the shared context in the original gesture, reads the local blob URL, decodes mono/stereo PCM at the context rate, imports the pinned local Signalsmith factory, transfers copied channel arrays, and reads processing latency. No files are written or uploaded. Only a fully prepared candidate replaces the old source; metadata is committed to Behavior after success. A queued file is not decoded until READY swaps it in. Queue replacement remains synchronous, does not interrupt the active source, and retains the prototype's occupied-queue replacement and manual advancement rules; those still differ from future automatic queue rules. Async loading and seeking join the existing per-deck guard. `loadingSong` retains the in-flight file URL so another deck's cleanup cannot revoke it prematurely.

Playback schedules a source coordinate against AudioContext time with a lead-in equal to reported Signalsmith latency. Source position is computed from an anchor position/time/rate, not the worklet's read-ahead `inputTime`. Tempo gestures keep the same node and buffers: calculate the old-rate coordinate, anchor the new rate there, schedule it at the same boundary, and replace the planned completion cutoff. Processing defaults to zero semitone shift. A 4 ms transport opening ramp is separate from Main's 15 ms ramp. Natural completion includes the baseline's DSP-latency tail allowance, gates output, leaves the song loaded, and emits ended without automatically playing the queue. Time updates run every 50 ms only while playing. Hidden views do not affect transport.

Pause immediately gates output and saves the planned source coordinate before deactivating processing; it does not alter Main or Tempo. `seekAudio` validates finite source seconds, clamps to 0–duration, deactivates/gates old output, updates the bookmark, and resumes only if previously playing and before the end. At end it remains paused. The full-song overview now invokes Behavior's guarded `seek` action. One batch serializes commands and retains only its latest waiting coordinate; it preserves the batch's original playing intent even if an intermediate target reached the end. Other transport actions retain the existing pending guard. A paused requested coordinate can be stored exactly, but audible position/latency/tails are estimates, **not verified sample accuracy**.

New loads and Eject abort prior fetch/waits and invalidate stale generations/actions. Read/decode/import/node/command waits are bounded (30 s file read, 60 s decode, 20 s node preparation, otherwise 15 s). These timeouts do not cancel browser decoding; stale results are discarded, including late-created nodes. Cleanup requests inactive processing and buffer dropping, then disconnects and closes the port even if acknowledgement fails (2 s bound). Main gates and the shared context are retained per application lifetime; other decks are not closed. A processor error mutes/stops its deck, reports failure, and requires reload. Failed worklet registration may require a page reload. Disconnection is not proof of native/WASM memory reclamation; long files, repeated replacement, background suspension, and four-deck sustained CPU/memory need physical measurement.

Scheduling acknowledgements do not define playback start: the Audio clock and transport opening ramp are scheduled with the worklet command before awaiting its reply. Tempo/Pitch requests arriving during that wait operate on the active timeline. A newer transport action invalidates an unfinished seek before it can move the bookmark or resume. Delayed processing failures affect the deck only if their song generation, transport action, and processing request are still current; superseded calls still reject to their caller. Browser regressions delay real worklet replies to exercise these overlaps and measure output while Play acknowledgement remains pending.

Signalsmith AudioWorklet requires a secure context: localhost works on the Mac; an iPad accessing the Mac needs a trusted HTTPS origin. The existing server supports optional local HTTPS; see [setup](../docs/LOCAL_HTTPS.md). The user reports working iPad loading/waveforms through that setup; this is distinct from agent-performed device/listening verification. Plain HTTP on a LAN IP remains unsuitable. No insecure worklet fallback is added. Original MIT notices and vendor provenance remain unchanged.

Natural-end acknowledgement safety: successful Behavior Play completion reads the
current Audio paused state rather than assuming the song is still playing. A
short song may have ended before its Play reply arrives. Natural-end stop failures
are reported only while the node and transport action remain current; a later
paused seek also supersedes an old end reply. Real-worklet regressions delay these
acknowledgements and verify both obsolete-failure suppression and current-failure
reporting. This changes neither the source clock nor the DSP scheduling commands.

The approved product-level requirements are in [RULES.md](../RULES.md). The full pre-consolidation technical and historical record is preserved in [legacy-rules.md](legacy-rules.md). Before implementing or changing this subsystem, extract its relevant approved details from that record, distinguish superseded experiments and unresolved mechanics, and synchronize code comments and tests. Do not invent missing decisions.
