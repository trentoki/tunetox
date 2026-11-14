import importlib.util
import math
from pathlib import Path
import tempfile
import unittest
s=importlib.util.spec_from_file_location('four_d',Path(__file__).with_name('reconstruct.py'))
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

def family(channels=1):
    shape=[math.sin(2*math.pi*i/64)*(1 if c==0 else -1) for c in range(channels) for i in range(64)]
    return {'family':1,'status':'recurring','signature_shape_64_per_channel':shape}

def occurrence(n,start,end,scale=1,status='assigned',channels=1):
    return {'cycle':n,'family':1,'status':status,'reliable':True,'start_frame':start,'end_frame':end,
            'signature_rms_scale':scale,'channel_offsets':[0.]*channels}

class ShapeReconstruction(unittest.TestCase):
    def test_pitch_timing_amplitude_and_stereo(self):
        rows=[occurrence(1,3.25,103.25,.2,channels=2),occurrence(2,150.5,350.5,.7,channels=2)]
        y,mask,bridge,model=a.synthesize([family(2)],rows,400,2,44100)
        self.assertTrue(all(v==0 for v in y[:8]))
        self.assertAlmostEqual(y[28*2],.2*math.sin(2*math.pi*(28-3.25)/100),delta=.001)
        self.assertAlmostEqual(y[201*2],.7*math.sin(2*math.pi*(201-150.5)/200),delta=.001)
        self.assertTrue(all(abs(y[i]+y[i+1])<1e-12 for i in range(0,len(y),2)))
        self.assertEqual(model['accepted_cycles'],2)
        self.assertEqual(model['accepted_runs'],2)
        self.assertEqual(sum(mask),300)

    def test_ambiguous_provisional_and_unreliable_stay_silent(self):
        rows=[occurrence(1,10,110,status='ambiguous'),occurrence(2,110,210,status='provisional'),occurrence(3,210,310)]
        rows[2]['reliable']=False
        y,mask,bridge,model=a.synthesize([family()],rows,400,1,44100)
        self.assertEqual(a.energy(y),0)
        self.assertEqual(sum(mask),0)
        self.assertEqual(model['accepted_cycles'],0)

    def test_hermite_endpoint_values_and_slopes(self):
        length=12.;args=(.1,.02,-.2,-.01)
        self.assertEqual(a.hermite(*args,0,length),.1)
        self.assertAlmostEqual(a.hermite(*args,1,length),-.2)
        epsilon=1e-6
        self.assertAlmostEqual((a.hermite(*args,epsilon,length)-.1)/(epsilon*length),.02,places=5)
        self.assertAlmostEqual((-.2-a.hermite(*args,1-epsilon,length))/(epsilon*length),-.01,places=5)

    def test_adjacent_cycles_share_model_join_and_gaps_are_zero(self):
        rows=[occurrence(1,0,100,.2),occurrence(2,100,200,.7)]
        rows[0]['channel_offsets']=[.05];rows[1]['channel_offsets']=[-.03]
        y,mask,bridge,model=a.synthesize([family()],rows,220,1,44100)
        self.assertAlmostEqual(y[100],.01)
        self.assertAlmostEqual(y[0],0)
        self.assertEqual(y[200:],[0.]*20)
        self.assertEqual(model['accepted_runs'],1)

    def test_float_export_conservation_and_overwrite_refusal(self):
        x=[1.8,-1.7,.3,.1]
        y=[1.4,-.2,.12,-.4];res=[v-w for v,w in zip(x,y)]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name,values in [('x',x),('y',y),('r',res)]:a.write_float(root/name,44100,2,values)
            ex=a.read_export(root/'x')[2];ey=a.read_export(root/'y')[2];er=a.read_export(root/'r')[2]
            self.assertGreater(max(ex),1)
            self.assertLess(max(abs(v-w-z) for v,w,z in zip(ex,ey,er)),2e-7)
            with self.assertRaises(FileExistsError):a.write_float(root/'x',44100,2,x)

    def test_invalid_geometry_and_overlaps_reject(self):
        with self.assertRaises(ValueError):a.synthesize([family()],[occurrence(1,0,100),occurrence(2,99,200)],220,1,44100)
        bad=family();bad['signature_shape_64_per_channel'][0]=float('nan')
        with self.assertRaises(ValueError):a.synthesize([bad],[],10,1,44100)

if __name__=='__main__':unittest.main()
