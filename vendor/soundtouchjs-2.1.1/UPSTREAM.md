# Pinned upstream

Package: @soundtouchjs/audio-worklet 2.1.1 (MPL-2.0).
Source: https://registry.npmjs.org/@soundtouchjs/audio-worklet/-/audio-worklet-2.1.1.tgz
Archive SHA-256: 360c233284a44c30f6a7a20578e48f2011c988c86b737d422bc73da37bf8a24b

`soundtouch-processor.js` is the original self-contained published bundle, including core, worklet-base, and Lanczos dependencies. No runtime external imports are required. `soundtouch-export.js` is that exact bundle followed by an export of its existing Stretch class. No DSP lines have been changed. Its original processor registration is retained but unused by the experiment. Source-map files are not needed at runtime.

TuneFlow's experimental processor uses the existing WSOLA Stretch stage directly, feeding original-speed PCM on demand instead of using a native source plus rate-compensating pitch shifter. It supplies tempo through the existing Stretch.tempo setter. This avoids introducing a resampling algorithm or replacing the stretch implementation.

The files are readable source. Keep LICENSE and copyright notices, make this covered source and modifications available when distributing, and retain this extension description. See https://www.mozilla.org/MPL/2.0/FAQ/ . No online dependency is used during playback.
