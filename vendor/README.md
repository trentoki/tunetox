# TuneTox audio libraries

**Current application:** [tunetox.html](../tunetox.html) now uses the pinned Signalsmith Stretch 1.3.2 module for buffered, pitch-preserving Tempo on all four decks. Its embedded WASM/AudioWorklet and license files are unchanged. No package installation or CDN is required. AudioWorklet needs HTTPS or localhost; four-deck Safari listening and long-file performance remain unverified. The D1 descriptions below refer to the older [legacy application](../legacy-reference/index.html), not the current entry.

**The preserved TuneTox D1 uses native Web Audio playback** in `legacy-reference/app/audio/`. Pitch-preserving tempo stretching is not a required D1 feature. In earlier TuneToss experiments, Deck 1 offered Normal Playback, SoundTouchJS, and Signalsmith Stretch for comparison; neither stretching library was the default engine.

Signalsmith is active in the current application; SoundTouchJS is retained for historical comparison. **Neither library is loaded by the preserved D1 application entry page (`legacy-reference/index.html`).** Its native audio player is in `legacy-reference/app/audio/`. Keeping a library here does not mean its sound quality, compatibility, performance, or licensing obligations have been fully evaluated for release.

## Signalsmith Stretch 1.3.2
- Purpose: tempo stretching and pitch shifting.
- Status: **active in tunetox.html**; not loaded by the preserved legacy D1 entry.
- License: MIT (see `signalsmith-stretch-1.3.2/LICENSE.txt` and `LICENSE-Linear.txt`). Commercial use is generally permitted; preserve the notices in distributed copies.
- Provenance and package details: `signalsmith-stretch-1.3.2/UPSTREAM.md` and `README.md`.

## SoundTouchJS 2.1.1
- Purpose: tempo stretching, with a potential path to tempo changes without corresponding pitch changes.
- Status: retained, **not connected to current D1 playback**.
- License: Mozilla Public License 2.0 (see `soundtouchjs-2.1.1/LICENSE`). Commercial use is permitted, subject to the license's requirements for covered source files, modifications, and distribution. Do not assume it is identical to the MIT license.
- Provenance and bundled implementation notes: `soundtouchjs-2.1.1/UPSTREAM.md` and `README.md`.

## Before using either in D1
1. Compare sound quality on vocals, drums, and full mixes at realistic tempo changes.
2. Test Safari on Mac, iPad, and iPhone, including CPU load, latency, seeking, and synchronized four-deck playback.
3. Review release packaging and required license/source notices.
4. Integrate only after a separately agreed change, without replacing the verified D1 audio engine during this repository cleanup.

The older TuneToss project and Git history retain previous experiments. This folder keeps only the pinned third-party libraries and their license/provenance information.
