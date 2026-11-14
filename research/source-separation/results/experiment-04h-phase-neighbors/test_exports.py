"""Checks the saved listening exports independently of recognition implementation."""
import json
from pathlib import Path
import unittest
import recognition as h
HERE=Path(__file__).resolve().parent

@unittest.skipUnless((HERE/'report.json').exists(),'Run reconstruction before export QA')
class ListeningExports(unittest.TestCase):
    def test_reference_and_float32_conservation(self):
        io=h.load('export_reader',h.ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py')
        r,c,x=io.read_export(HERE/'original_reference.wav');r2,c2,y=io.read_export(HERE/'reconstructed.wav');r3,c3,res=io.read_export(HERE/'residual.wav')
        self.assertEqual((r,c,len(x)),(44100,2,529200));self.assertEqual((r,c,len(x)),(r2,c2,len(y)));self.assertEqual((r,c,len(x)),(r3,c3,len(res)))
        self.assertEqual((HERE/'original_reference.wav').read_bytes(),(h.ROOT/'results/experiment-04d-majorsaw-reconstruction/original_reference.wav').read_bytes())
        self.assertLess(max(abs(a-b-d) for a,b,d in zip(x,y,res)),5e-8)

    def test_new_render_choices_obey_fixed_neighbor_bounds(self):
        report=json.loads((HERE/'report.json').read_text());decisions=json.loads((HERE/'new-decisions.json').read_text())
        selected=[v for v in decisions if v['newly_supported']]
        self.assertEqual(len(selected),report['metrics']['additional_cycles'])
        self.assertEqual(len(decisions)-len(selected),report['metrics']['remaining_ambiguous_cycles'])
        for row in selected:
            self.assertTrue(row['target_gates_passed']);self.assertIsNone(row['identity_family']);self.assertEqual(row['reasons'],[])
            self.assertEqual(len(row['neighbors']),2)
            for evidence in row['neighbors']:
                self.assertLessEqual(evidence['gap_periods'],.1);self.assertGreaterEqual(evidence['gap_periods'],-1e-8)
                self.assertLessEqual(evidence['relative_period_change'],.02)
                self.assertGreaterEqual(evidence['phase_tolerant_similarity'],.995)
                self.assertLessEqual(abs(evidence['comparison_shift_positions']),.5)

if __name__=='__main__':unittest.main()
