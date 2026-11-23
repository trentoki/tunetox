import { buildDeck, sendToDeck, playDeck, pauseDeck, playQueue } from "../behavior/mixer/deck.js";
import { createPlaybackDeck } from "../visual/mixer/playback.js";
import { installTouchGuards } from "../visual/mixer/touch-guards.js";

// New host only: the original entry points, behavior and audio modules are unchanged.
// Each component receives its existing Clean Deck state and deck-bound actions.
// UI workspace changes never replace a deck or touch its audio player.
const container = document.querySelector(".mixer-decks");
const loaders = document.getElementById("audio-loaders");
const status = document.getElementById("playback-status");
installTouchGuards(document.querySelector(".app"));
const decks = Array.from({ length: 4 }, () => buildDeck());
const views = [];
const pending = new Set();
const fileInputs = [];
const objectURLs = new Set();

function announce(message) {
  status.textContent = message;
}

function renderAll() {
  views.forEach(view => view.render());
}

// Revoke only URLs no longer used by either an active or queued song.
// Never alter the original files, and never revoke an active player's source.
function releaseUnusedURLs() {
  const retained = new Set(decks.flatMap(deck => [deck.song?.url, deck.queue?.url]));
  for (const url of objectURLs) {
    if (!retained.has(url)) {
      URL.revokeObjectURL(url);
      objectURLs.delete(url);
    }
  }
}

async function runPlayback(index, operation) {
  if (pending.has(index)) return;
  pending.add(index);
  views[index].setBusy(true);
  fileInputs[index].disabled = true;
  try {
    await operation();
    announce("Deck " + (index + 1) + (decks[index].isPlaying ? " playing." : " paused."));
  } catch (error) {
    announce("Deck " + (index + 1) + ": playback could not start. " + error.message);
  } finally {
    pending.delete(index);
    fileInputs[index].disabled = false;
    views[index].setBusy(false);
    releaseUnusedURLs();
    renderAll();
  }
}

decks.forEach((deck, index) => {
  const number = index + 1;
  const view = createPlaybackDeck(number, deck, {
    togglePlayback() {
      return runPlayback(index, () => deck.isPlaying ? pauseDeck(deck) : playDeck(deck));
    },
    playQueue() {
      return runPlayback(index, () => playQueue(deck));
    },
    librarySongs() {
      return decks.filter(item => item.song).map(item => item.song);
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
  fileInputs.push(input);

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file || pending.has(index)) return;
    const url = URL.createObjectURL(file);
    objectURLs.add(url);
    // Preserve Clean Deck's sendToDeck decision, including occupied-queue replacement.
    sendToDeck(deck, { name: file.name, url });
    input.value = "";
    releaseUnusedURLs();
    renderAll();
    announce("Deck " + number + ": " + file.name + (deck.isPlaying ? " queued." : " loaded. Press Play."));
  });

  // Reflect browser transport events and natural end, including a failed media load.
  // Clean Deck leaves an ended song loaded and does not automatically advance its queue.
  deck.audio.addEventListener("ended", () => {
    deck.isPlaying = false;
    renderAll();
    announce("Deck " + number + " ended. Song remains loaded.");
  });
  deck.audio.addEventListener("error", () => {
    deck.isPlaying = false;
    renderAll();
    announce("Deck " + number + ": this file could not be played. Try another audio file.");
  });
  for (const event of ["timeupdate", "loadedmetadata", "durationchange"]) {
    deck.audio.addEventListener(event, () => view.render());
  }
});
renderAll();

