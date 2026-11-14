import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('c',Path(__file__).resolve().parents[1]/'experiment_01c.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class StageOne(unittest.TestCase):
    def test_weak_presence_and_absence(self):
        sound = [1.,-1.,1.,-1.]*16 + [0.]*192
        mixture = [.1*x for x in sound]
        mixture[128:192] = [5.]*64
        best, rows = c.discover([sound,mixture],1,0)
        self.assertIsNotNone(best)
        self.assertLess(rows[0]['explained_fractions'][1],.01)
        self.assertTrue(rows[0]['presence_evidence'][1]['present'])
        self.assertFalse(c.presence(sound,[1.]*len(sound),1,0)['present'])
        self.assertFalse(c.presence(sound,[-x for x in sound],1,0)['present'])
        self.assertFalse(c.presence(sound,[0.]*len(sound),1,0)['present'])

    def test_complete_observed_tail_and_conservation(self):
        sound = [(-1.)**i * (.8 if i<30 else .0005) for i in range(150)]
        samples = [0.]*500
        for start in (20,270):
            samples[start:start+150] = sound
        tracks,residual,report = c.separate(samples,1000,1,max_lag_ms=0)
        self.assertTrue(tracks)
        self.assertGreater(report['events'][0]['end_frame'],report['events'][0]['detected_end_frame'])
        self.assertAlmostEqual(tracks[0][169],samples[169])
        self.assertLess(c.energy(residual),1e-20)
        self.assertEqual(samples,[sum(t[i] for t in tracks)+residual[i] for i in range(len(samples))])

    def test_stereo_shift_and_input_unchanged(self):
        x = [v for i in range(64) for v in ((-1.)**i,-(-1.)**i)]
        target = [0.,0.]+[.2*v for v in x]
        before = target[:]
        self.assertTrue(c.presence(x,target,2,1)['present'])
        self.assertEqual(target,before)
        self.assertFalse(c.presence([],[],1,0)['present'])

if __name__ == '__main__': unittest.main()

# Keep baseline API/export/alignment regressions against the new version as well.
import test_experiment_01 as original_tests
class OriginalSuiteAgainst1C(original_tests.SeparationTests):
    def setUp(self):
        self.previous=original_tests.experiment
        original_tests.experiment=c
    def tearDown(self):
        original_tests.experiment=self.previous
