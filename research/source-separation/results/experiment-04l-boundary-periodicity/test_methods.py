"""Focused boundary regression checks; no audio identity assumptions."""
import math
import unittest
from unittest.mock import patch
import methods as m

class BoundaryTests(unittest.TestCase):
    def test_only_predecessor_context_can_be_waived(self):
        row={'cycle':1};assignment={'candidates':[{'family':2,'similarity':.999}]}
        def call(reasons,passed=True,onset={1}):
            with patch.object(m.j,'target_phase_choice',return_value=(None,{'reasons':reasons,'target_gates_passed':passed})):
                return m.choose(row,assignment,{}, {},set(),({},{}),onset)[0]
        self.assertEqual(call(['reliable previous neighbor outside time bound']),2)
        self.assertIsNone(call(['reliable previous neighbor outside time bound'],onset=set()))
        self.assertIsNone(call(['target shape similarity too low'],False))
        self.assertIsNone(call(['reliable previous neighbor outside time bound','reliable following neighbor geometry mismatch']))
        self.assertIsNone(call(['reliable previous neighbor geometry mismatch']))

    def test_unrelated_shapes_remain_unmatched(self):
        first=[math.sin(2*math.pi*i/64) for i in range(64)]
        other=[math.sin(6*math.pi*i/64) for i in range(64)]
        family={'family':1,'status':'recurring','signature_shape_64_per_channel':first}
        self.assertEqual(m.frozen_assignment({'cycle':1,'shape':other,'reliable':True},[family])['status'],'unmatched')
        self.assertEqual(m.frozen_assignment({'cycle':1,'shape':first,'reliable':False},[family])['status'],'unreliable')

    def test_audio_derived_boundary_and_unchanged_away_context(self):
        rate=12000;n=12000;change=6000
        x=[math.sin(2*math.pi*(220*i/rate if i<change else 220*change/rate+330*(i-change)/rate)) for i in range(n)]
        frames,strong=m.c.frame_analysis([x],rate);cycles,_=m.c.extract_cycles([x],rate,frames,strong)
        d={'sample_rate':rate,'reference_channel_zero_based':strong,'frames':frames,'cycles':cycles}
        bounds=m.boundaries(d,[]);self.assertEqual(len(bounds),1)
        self.assertLess(abs(bounds[0]['frame']-change),rate*.02)
        updated,changes,probes=m.adjust_periodicity(d,[x],bounds,[])
        self.assertGreater(probes,0)
        changed={v['cycle'] for v in changes}
        for old,new in zip(cycles,updated):
            if old['cycle'] not in changed:self.assertEqual(old,new)
        for v in changes:
            a,z=v['window_frames'];self.assertEqual(z-a,m.WIDTH)
            self.assertFalse(a<bounds[0]['frame']<z)

    def test_silence_and_partial_onset_are_not_filled(self):
        rate=12000;x=[0.]*3000+[math.sin(2*math.pi*240*i/rate) for i in range(3000)]
        quiet=m.silence_intervals(x,1,rate);self.assertEqual(quiet[0][0],0)
        z=quiet[0][1]
        cycles={1:{'cycle':1,'start_frame':z,'end_frame':z+5,'reliable':False},2:{'cycle':2,'start_frame':z+5,'end_frame':z+55,'reliable':True},3:{'cycle':3,'start_frame':z+55,'end_frame':z+105,'reliable':True}}
        self.assertEqual(m.first_cycles_after_silence(cycles,quiet,rate),{2})

if __name__=='__main__':unittest.main()
