import { connectGlobalNudgeControls } from '../../behavior/mixer/nudge-controls.js';
import { connectGlobalLibraryControls } from '../../behavior/library/library-global-controls.js';
import { createLibraryAnalysisQueue } from '../../behavior/library/library-analysis-queue.js';
import { createLibraryDeckLoading } from '../../behavior/library/library-deck-loading.js';
import { createLibraryManagement } from '../../behavior/library/library-management.js';
import { buildDeck, getLoadedSongs, createPlaybackCoordinator, setMainVolume, setTempo, setStemLevel } from "../../behavior/mixer/deck.js";
import { createAudioFileURLs } from "../../audio/deck-audio.js";
import { createPlaybackDeck } from "./playback.js";
import { installTouchGuards } from "../../behavior/mixer/performance-input.js";
import { connectSettings } from "../../behavior/settings.js";
import { installDeckSelector } from "../iphone/deck-selector.js";

// Visual startup: assemble existing deck behavior, audio resources, and views.
// Each component receives its existing Clean Deck state and deck-bound actions.
// UI workspace changes never replace a deck or touch its audio player.
const container = document.querySelector(".mixer-decks");
const status = document.getElementById("playback-status");
installTouchGuards(document.querySelector(".app"));
const decks = Array.from({ length: 4 }, () => buildDeck());
const views = [];
const coordinators = [];
const musicLibrary = createLibraryManagement();
musicLibrary.ready.catch(error => announce("Library storage unavailable: " + error.message));
const libraryAnalysis = createLibraryAnalysisQueue(musicLibrary);
const audioFileURLs = createAudioFileURLs();

function announce(message) {
  status.textContent = message;
}

function renderAll() {
  views.forEach(view => view.render());
}

const sendLibrarySong = createLibraryDeckLoading(musicLibrary, coordinators, audioFileURLs, releaseUnusedURLs, renderAll, announce);

// Supply current references; Audio owns URL tracking and revocation.
function releaseUnusedURLs() {
  audioFileURLs.releaseUnused(decks.flatMap(deck => [deck.song?.url, deck.queue?.url, deck.loadingSong?.url]));
}

decks.forEach((deck, index) => {
  const number = index + 1;
  const view = createPlaybackDeck(number, deck, {
    library: musicLibrary, libraryAnalysis,
    sendLibrarySong, announce,
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

  const playback = createPlaybackCoordinator(deck, {
    busyChanged(busy) {
      // Preserve the existing UI update order while Behavior owns the guard.
      if (busy) view.setBusy(true);
      if (!busy) view.setBusy(false);
    },
    completed(result) {
      view.completed(result);
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

  coordinators.push(playback);

  deck.audio.addEventListener("timeupdate", () => view.updatePlaybackTime());
  for (const event of ["loadedmetadata", "durationchange", "emptied"]) {
    deck.audio.addEventListener(event, () => view.render());
  }
});
renderAll();
connectSettings(document.querySelector(".mixer-header"), container);
connectGlobalNudgeControls(document.querySelector(".mixer-header"), decks, announce);
installDeckSelector(container);

connectGlobalLibraryControls(document.querySelector(".mixer-header"), musicLibrary, libraryAnalysis, announce);
