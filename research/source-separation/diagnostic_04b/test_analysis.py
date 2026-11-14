import math
from pathlib import Path
import random
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import analysis as a

class Diagnostics(unittest.TestCase):
    def test_fft_roundtrip(self):
        x=[.3,-.4,.1,0.,.7,.2,-.1,0.]
        y=a.fft(a.fft(x),True)
        self.assertLess(max(abs(v.real-w) for v,w in zip(y,x)),1e-12)

    def test_pitch_and_negative_controls(self):
        for hz in (180,350,720):
            x=[math.sin(2*math.pi*hz*i/44100) for i in range(2048)]
            f,confidence=a.pitch(x,44100)
            self.assertLess(abs(1200*math.log2(f/hz)),15)
            self.assertGreater(confidence,.9)
        self.assertIsNone(a.pitch([0.]*2048,44100)[0])
        rng=random.Random(64)
        self.assertIsNone(a.pitch([rng.uniform(-1,1) for i in range(2048)],44100)[0])

    def test_harmonic_relative_similarity_and_negative_timbre(self):
        vectors=[]
        for f in (220,370):
            x=[sum(g*math.sin(2*math.pi*f*h*i/44100) for h,g in [(1,1),(2,.6),(3,.4)]) for i in range(2048)]
            h,_=a.spectral_features(a.spectrum(x),f,44100);vectors.append(h)
        pure=[math.sin(2*math.pi*220*i/44100) for i in range(2048)]
        h,_=a.spectral_features(a.spectrum(pure),220,44100)
        self.assertGreater(a.cosine(*vectors),.98)
        self.assertLess(a.cosine(vectors[0],h),.9)

    def test_waveform_scaling_gain_and_stereo(self):
        rate=44100;x=[]
        for i in range(rate):
            f=220 if i<rate//2 else 330
            x.append(math.sin(2*math.pi*f*i/rate)+.3*math.sin(4*math.pi*f*i/rate))
        channels=[x,[-v for v in x]];before=[ch[:] for ch in channels]
        left={'f0':220,'center':rate//4};right={'f0':330,'center':3*rate//4}
        raw=a.waveform_compare(channels,left,right,rate,False)
        scaled=a.waveform_compare(channels,left,right,rate,True)
        self.assertGreater(abs(scaled['signed_correlation']),.99)
        self.assertLess(abs(raw['signed_correlation']),.2)
        self.assertEqual(channels,before)

    def test_regions_have_no_expected_count(self):
        def frame(i,f):return {'frame':i*441,'f0':f}
        self.assertEqual(a.regions_from_frames([frame(i,None) for i in range(20)],44100,441),[])
        frames=[frame(i,200 if i<8 else 300) for i in range(16)]
        self.assertEqual(len(a.regions_from_frames(frames,44100,441)),2)

if __name__=='__main__':unittest.main()
