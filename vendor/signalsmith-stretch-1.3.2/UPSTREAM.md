# Signalsmith Stretch 1.3.2 provenance

Official published package: `signalsmith-stretch@1.3.2`.
Archive: https://registry.npmjs.org/signalsmith-stretch/-/signalsmith-stretch-1.3.2.tgz
Registry gitHead: `222093b4cc13ddb4d07c826bc3c1559326091731`.
Archive SHA-256: `345e774c8d5f680bc0156d788ff0f3f08d47bd307a8a262a7c0d5d887b230909`.
SignalsmithStretch.mjs SHA-256: `97530b11d5bc01015af4cde40d6aa55ff10c40aa1294ca4c8c5762027d517a46`.
The downloaded archive's SHA-512 was verified against registry integrity metadata.

The ES module is copied byte-for-byte, without wrapper or DSP edits. It contains the
WASM binary as base64 and the worklet implementation. There are no runtime CDN imports,
external WASM files, package dependencies, or build steps. README/package.json are original.
The factory's existing `moduleUrl` property points to the local module for worklet registration.

License: MIT. LICENSE.txt was obtained from the source commit above because the npm archive
omits it: https://github.com/Signalsmith-Audio/signalsmith-stretch/blob/222093b4cc13ddb4d07c826bc3c1559326091731/LICENSE.txt
Retain the notice in distributions. Signalsmith Linear is also MIT; LICENSE-Linear.txt
is included from https://github.com/Signalsmith-Audio/linear/blob/main/LICENSE.txt .
The published package does not identify its exact embedded Linear build revision; retain
this supplemental dependency notice and review build provenance before a production release.

TuneFlow changes are outside this module: experimental/signalsmith-transport.js owns UI
transport, gain gating, cancellation, completion, and context lifecycle. It does not replace
or patch any Signalsmith algorithm, source buffer handling, or message implementation.
