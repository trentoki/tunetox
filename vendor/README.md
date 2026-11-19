# Optional audio libraries

These libraries are retained for future TuneTox audio experiments. **Neither library is currently loaded by the TuneTox D1 application entry page (`index.html`).** The working D1 audio player is in `app/audio/`. Keeping a library here does not mean its sound quality, compatibility, performance, or licensing obligations have been fully evaluated for release.

## Signalsmith Stretch 1.3.2
- Purpose: tempo stretching and pitch shifting.
- Status: retained, **not connected to current D1 playback**.
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
