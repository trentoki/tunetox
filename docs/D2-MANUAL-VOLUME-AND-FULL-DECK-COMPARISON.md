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


## Increment 2: full-deck comparison

Manual Main checkpoint: `4b3face`. This second increment has no Audio or Behavior
code changes. It extends the approved comparison presentation in place, retaining
its landscape Vertical scope, three-pixel activation threshold, participation,
original pointer anchor/capture and owner-only seek pathway.

Production files and responsibilities:

- Visual `app/visual/waveform/expanded-comparison.js`: measures the existing deck,
  preserves original axis/cross-axis lengths, positions the same surface across the
  deck interior and derives the playhead offset from its original screen Y. It owns
  only transient DOM geometry and prior styles/inert flags. Header and lower controls
  become inert; restoration reinstates their exact prior flags and normal styles.
- Visual `app/visual/mixer/playback.js`: passes existing deck/header references to
  that presentation instead of the former lower-content reference. Its established
  Behavior registration and lifecycle remain unchanged.
- Visual `app/visual/mixer/playback.css`: makes the participating deck the temporary
  containing block, removes inner clipping, hides header/overview/lower controls,
  time and nudges, and restores normal presentation by removal of the existing class.
  The layout remains allocated; nothing is reparented or recreated.
- Visual `app/visual/waveform/scrolling-waveform.js`: keeps original amplitude scale
  while the canvas additionally covers deck padding. Existing shared geometry/cue
  rendering uses the larger visible area and adjusted playhead offset to reveal
  earlier/later source data, without stretching or repeating analysis.

Data flow remains Behavior drag lifecycle/participation → existing Visual expansion
→ existing renderer and cue presentation reading one zoom, the original source
measurements and authoritative positions/seek preview. Release/cancellation restores
all interface elements through the same existing lifecycle. Source-clock, navigation,
cue, Queue and playback state are not copied. Stems/Library are not participants.
No new production files, controllers, adapters or synchronization mechanisms exist.

Architecture/readability review: temporary DOM flags/geometry belong to presentation;
interaction decisions remain in the existing Behavior files. No responsibilities
were added to Audio in increment 2. Related measurements/restoration are together
in the existing small presentation module. No broader Audio readability work or
unrelated reorganization was undertaken.

Increment 2 verification: all eleven current browser regression suites passed
(comparison, zoom, orientation, iPhone, nudging, Library interface, Library storage,
Library analysis, Queue, Visual Playback and Glass Hardware). Comparison checks
cover full interior bounds, hidden/inert header and overview controls, earlier/later
cue continuation, original screen playhead and scale at 1/4/8 seconds, retained DOM
identity, passive playback, Stems/Library exclusions and exact restoration through
release/cancellation/theme/navigation/resize/zoom. Browser-delivered native Chromium
mouse and touch checks passed in all three themes for full-deck geometry, continuous
capture, seek distance, release and touch cancellation. Expanded screenshot inspected.
Editor diagnostics and whitespace checks passed. No unresolved automated failures.

Physical iPad Safari must still verify the full-deck presentation, capture/restoration,
manual fader feel and audible clicking risk. Tests use generated audio and measured
signals; they do not establish audible performance or real-device latency. Servers
respond locally and over the existing LAN HTTPS address. Personal library/research,
exports, certificates and temporary test tooling are excluded from these checkpoints.
