import { buildDeck, getLoadedSongs, createPlaybackCoordinator, setMainVolume, setTempo, setStemLevel } from "../../behavior/mixer/deck.js";
import { createAudioFileURLs } from "../../audio/deck-audio.js";
import { createPlaybackDeck } from "./playback.js";
import { installTouchGuards } from "./touch-guards.js";
import { installThemeControls } from "../themes/theme-manager.js";
import { installDeckSelector } from "../iphone/deck-selector.js";

// Visual startup: assemble existing deck behavior, audio resources, and views.
// Each component receives its existing Clean Deck state and deck-bound actions.
// UI workspace changes never replace a deck or touch its audio player.
const container = document.querySelector(".mixer-decks");
const loaders = document.getElementById("audio-loaders");
const status = document.getElementById("playback-status");
installTouchGuards(document.querySelector(".app"));
const decks = Array.from({ length: 4 }, () => buildDeck());
const views = [];
const audioFileURLs = createAudioFileURLs();

function announce(message) {
  status.textContent = message;
}

function renderAll() {
  views.forEach(view => view.render());
}

// Supply current references; Audio owns URL tracking and revocation.
function releaseUnusedURLs() {
  audioFileURLs.releaseUnused(decks.flatMap(deck => [deck.song?.url, deck.queue?.url, deck.loadingSong?.url]));
}

decks.forEach((deck, index) => {
  const number = index + 1;
  const view = createPlaybackDeck(number, deck, {
    setTempo(ratio) {
      const applied = setTempo(deck, ratio);
      view.render();
      applied.catch(error => announce("Deck " + number + ": " + error.message));
    },
    setMainVolume(value) {
      setMainVolume(deck, value);
      view.render();
    },
    setStemLevel(stem, value) {
      setStemLevel(deck, stem, value);
      view.render();
    },
    togglePlayback() {
      return playback.togglePlayback();
    },
    playQueue() {
      return playback.playQueue();
    },
    seek(seconds) { return playback.seek(seconds); },
    canSeek() { return playback.canSeek(); },
    cue(number, clear) { return playback.cue(number, clear); },
    librarySongs() {
      return getLoadedSongs(decks);
    }
  });
  views.push(view);
  container.append(view.node);

  const label = document.createElement("label");
  label.append("Load D" + number);
  const input = document.createElement("input");
  input.type = "file";
  // Do not filter the Files picker: iPadOS may gray out valid audio files for audio/*.
  // Decode validation still occurs in the audio loading layer.
  input.setAttribute("aria-label", "Load audio for Deck " + number);
  label.append(input);
  loaders.append(label);
  const playback = createPlaybackCoordinator(deck, {
    busyChanged(busy) {
      // Preserve the existing UI update order while Behavior owns the guard.
      if (busy) view.setBusy(true);
      input.disabled = busy;
      if (!busy) view.setBusy(false);
    },
    completed(result) {
      if (result?.kind === "queue-full") announce("Deck " + number + ": queue occupied by " + result.song.name + ". New file was not queued.");
      else if (result?.kind) announce("Deck " + number + ": " + result.song.name +
        (result.kind === "queued" ? " queued." : " loaded. Press Play."));
      else announce("Deck " + number + (deck.isPlaying ? " playing." : " paused."));
    },
    failed(error) {
      announce("Deck " + number + ": audio operation failed. " + error.message);
    },
    settled() {
      releaseUnusedURLs();
      renderAll();
    },
    ended() {
      renderAll();
      announce("Deck " + number + " ended. Song remains loaded.");
    },
    mediaFailed() {
      renderAll();
      announce("Deck " + number + ": this file could not be played. " + (deck.audio.error?.message || "Try another audio file."));
    }
  });

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file || playback.isPending()) return;
    const url = audioFileURLs.create(file);
    // Behavior owns loading/queue decisions, including occupied-slot protection.
    await playback.sendToDeck({ name: file.name, url });
    input.value = "";
  });

  deck.audio.addEventListener("timeupdate", () => view.updatePlaybackTime());
  for (const event of ["loadedmetadata", "durationchange"]) {
    deck.audio.addEventListener(event, () => view.render());
  }
});
renderAll();
installThemeControls(document.querySelector(".mixer-header"), container);
installDeckSelector(container);
