import { sendToDeck, playDeck, pauseDeck, playQueue, ejectSong } from "../../behavior/mixer/deck.js";

// Visual: create buttons and display the deck's current state.
export function designDeck(deck, container) {
  const title = document.createElement("h2");
  const queueTitle = document.createElement("p");
  const send = document.createElement("input");
  send.type = "file";
  send.accept = "audio/*";
  const play = document.createElement("button");
  const next = document.createElement("button");
  const eject = document.createElement("button");
  eject.textContent = "Eject";

  function updateDeckDesign() {
    title.textContent = deck.song?.name ?? "Empty deck";
    queueTitle.textContent = "Queue: " + (deck.queue?.name ?? "empty");
    play.textContent = deck.isPlaying ? "Pause" : "Play";
    play.disabled = deck.song === null;
    next.disabled = deck.queue === null;
    next.textContent = "Play Queue";
    eject.disabled = deck.isPlaying || deck.song === null;
  }

  send.addEventListener("change", () => {
    const file = send.files[0];
    if (!file) return;
    // Keep the file available to the browser's audio player.
    sendToDeck(deck, { name: file.name, url: URL.createObjectURL(file) });
    send.value = "";
    updateDeckDesign();
  });

  play.addEventListener("click", async () => {
    try {
      if (deck.isPlaying) pauseDeck(deck);
      else await playDeck(deck);
    } catch (error) {
      alert("Playback could not start: " + error.message);
    }
    updateDeckDesign();
  });

  next.addEventListener("click", async () => {
    try {
      await playQueue(deck);
    } catch (error) {
      alert("Queued playback could not start: " + error.message);
    }
    updateDeckDesign();
  });

  eject.addEventListener("click", () => {
    ejectSong(deck);
    updateDeckDesign();
  });

  deck.audio.addEventListener("ended", () => {
    deck.isPlaying = false;
    updateDeckDesign();
  });

  container.append(title, queueTitle, send, play, next, eject);
  updateDeckDesign();
}
