import importlib.util
import math
from pathlib import Path
import random
import unittest
s=importlib.util.spec_from_file_location('shape_analysis',Path(__file__).with_name('analysis.py'))
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

def wave(frequency,seconds=.2,scale=1,second=0,offset=0):
    return [offset+scale*(math.sin(2*math.pi*frequency*i/44100)+second*math.sin(4*math.pi*frequency*i/44100)) for i in range(round(seconds*44100))]

class CycleDiagnostics(unittest.TestCase):
    def test_shape_pitch_gain_and_dc_invariance(self):
        rows=[]
        for f,g,dc in [(220,1,0),(370,.2,.3),(600,2,-.1)]:
            x=wave(f,scale=g,second=.3,offset=dc)
            rows.append(a.signature([x],0,44100/f))
        self.assertGreater(a.cosine(rows[0]['shape'],rows[1]['shape']),.999)
        self.assertGreater(a.cosine(rows[0]['shape'],rows[2]['shape']),.999)
        self.assertGreater(rows[2]['signature_rms_scale']/rows[1]['signature_rms_scale'],9.9)

    def test_different_shapes_at_same_pitch_and_polarity(self):
        x=wave(300);y=wave(300,second=.7)
        left=a.signature([x],0,147);right=a.signature([y],0,147)
        inverted=a.signature([[-v for v in x]],0,147)
        self.assertLess(a.cosine(left['shape'],right['shape']),.9)
        self.assertLess(a.cosine(left['shape'],inverted['shape']),-.999)
        self.assertGreater(a.cosine(left['harmonics'],inverted['harmonics']),.999)

    def test_stereo_and_boundary_timing(self):
        x=wave(300);channels=[x,[-v for v in x]];before=[v[:] for v in channels]
        frames,strongest=a.frame_analysis(channels,44100)
        cycles,level=a.extract_cycles(channels,44100,frames,strongest)
        reliable=[row for row in cycles if row['reliable']]
        self.assertGreater(len(reliable),30)
        self.assertLess(max(abs(row['frequency_hz']-300) for row in reliable),.2)
        for row in reliable:
            self.assertLess(a.cosine(row['shape'][:64],row['shape'][64:]),-.999)
        self.assertEqual(channels,before)

    def test_silence_and_nonperiodic_are_not_forced(self):
        for x in [[0.]*8820,[random.Random(17+i).uniform(-1,1) for i in range(8820)]]:
            frames,strongest=a.frame_analysis([x],44100)
            cycles,level=a.extract_cycles([x],44100,frames,strongest)
            families,assignments,count=a.cluster(cycles)
            self.assertEqual(sum(row['reliable'] for row in cycles),0)
            self.assertEqual(families,[])

    def test_multiple_families_provisional_and_ambiguous(self):
        def row(n,theta):
            vector=[math.cos(theta),math.sin(theta)]
            return {'cycle':n,'reliable':True,**{key:vector for key in ['shape','slopes','curvature','harmonics']}}
        families,assignments,count=a.cluster([row(1,-.14),row(2,.14),row(3,0)])
        self.assertEqual(len(families),2)
        self.assertEqual(assignments[-1]['status'],'ambiguous')
        self.assertTrue(all(f['status']=='provisional' for f in families))
        families,assignments,count=a.cluster([row(1,0),row(2,0),row(3,0),row(4,1),row(5,1),row(6,1)])
        self.assertEqual(sum(f['status']=='recurring' for f in families),2)

if __name__=='__main__':unittest.main()
