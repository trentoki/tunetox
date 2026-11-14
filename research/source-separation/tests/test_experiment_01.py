"""Deterministic synthetic tests; no original/reference recordings required."""
import importlib.util
import math
from pathlib import Path
import random
import argparse
import contextlib
import io
import struct
import wave
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'experiment_01.py'
spec = importlib.util.spec_from_file_location('experiment_01', MODULE)
experiment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(experiment)


def fixture(order=(0, 1, 0, 1, 0, 1, 0, 1), stereo=False):
    rate = 1000
    a = [0.4 * math.exp(-i / 30) * math.cos(i * .31) for i in range(100)]
    randomizer = random.Random(7)
    b = [0.12 * math.exp(-i / 20) * randomizer.uniform(-1, 1) for i in range(100)]
    # Orthogonalize for known synthetic decomposition (fixture creation only).
    projection = sum(x * y for x, y in zip(a, b)) / experiment.energy(a)
    b = [y - projection * x for x, y in zip(a, b)]
    samples = [0.0] * 1900
    true_a, true_b = samples[:], samples[:]
    for j, present in enumerate(order):
        start = 100 + 210 * j + (j % 3)
        gain = .7 + .06 * j
        for k in range(100):
            true_a[start + k] = gain * a[k]
            true_b[start + k] = gain * present * b[k]
            samples[start + k] = true_a[start + k] + true_b[start + k]
    if stereo:
        expand = lambda values: [v for x in values for v in (x, -x)]
        samples, true_a, true_b = map(expand, (samples, true_a, true_b))
    return rate, 2 if stereo else 1, samples, true_a, true_b


class SeparationTests(unittest.TestCase):
    def test_eight_events_and_blind_recovery_with_gains_and_jitter(self):
        rate, channels, samples, a, b = fixture()
        tracks, residual, report = experiment.separate(samples, rate, channels)
        self.assertEqual(len(report['events']), 8)
        self.assertEqual(len(tracks), 2)
        self.assertLess(experiment.energy([x-y for x,y in zip(tracks[0], a)]) / experiment.energy(a), .001)
        self.assertLess(experiment.energy([x-y for x,y in zip(tracks[1], b)]) / experiment.energy(b), .02)
        self.assertLess(experiment.energy(residual) / experiment.energy(samples), .001)
        for i, value in enumerate(samples):
            self.assertAlmostEqual(value, sum(t[i] for t in tracks) + residual[i], places=14)

    def test_non_alternating_order_and_antiphase_stereo(self):
        rate, channels, samples, _, _ = fixture((1, 0, 0, 1, 1, 1, 0, 0), True)
        tracks, residual, report = experiment.separate(samples, rate, channels)
        self.assertEqual(len(report['events']), 8)
        self.assertEqual(len(tracks), 2)
        self.assertLess(experiment.energy(residual) / experiment.energy(samples), .001)

    def test_alignment_both_directions_and_gain(self):
        template = [0, .2, -.4, .3, 0, 0]
        for offset in (-1, 1):
            target = [2.3 * x for x in experiment.shifted(template, 6, offset, 1)]
            _, lag, gain = experiment.fit(template, target, 1, 2)
            self.assertEqual(lag, offset)
            self.assertAlmostEqual(gain, 2.3)

    def test_silence_and_singleton_fail_honestly(self):
        tracks, residual, report = experiment.separate([0.] * 1000, 1000, 1)
        self.assertEqual(tracks, [])
        self.assertEqual(report['events'], [])
        self.assertTrue(report['warnings'])
        samples = [0.] * 100 + [.5] * 50 + [0.] * 100
        tracks, residual, report = experiment.separate(samples, 1000, 1)
        self.assertEqual(tracks, [])
        self.assertEqual(samples, residual)

    def test_float_export_preserves_over_unity_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.wav'
            experiment.write_float_wav(path, 1000, 1, [1.5, -1.75, 0])
            self.assertEqual(experiment.read_float_wav(path), (1000, 1, [1.5, -1.75, 0]))
            with self.assertRaises(FileExistsError):
                experiment.write_float_wav(path, 1000, 1, [0])

    def test_baseline_is_literal_first_event_subtraction(self):
        model, residual = experiment.baseline([0, 1, 2, 0, 3, 4], [(1, 3), (4, 6)], 1)
        self.assertEqual(model, [0, 1, 2, 0, 1, 2])
        self.assertEqual(residual, [0, 0, 0, 0, 2, 2])

    def test_file_workflow_and_posthoc_evaluation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'mixture.wav'
            rate, channels, samples, _, _ = fixture()
            with wave.open(str(source), 'wb') as audio:
                audio.setparams((channels, 2, rate, 0, 'NONE', 'not compressed'))
                audio.writeframes(struct.pack('<' + 'h' * len(samples),
                                              *(round(x * 32768) for x in samples)))
            before = source.read_bytes()
            args = argparse.Namespace(input=str(source), output=str(root / 'run'),
                                      threshold=.015, max_lag_ms=5)
            with contextlib.redirect_stdout(io.StringIO()):
                experiment.run(args)
            self.assertEqual(source.read_bytes(), before)
            with self.assertRaises(FileExistsError):
                experiment.run(args)
            report_before = (root / 'run' / 'report.json').read_bytes()
            evaluation = argparse.Namespace(run=str(root / 'run'), references=[str(source)],
                                            output=str(root / 'evaluation.json'), max_lag_ms=5)
            experiment.evaluate(evaluation)
            self.assertEqual((root / 'run' / 'report.json').read_bytes(), report_before)
            self.assertTrue((root / 'evaluation.json').exists())
            with self.assertRaises(FileExistsError):
                experiment.evaluate(evaluation)

    def test_unrelated_events_not_claimed_recurring(self):
        best, _ = experiment.discover([[1, 0, 0], [0, 0, 1]], 1, 0)
        self.assertIsNone(best)


if __name__ == '__main__':
    unittest.main()
