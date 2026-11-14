"""Independent checks that report locations/energy labels agree with frozen WAVs."""
import importlib.util
import json
import math
from pathlib import Path
import unittest
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
s=importlib.util.spec_from_file_location('frozen_io_for_tests',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py');io=importlib.util.module_from_spec(s);s.loader.exec_module(io)

@unittest.skipUnless((HERE/'report.json').exists(),'Run diagnostics before artifact QA')
class SavedMeasurementChecks(unittest.TestCase):
    def test_labeled_spike_samples_match_immutable_audio(self):
        report=json.loads((HERE/'report.json').read_text());rate,channels,residual=io.read_export(ROOT/'results/experiment-04f-independent/b-related-shapes/residual.wav')
        events=report['residual_spikes']['4F-B']['events'];threshold=report['residual_spikes']['4F-B']['threshold_absolute']
        for event in events[::max(1,len(events)//30)]:
            first=round(event['start_seconds']*rate);end=round(event['end_seconds']*rate)
            self.assertEqual(end-first,event['width_frames'])
            self.assertTrue(all(max(abs(residual[i*channels+c]) for c in range(channels))>=threshold for i in range(first,end)))
            if first:self.assertLess(max(abs(residual[(first-1)*channels+c]) for c in range(channels)),threshold)
            if end<len(residual)//channels:self.assertLess(max(abs(residual[end*channels+c]) for c in range(channels)),threshold)

    def test_gap_status_energy_totals_and_residual_partition(self):
        report=json.loads((HERE/'report.json').read_text())
        for gap in report['interruptions']:
            self.assertAlmostEqual(sum(gap['status_energy'].values()),gap['original_energy'],places=10)
            self.assertTrue(gap['residual_equals_original'])
        _,_,residual=io.read_export(ROOT/'results/experiment-04f-independent/b-related-shapes/residual.wav')
        self.assertAlmostEqual(sum(report['residual_energy_parts']['4F-B'].values()),io.energy(residual),places=9)

if __name__=='__main__':unittest.main()
