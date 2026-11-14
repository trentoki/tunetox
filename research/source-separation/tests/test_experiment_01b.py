"""Original behavioral suite reused unchanged, plus 1B-specific regressions."""
import importlib.util
from pathlib import Path
import unittest
import test_experiment_01 as original_tests

spec = importlib.util.spec_from_file_location('experiment_01b',
        Path(__file__).resolve().parents[1] / 'experiment_01b.py')
experiment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(experiment)


class OriginalSuiteAgainst1B(original_tests.SeparationTests):
    def setUp(self):
        self.original = original_tests.experiment
        original_tests.experiment = experiment

    def tearDown(self):
        original_tests.experiment = self.original


class BoundaryAndSignificanceTests(unittest.TestCase):
    def test_recording_start_without_leading_context(self):
        rate, channels, samples, a, b = original_tests.fixture()
        # Move first event exactly to recording start; all other events keep context.
        samples[:100] = samples[100:200]
        samples[100:200] = [0.] * 100
        a[:100] = a[100:200]
        a[100:200] = [0.] * 100
        tracks, residual, report = experiment.separate(samples, rate, channels)
        self.assertEqual(len(report['events']), 8)
        self.assertEqual(report['events'][0]['leading_context_frames'], 0)
        self.assertGreater(report['events'][1]['leading_context_frames'], 0)
        self.assertEqual(len(tracks), 2)
        self.assertLess(experiment.energy([x-y for x,y in zip(tracks[0][:100],a[:100])]) /
                        experiment.energy(a[:100]), .002)
        self.assertLess(experiment.energy(residual) / experiment.energy(samples), .001)

    def test_valid_overlap_and_placement_in_both_directions(self):
        sound = [.2, -.6, .3, .1]
        padded = [0.] * 10 + sound
        for template, target, center in ((padded, sound, -10), (sound, padded, 10)):
            explained, lag, gain = experiment.fit(template, target, 1, 1, center)
            self.assertEqual(lag, center)
            self.assertAlmostEqual(gain, 1)
            self.assertAlmostEqual(explained, experiment.energy(sound))
            self.assertEqual(experiment.shifted(template, len(target), lag, 1), target)
        self.assertEqual(experiment.fit(sound, sound, 1, 0, 100), (0., 0, 0.))

    def test_negligible_recurrence_rejected_at_multiple_input_scales(self):
        for scale in (1, .0001, 100):
            events = [[scale * .001, 0], [scale * .001, 0]]
            best, diagnostics = experiment.discover(events, 1, 0,
                        original_energies=[scale**2, scale**2], input_energy=2*scale**2)
            self.assertIsNone(best)
            self.assertTrue(all(not row['meaningful'] for row in diagnostics))
            self.assertTrue(all('retained in residual' in row['rejection'] for row in diagnostics))

    def test_quiet_but_relatively_meaningful_source_is_kept(self):
        for scale in (1, 1e-7):
            events = [[scale * .02, 0], [scale * .02, 0]]
            best, diagnostics = experiment.discover(events, 1, 0,
                         original_energies=[scale**2,scale**2], input_energy=2*scale**2)
            self.assertIsNotNone(best)
            self.assertTrue(diagnostics[0]['meaningful'])

    def test_rejected_small_structure_remains_in_residual(self):
        rate, channels, _, a, b = original_tests.fixture()
        samples = [x + .001*y for x,y in zip(a,b)]
        tracks, residual, report = experiment.separate(samples, rate, channels)
        self.assertEqual(len(tracks), 1)
        self.assertGreater(experiment.energy(residual), 0)
        rejected = [row for p in report['passes'] for row in p['comparisons']
                    if row.get('meaningful') is False and len(row['members']) >= 2]
        self.assertTrue(rejected)
        for i, value in enumerate(samples):
            self.assertAlmostEqual(tracks[0][i] + residual[i], value, places=15)

    def test_boundary_stereo_scale_and_conservation(self):
        rate, channels, samples, _, _ = original_tests.fixture(stereo=True)
        samples[:200] = samples[200:400]
        samples[200:400] = [0.] * 200
        samples = [x * 1e-5 for x in samples]
        tracks, residual, report = experiment.separate(samples, rate, channels)
        self.assertEqual(len(tracks), 2)
        for i, value in enumerate(samples):
            self.assertAlmostEqual(sum(t[i] for t in tracks)+residual[i], value, places=18)
        self.assertLess(experiment.energy(residual)/experiment.energy(samples), .001)


if __name__ == '__main__':
    unittest.main()
