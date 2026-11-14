#!/usr/bin/env python3
"""Experiment 1C: boundary-aware recurring-waveform subtraction research. Python standard library only.

All inference receives only the mixture. References enter a separate evaluate command.
See README.md for equations, assumptions, identifiability and failure modes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import wave


MAX_SAMPLES = 4_000_000  # Bound memory/CPU for this short-recording experiment.


def energy(values):
    return sum(value * value for value in values)


def read_audio(path):
    """Decode integer PCM WAV without peak normalization or channel downmix."""
    if Path(path).stat().st_size > MAX_SAMPLES * 4 + 1_048_576:
        raise ValueError('Input file exceeds short-experiment size limit')
    with wave.open(str(path), 'rb') as audio:
        channels, width, rate, frames, compression, _ = audio.getparams()
        if compression != 'NONE' or width not in (1, 2, 3, 4):
            raise ValueError('Expected uncompressed 8/16/24/32-bit integer PCM WAV')
        if channels not in (1, 2) or frames * channels > MAX_SAMPLES or rate <= 0:
            raise ValueError('Expected mono/stereo short WAV (at most 4 million samples)')
        raw = audio.readframes(frames)
    if len(raw) != frames * channels * width:
        raise ValueError('Truncated PCM data')
    values = []
    for offset in range(0, len(raw), width):
        sample = raw[offset:offset + width]
        integer = sample[0] - 128 if width == 1 else int.from_bytes(sample, 'little', signed=True)
        values.append(integer / float(1 << (8 * width - 1)))
    return rate, channels, values


def write_float_wav(path, rate, channels, values):
    """Exclusive-create IEEE float32 WAV: values above unity are NOT clipped."""
    if len(values) % channels or not all(math.isfinite(x) for x in values):
        raise ValueError('Invalid output samples')
    payload = struct.pack('<' + 'f' * len(values), *values)
    fmt = struct.pack('<HHIIHH', 3, channels, rate, rate * channels * 4, channels * 4, 32)
    fact = struct.pack('<I', len(values) // channels)
    body = b'WAVEfmt ' + struct.pack('<I', len(fmt)) + fmt
    body += b'fact' + struct.pack('<I', 4) + fact
    body += b'data' + struct.pack('<I', len(payload)) + payload
    with Path(path).open('xb') as output:
        output.write(b'RIFF' + struct.pack('<I', len(body)) + body)


def detect_events(samples, rate, channels, threshold=0.015, gap_ms=60, pre_ms=10):
    """Threshold 2 ms channel-summed energy; bridge short below-threshold gaps."""
    hop = max(1, round(rate * .002))
    frames = len(samples) // channels
    powers = [energy(samples[i * channels:min(i + hop, frames) * channels]) /
              (min(hop, frames - i) * channels) for i in range(0, frames, hop)]
    peak = max(powers, default=0)
    if peak == 0:
        return []
    active = [i for i, value in enumerate(powers) if value > peak * threshold ** 2]
    groups = []
    for index in active:
        if not groups or (index - groups[-1][-1]) * hop > rate * gap_ms / 1000:
            groups.append([index])
        else:
            groups[-1].append(index)
    pre = round(rate * pre_ms / 1000)
    events = []
    for group in groups:
        start = max(0, group[0] * hop - pre)
        end = min(frames, (group[-1] + 1) * hop + pre)
        # Never duplicate samples when nearby padded events overlap.
        if events:
            start = max(start, events[-1][1])
        if end > start:
            events.append((start, end))
    return events


def leading_contexts(samples, rate, channels, boundaries, threshold):
    """Locate first active 2 ms block within each event using mixture detection energy.

    This repeats the detector's measurement without changing its segmentation. Context
    is measured from the actual clipped window start, so frame-zero events need no
    fabricated pre-recording samples. Context stays fixed throughout residual passes.
    """
    hop = max(1, round(rate * .002))
    frames = len(samples) // channels
    powers = [energy(samples[i * channels:min(i + hop, frames) * channels]) /
              (min(hop, frames - i) * channels) for i in range(0, frames, hop)]
    cutoff = max(powers, default=0) * threshold ** 2
    contexts = []
    for start, end in boundaries:
        active = next((i * hop for i, power in enumerate(powers)
                       if power > cutoff and start <= i * hop < end), start)
        contexts.append(active - start)
    return contexts


def shifted(template, length, lag, channels):
    """Integer-frame shift, preserving stereo; zero outside template support."""
    result = [0.0] * length
    source = max(0, -lag) * channels
    target = max(0, lag) * channels
    count = min(len(template) - source, length - target)
    if count > 0:
        result[target:target + count] = template[source:source + count]
    return result


def fit(template, target, channels, max_lag, center_lag=0):
    """Minimize ||y-gT_lag||²; g=max(0,<y,T>/<T,T>), exhaustive sample lags."""
    best = (0.0, 0, 0.0)
    for lag in range(center_lag - max_lag, center_lag + max_lag + 1):
        source = max(0, -lag) * channels
        destination = max(0, lag) * channels
        count = min(len(template) - source, len(target) - destination)
        if count <= 0:
            continue
        # Missing context is unobserved, not evidence of a silent source.
        overlap = template[source:source + count]
        observed = target[destination:destination + count]
        norm = energy(overlap)
        dot = sum(a * b for a, b in zip(overlap, observed))
        gain = max(0.0, dot / norm) if norm else 0.0
        explained = gain * gain * norm
        if explained > best[0]:
            best = (explained, lag, gain)
    return best


def presence(template, target, channels, lag, window_frames=16):
    """Local signed waveform agreement; unrelated energy elsewhere is irrelevant.

    Require three informative windows (or every window of a shorter observation).
    Correlation is measured jointly across channels, without channel cancellation.
    """
    source = max(0, -lag) * channels
    destination = max(0, lag) * channels
    count = min(len(template) - source, len(target) - destination)
    width = window_frames * channels
    rows = []
    peak = max((energy(template[k:k+width]) for k in range(0, len(template), width)), default=0)
    for offset in range(0, max(0, count), width):
        x = template[source+offset:source+min(count, offset+width)]
        y = target[destination+offset:destination+min(count, offset+width)]
        xx, yy = energy(x), energy(y)
        if xx <= max(peak * .001, 1e-30):
            continue
        dot = sum(a*b for a,b in zip(x,y))
        correlation = dot / math.sqrt(xx*yy) if yy else 0.
        rows.append(correlation)
    supported = sum(value >= .85 for value in rows)
    required = min(3, len(rows))
    return {'present': required > 0 and supported >= required,
            'supported_windows': supported, 'informative_windows': len(rows),
            'correlations': rows}


def discover(events, channels, max_lag, match=None, contexts=None,
             original_energies=None, input_energy=None, window_frames=16):
    """Anonymous observed candidates ranked by recurrence and observed energy."""
    best, comparisons = None, []
    contexts = contexts if contexts is not None else [0] * len(events)
    for i, candidate in enumerate(events):
        candidate_energy = energy(candidate)
        if candidate_energy < 1e-20:
            continue
        fits = [fit(candidate, event, channels, max_lag, contexts[j]-contexts[i])
                for j,event in enumerate(events)]
        evidence = [presence(candidate,event,channels,fits[j][1],window_frames)
                    for j,event in enumerate(events)]
        members = [j for j,row in enumerate(evidence) if row['present']]
        fractions = [row[0]/max(energy(event),1e-30) for row,event in zip(fits,events)]
        total = sum(fits[j][0] for j in members)/max(input_energy or sum(map(energy,events)),1e-30)
        contributions = sorted(fits[j][0]/max(original_energies[j] if original_energies is not None
                                             else energy(events[j]),1e-30) for j in members)
        middle = len(contributions)//2
        typical = (contributions[middle]+contributions[~middle])/2 if contributions else 0.
        meaningful = total >= 1e-5 or typical >= 1e-4
        row = {'candidate': i, 'energy': candidate_energy, 'members': members,
               'presence_evidence': evidence, 'explained_fractions': fractions,
               'input_energy_fraction': total, 'median_original_event_energy_fraction': typical,
               'meaningful': meaningful}
        if not meaningful:
            row['rejection'] = 'Negligible relative to input and original events; retained in residual'
        comparisons.append(row)
        if len(members) >= 2 and meaningful:
            score = (len(members), -candidate_energy)
            if best is None or score > best[0]:
                best = (score,i,fits,members)
    return best, comparisons


def separate(samples, rate, channels, threshold=.015, max_lag_ms=5, max_components=4):
    """Greedy recurring-template discovery on events and their evolving residuals."""
    boundaries = detect_events(samples, rate, channels, threshold)
    # Include observed quiet tails up to the next event, never extrapolate a tail.
    detected_boundaries = boundaries[:]
    boundaries = [(start, boundaries[i+1][0] if i+1 < len(boundaries)
                   else len(samples)//channels) for i,(start,end) in enumerate(boundaries)]
    events = [samples[start * channels:end * channels] for start, end in boundaries]
    residuals = [event[:] for event in events]
    contexts = leading_contexts(samples, rate, channels, boundaries, threshold)
    original_energies = [energy(event) for event in events]
    lag = round(rate * max_lag_ms / 1000)
    tracks, passes = [], []
    original_energy = energy(samples)
    for _ in range(max_components):
        best, comparisons = discover(residuals, channels, lag, contexts=contexts,
                                     original_energies=original_energies, input_energy=original_energy,
                                     window_frames=max(1, round(rate * .004)))
        if best is None:
            passes.append({'comparisons': comparisons, 'stop': 'No meaningful recurring candidate; rejected candidates remain in residual'})
            break
        _, index, fits, members = best
        template = residuals[index][:]
        track = [0.0] * len(samples)
        allocations = []
        # Only subtract confident matches. Unexplained audio remains explicit residual.
        for j in members:
            explained, offset, gain = fits[j]
            model = shifted(template, len(residuals[j]), offset, channels)
            start = boundaries[j][0] * channels
            for k, value in enumerate(model):
                value *= gain
                track[start + k] += value
                residuals[j][k] -= value
            allocations.append({'event': j, 'lag_frames': offset, 'gain': gain,
                                'explained_energy': explained})
        if energy(track) <= max(original_energy * 1e-10, 1e-20):
            break
        tracks.append(track)
        passes.append({'template_event': index, 'allocations': allocations,
                       'comparisons': comparisons})
    residual = [value - sum(track[i] for track in tracks) for i, value in enumerate(samples)]
    warnings = ['Templates are observed events, not proven independent sources.',
                'An exact reconstruction with residual does not establish separation quality.']
    if len(boundaries) != 8:
        warnings.append('Detected event count differs from the described eight; no assignments were forced.')
    if not tracks:
        warnings.append('No recurring component discovered.')
    if energy(residual) > original_energy * .01:
        warnings.append('More than 1% of input energy remains unresolved.')
    report = {'sample_rate': rate, 'channels': channels, 'frames': len(samples) // channels,
              'events': [{'start_frame': a, 'end_frame': b, 'time_seconds': a / rate,
                          'leading_context_frames': contexts[i],
                          'detected_end_frame': detected_boundaries[i][1],
                          'energy': energy(event), 'peak': max(map(abs, event), default=0),
                          'rms': math.sqrt(energy(event) / max(len(event), 1)),
                          'interval_seconds': (a - boundaries[i-1][0]) / rate if i else None}
                         for i, ((a, b), event) in enumerate(zip(boundaries, events))],
              'passes': passes, 'component_count': len(tracks),
              'experiment': '1C',
              'significance_policy': {'input_energy_fraction_min': 1e-5,
                                      'median_event_energy_fraction_min': 1e-4,
                                      'combination': 'either criterion suffices'},
              'residual_energy_fraction': energy(residual) / max(original_energy, 1e-30),
              'warnings': warnings}
    return tracks, residual, report


def baseline(samples, boundaries, channels):
    """First detected event subtracted once from each event, no alignment or gain fit."""
    model = [0.0] * len(samples)
    if boundaries:
        a, b = boundaries[0]
        template = samples[a * channels:b * channels]
        for start, end in boundaries:
            count = min(len(template), (end - start) * channels)
            model[start * channels:start * channels + count] = template[:count]
    return model, [x - y for x, y in zip(samples, model)]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, value):
    with Path(path).open('x') as output:
        json.dump(value, output, indent=2, allow_nan=False)
        output.write('\n')


def run(args):
    input_path = Path(args.input).resolve()
    rate, channels, samples = read_audio(input_path)
    # Output must be a NEW directory; even partial/previous runs are never overwritten.
    output = Path(args.output).resolve()
    if output == input_path or input_path in output.parents:
        raise ValueError('Invalid output directory')
    output.mkdir(parents=True, exist_ok=False)
    tracks, residual, report = separate(samples, rate, channels, args.threshold, args.max_lag_ms)
    report['input_sha256'] = digest(input_path)
    report['parameters'] = {'threshold': args.threshold, 'max_lag_ms': args.max_lag_ms,
                            'presence_window_ms': 4, 'local_correlation_min': .85, 'max_components': 4}
    report['outputs'] = []
    for i, track in enumerate(tracks):
        name = 'component_%02d.wav' % (i + 1)
        write_float_wav(output / name, rate, channels, track)
        report['outputs'].append({'file': name, 'peak': max(map(abs, track), default=0)})
    write_float_wav(output / 'residual.wav', rate, channels, residual)
    bounds = [(e['start_frame'], e['end_frame']) for e in report['events']]
    base, base_residual = baseline(samples, bounds, channels)
    write_float_wav(output / 'baseline_component.wav', rate, channels, base)
    write_float_wav(output / 'baseline_residual.wav', rate, channels, base_residual)
    report['baseline_residual_energy_fraction'] = energy(base_residual) / max(energy(samples), 1e-30)
    save_json(output / 'report.json', report)
    print(json.dumps({'output': str(output), 'components': len(tracks), 'warnings': report['warnings']}, indent=2))


def read_float_wav(path):
    """Read only this experiment's float WAV outputs, including the fact chunk."""
    if Path(path).stat().st_size > MAX_SAMPLES * 4 + 1024:
        raise ValueError('Output WAV exceeds size limit')
    raw = Path(path).read_bytes()
    if len(raw) > MAX_SAMPLES * 4 + 1024 or raw[:4] != b'RIFF' or raw[8:12] != b'WAVE':
        raise ValueError('Invalid or oversized output WAV')
    offset, fmt, payload = 12, None, None
    while offset + 8 <= len(raw):
        tag, size = struct.unpack_from('<4sI', raw, offset)
        chunk = raw[offset + 8:offset + 8 + size]
        if len(chunk) != size:
            raise ValueError('Truncated WAV chunk')
        if tag == b'fmt ':
            fmt = struct.unpack('<HHIIHH', chunk)
        if tag == b'data':
            payload = chunk
        offset += 8 + size + size % 2
    if fmt is None or fmt[0] != 3 or fmt[5] != 32 or fmt[1] not in (1, 2) or payload is None:
        raise ValueError('Expected experiment float32 WAV')
    values = list(struct.unpack('<' + 'f' * (len(payload) // 4), payload))
    if not all(math.isfinite(x) for x in values):
        raise ValueError('Nonfinite output')
    return fmt[2], fmt[1], values


def evaluate(args):
    """Post-hoc template resemblance only; never feeds references back into inference."""
    run_path = Path(args.run)
    report = json.loads((run_path / 'report.json').read_text())
    scores = []
    for item in report['outputs']:
        rate, channels, track = read_float_wav(run_path / item['file'])
        for reference_path in args.references:
            ref_rate, ref_channels, reference = read_audio(reference_path)
            if (rate, channels) != (ref_rate, ref_channels):
                raise ValueError('Reference rate/channels must match; no silent conversion')
            for index, event in enumerate(report['events']):
                target = track[event['start_frame'] * channels:event['end_frame'] * channels]
                explained, lag, gain = fit(reference, target, channels, round(rate * args.max_lag_ms / 1000))
                scores.append({'component': item['file'], 'reference': str(reference_path),
                               'reference_sha256': digest(reference_path), 'event': index,
                               'explained_fraction': explained / max(energy(target), 1e-30),
                               'lag_frames': lag, 'gain': gain})
    save_json(args.output, {'metric': 'Per-event reference projection; not full-track ground truth SDR',
                            'scores': scores, 'separation_report_sha256': digest(run_path / 'report.json')})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    separation = commands.add_parser('separate')
    separation.add_argument('input')
    separation.add_argument('--output', required=True)
    separation.add_argument('--threshold', type=float, default=.015)
    separation.add_argument('--max-lag-ms', type=float, default=5)
    evaluation = commands.add_parser('evaluate')
    evaluation.add_argument('run')
    evaluation.add_argument('--references', nargs='+', required=True)
    evaluation.add_argument('--output', required=True)
    evaluation.add_argument('--max-lag-ms', type=float, default=25)
    args = parser.parse_args()
    if not 0 <= args.max_lag_ms <= 50:
        parser.error('max-lag-ms must be between 0 and 50')
    if args.command == 'separate' and not 0 < args.threshold < 1:
        parser.error('threshold must be between 0 and 1')
    try:
        run(args) if args.command == 'separate' else evaluate(args)
    except (ValueError, OSError, wave.Error, struct.error) as error:
        parser.exit(1, 'Experiment failed: %s\n' % error)


if __name__ == '__main__':
    main()
