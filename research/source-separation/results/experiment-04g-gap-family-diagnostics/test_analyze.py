import importlib.util
from pathlib import Path
import math
import unittest
s=importlib.util.spec_from_file_location('four_g',Path(__file__).with_name('analyze.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class DiagnosticCalculations(unittest.TestCase):
    def test_run_locations_preserve_edges(self):
        self.assertEqual(a.runs([1,1,0,1,0,1,1]),[(0,2),(3,4),(5,7)])
        self.assertEqual(a.runs([]),[])
        self.assertEqual(a.runs([0,0]),[])

    def test_fractional_cycle_mask_and_omitted_energy(self):
        cycles={1:{'start_frame':1.2,'end_frame':3.4},2:{'start_frame':3.4,'end_frame':5.1}}
        mask=a.mask_from_cycles(cycles,{1},7)
        self.assertEqual(list(mask),[0,0,1,1,0,0,0])
        x=[1.,2.,3.,4.,5.,6.,7.];r=[1.,2.,.1,.2,5.,6.,7.]
        parts=a.energy_parts(x,r,mask,1)
        self.assertAlmostEqual(parts['accepted_model_error'],.05)
        self.assertAlmostEqual(sum(parts.values()),a.io.energy(r))

    def test_amplitude_phase_probes_are_not_conflated_with_gaps(self):
        x=[math.sin(i*.3) for i in range(100)];y=[v*.5 for v in x]
        fit=a.aligned_fit(x,y,1)
        self.assertAlmostEqual(fit['unshifted_gain'],2)
        self.assertGreater(fit['gain_only_error_reduction'],.99)
        self.assertEqual(a.classify_cycle(True,'assigned',1,.5,fit),'amplitude-scale mismatch evidence')
        self.assertIn('ambiguous',a.classify_cycle(False,'ambiguous',1,1,None))
        shifted=[0.]+x[:-1];probe=a.aligned_fit(x,shifted,1)
        self.assertNotEqual(probe['best_shift_gain']['lag_frames'],0)
        self.assertGreater(probe['best_shift_gain']['relative_error_reduction'],.9)

    def test_audio_phase_labels_use_frames_and_envelope_not_note_number(self):
        region={'start_seconds':1.,'end_seconds':1.5};rate=1000
        core={'start_frame':1200,'end_frame':1205,'start_seconds':1.2,'end_seconds':1.205,'absolute_rms':1.,'reliable':True}
        release={'start_frame':1480,'end_frame':1485,'start_seconds':1.48,'end_seconds':1.485,'absolute_rms':.1,'reliable':True}
        self.assertEqual(a.phase_class(core,region,[core]*10+[release],rate),'sustain-like stable level')
        self.assertEqual(a.phase_class(release,region,[core]*10+[release],rate),'release / low-level decay')

    def test_stereo_mask_does_not_cancel_opposite_polarity(self):
        parts=a.energy_parts([1.,-1.,2.,-2.],[.1,-.1,2.,-2.],bytearray([1,0]),2)
        self.assertAlmostEqual(parts['omitted_original'],8)
        self.assertAlmostEqual(parts['accepted_model_error'],.02)

if __name__=='__main__':unittest.main()
