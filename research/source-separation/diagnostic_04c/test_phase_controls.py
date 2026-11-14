import importlib.util
import math
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('shape_phase',Path(__file__).with_name('analysis.py'))
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class PhaseControls(unittest.TestCase):
    def test_equal_harmonic_magnitudes_do_not_prove_equal_geometry(self):
        n=147
        left=[math.sin(2*math.pi*i/n)+.8*math.sin(4*math.pi*i/n) for i in range(n+2)]
        right=[math.sin(2*math.pi*i/n)+.8*math.cos(4*math.pi*i/n) for i in range(n+2)]
        x=a.signature([left],0,n);y=a.signature([right],0,n)
        self.assertGreater(a.cosine(x['harmonics'],y['harmonics']),.999)
        self.assertLess(a.cosine(x['shape'],y['shape']),.7)

    def test_raw_amplitude_equality_is_not_used_by_clustering(self):
        rows=[]
        for index,gain in enumerate([.1,.7,2.]):
            values=[gain*math.sin(2*math.pi*i/147) for i in range(149)]
            row=a.signature([values],0,147)
            row.update({'cycle':index+1,'reliable':True})
            rows.append(row)
        families,assignments,count=a.cluster(rows)
        self.assertEqual(len(families),1)
        self.assertEqual(families[0]['status'],'recurring')
