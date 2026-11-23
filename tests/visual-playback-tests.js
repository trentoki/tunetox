import { runTouchGuardChecks } from "./touch-guard-tests.js";
const frame = document.getElementById("application");
const output = document.getElementById("results");
const run = document.getElementById("run");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function until(condition, message) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await delay(30);
  }
  throw new Error(message);
}
function tone(window, name) {
  const sampleRate = 8000, samples = sampleRate * 8;
  const bytes = new ArrayBuffer(44 + samples * 2), data = new DataView(bytes);
  const text = (at, value) => [...value].forEach((char, index) => data.setUint8(at + index, char.charCodeAt(0)));
  text(0, "RIFF"); data.setUint32(4, 36 + samples * 2, true); text(8, "WAVE");
  text(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, 1, true); data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  text(36, "data"); data.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const envelope = Math.min(1, i / 400, (samples - i) / 400);
    data.setInt16(44 + i * 2, Math.sin(i * Math.PI * 2 * 440 / sampleRate) * 1000 * envelope, true);
  }
  return new window.File([bytes], name, { type: "audio/wav" });
}
run.addEventListener("click", async () => {
  run.disabled = true;
  delete output.dataset.result;
  const lines = [];
  const pass = message => { lines.push("PASS " + message); output.textContent = lines.join("\n"); };
  let players = [];
  try {
    const source = await (await fetch("../tunetox.html")).text();
    // Observe actual native players only in the test frame, with no production diagnostics API.
    const observer = '<base href="' + new URL("../", location.href).href + '">' +
      '<script>window.__players=[];const NativeAudio=window.Audio;window.Audio=function(...args){const p=new NativeAudio(...args);window.__players.push(p);return p;};<\/script>';
    frame.srcdoc = source.replace("<head>", "<head>" + observer);
    await new Promise(resolve => frame.addEventListener("load", resolve, { once: true }));
    const doc = frame.contentDocument, win = frame.contentWindow;
    await until(() => doc.querySelectorAll(".deck").length === 4, "Four decks did not render");
    players = win.__players;
    assert(players.length === 4, "Expected four native media players");
    pass("four deck components and four native players");
    const viewport = doc.querySelector('meta[name="viewport"]').content;
    assert(viewport.includes("width=device-width") && viewport.includes("initial-scale=1"), "Responsive viewport changed");
    assert(win.getComputedStyle(doc.querySelector(".app")).touchAction === "manipulation",
      "Application must suppress double-tap zoom while permitting panning");
    assert([...doc.querySelectorAll("button, .scrolling-waveform, .waveform-overview, .search-results")]
      .every(node => win.getComputedStyle(node).touchAction === "manipulation"),
      "Controls, waveforms and Library scrollers must suppress double-tap zoom");
    assert([...doc.querySelectorAll('input[type="range"]')].every(input =>
      win.getComputedStyle(input).touchAction === "pan-y pinch-zoom"), "Fader gesture policy missing");
    assert([...doc.querySelectorAll(".search-results")].every(results =>
      win.getComputedStyle(results).overflowY === "auto"), "Library scrolling must remain enabled");
    pass("device-width viewport; double-tap zoom policy; fader gestures and Library scrolling preserved");
    pass("touch fallback: " + runTouchGuardChecks(doc));
    assert([...doc.querySelectorAll(".play-pause-button")].every(b => b.disabled), "Empty Play must be disabled");
    pass("empty decks cannot play");
    const inputs = [...doc.querySelectorAll('input[type="file"]')];
    const load = (index, name) => {
      const transfer = new win.DataTransfer();
      transfer.items.add(tone(win, name));
      inputs[index].files = transfer.files;
      inputs[index].dispatchEvent(new win.Event("change", { bubbles: true }));
    };
    const deck = number => doc.querySelector('.deck[data-deck="' + number + '"]');
    const play = number => deck(number).querySelector(".play-pause-button");
    const select = (number, section, index) => {
      const toggle = deck(number).querySelector(".performance-" + section + "-toggle");
      if (toggle.getAttribute("aria-pressed") !== String(Boolean(index))) toggle.click();
    };
    const selection = number => ["upper", "lower"].map(section =>
      deck(number).querySelector(".performance-" + section + "-toggle").textContent).join(" + ");
    const visible = (number, name) => !deck(number).querySelector("." + name).hidden;
    assert([1, 2, 3, 4].every(n => selection(n) === "Wave + Cues" &&
      !deck(n).querySelector(".performance-view").hidden), "Every deck must start in Wave + Cues");
    assert(doc.querySelectorAll(".controls .stem-faders").length === 0 &&
      doc.querySelectorAll(".stems-view .stem-faders input[data-stem]").length === 16,
      "Stems must exist only in the upper Stems views");
    assert([...doc.querySelectorAll(".stem-faders input, .cue-pad, .controls button")]
      .every(control => control.disabled), "Inactive musical controls must remain disabled");
    pass("all decks default to Wave + Cues; four stem faders per upper Stems view");
    assert(doc.querySelectorAll(".performance-header .performance-selector button").length === 8 &&
      !doc.querySelector(".performance-content button[class$='-toggle'], .performance-upper-selector, .performance-lower-selector"),
      "Expected exactly two header toggles per deck and no additional selector rows");
    pass("two compact header toggles per deck; no selectors consume content space");
    for (const number of [1, 2, 3, 4]) {
      for (const upper of [0, 1]) {
        for (const lower of [0, 1]) {
          const others = [1, 2, 3, 4].filter(n => n !== number).map(selection);
          const lowerBefore = selection(number).split(" + ")[1];
          select(number, "upper", upper);
          assert(selection(number).split(" + ")[1] === lowerBefore, "Upper selection reset the lower section");
          select(number, "lower", lower);
          assert(visible(number, upper ? "stems-view" : "wave-view") &&
            !visible(number, upper ? "wave-view" : "stems-view") &&
            visible(number, lower ? "controls" : "cues-view") &&
            !visible(number, lower ? "cues-view" : "controls"), "Incorrect section visibility");
          assert(selection(number).split(" + ")[0] === (upper ? "Stems" : "Wave"), "Lower selection reset the upper section");
          assert([1, 2, 3, 4].filter(n => n !== number).map(selection).join("|") === others.join("|"), "Another deck's selections changed");
          const beforeLibrary = selection(number);
          deck(number).querySelector(".library-button").click();
          deck(number).querySelector(".back-to-performance-button").click();
          assert(selection(number) === beforeLibrary, "Library round trip lost selections");
        }
      }
      select(number, "upper", 0);
      select(number, "lower", 0);
    }
    pass("all four combinations on every deck; independent sections/decks; Library retains each pair");
    for (let i = 0; i < 4; i++) load(i, "Generated Deck " + (i + 1) + ".wav");
    await until(() => players.every(p => p.readyState >= 2), "Generated audio did not load");
    assert(players.every(p => p.paused), "Load must not start playback");
    assert([...doc.querySelectorAll(".song-title")].some(n => n.textContent === "Generated Deck 1.wav"), "Filename missing");
    pass("all four loads succeed without autoplay; filenames rendered as text");

    for (let number = 1; number <= 4; number++) {
      play(number).click();
      await until(() => play(number).getAttribute("aria-label") === "Pause Deck " + number, "Play did not resolve for deck " + number);
    }
    await until(() => players.every(p => p.currentTime > .1), "Playback clocks did not advance");
    pass("all four native players run independently");
    play(1).click();
    await until(() => players[0].paused, "Pause failed");
    const pausedTime = players[0].currentTime;
    await delay(160);
    assert(Math.abs(players[0].currentTime - pausedTime) < .03, "Paused position drifted");
    assert(players.slice(1).every(p => !p.paused), "Pausing Deck 1 affected another deck");
    play(1).click();
    await until(() => players[0].currentTime > pausedTime + .1, "Resume failed");
    pass("Pause retains position; resume and deck independence");

    const priorSource = players[0].src;
    load(0, "First queue.wav");
    load(0, "Replacement queue.wav");
    assert(players[0].src === priorSource && !players[0].paused, "Queuing interrupted playback");
    assert(deck(1).querySelector(".queue-button").title === "Replacement queue.wav", "Prototype queue replacement changed");
    deck(1).querySelector(".queue-button").click();
    await until(() => deck(1).querySelector(".song-title").textContent === "Replacement queue.wav" && !players[0].paused, "Queue swap failed");
    pass("existing queue replacement and Play Queue behavior preserved");

    const sources = players.map(p => p.src);
    const positions = players.map(p => p.currentTime);
    let interruptions = 0;
    const interrupted = () => { interruptions++; };
    for (const player of players) {
      player.addEventListener("pause", interrupted);
      player.addEventListener("emptied", interrupted);
    }
    for (const number of [1, 2, 3, 4]) {
      for (const [upper, lower] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        select(number, "upper", upper);
        select(number, "lower", lower);
        const beforeLibrary = selection(number);
        deck(number).querySelector(".library-button").click();
        deck(number).querySelector(".back-to-performance-button").click();
        assert(selection(number) === beforeLibrary, "Playing Library round trip lost selections");
      }
    }
    await delay(160);
    assert(players.every((p, i) => p.src === sources[i] && !p.paused &&
      p.currentTime > positions[i] + .04) && interruptions === 0, "View change interrupted or reset playback");
    assert(players.length === win.__players.length, "View changes created new players");
    for (const player of players) {
      player.removeEventListener("pause", interrupted);
      player.removeEventListener("emptied", interrupted);
    }
    pass("every combination and Library round trip preserve all four playing sources, positions and players");

    play(1).click();
    await until(() => players[0].paused, "Pause before rejection failed");
    const nativePlay = players[0].play;
    players[0].play = () => Promise.reject(new Error("Intentional test rejection"));
    play(1).click();
    await until(() => doc.getElementById("playback-status").textContent.includes("Intentional test rejection"), "Playback failure not reported");
    assert(play(1).getAttribute("aria-label") === "Play Deck 1" && !play(1).disabled, "Failed Play falsely showed success");
    players[0].play = nativePlay;
    pass("rejected playback is reported and transport recovers");

    players[1].currentTime = players[1].duration - .05;
    await until(() => players[1].ended, "Natural end not observed");
    await until(() => play(2).getAttribute("aria-label") === "Play Deck 2", "End did not update UI");
    assert(deck(2).querySelector(".song-title").textContent === "Generated Deck 2.wav", "End unloaded the song");
    pass("natural end retains loaded song and resets Play display");
    const invalid = new win.DataTransfer();
    invalid.items.add(new win.File(["not audio"], "Invalid.wav", { type: "audio/wav" }));
    inputs[0].files = invalid.files;
    inputs[0].dispatchEvent(new win.Event("change", { bubbles: true }));
    await until(() => doc.getElementById("playback-status").textContent.includes("could not be played"), "Invalid media error not reported");
    assert(play(1).getAttribute("aria-label") === "Play Deck 1", "Invalid media left a playing state");
    load(0, "Recovery.wav");
    await until(() => players[0].readyState >= 2, "Valid reload after invalid media failed");
    pass("invalid audio is reported; a valid file can be reloaded");
    output.dataset.result = "pass";
    pass("all checks complete");
  } catch (error) {
    output.dataset.result = "fail";
    output.textContent = lines.join("\n") + "\nFAIL " + error.message;
  } finally {
    players.forEach(p => p.pause());
    run.disabled = false;
  }
});

