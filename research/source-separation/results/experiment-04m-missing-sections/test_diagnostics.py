import unittest
from pathlib import Path
import analyze as a
h=a.load('existing_4i_checks',Path(__file__).resolve().parents[1]/'experiment-04i-cycle-trace/analyze.py')
class DiagnosticChecks(unittest.TestCase):
 def test_sample_ranges_are_half_open(self):
  self.assertEqual(a.runs([True,True,False,True]),[(0,2),(3,4)])
  self.assertEqual(a.runs([False,False]),[])
 def test_significance_separates_tiny_low_energy_holes(self):
  self.assertFalse(h.significant_gap(2,75,.000001,1.1))
  self.assertTrue(h.significant_gap(76,75,1.14,1.1))
 def test_pipeline_distinguishes_rejection_and_rendering(self):
  self.assertEqual(h.classify(True,True,True,'ambiguous',False,0,['reliable following neighbor period mismatch']),'neighbor_rejection')
  self.assertEqual(h.classify(True,True,True,'assigned',True,0,[]),'accepted_not_rendered')
  self.assertEqual(h.classify(True,False,False,'unreliable',False,0,[]),'detection_reliability_rejection')
if __name__=='__main__':unittest.main()
