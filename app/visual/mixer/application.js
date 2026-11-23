import { buildDeck, sendToDeck, getLoadedSongs, createPlaybackCoordinator } from "../../behavior/mixer/deck.js";
import { createAudioFileURLs } from "../../audio/deck-audio.js";
import { createPlaybackDeck } from "./playback.js";
import { installTouchGuards } from "./touch-guards.js";

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
  audioFileURLs.releaseUnused(decks.flatMap(deck => [deck.song?.url, deck.queue?.url]));
}

decks.forEach((deck, index) => {
  const number = index + 1;
  const view = createPlaybackDeck(number, deck, {
    togglePlayback() {
      return playback.togglePlayback();
    },
    playQueue() {
      return playback.playQueue();
    },
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
  input.accept = "audio/*";
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
    completed() {
      announce("Deck " + number + (deck.isPlaying ? " playing." : " paused."));
    },
    failed(error) {
      announce("Deck " + number + ": playback could not start. " + error.message);
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
      announce("Deck " + number + ": this file could not be played. Try another audio file.");
    }
  });

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file || playback.isPending()) return;
    const url = audioFileURLs.create(file);
    // Preserve Clean Deck's sendToDeck decision, including occupied-queue replacement.
    sendToDeck(deck, { name: file.name, url });
    input.value = "";
    releaseUnusedURLs();
    renderAll();
    announce("Deck " + number + ": " + file.name + (deck.isPlaying ? " queued." : " loaded. Press Play."));
  });

  for (const event of ["timeupdate", "loadedmetadata", "durationchange"]) {
    deck.audio.addEventListener(event, () => view.render());
  }
});
renderAll();
