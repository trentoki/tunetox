# Playable 0.1 — Phase 1A manual audio verification

Open `http://192.168.50.24:8765/tests/ipad-audio-verification.html?v=phase1a-1`
from iPad Safari on the same Wi-Fi. The existing LAN server must remain running.
This fixture loads only `experimental/four-stem-player.js` plus its own UI script;
it does not initialize the main application, Design Mode, or source-separation code.

Start with low iPad speaker volume. Tap **Enable Audio / Play Test**. Expect a
four-second 440 Hz tone. **Stop** cancels playback; **Replay** starts at the beginning.
Four generated, faded PCM WAV files pass through the unchanged native mixer:
source → stem gain → deck main gain → transport → shared destination input.
Each source is 0.025 peak with stem gain 0.5; the coherent combined peak is about
0.05 (RMS 0.035), before hardware volume. Initial and ending fades affect readings.
The context is created/resumed only by a direct tap. No worklet, permissions prompt,
external music, alternate playback engine, automatic resume, or device override is used.

The page distinguishes three kinds of evidence:
- Nonzero per-stage source/gain measurements: signal exists in the graph.
- Nonzero final meter: signal reaches the destination input, not hardware loopback.
- **I heard the tone / I did not hear it**: manual physical-output report.

During playback expect `running`, an advancing clock, and nonzero stage RMS/peak.
After playback the live meters return to zero; retained positive observations and
last-nonzero snapshot remain in Diagnostics. If interrupted, return to Safari and
press Replay. Record the context state, errors, missing stages, and physical outcome.
An incomplete measurement is not automatically a silence diagnosis. Diagnostics can
be selected/copied; there is no telemetry or upload.

## Automated checks actually run

- `osascript -l JavaScript tests/run-tests.js`: 43 passing result messages; macOS
  service-connection warnings remain unrelated to assertion results.
- `python3 tests/ipad-audio-verification-check.py` against isolated headless Chrome
  debugging port 9230: generated header/fade, lazy context, actual native playback,
  all-stage signal evidence, manual-confirmation separation, Stop, Replay,
  suspended-state display/recovery, and 1194×834 horizontal fit passed.
- Existing `native-output-browser-tests.html`: final-input assertion still failed
  in the same browser session. Cause unresolved; it takes a single initial sample,
  whereas the new fixture retains repeated observations. No production correction
  was made and this difference does not establish the old failure's cause.
- LAN HTTP GET returned 200. Physical iPad Safari loading, activation, interruptions,
  and speaker audibility are pending user verification. Chrome viewport emulation
  does not emulate Safari's audio policy or hardware.

Stop here until the user confirms physical iPad audibility. No songs or UI adapter
are loaded by this fixture. The test helper reuses the existing stdlib CDP client;
no dependencies were added.
