# TuneToss research code index

This index currently covers the isolated Envelope Analysis Lab. Existing application
architecture is documented in TUNEFLOW_DESIGN.md; this is not an exhaustive repository index.

| File | Responsibility |
| --- | --- |
| experimental/envelope-lab/index.html | Standalone entry and accessible controls |
| experimental/envelope-lab/lab.css | Lab-only responsive presentation |
| experimental/envelope-lab/lab.js | Local decoding, retained PCM/results, shared plot viewport and inspection |
| experimental/envelope-lab/analysis.js | Pure RMS, positive onset, timestamps and tempo mapping |
| experimental/envelope-lab/worker.js | Isolated background calculation and error delivery |
| experimental/envelope-lab/README.md | Research methods, limits, reference gap, Safari procedure |
| tests/envelope-analysis-tests.js | Pure arithmetic, resolution, timestamp and negative-case assertions |
| tests/run-envelope-tests.js | Independent macOS JXA runner and syntax checks |
| tests/envelope-analysis-tests.html | Browser test entry |
| tests/envelope-analysis-browser-tests.js | Real generated-WAV decode and worker integration fixture |

The lab has no production imports and is not linked into the production page.
