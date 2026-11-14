import json
import math
from pathlib import Path
import unittest
import methods as m
HERE=Path(__file__).resolve().parent

@unittest.skipUnless((HERE/'a-target-phase/report.json').exists() and (HERE/'b-sequence-continuity/report.json').exists(),'Render both branches first')
class IndependentExports(unittest.TestCase):
    def test_both_float32_exports_conserve_exact_reference(self):
        reference=(m.ROOT/'results/experiment-04h-phase-neighbors/original_reference.wav').read_bytes()
        for directory in ['a-target-phase','b-sequence-continuity']:
            folder=HERE/directory
            r,c,x=m.render.d.read_export(folder/'original_reference.wav');r2,c2,y=m.render.d.read_export(folder/'reconstructed.wav');r3,c3,res=m.render.d.read_export(folder/'residual.wav')
            self.assertEqual((r,c,len(x)),(44100,2,529200));self.assertEqual((r,c,len(x)),(r2,c2,len(y)));self.assertEqual((r,c,len(x)),(r3,c3,len(res)))
            self.assertEqual((folder/'original_reference.wav').read_bytes(),reference)
            self.assertLess(max(abs(a-b-d) for a,b,d in zip(x,y,res)),5e-8)
    def test_branches_are_separate_and_inferences_are_verified(self):
        a=json.loads((HERE/'a-target-phase/report.json').read_text());b=json.loads((HERE/'b-sequence-continuity/report.json').read_text())
        self.assertEqual(a['inferred_occurrences'],[]);self.assertEqual(b['recognized_cycle_ids'],[])
        decisions=json.loads((HERE/'b-sequence-continuity/decisions.json').read_text())
        for decision in decisions:
            if not decision['accepted_inference']:continue
            self.assertEqual(decision['reasons'],[]);self.assertTrue(decision['verification']['correlation']>=.98)
            self.assertLessEqual(decision['verification']['error_ratio'],.05)
            self.assertEqual(decision['verification']['reasons'],[])
        for row in b['inferred_occurrences']:
            self.assertLess(row['cycle'],0);self.assertIsNone(row['identity_family']);self.assertIn('inferred',row['provenance'])
        self.assertTrue(all(row['error_ratio']<=.08 for row in b['new_region_cycle_metrics']))

if __name__=='__main__':unittest.main()
