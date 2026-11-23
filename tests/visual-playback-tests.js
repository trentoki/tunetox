import { runTouchGuardChecks } from "./touch-guard-tests.js";
import { buildDeck, getLoadedSongs, createPlaybackCoordinator, setMainVolume, sendToDeck, setTempo } from "../app/behavior/mixer/deck.js";
import { createAudioFileURLs, loadAudio, pauseAudio, ejectAudio } from "../app/audio/deck-audio.js";
const frame = document.getElementById("application");
const output = document.getElementById("results");
const run = document.getElementById("run");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
function checkMainVolumeState() {
  const first = buildDeck(), second = buildDeck();
  assert(first.mainVolume === 0 && second.mainVolume === 0, "Main must initialize at zero");
  for (const value of [0, .5, 1, .99, .1, .6]) setMainVolume(first, value);
  assert(first.mainVolume === .6 && second.mainVolume === 0, "Main state is not deck-local");
  for (const invalid of [NaN, Infinity, -Infinity, -.01, 1.01, "0.5", null, undefined]) {
    let rejected = false;
    try { setMainVolume(first, invalid); } catch (error) { rejected = error instanceof RangeError; }
    assert(rejected && first.mainVolume === .6 && second.mainVolume === 0,
      "Invalid Main value changed state or was not rejected");
  }
  setMainVolume(first, 0);
  assert(first.tempoRatio === 1 && second.tempoRatio === 1, "Tempo must start at unity");
  for (const value of [NaN, Infinity, 0, .49, 2.01, "1", null]) {
    let rejected = false;
    try { setTempo(first, value); } catch (error) { rejected = error instanceof RangeError; }
    assert(rejected && first.tempoRatio === 1, "Invalid tempo changed state");
  }
}

async function checkCancelledLoading() {
  const player = buildDeck().audio, originalFetch = window.fetch;
  let finishRead, entered = false;
  window.fetch = (url, options) => {
    if (url === "held-test-file") {
      entered = true;
      return new Promise(resolve => { finishRead = resolve; });
    }
    return originalFetch(url, options);
  };
  let url;
  try {
    const loading = loadAudio(player, { url: "held-test-file" }).catch(error => error);
    await until(() => entered, "Held file read never started");
    await ejectAudio(player);
    const error = await loading;
    assert(error.name === "AbortError" && player.duration === 0 && player.paused,
      "Eject did not cancel an in-flight load");
    const file = tone(window, "Late.wav");
    finishRead(new Response(await file.arrayBuffer()));
    url = URL.createObjectURL(file);
    await loadAudio(player, { url });
    assert(player.src === url && player.readyState === 2 && player.currentTime === 0,
      "Stale load overwrote its replacement");
  } finally {
    window.fetch = originalFetch;
    await ejectAudio(player);
    if (url) URL.revokeObjectURL(url);
  }
}
// Delay replies, not worklet execution: exercise the real scheduling boundary.
async function checkTransportRaces(api, player, node, context, gain) {
  const original = node.schedule;
  let release;
  function holdNext(predicate) {
    node.schedule = function(command) {
      const reply = original.call(this, command);
      if (!predicate(command)) return reply;
      node.schedule = original;
      return reply.then(() => new Promise((resolve, reject) => { release = { resolve, reject }; }));
    };
    release = null;
  }
  const analyser = context.createAnalyser(), samples = new Float32Array(2048);
  analyser.fftSize = samples.length;
  gain.connect(analyser);
  try {
    api.setAudioMainVolume(player, .5);
    holdNext(command => command.active);
    const starting = api.startAudio(player);
    await until(() => release, "Start acknowledgement was not held");
    await api.setAudioTempo(player, .5);
    const before = player.currentTime;
    await delay(250);
    assert(Math.abs(player.currentTime - before - .125) < .06,
      "Startup clock did not use the newly scheduled tempo");
    analyser.getFloatTimeDomainData(samples);
    assert(samples.some(value => Math.abs(value) > .001),
      "Delayed Play acknowledgement kept the opening audio muted");
    release.resolve(); await starting;

    holdNext(command => !command.active);
    const seeking = api.seekAudio(player, 10).catch(error => error);
    await until(() => release, "Seek pause acknowledgement was not held");
    const held = release;
    await api.pauseAudio(player);
    const pausedAt = player.currentTime;
    held.resolve();
    assert((await seeking).name === "AbortError" && player.paused && player.currentTime === pausedAt,
      "Superseded seek moved position or restarted after Pause");

    holdNext(command => !command.active);
    const oldSeek = api.seekAudio(player, 9).catch(error => error);
    await until(() => release, "Overlapping seek acknowledgement was not held");
    const oldReply = release;
    await api.seekAudio(player, 3);
    oldReply.resolve();
    assert((await oldSeek).name === "AbortError" && player.currentTime === 3 && player.paused,
      "Older seek overwrote the latest position");

    await api.startAudio(player);
    for (const obsolete of [() => api.setAudioTempo(player, .75), () => api.setAudioPitch(player, 1)]) {
      holdNext(command => command.active);
      const pending = obsolete().catch(error => error);
      await until(() => release, "Processing acknowledgement was not held");
      await api.setAudioTempo(player, 1);
      release.reject(new Error("Obsolete processing failure"));
      await pending;
      assert(!player.paused && !player.error, "Obsolete processing failure stopped newer playback");
    }
    holdNext(command => command.active);
    const obsoleteTempo = api.setAudioTempo(player, 1).catch(error => error);
    await until(() => release, "Tempo reply before restart was not held");
    const obsoleteReply = release;
    await api.pauseAudio(player);
    await api.startAudio(player);
    obsoleteReply.reject(new Error("Failure from previous transport action"));
    await obsoleteTempo;
    assert(!player.paused && !player.error, "Old processing failure stopped a newer Play");

    await api.pauseAudio(player);
    holdNext(command => command.active);
    const cancelledStart = api.startAudio(player).catch(error => error);
    await until(() => release, "Cancelled Play reply was not held");
    const startReply = release;
    await api.pauseAudio(player);
    const stoppedAt = player.currentTime;
    startReply.resolve();
    assert((await cancelledStart).name === "AbortError" && player.paused && player.currentTime === stoppedAt,
      "Late Play reply undid a newer Pause");
    await delay(100);
    analyser.getFloatTimeDomainData(samples);
    assert(samples.every(value => Math.abs(value) < 1e-7), "Cancelled Play reopened its gain gate");
  } finally {
    node.schedule = original;
    release?.resolve();
    await api.pauseAudio(player);
    await api.setAudioPitch(player, 0);
    await api.setAudioTempo(player, 1);
    await api.seekAudio(player, 0);
    api.setAudioMainVolume(player, 0);
    gain.disconnect(analyser);
    analyser.disconnect();
  }
}

function checkAudioFileResources() {
  const resources = createAudioFileURLs();
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  URL.revokeObjectURL = url => { revoked.push(url); originalRevoke.call(URL, url); };
  const loaded = { name: "Loaded", url: resources.create(new Blob(["loaded"])) };
  const queued = { name: "Queued", url: resources.create(new Blob(["queued"])) };
  const unused = resources.create(new Blob(["unused"]));
  try {
    const decks = [{ song: loaded, queue: queued }, { song: null, queue: loaded },
      { song: queued, queue: null }];
    const songs = getLoadedSongs(decks);
    assert(songs.length === 2 && songs[0] === loaded && songs[1] === queued,
      "Loaded-song list must retain deck order and object identity, excluding queues/empty decks");
    resources.releaseUnused(decks.flatMap(deck => [deck.song?.url, deck.queue?.url]));
    assert(revoked.length === 1 && revoked[0] === unused, "Cleanup revoked a loaded or queued URL");
    resources.releaseUnused([loaded.url, "external-source"]);
    assert(revoked.length === 2 && revoked[1] === queued.url, "Replaced queue URL was not released");
    resources.releaseUnused([]);
    resources.releaseUnused([]);
    assert(revoked.length === 3 && revoked[2] === loaded.url,
      "Cleanup must release each owned URL once and never revoke external sources");
  } finally {
    resources.releaseUnused([]);
    URL.revokeObjectURL = originalRevoke;
  }
}
async function checkPlaybackCoordination() {
  const urls = [];
  async function fixture() {
    const deck = buildDeck(), notices = [];
    const url = URL.createObjectURL(tone(window, "Current.wav")); urls.push(url);
    await sendToDeck(deck, { name: "Current", url });
    deck.queue = { name: "Queued", url };
    const callbacks = {
      busyChanged: busy => notices.push(busy), completed: () => notices.push("completed"),
      failed: error => notices.push(error.message), settled: () => notices.push("settled"),
      ended: () => notices.push("ended"), mediaFailed: () => notices.push("mediaFailed")
    };
    return { deck, notices, coordinator: createPlaybackCoordinator(deck, callbacks) };
  }
  const first = await fixture(), second = await fixture();
  const nativeResume = AudioContext.prototype.resume;
  let rejectPlay, held = false;
  AudioContext.prototype.resume = function() {
    if (!held) { held = true; return new Promise((resolve,reject) => { rejectPlay = reject; }); }
    return nativeResume.call(this);
  };
  try {
    const pending = first.coordinator.togglePlayback();
    assert(first.coordinator.isPending(), "Play must hold the operation guard");
    await first.coordinator.togglePlayback();
    await first.coordinator.playQueue();
    assert(first.deck.queue.name === "Queued", "An overlapping operation consumed the queue");
    await second.coordinator.togglePlayback();
    assert(second.deck.isPlaying, "A pending deck blocked another deck");
    rejectPlay(new Error("Held Play rejected")); await pending;
    assert(!first.coordinator.isPending() && !first.deck.isPlaying &&
      first.notices.join("|") === "true|Held Play rejected|false|settled", "Rejection/cleanup order changed");
    AudioContext.prototype.resume = nativeResume;
    await first.coordinator.togglePlayback();
    assert(first.deck.isPlaying && first.notices.slice(-4).join("|") === "true|completed|false|settled",
      "Successful Play order/recovery changed");
    await second.coordinator.playQueue();
    assert(second.deck.isPlaying && second.deck.song.name === "Queued" && second.deck.queue === null,
      "Guarded asynchronous queue playback failed");
    await pauseAudio(first.deck.audio);
    const song = first.deck.song, queue = first.deck.queue;
    for (const type of ["ended", "error"]) {
      first.deck.isPlaying = true;
      first.deck.audio.dispatchEvent(new Event(type));
      assert(!first.deck.isPlaying && first.deck.song === song && first.deck.queue === queue,
        type + " did not retain loaded/queued songs");
    }
  } finally {
    AudioContext.prototype.resume = nativeResume;
    await Promise.all([first,second].map(item => ejectAudio(item.deck.audio)));
    urls.forEach(url => URL.revokeObjectURL(url));
  }
}
async function until(condition, message) {
  for (let i = 0; i < 1000; i++) {
    if (condition()) return;
    await delay(30);
  }
  throw new Error(message);
}
function tone(window, name, initialFrequency = 440, channels = 1) {
  const sampleRate = 8000, samples = sampleRate * 20;
  const bytes = new ArrayBuffer(44 + samples * 2 * channels), data = new DataView(bytes);
  const text = (at, value) => [...value].forEach((char, index) => data.setUint8(at + index, char.charCodeAt(0)));
  text(0, "RIFF"); data.setUint32(4, 36 + samples * 2 * channels, true); text(8, "WAVE");
  text(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, channels, true); data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * 2 * channels, true); data.setUint16(32, 2 * channels, true); data.setUint16(34, 16, true);
  text(36, "data"); data.setUint32(40, samples * 2 * channels, true);
  for (let i = 0; i < samples; i++) {
    const envelope = Math.min(1, i / 400, (samples - i) / 400);
    const frequency = i < sampleRate * 10 ? initialFrequency : 440;
    for (let channel = 0; channel < channels; channel++) {
      data.setInt16(44 + (i * channels + channel) * 2, Math.sin(i * Math.PI * 2 * frequency / sampleRate) * 1000 * envelope, true);
    }
  }
  return new window.File([bytes], name, { type: "audio/wav" });
}
run.addEventListener("click", async () => {
  run.disabled = true;
  delete output.dataset.result;
  const lines = [];
  const pass = message => { lines.push("PASS " + message); output.textContent = lines.join("\n"); };
  let players = [], audioAPI;
  try {
    checkAudioFileResources();
    pass("loaded-song list and audio URL retention/replacement/cleanup");
    checkMainVolumeState();
    pass("Main starts at zero, stays deck-local, and rejects invalid values without state changes");
    await checkPlaybackCoordination();
    pass("coordinator blocks overlapping actions per deck; rejection recovers; ended/error retain songs and queue");
    await checkCancelledLoading();
    pass("Eject cancels pending loading; stale results cannot replace a newer song");
    const source = await (await fetch("../tunetox.html")).text();
    // Observe real players and gain nodes only in the isolated test frame.
    // No production diagnostics interface or alternate audio implementation.
    const observer = '<base href="' + new URL("../", location.href).href + '">' +
      '<script>window.__players=[];window.__contexts=[];window.__gains=[];window.__sources=[];' +
      'const NativeTarget=window.EventTarget;window.EventTarget=class extends NativeTarget{constructor(){super();window.__players.push(this);}};' +
      'const NativeWorklet=window.AudioWorkletNode;window.AudioWorkletNode=class extends NativeWorklet{constructor(...args){super(...args);window.__sources.push(this);}};' +
      'const NativeContext=window.AudioContext;window.AudioContext=class extends NativeContext{' +
      'constructor(...args){super(...args);window.__contexts.push(this);}' +
      'createGain(){const g=super.createGain(),connect=g.connect.bind(g),destination=this.destination;g.connect=(...args)=>{if(args[0]===destination)window.__gains.push(g);return connect(...args);};return g;}};<\/script>';
    frame.srcdoc = source.replace("<head>", "<head>" + observer);
    await new Promise(resolve => frame.addEventListener("load", resolve, { once: true }));
    const doc = frame.contentDocument, win = frame.contentWindow;
    audioAPI = await win.eval("import(" + JSON.stringify(new URL("../app/audio/deck-audio.js", location.href).href) + ")");
    await until(() => doc.querySelectorAll(".deck").length === 4, "Four decks did not render");
    players = win.__players;
    assert(players.length === 4, "Expected four persistent audio transports");
    pass("four deck components and four persistent transports");
    assert(win.__contexts.length === 1 && win.__gains.length === 4 && win.__sources.length === 0,
      "Expected one shared context and one Main gain per deck, before any worklet is loaded");
    assert(win.__gains.every(gain => gain.gain.value === 0), "Audio must start with zero gain");
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
      transfer.items.add(tone(win, name, index === 3 ? 220 : 440, index === 1 ? 2 : 1));
      inputs[index].files = transfer.files;
      inputs[index].dispatchEvent(new win.Event("change", { bubbles: true }));
    };
    const deck = number => doc.querySelector('.deck[data-deck="' + number + '"]');
    const play = number => deck(number).querySelector(".play-pause-button");
    const tempoInput = number => deck(number).querySelector(".tempo-slider input");
    const tempo = (number, position) => {
      const input = tempoInput(number);
      input.value = String(position);
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
    };
    assert([1,2,3,4].every(n => tempoInput(n).value === "500" &&
      deck(n).querySelector(".pitch-slider input").disabled), "Tempo must center at unity; Pitch must stay disabled");
    const mainInput = number => deck(number).querySelector(".main-volume-fader input");
    const volume = (number, percent) => {
      const input = mainInput(number);
      input.value = String(percent);
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      assert(input.getAttribute("aria-valuetext") === percent + "%" &&
        deck(number).querySelector(".main-volume-fader span").textContent === "MAIN " + percent + "%",
        "Main percentage did not reflect Behavior state");
    };
    assert([1,2,3,4].every(n => !mainInput(n).disabled && mainInput(n).value === "0"),
      "All four Main faders must be enabled at zero");
    for (const number of [1,2,3,4]) {
      const before = mainInput(number).getBoundingClientRect();
      for (const percent of [0,25,50,75,100]) {
        volume(number, percent);
        const after = mainInput(number).getBoundingClientRect();
        assert(mainInput(number).style.getPropertyValue("--main-volume-fill") === percent + "%",
          "Main accent fill did not follow its current value");
        assert(Math.abs(before.x - after.x) < .1 && Math.abs(before.width - after.width) < .1 &&
          Math.abs(before.height - after.height) < .1,
          "Main percentage changes shifted the existing fader geometry");
      }
      volume(number, 0);
    }
    pass("Main fill follows 0/25/50/75/100% on all decks without changing fader geometry");
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
    await until(() => players.every(p => p.readyState >= 2) && inputs.every(input => !input.disabled), "Generated audio did not load");
    assert(players.every(p => p.paused), "Load must not start playback");
    assert([...doc.querySelectorAll(".song-title")].some(n => n.textContent === "Generated Deck 1.wav"), "Filename missing");
    pass("all four loads succeed without autoplay; filenames rendered as text");
    await checkTransportRaces(audioAPI, players[0], win.__sources[0], win.__contexts[0], win.__gains[0]);
    pass("delayed Play reply preserves opening audio; startup tempo clock; superseded seeks; obsolete Tempo/Pitch failures");

    for (let number = 1; number <= 4; number++) {
      play(number).click();
      await until(() => play(number).getAttribute("aria-label") === "Pause Deck " + number, "Play did not resolve for deck " + number);
    }
    await until(() => players.every(p => p.currentTime > .1), "Playback clocks did not advance");
    pass("all four persistent transports run independently");
    const context = win.__contexts[0];
    const meters = win.__gains.map(gain => {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      gain.connect(analyser);
      return { analyser, samples: new Float32Array(analyser.fftSize) };
    });
    const rms = meter => {
      meter.analyser.getFloatTimeDomainData(meter.samples);
      return Math.sqrt(meter.samples.reduce((sum, value) => sum + value * value, 0) / meter.samples.length);
    };
    await delay(100);
    assert(meters.every(meter => rms(meter) < 1e-7), "Playing at Main zero must be silent");
    const volumeSources = players.map(p => p.src), volumeTimes = players.map(p => p.currentTime);
    [100,50,25,0].forEach((percent, index) => volume(index + 1, percent));
    await delay(120);
    const levels = meters.map(rms);
    assert(levels[0] > .005 && Math.abs(levels[1] / levels[0] - .5) < .08 &&
      Math.abs(levels[2] / levels[0] - .25) < .04 && levels[3] < 1e-7,
      "Measured audio must follow independent 100/50/25/0 percent Main levels");
    volume(1, 90); volume(1, 10); volume(1, 60);
    await delay(100);
    assert(Math.abs(win.__gains[0].gain.value - .6) < 1e-6, "Rapid retarget did not reach final gain");
    volume(1, 0);
    await delay(100);
    assert(rms(meters[0]) < 1e-7 && rms(meters[1]) > .005, "Main zero failed to mute only its deck");
    volume(1, 60);
    assert(players.every((p,i) => p.src === volumeSources[i] && !p.paused && p.currentTime > volumeTimes[i]),
      "Main changes interrupted playback or changed sources");
    pass("real post-gain signal follows 0/25/50/100%; rapid changes settle; mute and playback remain independent");
    const frequency = meter => {
      meter.analyser.getFloatTimeDomainData(meter.samples);
      const crossings = [];
      for (let i = 1; i < meter.samples.length; i++) {
        const a = meter.samples[i-1], b = meter.samples[i];
        if (a <= 0 && b > 0) crossings.push(i - 1 - a / (b-a));
      }
      return (crossings.length - 1) * context.sampleRate / (crossings.at(-1) - crossings[0]);
    };
    volume(4, 50);
    const nodesBeforeTempo = win.__sources.length;
    [0,500,1000,750].forEach((position,i) => tempo(i+1, position));
    const ratios = [.5,1,2,Math.SQRT2];
    const timeBeforeTempo = context.currentTime, sourceBeforeTempo = players.map(p=>p.currentTime);
    await delay(550);
    const elapsedTempo = context.currentTime - timeBeforeTempo;
    assert(players.every((p,i) => Math.abs((p.currentTime-sourceBeforeTempo[i]) / elapsedTempo - ratios[i]) < .1),
      "Four independent source clocks did not follow logarithmic tempo ratios");
    assert(meters.every((meter,i) => Math.abs(frequency(meter) - (i===3?220:440)) < 12),
      "Tempo changed musical pitch in the measured Signalsmith signal");
    assert(win.__sources.length === nodesBeforeTempo, "Tempo movement recreated processing nodes");
    assert(tempoInput(1).value === "0" && tempoInput(2).value === "500" && tempoInput(3).value === "1000",
      "Half/unity/double tempo mapping changed");
    const beforeRapid = players[0].currentTime;
    [1000,0,750,500].forEach(value=>tempo(1,value));
    await delay(180);
    assert(players[0].currentTime > beforeRapid && !players[0].paused && tempoInput(1).value === "500",
      "Rapid tempo changes interrupted playback or lost the final request");
    tempo(1,0);
    pass("four independent 0.5/1/2/logarithmic rates; real 220/440 Hz pitch preserved; rapid tempo keeps the node");
    const otherPositions = players.slice(0,3).map(p=>p.currentTime);
    await audioAPI.seekAudio(players[3], 12);
    await delay(400);
    assert(Math.abs(frequency(meters[3])-440) < 12 && players[3].currentTime >= 12 &&
      players.slice(0,3).every((p,i)=>!p.paused && p.currentTime > otherPositions[i]),
      "Playing seek did not reach the later frequency region independently");
    play(4).click();
    await until(()=>players[3].paused && !play(4).disabled, "Pause before seek failed");
    await audioAPI.seekAudio(players[3],3.25);
    await delay(100);
    assert(players[3].currentTime === 3.25 && players[3].paused, "Paused seek lost its requested coordinate");
    await audioAPI.seekAudio(players[3],-2);
    assert(players[3].currentTime === 0, "Negative seek was not clamped");
    await audioAPI.seekAudio(players[3],1e6);
    assert(players[3].currentTime === players[3].duration, "Seek beyond duration was not clamped");
    for (const bad of [NaN, Infinity, "3"]) {
      let rejected = false;
      try { await audioAPI.seekAudio(players[3],bad); } catch { rejected = true; }
      assert(rejected && players[3].paused, "Invalid seek was accepted or started playback");
    }
    let badPitch = false;
    try { await audioAPI.setAudioPitch(players[3],NaN); } catch { badPitch = true; }
    assert(badPitch, "Prepared Audio pitch setter accepted NaN");
    await audioAPI.setAudioPitch(players[3],0);
    await audioAPI.seekAudio(players[3],3.25);
    play(4).click();
    await until(()=>!players[3].paused && !play(4).disabled, "Resume after paused seek failed");
    await delay(350);
    assert(Math.abs(frequency(meters[3])-220)<12, "Resume did not use the earlier seek coordinate");
    volume(4,0);
    pass("playing/paused seeks select measured source regions; bounds/invalid inputs; other decks uninterrupted (not sample accuracy)");
    play(1).click();
    await until(() => players[0].paused, "Pause failed");
    const pausedTime = players[0].currentTime;
    await delay(160);
    assert(Math.abs(players[0].currentTime - pausedTime) < .03, "Paused position drifted");
    assert(players.slice(1).every(p => !p.paused), "Pausing Deck 1 affected another deck");
    await context.suspend();
    play(1).click();
    await until(() => players[0].currentTime > pausedTime + .1, "Resume failed");
    assert(context.state === "running", "Play did not resume the suspended audio context");
    pass("Pause retains position; resume and deck independence");

    const priorSource = players[0].src;
    load(0, "First queue.wav");
    load(0, "Replacement queue.wav");
    assert(players[0].src === priorSource && !players[0].paused, "Queuing interrupted playback");
    assert(deck(1).querySelector(".queue-button").title === "Replacement queue.wav", "Prototype queue replacement changed");
    deck(1).querySelector(".queue-button").click();
    await until(() => deck(1).querySelector(".song-title").textContent === "Replacement queue.wav" && !players[0].paused, "Queue swap failed");
    pass("existing queue replacement and Play Queue behavior preserved");
    assert(mainInput(1).value === "60" && Math.abs(win.__gains[0].gain.value - .6) < 1e-6,
      "Pause/resume or queued playback reset Main volume");
    await until(() => players[0].currentTime > .1 && !play(1).disabled,
      "Queued playback did not advance after its processing lead-in");

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
    assert([60,50,25,0].every((value,i) => Number(mainInput(i+1).value) === value),
      "View or Library switching reset Main volume");
    assert([0,500,1000,750].every((value,i)=>Number(tempoInput(i+1).value)===value),
      "Queue or view changes reset independent tempo settings");

    play(1).click();
    await until(() => players[0].paused && !play(1).disabled, "Pause before rejection failed");
    const nativeResume = context.resume;
    context.resume = () => Promise.reject(new Error("Intentional context rejection"));
    try {
      play(1).click();
      await until(() => doc.getElementById("playback-status").textContent.includes("Intentional context rejection"),
        "Audio-context failure not reported");
      assert(players[0].paused && !play(1).disabled && play(1).getAttribute("aria-label") === "Play Deck 1",
        "Context rejection left media running or controls locked");
    } finally { context.resume = nativeResume; }
    pass("context resume failure stops that player, reports failure, and releases the operation guard");

    await audioAPI.seekAudio(players[1], players[1].duration - .05);
    await until(() => players[1].ended, "Natural end not observed");
    await until(() => play(2).getAttribute("aria-label") === "Play Deck 2", "End did not update UI");
    assert(deck(2).querySelector(".song-title").textContent === "Generated Deck 2.wav", "End unloaded the song");
    pass("natural end retains loaded song and resets Play display");
    const invalid = new win.DataTransfer();
    invalid.items.add(new win.File(["not audio"], "Invalid.wav", { type: "audio/wav" }));
    inputs[0].files = invalid.files;
    inputs[0].dispatchEvent(new win.Event("change", { bubbles: true }));
    await until(() => doc.getElementById("playback-status").textContent.includes("audio operation failed"), "Invalid media error not reported");
    assert(play(1).getAttribute("aria-label") === "Play Deck 1", "Invalid media left a playing state");
    load(0, "Recovery.wav");
    await until(() => players[0].readyState >= 2 && !inputs[0].disabled && deck(1).querySelector(".song-title").textContent === "Recovery.wav", "Valid reload after invalid media failed");
    pass("invalid audio is reported; a valid file can be reloaded");
    play(1).click();
    await until(()=>!players[0].paused && !play(1).disabled, "Recovery Play failed");
    win.__sources.at(-1).onprocessorerror(new win.Event("processorerror"));
    assert(players[0].paused && play(1).getAttribute("aria-label") === "Play Deck 1" &&
      doc.getElementById("playback-status").textContent.includes("processor failed"),
      "Processor failure did not mute/update the deck");
    load(0,"Processor recovery.wav");
    await until(()=>!inputs[0].disabled && deck(1).querySelector(".song-title").textContent === "Processor recovery.wav",
      "Reload after processor failure failed");
    pass("processor failure mutes and reports the deck; reload recovers");
    output.dataset.result = "pass";
    pass("all checks complete");
  } catch (error) {
    output.dataset.result = "fail";
    output.textContent = lines.join("\n") + "\nFAIL " + error.message;
  } finally {
    if (audioAPI) await Promise.all(players.map(p => audioAPI.ejectAudio(p)));
    run.disabled = false;
  }
});

