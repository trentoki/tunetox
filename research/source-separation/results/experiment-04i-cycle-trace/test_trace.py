import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('four_i',Path(__file__).with_name('analyze.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class TraceClassifications(unittest.TestCase):
    def test_no_candidate_is_distinct_from_detection_rejection(self):
        self.assertEqual(a.classify(False,False,False,None,False,0,[]),'outside_candidate_support')
        self.assertEqual(a.classify(True,False,False,'unreliable',False,0,[]),'detection_reliability_rejection')

    def test_signature_recognition_and_render_failures_are_distinct(self):
        self.assertEqual(a.classify(True,True,False,'ambiguous',False,0,[]),'signature_missing')
        self.assertEqual(a.classify(True,True,True,'ambiguous',False,0,['target shape similarity too low']),'target_shape_rejection')
        self.assertEqual(a.classify(True,True,True,'assigned',True,0,[]),'accepted_not_rendered')
        self.assertEqual(a.classify(True,True,True,'assigned',True,.95,[]),'rendered_model_error')

    def test_multiple_reasons_are_exclusively_counted(self):
        self.assertEqual(a.classify(True,True,True,'ambiguous',False,0,['unsupported competing-family relationship','target shape similarity too low']),'unsupported_family_relationship')
        self.assertEqual(a.classify(True,True,True,'ambiguous',False,0,['reliable previous neighbor geometry mismatch']),'neighbor_rejection')

    def test_tiny_low_energy_crossing_is_not_a_significant_missing_ramp(self):
        self.assertFalse(a.significant_gap(1,100,1e-7,1))
        self.assertTrue(a.significant_gap(100,100,.8,1))
        self.assertTrue(a.significant_gap(5,100,.2,1))

    def test_internal_sharp_edge_is_not_the_cycle_origin(self):
        x=[(i%100)/100 if i%100<50 else (i%100)/100-1 for i in range(201)]
        first=a.sharp_edge(x,1,0,100);second=a.sharp_edge(x,1,100,200)
        self.assertEqual(first['frame'],50);self.assertAlmostEqual(first['cycle_phase'],.5,places=2)
        self.assertAlmostEqual(second['fractional_frame']-first['fractional_frame'],100,places=9)

if __name__=='__main__':unittest.main()
