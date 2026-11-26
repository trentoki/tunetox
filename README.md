# TuneTox

## Current application

Open [tunetox.html](tunetox.html) through the repository's local server:

```sh
node tests/serve-visual-playback.cjs
```

Visit http://127.0.0.1:8080/tunetox.html. The server accepts loopback/private IPv4 clients for local-network testing. See [Clean Playback usage and limitations](docs/CLEAN_PLAYBACK.md) for the current Mac runtime command and device-verification limits.

The active application has four decks with Load, Play/Pause/resume, protected one-slot queues with READY and automatic natural-end advancement, pitch-preserving Tempo (0.5×–2.0×, centered at 1.0×), independent Main Volume, full-song waveform seeking, and eight functional cue pads per loaded deck. Numbered cues appear on the real audio-derived overview. The scrolling waveform uses the same decoded summary beneath a centered stationary playhead; drag right to move backward and left to move forward, committing the seek on release. Stem faders edit Behavior-owned levels but have no stem audio connection. Musical Pitch, EQ and effects remain inactive; Futuristic's Pitch Demo is Visual-only. All Main faders start at 0%: raise a deck's Main after pressing Play to hear it. Visual, Behavior, and Audio live in `app/visual/`, `app/behavior/`, and `app/audio/`. AudioWorklet requires localhost on this Mac or trusted HTTPS for iPad/iPhone; plain-HTTP LAN audio cannot run Signalsmith. Run [playback regression checks](tests/visual-playback-tests.html) and [Queue checks](tests/queue-tests.html) through the same server. See [Queue behavior and limitations](specs/queue.md) and [HTTPS setup](docs/LOCAL_HTTPS.md). Natural-end swaps still need preparation time; gapless playback and physical Safari transition quality are not verified.

## Preserved legacy references

See the [24 November codebase audit and proposed branch preservation plan](docs/CODEBASE-AUDIT-2026-11-24.md) for confirmed follow-up issues, cleanup scope and verification results.

- [Older D1 application](legacy-reference/index.html)
- [Clean Deck prototype](legacy-reference/development/clean-deck.html), sharing active Behavior and Audio modules rather than copies
- Legacy [core tests](legacy-reference/tests/core-tests.html), [startup/routing checks](legacy-reference/tests/browser-smoke-tests.html), and [native output checks](legacy-reference/tests/native-output-browser-tests.html)
- [Historical D1 application map](legacy-reference/docs/D1_APPLICATION_MAP.md)

The following introduction and instructions are preserved historical D1 material. Their root-page paths, feature status, and device descriptions are not instructions for the current application; use the links above. Historical source remains recoverable in Git.

## Historical TuneTox D1 README

TuneTox is a four-deck music performance and mixing application.

TuneTox features **Handoff**, which allows DJs to easily control stems from multiple songs. Each song contains four stems: the beat (typically drums), the bass, the tune (typically chords and background instruments), and the voice (a vocal or lead instrument).

With Handoff enabled, raising the volume of a stem on one deck automatically lowers the corresponding stem volumes on other participating decks as needed. DJs can use this feature to effortlessly blend the beat, bass, tune, and voice of up to four decks without worrying about their stems overlapping in volume. The available volume for each stem type is shared among Handoff-enabled decks.

Each deck has three main views: **Controls, Waveform/Cue, and Library**. This simplifies navigation and performance. Opening the library on one deck doesn't block the other decks. Changing a stem level, loading a song, or scrubbing through a song's waveform is always just a click away.

Songs sent to a deck that's already loaded and playing are stored in that deck's queue, meaning four songs can be playing while another four are queued. No more frantically searching for a song at the last second or accidentally ending a song that's already playing!

TuneTox's planned **Song Sampler** will allow DJs to perform using samples from currently playing songs. DJs will be able to take over any stem and play their own beats, basslines, tunes, or lead melodies using samples from those songs.

TuneTox is also designed to include standard DJ features such as beatmatching, tempo adjustment, and pitch shifting. It will also feature **Tune Matching**, which automatically adjusts a song's pitch to align its musical key with other tune-matched songs.

**Development status:** This introduction describes TuneTox's intended features. Not all are functional in the current D1 build. The verification checklist below distinguishes work still to be tested.

## Open TuneTox

### Download TuneTox

Open the TuneTox GitHub page using the link provided.

Click the green **Code** button, select **Download ZIP**, and extract the downloaded folder.

The downloaded folder contains the complete TuneTox application. You don't need to install a code editor.

### Mac

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Type `python3 --version` and press Return. If Python 3 is missing, install it from https://www.python.org/downloads/ and retry.
3. Type `cd ` (including the space), then drag the unzipped TuneTox folder into Terminal and press Return.
4. Paste `python3 -m http.server 8000` and press Return.
5. Keep Terminal open. In your browser, visit **http://localhost:8000**.

### Windows

1. Open the unzipped TuneTox folder in File Explorer.
2. Click its address bar, type `powershell`, and press Enter.
3. Type `py --version` and press Enter. If Python 3 is missing, install it from https://www.python.org/downloads/ and retry.
4. Paste `py -m http.server 8000` and press Enter.
5. Keep PowerShell open. In your browser, visit **http://localhost:8000**.

**Stopping TuneTox:** To stop the application, return to Terminal (Mac) or PowerShell (Windows) and press **Control+C**. You can then close the window.

**Troubleshooting:** If port 8000 is already in use, stop the other local server before starting TuneTox.

## What you should see

TuneTox D1 uses a four-deck interface. Its layout adapts to different screen sizes.

### Mac and Windows

The interface displays four decks side by side. Each deck provides access to its waveform and cue controls, mixing controls, and library.

### iPad

The interface adapts to the iPad's screen size and orientation. In landscape, the four-deck layout is available. In portrait, the layout adjusts to fit the narrower screen.

### iPhone

In portrait orientation, TuneTox displays **one selected deck at a time**, with buttons to switch between Decks 1–4.

The selected deck provides access to its waveform and cue controls, mixing controls, and library. A **Transition** view also provides controls for working with two decks together.

All four decks remain part of the application even when only one is displayed.

**iPhone landscape orientation has not been created yet.**

### Audio and testing

Seeing the interface **does not yet verify audio playback**.

Use the **Audio files** button at the top of the application to load your own stem files (Transients, Flow, Tune, Voice). Raise Main and the appropriate stem levels before pressing Play.

Test audio files are not guaranteed to be included in the download.

If something fails, note the device, operating system, browser, expected result, actual result, and any error message.

## For developers

This is **one application**, not separate interface and audio products. Its root `index.html` is the intended entry page. The interface currently loads existing modules from `development/`, `experimental/`, and root files; those locations are **not yet the final proposed folder organization**. Do not move or delete them without mapping dependencies and testing.

Before making significant changes, read `AGENTS.md` (workflow and safeguards), `RULES.md` (approved behavior), and `TUNETOX_PLAN.md` (roadmap and design context). These documents contain historical terminology; treat that as background rather than separate D1 applications.

**Rules:** Keep one clear application entry point, avoid duplicated musical logic, make small reversible changes, test real playback and Handoff, and preserve the protected working baseline.

## Verification checklist

- [ ] Fresh ZIP download opens at http://localhost:8000 on Mac.
- [ ] Fresh ZIP download opens at http://localhost:8000 on Windows.
- [ ] All required scripts and styles load without browser errors.
- [ ] Real stem files load and produce audible output.
- [ ] Four-deck playback and stem controls behave correctly.
- [ ] Handoff behavior matches the approved rules.
- [ ] Responsive interface works on required devices.
- [ ] A clean developer can follow these instructions unaided.

**Unchecked means unverified, not failed or passed.**
