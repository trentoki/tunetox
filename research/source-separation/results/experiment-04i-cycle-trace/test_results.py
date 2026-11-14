import importlib.util
import json
from pathlib import Path
import unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('trace_qa',HERE/'analyze.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

@unittest.skipUnless((HERE/'report.json').exists(),'Run trace first')
class SavedTraceChecks(unittest.TestCase):
    def test_residual_categories_partition_saved_audio(self):
        report=json.loads((HERE/'report.json').read_text());_,_,res=a.io.read_export(a.H/'residual.wav')
        self.assertAlmostEqual(sum(v['residual_energy'] for v in report['category_summary'].values()),a.io.energy(res),places=8)
        for gap in report['gaps']:
            self.assertAlmostEqual(sum(gap['trace_categories'].values()),gap['original_energy'],places=9)
            if gap['significant']:
                self.assertFalse(gap['any_declared_rendered_frames'])
                self.assertTrue(gap['residual_equals_original'])

    def test_signatures_and_render_trace_are_consistent(self):
        report=json.loads((HERE/'report.json').read_text())
        self.assertEqual(report['diagnostic_counts']['maximum_regenerated_signature_difference'],0)
        self.assertEqual(report['diagnostic_counts']['accepted_not_rendered_cycles'],0)
        for row in report['cycles']:
            if row['4h_supported']:self.assertTrue(row['actual_output_nonzero'])
            if row['failure_category']=='target_shape_rejection':
                self.assertTrue(row['signature_present']);self.assertTrue(row['detection_reliability'])
                self.assertAlmostEqual(row['historical_best_similarity'],row['recomputed_same_signature_similarity'],places=12)
                self.assertLess(row['historical_best_similarity'],.995)

if __name__=='__main__':unittest.main()
