async function runSignalsmithRecorderAnomalyTests(Recorder, clock) {
  const check = (value, message) => { if (!value) throw new Error(message); };
  function run(sequence, startFrame, endFrame) {
    const recorder = new Recorder(), messages = [];
    recorder.port.postMessage = data => messages.push(data);
    recorder.port.onmessage({ data: { type: 'arm', id: 10, startFrame, endFrame } });
    for (const frame of sequence) {
      clock.frame = frame;
      const channel = new Float32Array(128).fill(frame + 1);
      recorder.process([[channel, channel], [channel, channel]], [[new Float32Array(128)]]);
    }
    return { recorder, messages, data: messages.find(message => message.type === 'capture') };
  }
  const gap = run([0, 128, 512], 0, 640).data;
  check(JSON.stringify(gap.frameAnomalies.internalGaps) === '[{"startFrame":256,"endFrame":512}]', 'Exact internal hole required');
  check(Number.isNaN(gap.channels[0][256]) && gap.validRanges[0].length === 2, 'Unknown PCM must be NaN with valid-range metadata');
  const wrapped = run([0, 96128], 96000, 96256).data;
  check(Number.isNaN(wrapped.channels[0][0]) && wrapped.channels[0][128] === 96129,
    'Frame tags must not expose stale ring PCM as current samples after a large jump');
  const leading = run([256, 384], 0, 512).data;
  check(leading.frameAnomalies.leadingUncovered[0].endFrame === 256 && !leading.frameAnomalies.internalGaps.length,
    'Leading uncovered frames must be distinct from internal holes');
  const duplicate = run([0, 0, 128, 256], 0, 384).data;
  check(duplicate.frameAnomalies.duplicates.length === 1 && !duplicate.frameAnomalies.missingRanges.length,
    'Duplicate must not be reported as missing frames');
  const overlap = run([0, 64, 192], 0, 320).data;
  check(overlap.frameAnomalies.overlaps[0].startFrame === 64 && overlap.frameAnomalies.overlaps[0].endFrame === 128,
    'Overlap intersection must have exact coordinates');
  const backwards = run([256, 0, 128, 384], 0, 512).data;
  check(backwards.frameAnomalies.backwardJumps[0].previousFrame === 256 && backwards.frameAnomalies.backwardJumps[0].frame === 0,
    'Backward jump must report both callback positions');
  const olderDuplicate = run([0, 128, 0, 256], 0, 384).data;
  check(olderDuplicate.frameAnomalies.duplicates.length === 1 && olderDuplicate.frameAnomalies.backwardJumps.length === 1,
    'Nonadjacent duplicate and backward jump must both be detected');
  check(run([512, 640, 768], 512, 896).data.complete, 'Late but contiguous first callback must be accepted');
  const trailing = run([0, 128], 0, 512);
  trailing.recorder.port.onmessage({ data: { type: 'cancel', reason: 'cancelled' } });
  const cancelled = trailing.messages.find(message => message.type === 'capture');
  check(cancelled.frameAnomalies.trailingUncovered[0].startFrame === 256, 'Cancellation needs exact trailing range');

  const missing = new Recorder(), messages = [];
  missing.port.postMessage = data => messages.push(data);
  missing.port.onmessage({ data: { type: 'arm', id: 11, startFrame: 0, endFrame: 128 } });
  clock.frame = 0;
  missing.process([[new Float32Array(128)], []], [[new Float32Array(128)]]);
  const absent = messages.find(message => message.type === 'capture');
  check(absent.validRanges[0].length === 1 && absent.channels[0][0] === 0 &&
    !absent.validRanges[2].length && Number.isNaN(absent.channels[2][0]), 'Recorded zero and absent input must differ');
  const timing = messages.filter(message => message.type === 'timing');
  check(timing.some(message => message.event === 'diagnostic-tap-first-render-block' && message.frame === 0) &&
    timing.some(message => message.event === 'first-observed-processor-output' && message.frame === 0),
    'First observed channel-bearing processor block needs a render frame');

  const checkpoints = run(Array.from({ length: 80 }, (_, i) => i * 128), 0, 10240).messages.filter(m => m.type === 'checkpoint');
  check(checkpoints.length === 1 && checkpoints[0].endFrame - checkpoints[0].firstFrame === 4800,
    'Checkpoint backpressure must allow only one unacknowledged message');
  const resumed = new Recorder(), delivered = [];
  resumed.port.postMessage = data => delivered.push(data);
  for (let frame = 0; frame < 16000; frame += 128) {
    clock.frame = frame;
    resumed.process([[new Float32Array(128)], [new Float32Array(128)]], [[new Float32Array(128)]]);
  }
  check(delivered.filter(m => m.type === 'checkpoint').length === 1, 'Blocked main thread must not grow checkpoint queue');
  resumed.port.onmessage({ data: { type: 'checkpoint-ack' } });
  clock.frame = 16000;
  resumed.process([[new Float32Array(128)], [new Float32Array(128)]], [[new Float32Array(128)]]);
  check(delivered.filter(m => m.type === 'checkpoint').length === 2, 'Acknowledgement must permit a fresh recent checkpoint');
  console.log('Recorder exact frame anomalies, validity, unknown PCM, timing, and checkpoint tests passed');
}
