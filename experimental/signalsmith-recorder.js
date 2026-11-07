// Diagnostic branch only. Never forwards its inputs to the audible output.
class SignalsmithDiagnosticRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = Math.ceil(sampleRate * 2);
    this.pcm = Array.from({ length: 4 }, () => new Float32Array(this.capacity));
    this.frameTags = new Float64Array(this.capacity).fill(-1);
    this.channelMasks = new Uint8Array(this.capacity);
    this.blocks = [];
    this.checkpointEnd = 0;
    this.checkpointInFlight = false;
    this.firstOutput = false;
    this.firstNonzero = false;
    this.firstFrame = null;
    this.lastFrame = 0;
    this.capture = null;
    this.loadCapture = null;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'arm') {
        if (this.capture) this.finish('superseded');
        this.capture = data;
        if (this.lastFrame >= data.endFrame) this.finish();
      } else if (data.type === 'load') {
        this.loadCapture = { ...data, startFrame: this.firstFrame, endFrame: this.firstFrame === null ? null : this.firstFrame + Math.round(sampleRate * 0.5) };
        if (this.loadCapture.endFrame !== null && this.lastFrame >= this.loadCapture.endFrame) this.finish('', this.loadCapture);
      } else if (data.type === 'snapshot') {
        this.finish('best-effort snapshot; subsequent disposal is unobserved',
          { ...data, startFrame: Math.max(0, this.lastFrame - Math.round(sampleRate * 0.1)), endFrame: this.lastFrame });
      } else if (data.type === 'checkpoint-ack') this.checkpointInFlight = false;
      else if (data.type === 'cancel') this.finish(data.reason || 'cancelled');
    };
  }
  finish(reason = '', capture = this.capture) {
    if (!capture) return;
    if (capture === this.capture) this.capture = null;
    if (capture === this.loadCapture) this.loadCapture = null;
    const first = Math.max(0, capture.startFrame, this.lastFrame - this.capacity);
    const end = Math.max(first, Math.min(capture.endFrame, this.lastFrame));
    const blocks = this.blocks.filter(block => block.frame < end && block.frame + block.length > first);
    const anomalies = { duplicates: [], overlaps: [], backwardJumps: [] };
    const seen = new Map();
    let covered = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i], previous = blocks[i - 1];
      const key = block.frame + ':' + block.length;
      if (seen.has(key)) {
        anomalies.duplicates.push({ frame: block.frame, length: block.length,
          previousOccurrenceIndex: seen.get(key), blockIndex: i });
      } else {
        for (const range of covered) {
          const start = Math.max(range.startFrame, block.frame);
          const stop = Math.min(range.endFrame, block.frame + block.length);
          if (start < stop) anomalies.overlaps.push({ frame: block.frame, length: block.length,
            startFrame: start, endFrame: stop, priorRange: { ...range } });
        }
        seen.set(key, i);
      }
      if (previous && block.frame < previous.frame) anomalies.backwardJumps.push({
        previousFrame: previous.frame, previousLength: previous.length, frame: block.frame, length: block.length });
      const ordered = [...covered, { startFrame: block.frame, endFrame: block.frame + block.length }]
        .sort((a, b) => a.startFrame - b.startFrame);
      covered = [];
      for (const range of ordered) {
        const last = covered[covered.length - 1];
        if (last && range.startFrame <= last.endFrame) last.endFrame = Math.max(last.endFrame, range.endFrame);
        else covered.push({ ...range });
      }
    }
    const ranges = predicate => {
      const result = [];
      let start = null;
      for (let frame = first; frame <= end; frame++) {
        const valid = frame < end && predicate(frame);
        if (valid && start === null) start = frame;
        if (!valid && start !== null) { result.push({ startFrame: start, endFrame: frame }); start = null; }
      }
      return result;
    };
    const recorded = frame => this.frameTags[frame % this.capacity] === frame;
    const recordedRanges = ranges(recorded);
    const missingRanges = ranges(frame => !recorded(frame));
    if (capture.startFrame < first) missingRanges.unshift({ startFrame: capture.startFrame, endFrame: first });
    if (end < capture.endFrame) missingRanges.push({ startFrame: end, endFrame: capture.endFrame });
    // Merge adjacent missing intervals, including retention-boundary truncation.
    const merged = [];
    for (const range of missingRanges) {
      const last = merged[merged.length - 1];
      if (last && last.endFrame === range.startFrame) last.endFrame = range.endFrame;
      else merged.push({ ...range });
    }
    const validRanges = this.pcm.map((_, channel) => ranges(frame => recorded(frame) &&
      !!(this.channelMasks[frame % this.capacity] & (1 << channel))));
    const channels = this.pcm.map((ring, channel) => {
      const data = new Float32Array(end - first).fill(NaN);
      for (const range of validRanges[channel]) for (let frame = range.startFrame; frame < range.endFrame; frame++) {
        data[frame - first] = ring[frame % this.capacity];
      }
      return data;
    });
    const missingInput = validRanges.some(channel => channel.reduce((total, range) => total + range.endFrame - range.startFrame, 0) !== end - first);
    const ambiguous = Object.values(anomalies).some(items => items.length);
    const complete = !reason && !merged.length && !ambiguous && !missingInput;
    this.port.postMessage({ type: capture.type === 'checkpoint' ? 'checkpoint' : 'capture', id: capture.id,
      firstFrame: first, endFrame: end, requestedStartFrame: capture.startFrame, requestedEndFrame: capture.endFrame,
      sampleRate, channels, blocks, validRanges, recordedRanges,
      frameAnomalies: { ...anomalies, missingRanges: merged,
        leadingUncovered: merged.filter(range => range.startFrame === capture.startFrame),
        internalGaps: merged.filter(range => range.startFrame > capture.startFrame && range.endFrame < capture.endFrame),
        trailingUncovered: merged.filter(range => range.endFrame === capture.endFrame) },
      repeatedFramePolicy: 'Latest callback wins; repeated/overlapping frames remain flagged as ambiguous.',
      unknownSampleEncoding: 'NaN in float WAV; validRanges are authoritative. Unknown is not silence.',
      complete, reason: reason || (merged.length ? 'uncovered render frames' : ambiguous ? 'duplicate/overlap/backward render frames' : missingInput ? 'capture input unavailable' : '')
    }, channels.map(c => c.buffer));
  }

  process(inputs, outputs) {
    const length = outputs[0][0].length;
    outputs[0].forEach(channel => channel.fill(0));
    if (this.firstFrame === null) {
      this.firstFrame = currentFrame;
      this.port.postMessage({ type: 'timing', event: 'diagnostic-tap-first-render-block', frame: currentFrame, sampleRate,
        observation: 'First recorder callback; connections may have been requested earlier.' });
    }
    if (this.loadCapture && this.loadCapture.startFrame === null) {
      this.loadCapture.startFrame = this.firstFrame;
      this.loadCapture.endFrame = this.firstFrame + Math.round(sampleRate * 0.5);
    }
    for (let input = 0; input < 2; input++) {
      for (let channel = 0; channel < 2; channel++) {
        const source = inputs[input]?.[channel];
        const ring = this.pcm[input * 2 + channel];
        for (let i = 0; i < length; i++) ring[(currentFrame + i) % this.capacity] = source ? source[i] : NaN;
      }
    }
    for (let i = 0; i < length; i++) {
      const index = (currentFrame + i) % this.capacity;
      this.frameTags[index] = currentFrame + i;
      this.channelMasks[index] = (inputs[0]?.[0] ? 1 : 0) | (inputs[0]?.[1] ? 2 : 0) |
        (inputs[1]?.[0] ? 4 : 0) | (inputs[1]?.[1] ? 8 : 0);
    }
    if (!this.firstOutput && inputs[0]?.length) {
      this.firstOutput = true;
      this.port.postMessage({ type: 'timing', event: 'first-observed-processor-output', frame: currentFrame,
        sampleRate, observation: 'First block with pre-gain input channels, including silence; processor output before tap is unavailable.' });
    }
    if (!this.firstNonzero && inputs[0]?.some(channel => channel.some(value => Number.isFinite(value) && value !== 0))) {
      this.firstNonzero = true;
      this.port.postMessage({ type: 'timing', event: 'first-observed-nonzero-processor-block', frame: currentFrame, sampleRate });
    }
    this.lastFrame = Math.max(this.lastFrame, currentFrame + length);
    this.blocks.push({ frame: currentFrame, length, inputChannels: inputs.map(input => input.length) });
    while (this.blocks.length && (this.blocks.length > 2048 || this.blocks[0].frame + this.blocks[0].length <= this.lastFrame - this.capacity)) this.blocks.shift();
    if (this.loadCapture && this.lastFrame >= this.loadCapture.endFrame) this.finish('', this.loadCapture);
    if (this.capture && this.lastFrame >= this.capture.endFrame) this.finish();
    if (!this.checkpointInFlight && this.lastFrame - this.checkpointEnd >= Math.round(sampleRate * 0.1)) {
      this.checkpointEnd = this.lastFrame;
      this.checkpointInFlight = true;
      this.finish('', { type: 'checkpoint', startFrame: Math.max(0, this.lastFrame - Math.round(sampleRate * 0.1)), endFrame: this.lastFrame });
    }
    return true;
  }
}
registerProcessor('tuneflow-signalsmith-recorder', SignalsmithDiagnosticRecorder);
