import importlib.util
import math
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('g_context',Path(__file__).with_name('contextualize.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class BoundedPhaseDiagnostics(unittest.TestCase):
    def test_small_phase_probe_does_not_mutate_source_shapes(self):
        x=[math.sin(2*math.pi*i/64) for i in range(64)]
        y=[math.sin(2*math.pi*(i+.5)/64) for i in range(64)]
        before=(x[:],y[:]);probe=a.bounded_phase_similarity(x,y)
        self.assertGreater(probe['similarity'],.999999)
        self.assertEqual((x,y),before)
        self.assertLessEqual(abs(probe['shift_positions']),.5)

    def test_bounded_phase_does_not_explain_genuinely_different_shape(self):
        x=[math.sin(2*math.pi*i/64) for i in range(64)]
        y=[math.sin(2*math.pi*i/64)+.8*math.sin(4*math.pi*i/64) for i in range(64)]
        self.assertLess(a.bounded_phase_similarity(x,y)['similarity'],.85)

if __name__=='__main__':unittest.main()
