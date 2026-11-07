// TuneFlow transport extension. SoundTouch's WSOLA implementation is unchanged.
import { Stretch } from '../vendor/soundtouchjs-2.1.1/soundtouch-export.js';

class DeckOneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channels = null;
    this.length = 0;
    this.rate = 1;
    this.playing = false;
    this.disposed = false;
    this.reset();
    this.port.onmessage = event => this.command(event.data);
  }

  reset() {
    this.stretch = new Stretch({ sampleRate, createBuffers: true });
    this.stretch.tempo = this.rate;
    this.readFrame = 0;
    this.fedFrames = 0;
    this.processedFrame = 0;
    this.renderedFrame = 0;
    this.mappedFrame = 0;
    this.segments = [];
    this.timeline = [];
    this.scratch = new Float32Array(1024);
    this.output = new Float32Array(256);
    this.blocks = 0;
    this.underruns = 0;
    this.finished = false;
  }

  command(message) {
    if (message.type === 'load') {
      this.channels = message.channels;
      this.length = this.channels[0].length;
      this.rate = 1;
      this.playing = false;
      this.reset();
    } else if (message.type === 'play') {
      if (this.finished) this.reset();
      this.playing = this.channels !== null;
    } else if (message.type === 'pause') {
      // Keep every DSP buffer and overlap sample intact for Resume.
      this.playing = false;
    } else if (message.type === 'stop') {
      this.playing = false;
      this.reset();
    } else if (message.type === 'tempo') {
      if (Number.isFinite(message.rate) && message.rate >= 0.8 && message.rate <= 1.2) {
        this.rate = message.rate;
        this.stretch.tempo = this.rate;
      }
    } else if (message.type === 'dispose') {
      this.playing = false;
      this.channels = null;
      this.length = 0;
      this.reset();
      this.disposed = true;
    }
    this.report(message.id);
  }

  // Read original PCM without resampling. Zero padding lets the final WSOLA window finish.
  feed() {
    const count = 512;
    const start = this.fedFrames;
    for (let index = 0; index < count; index++) {
      const frame = start + index;
      this.scratch[index * 2] = frame < this.length ? this.channels[0][frame] : 0;
      const right = this.channels[1] || this.channels[0];
      this.scratch[index * 2 + 1] = frame < this.length ? right[frame] : 0;
    }
    this.stretch.inputBuffer.putSamples(this.scratch, 0, count);
    this.fedFrames += count;
    this.readFrame = Math.min(this.length, this.fedFrames);
    const before = this.stretch.outputBuffer.frameCount;
    this.stretch.process();
    const generated = this.stretch.outputBuffer.frameCount - before;
    const consumed = this.fedFrames - this.stretch.inputBuffer.frameCount;
    this.processedFrame = Math.min(this.length, consumed);
    if (generated > 0) {
      // A nominal source-timeline map, NOT the exact source sample chosen by WSOLA.
      this.segments.push({ count: generated, used: 0, start: this.mappedFrame, end: consumed });
      this.mappedFrame = consumed;
    }
  }

  advanceTimeline(count) {
    let remaining = count;
    while (remaining > 0 && this.segments.length) {
      const segment = this.segments[0];
      const take = Math.min(remaining, segment.count - segment.used);
      segment.used += take;
      this.renderedFrame = Math.min(this.length,
        segment.start + (segment.end - segment.start) * segment.used / segment.count);
      remaining -= take;
      if (segment.used === segment.count) this.segments.shift();
    }
  }

  report(id) {
    this.port.postMessage({
      id, playing: this.playing, finished: this.finished,
      sourcePosition: this.readFrame / sampleRate,
      processedPosition: this.processedFrame / sampleRate,
      renderedPosition: this.renderedFrame / sampleRate,
      time: currentTime, timeline: this.timeline,
      bufferedFrames: this.stretch.outputBuffer.frameCount, underruns: this.underruns
    });
    this.timeline = [];
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return !this.disposed;
    output.forEach(channel => channel.fill(0));
    if (!this.playing || !this.channels) return !this.disposed;
    const frames = output[0].length;
    if (this.output.length < frames * 2) this.output = new Float32Array(frames * 2);
    // Bound work per render callback. No waits, file reads, or new DSP algorithm.
    let feeds = 0;
    while (this.stretch.outputBuffer.frameCount < frames && feeds < 64) {
      this.feed();
      feeds++;
    }
    const count = Math.min(frames, this.stretch.outputBuffer.frameCount);
    if (count < frames) this.underruns++;
    this.stretch.outputBuffer.extract(this.output, 0, count);
    this.stretch.outputBuffer.receive(count);
    const start = this.renderedFrame / sampleRate;
    // Trim padded output once the nominal source timeline reaches the real endpoint.
    for (let index = 0; index < count; index++) {
      if (this.renderedFrame >= this.length) break;
      output[0][index] = this.output[index * 2];
      if (output[1]) output[1][index] = this.output[index * 2 + 1];
      this.advanceTimeline(1);
    }
    this.timeline.push({ time: currentTime, duration: frames / sampleRate,
      start, end: this.renderedFrame / sampleRate });
    this.blocks++;
    if (this.renderedFrame >= this.length) {
      this.finished = true;
      this.playing = false;
    }
    if (this.blocks % 8 === 0 || this.finished) this.report();
    return !this.disposed;
  }
}
registerProcessor('tuneflow-deck-one', DeckOneProcessor);
