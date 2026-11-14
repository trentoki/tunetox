import importlib.util
import math
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('four_e',Path(__file__).with_name('analyze.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class SpectralDiagnostics(unittest.TestCase):
    def test_linear_interpolation_transfer_against_numeric_projection(self):
        for harmonic in (5,20,30):
            shape=[math.cos(2*math.pi*harmonic*i/64) for i in range(64)]
            n=8192
            coefficient=2*sum(a.d.base_value_slope(shape,0,i/n,1,0,n)[0]*math.cos(2*math.pi*harmonic*i/n) for i in range(n))/n
            self.assertAlmostEqual(coefficient,a.attenuation(harmonic),delta=.0001)

    def test_stereo_power_and_known_gain_ratio(self):
        x=[math.sin(2*math.pi*440*i/44100) for i in range(2048)]
        original=[v for q in x for v in [q,-q]];half=[v*.5 for v in original]
        power=a.power_spectrum(original,2);changed=a.power_spectrum(half,2)
        xenergy=a.band_energy(power,44100,300,600);yenergy=a.band_energy(changed,44100,300,600)
        self.assertGreater(xenergy,0)
        self.assertAlmostEqual(a.decibels(yenergy,xenergy),-6.020599913,places=7)

    def test_real_cycle_nyquist_has_coincident_positive_negative_bins(self):
        shape=[(-1.)**i for i in range(64)]
        n=8192
        amplitude=2*sum(a.d.base_value_slope(shape,0,i/n,1,0,n)[0]*math.cos(2*math.pi*32*i/n) for i in range(n))/n
        self.assertAlmostEqual(amplitude,2*a.attenuation(32),delta=.0001)

    def test_silent_denominator_is_not_infinite_confidence(self):
        self.assertIsNone(a.decibels(0,0))
        self.assertIsNone(a.decibels(1,0))
        self.assertAlmostEqual(a.attenuation(0),1)

if __name__=='__main__':unittest.main()
