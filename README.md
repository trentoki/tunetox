# TuneTox D1

TuneTox is a four-deck DJ application for playing and mixing music using separate sound parts called **stems**. This is the shared application for everyone on the team.

**Status:** D1 is being prepared and tested. The interface and audio have worked in earlier Mac/iPhone tests, but this cleaned entry point and a fresh download have **not yet been tested**. Do not assume every control is functional.

## Open TuneTox

First, obtain access to this private GitHub repository. On its main page, choose **Code → Download ZIP**, then unzip the downloaded file.

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

If port 8000 is already in use, stop the other local server first. Stop TuneTox's server with **Control+C** in Terminal or PowerShell.

## What you should see

A TuneTox D1 interface with four decks and mixing controls. Seeing the interface **does not yet verify audio playback**.

The **Audio files** control loads your own stem files (Transients, Flow, Tune, Voice). Prepare the main volume and stem levels before playback. Test audio files are not guaranteed to be included in the download.

If something fails, note the step, operating system, browser, expected result, actual result, and any error message.

## For developers

This is **one application**, not separate interface and audio products. Its root `index.html` is the intended entry page. The interface currently loads existing modules from `development/`, `experimental/`, and root files; those locations are **not yet the final proposed folder organization**. Do not move or delete them without mapping dependencies and testing.

Before making significant changes, read `AGENTS.md` (workflow and safeguards), `RULES.md` (approved behavior), and `TUNEFLOW_DESIGN.md` (design context). These documents contain historical terminology; treat that as background rather than separate D1 applications.

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
