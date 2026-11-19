# TuneTox D1

**Start here.** TuneTox D1 is a four-deck DJ application designed for playing and mixing music using separate sound parts (stems). This repository contains the application source code and its development documents.

**Current status:** Working development build, **not yet a fully verified release**. Some features are incomplete or experimental. We will test each required feature before calling D1 ready for handoff.

## 1. Get the application onto your computer

1. Ask the project owner for access to this private GitHub repository.
2. Open the repository in your web browser.
3. Select the branch **`docs/tunetox-d1-handoff`** from the branch selector. This is the current handoff-preparation branch, not the final release.
4. Click the green **Code** button, then **Download ZIP**.
5. Find the downloaded ZIP file and extract/unzip it.
6. Open the extracted folder. This is the **TuneTox project folder**. Keep it open for the next steps.

You do **not** need a Netlify account, hosting credits, a code editor, or a Git installation just to try the application.

## 2. Start TuneTox on Mac

You need **Python 3** installed. To check, open **Terminal** (Applications → Utilities → Terminal) and enter:
```sh
python3 --version
```
If you see a Python 3 version number, continue. If the command is not found, install Python 3 from [python.org](https://www.python.org/downloads/) and retry the check.

To avoid typing a complicated folder location:

1. In Terminal, type `cd ` (the letters c and d followed by a space), **but do not press Return yet**.
2. Drag the extracted TuneTox project folder from Finder into the Terminal window. Its location should appear after `cd `.
3. Press **Return**.
4. Copy and paste this command, then press Return:
```sh
python3 -m http.server 8000
```
5. Keep Terminal open. In a browser on **that same computer**, open:

**http://localhost:8000/development/integration/h531-approved-live.html**

To stop the local server, return to Terminal and press **Control+C**.

## 3. Start TuneTox on Windows

You need **Python 3** installed. To check, open **PowerShell** (search for PowerShell in the Start menu) and enter:
```powershell
py --version
```
If you see a Python 3 version number, continue. If the command is not recognized, install Python 3 from [python.org](https://www.python.org/downloads/) and retry. Some installations use `python` instead of `py`.

1. Open the extracted TuneTox project folder in **File Explorer**.
2. Click the folder's **address bar**, type `powershell`, and press **Enter**. PowerShell should open in that folder.
3. Copy and paste the command below, then press Enter:
```powershell
py -m http.server 8000
```
4. Keep PowerShell open. In a browser on **that same computer**, open:

**http://localhost:8000/development/integration/h531-approved-live.html**

To stop the server, press **Control+C** in PowerShell.

If the command fails, **do not assume the app is broken**. Record the exact error message; we will diagnose it before proceeding.

## 4. What you should see

The approved TuneTox development interface should appear, with four decks and mixer controls. This confirms **only that the interface loaded**, not that playback, stems, Handoff, or every control works.

**Important:** Opening the repository-root `index.html` shows an older interface. It is **not** the D1 entry page. The long address above is a temporary technical path; we intend to simplify it after safely verifying the dependencies.

## 5. Check the audio separately

To test audio, you need suitable sound files. The development page provides a file-loading dialog for deck stems (Transients, Flow, Tune, Voice). Availability of test audio files is **not guaranteed** by the repository. Do not mark playback as passed until audible output and relevant controls have been tested.

## 6. If something does not work

Record: your computer (Mac or Windows), browser, the step number, what happened, what you expected, and any error message. Do not skip a failing step and mark it successful.

## 7. For the developer

The current repository has historical and experimental code alongside the working integration. **Do not assume its existing folders match a proposed clean architecture.** The verified live entry point is `development/integration/h531-approved-live.html`; its integration script is `development/integration/h531-approved-live-app.js`.

Read these before substantial changes:
- `AGENTS.md` — development safeguards.
- `RULES.md` — approved behavior and labelled historical rules.
- `TUNEFLOW_DESIGN.md` — design, architecture context, and unresolved questions.
- `DEVELOPER_GUIDE.md` — technical setup and current limitations.

The preserved working reference is `baseline/h531-direct-06-working`. Labels such as H5.3.1, G2, and DIRECT 06 are **historical internal identifiers**, not separate applications. The project is **TuneTox D1**.

**Development rule:** Map dependencies before reorganizing files; change one subsystem at a time; avoid duplicate implementations; verify the real application after each change; preserve the working baseline.

## 8. Verification status

| Check | Status |
| --- | --- |
| Approved interface opened on Mac | Previously reported working; fresh-download test pending |
| Approved interface opened on iPhone | Previously reported working; not a fresh-install test |
| Fresh ZIP download and local Mac launch | Not yet verified |
| Fresh ZIP download and local Windows launch | Not yet verified |
| Windows audio and controls | Not yet verified |
| Full audio, Handoff, and UI regression checklist | Not yet completed |

**Do not treat an unverified check as passed.** We will update this table only with actual test evidence.
