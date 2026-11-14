import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import envelope_controls as c

class OnsetControls(unittest.TestCase):
    def test_sustained_boundary_is_not_an_attack(self):
        x=[.5]*1000
        row=c.onset_probe([x],1000,{'region':1,'start_seconds':.2},.5)
        self.assertIsNone(row['attack_10_90_seconds'])
        self.assertNotIn('aligned_100ms_rms',row)

    def test_observed_silence_and_rise(self):
        x=[0.]*220+[i*.01 for i in range(50)]+[.5]*730
        row=c.onset_probe([x],1000,{'region':1,'start_seconds':.2},.5)
        self.assertTrue(row['observed_silence_backed_onset'])
        self.assertGreater(row['attack_10_90_seconds'],.02)
        self.assertEqual(len(row['aligned_100ms_rms']),20)
