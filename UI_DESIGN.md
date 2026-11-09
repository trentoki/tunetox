# TuneToss / TuneTox — UI Design Reference
Status: working design guidance, not a finished implementation spec. TuneTox is a provisional name; do not rename repository or code globally.

## Guiding principle
Make the product feel like a musical instrument, not a complex file manager. Keep immediate performance controls visible; reuse the Library area for contextual browsing instead of adding panels, permanent tabs, or dialogs. Preserve currently working audio engine and behavior. Implement changes incrementally, with visual reviews.

## Mixer
- Four decks are always active. On iPhone portrait show two decks side by side, with a compact control to switch A/B ↔ C/D. On iPad preserve a four-deck layout.
- Each deck has two faces that **must remain the same size when flipped**.
- Stem face: four thick horizontal glowing faders, icons only (Transients, Flow, Tune, Voice); compact header may include per-deck Beat Match, Tune Match and Handoff toggles.
- Playback face: song title, artist, optional user-assigned emoji, BPM, waveform, Play/Pause, backward seek and forward seek, Link, and Queue count. Do **not** add visible cue flag or Stop square on the phone playback face. Seek buttons move within current song, not to previous/next song.
- Compact global Tempo and Pitch sliders side by side, always accessible.
- Neon on dark, cyan/pink/blue/orange accents, minimal chrome. Avoid pushing the Library offscreen.

## Library
- iPhone: one full-width hierarchical browser, **not** separate Playlists/Songs tabs or side-by-side panes. Collection → contents → Back; persistent search, song and artist text. Library scrolls within remaining viewport.
- iPad: preserve two independently navigable Library panels, as established in earlier tablet design. Phone experiments do not replace iPad decisions.
- Direct song load, queue, and drag/drop where supported. Loading an occupied deck replaces its song and leaves it ready, not auto-playing; no confirmation or extra Swap button.
- Song row Link = **create/send outward**: select another song to link or a collection to add the song to. Navigate destinations using existing Library region; retain source song selection and provide Cancel/Back.
- Deck Link = **inspect/follow existing relationships**: show linked songs and collections containing the loaded song, using the Library region below. Back restores prior browsing context.
- Deck Queue icon (distinct from Handoff) shows a waiting-song count. Opening it also reuses Library region; no new deck expansion or permanent panel.

## Collections and Sampler
- Playlists and Sound Collections use the **same underlying collection model**. No mandatory types or enforced categories; user can create, rename, nest and customize names/emojis. One audio item can belong to multiple collections without duplicate audio.
- Sound Collections can offer defaults for material saved in the Sampler: 🥁 Beats (Transients), 🌊 Flow, 🎹 Tune, 🎤 Voice. Defaults are suggestions, never restrictions.
- Central **My Samples** view indexes all deliberately saved/extracted/recorded samples and loops from any song/deck, searchable by name, category and originating song. Preserve provenance and distinguish individual samples from performance loops.
- My Samples is quickly accessible while using the Sampler, but opens in existing Library space; do not create a permanent extra panel. Sampler pads remain primary visual focus.
- Saved material remains reusable regardless of which song is currently loaded.

## Visual and implementation safeguards
- Use icon-first controls where meaning is clear; preserve readable track titles, artists, and BPM.
- Do not invent buttons, menus, tabs, or workflows not discussed. Avoid visually similar icons for Queue and Handoff.
- Maintain responsive sizing and independent Library scrolling. Preserve existing functional audio behavior.
- Compare current implementation with this document first, identify mismatches, and propose a short UI-only implementation sequence before substantial refactoring.
- Suggested order: (1) phone Library hierarchy/search/back; (2) playback face cleanup, seek and clear Links/Queue, fixed deck dimensions; (3) contextual deck Links/Queue in Library region; (4) song Link-out workflow; (5) Sampler My Samples and collection defaults; (6) iPad refinement.
- Seek visual approval after each small step. This document is design direction, not a claim that features already exist.
