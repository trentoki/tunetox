import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import relationships_01c as relationships

class Relationships(unittest.TestCase):
    def test_signed_scaled_shifted_and_unrelated(self):
        x=[1.,0.,-.5,.2]*16
        row=relationships.compare(x,[0.]*3+[-.3*v for v in x],1,4)
        self.assertEqual(row['lag_frames'],3)
        self.assertAlmostEqual(row['signed_gain'],-.3)
        self.assertAlmostEqual(row['signed_correlation'],-1)
        self.assertIsNone(relationships.compare(x,[0.]*64,1,4))
        self.assertLess(relationships.compare(x,[1.]*64,1,0)['score'],.2)

    def test_diagnostic_is_read_only_and_reports_cross_component_inversion(self):
        x=[1.,-.5,.2,0.]*16
        tracks=[x,[-v for v in x]]
        before=[t[:] for t in tracks]
        result=relationships.analyze(tracks,[0.]*64,[(0,64)],1,0)
        self.assertEqual(tracks,before)
        self.assertFalse(result['audio_reassigned'])
        self.assertIn('possible inverted or complementary cancellation fragment',
                      result['comparisons'][0]['possible_relationships'])

    def test_saved_run_is_unchanged_and_report_refuses_overwrite(self):
        import tempfile,json
        import experiment_01c as c
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            x=[1.,-.5,.2,0.]*16
            c.write_float_wav(root/'component_01.wav',1000,1,x)
            c.write_float_wav(root/'residual.wav',1000,1,[-v for v in x])
            c.save_json(root/'report.json',{'sample_rate':1000,'channels':1,'frames':64,
                'outputs':[{'file':'component_01.wav'}],
                'events':[{'start_frame':0,'end_frame':64}]})
            before={p.name:p.read_bytes() for p in root.iterdir()}
            relationships.run(root,root/'relationships.json',0)
            for name,data in before.items(): self.assertEqual((root/name).read_bytes(),data)
            self.assertFalse(json.loads((root/'relationships.json').read_text())['audio_reassigned'])
            with self.assertRaises(FileExistsError):
                relationships.run(root,root/'relationships.json',0)

    def test_disjoint_complement_is_only_a_hypothesis(self):
        left=[1.,-1.]*16+[0.]*32
        right=[0.]*32+[1.,-1.]*16
        result=relationships.analyze([left],right,[(0,64)],1,0)
        self.assertIn('possible complementary disjoint fragments; identity unproven',
                      result['comparisons'][0]['possible_relationships'])
