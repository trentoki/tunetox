import copy
import math
import unittest
from pathlib import Path
import recognition as h


def shape(phase=0,second=0):
    return [math.sin(2*math.pi*(i+phase)/64)+.3*math.sin(16*math.pi*(i+phase)/64)+second*math.sin(4*math.pi*(i+phase)/64) for i in range(64)]

def harmonics(values):
    return [abs(sum(v*complex(math.cos(-2*math.pi*k*i/64),math.sin(-2*math.pi*k*i/64)) for i,v in enumerate(values))) for k in range(1,13)]

def row(i,start,end,values,reliable=True):
    return {'cycle':i,'start_frame':float(start),'end_frame':float(end),'shape':values,'harmonics':harmonics(values),
            'periodicity':1.,'period_error_fraction':0.,'reliable':reliable}


def fixture(micro=True,phase=.5):
    x=shape();b=shape(second=.002)
    cycles={1:row(1,0,100,shape(phase)),3:row(3,101 if micro else 100,201 if micro else 200,x),
            4:row(4,201 if micro else 200,301 if micro else 300,shape(-phase)),
            101:row(101,10000,10100,x),102:row(102,10100,10200,b)}
    if micro:cycles[2]=row(2,100,101,shape(),False)
    else:
        cycles[2]=cycles.pop(3);cycles[2]['cycle']=2
        cycles[3]=cycles.pop(4);cycles[3]['cycle']=3
    i=3 if micro else 2
    families={1:{'family':1,'status':'recurring','prototype_cycle':101},2:{'family':2,'status':'recurring','prototype_cycle':102}}
    assignment={'cycle':i,'status':'ambiguous','family':None,
                'candidates':[{'family':1,'similarity':h.f.cosine(cycles[i]['shape'],x)},
                              {'family':2,'similarity':h.f.cosine(cycles[i]['shape'],b)}]}
    return cycles,families,assignment

class PhaseTolerantNeighbors(unittest.TestCase):
    def choose(self,cycles,families,assignment):
        return h.choose(cycles[assignment['cycle']],assignment,cycles,families,{(1,2)},h.temporal_neighbors(cycles))

    def test_micro_crossing_and_small_neighbor_phase_can_recover(self):
        cycles,families,a=fixture();before=copy.deepcopy((cycles,families,a))
        old,reasons=h.f.choose_related(cycles[3],a,cycles,families,{(1,2)})
        self.assertIsNone(old);self.assertIn('unreliable immediate neighbor',reasons)
        family,evidence=self.choose(cycles,families,a)
        self.assertEqual(family,1)
        self.assertTrue(all(abs(v['comparison_shift_positions'])<=.5 for v in evidence['neighbors']))
        self.assertEqual((cycles,families,a),before)

    def test_genuinely_different_neighbor_shape_rejects(self):
        cycles,families,a=fixture()
        values=[math.sin(2*math.pi*i/64)+.8*math.sin(4*math.pi*i/64) for i in range(64)]
        cycles[4]['shape']=values
        self.assertIsNone(self.choose(cycles,families,a)[0])

    def test_polarity_inversion_is_not_phase_tolerance(self):
        cycles,families,a=fixture();cycles[4]['shape']=[-v for v in cycles[4]['shape']]
        self.assertIsNone(self.choose(cycles,families,a)[0])

    def test_real_time_gap_and_pitch_transition_reject(self):
        cycles,families,a=fixture();cycles[1]['end_frame']=70
        self.assertIsNone(self.choose(cycles,families,a)[0])
        cycles,families,a=fixture();cycles[4]['end_frame']+=20
        self.assertIsNone(self.choose(cycles,families,a)[0])

    def test_target_confidence_is_not_relaxed_or_phase_aligned(self):
        cycles,families,a=fixture();cycles[3]['periodicity']=.7
        self.assertIn('period confidence insufficient',self.choose(cycles,families,a)[1]['reasons'])
        cycles,families,a=fixture();cycles[3]['shape']=shape(.5)
        a['candidates']=[{'family':i,'similarity':h.f.cosine(cycles[3]['shape'],cycles[v['prototype_cycle']]['shape'])} for i,v in families.items()]
        family,evidence=self.choose(cycles,families,a)
        self.assertIsNone(family);self.assertIn('target shape similarity too low',evidence['reasons'])

    def test_unreliable_target_or_unknown_relationship_remains_unresolved(self):
        cycles,families,a=fixture();cycles[3]['reliable']=False
        self.assertIsNone(self.choose(cycles,families,a)[0])
        cycles,families,a=fixture()
        self.assertIsNone(h.choose(cycles[3],a,cycles,families,set(),h.temporal_neighbors(cycles))[0])

    def test_existing_strict_b_match_is_retained(self):
        cycles,families,a=fixture(False,0)
        old,_=h.f.choose_related(cycles[2],a,cycles,families,{(1,2)})
        self.assertEqual(self.choose(cycles,families,a)[0],old)
        self.assertIsNotNone(old)

    def test_renderer_is_frozen_4d_with_no_synthesis_phase_offset(self):
        renderer=h.load('render_for_test',h.ROOT/'results/experiment-04f-independent/render.py')
        families=[{'family':1,'status':'recurring','signature_shape_64_per_channel':shape()}]
        rows=[{'cycle':1,'family':1,'status':'assigned','reliable':True,'start_frame':1.25,'end_frame':101.25,'signature_rms_scale':.2,'channel_offsets':[.01]}]
        expected=renderer.d.synthesize(families,rows,120,1,44100)
        actual=renderer.synthesize(families,rows,120,1,44100,renderer.d.base_value_slope)
        self.assertEqual(expected,actual)

if __name__=='__main__':unittest.main()
