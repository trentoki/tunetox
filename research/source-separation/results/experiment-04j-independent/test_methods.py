import copy
import math
import unittest
import methods as m

def shape(phase=0,second=0):return [math.sin(2*math.pi*(i+phase)/64)+.3*math.sin(16*math.pi*(i+phase)/64)+second*math.sin(4*math.pi*(i+phase)/64) for i in range(64)]
def harmonics(v):return [abs(sum(x*complex(math.cos(-2*math.pi*h*i/64),math.sin(-2*math.pi*h*i/64)) for i,x in enumerate(v))) for h in range(1,13)]
def signature_row(i,start,end,v):return {'cycle':i,'start_frame':float(start),'end_frame':float(end),'shape':v,'harmonics':harmonics(v),'reliable':True,'periodicity':1.,'period_error_fraction':0.}

class TargetRecognition(unittest.TestCase):
    def fixture(self,target=None):
        x=shape();y=shape(second=.002);target=shape(.5) if target is None else target
        cycles={1:signature_row(1,0,100,target),2:signature_row(2,100,200,target),3:signature_row(3,200,300,target),
                101:signature_row(101,10000,10100,x),102:signature_row(102,10100,10200,y)}
        families={i:{'family':i,'status':'recurring','prototype_cycle':100+i,'signature_shape_64_per_channel':v} for i,v in [(1,x),(2,y)]}
        assignment={'cycle':2,'status':'ambiguous','family':None,'candidates':[{'family':i,'similarity':m.h.f.cosine(target,v)} for i,v in [(1,x),(2,y)]]}
        return cycles,families,assignment
    def test_phase_target_passes_without_lowering_threshold_or_mutating(self):
        cycles,families,a=self.fixture();before=copy.deepcopy((cycles,families,a));neighbors=m.h.temporal_neighbors(cycles)
        self.assertIsNone(m.h.choose(cycles[2],a,cycles,families,{(1,2)},neighbors)[0])
        family,evidence=m.target_phase_choice(cycles[2],a,cycles,families,{(1,2)},neighbors)
        self.assertIsNotNone(family);self.assertLess(evidence['original_target_similarity'],.995)
        self.assertGreaterEqual(evidence['phase_tolerant_target_similarity'],.995)
        self.assertEqual(evidence['synthesis_phase_shift'],0);self.assertEqual((cycles,families,a),before)
    def test_different_shape_polarity_and_large_phase_do_not_pass(self):
        different=[math.sin(2*math.pi*i/64)+.8*math.sin(4*math.pi*i/64) for i in range(64)]
        for v in [different,[-x for x in shape()],shape(3)]:
            cycles,families,a=self.fixture(v)
            self.assertIsNone(m.target_phase_choice(cycles[2],a,cycles,families,{(1,2)},m.h.temporal_neighbors(cycles))[0])
    def test_other_target_and_relationship_gates_stay_fixed(self):
        cycles,families,a=self.fixture();cycles[2]['periodicity']=.7
        self.assertIsNone(m.target_phase_choice(cycles[2],a,cycles,families,{(1,2)},m.h.temporal_neighbors(cycles))[0])
        cycles,families,a=self.fixture()
        self.assertIsNone(m.target_phase_choice(cycles[2],a,cycles,families,set(),m.h.temporal_neighbors(cycles))[0])

class SequenceContinuation(unittest.TestCase):
    def fixture(self,period_right=100,gap_cycles=1):
        v=[math.sin(2*math.pi*i/64)+.05*math.sin(4*math.pi*i/64) for i in range(64)]
        families={1:{'family':1,'status':'recurring','signature_shape_64_per_channel':v}}
        def row(i,start,period):return {'cycle':i,'start_frame':float(start),'end_frame':float(start+period),'shape':v,'family':1,'status':'assigned','reliable':True,'signature_rms_scale':.2,'channel_offsets':[0.]}
        left=[row(i+1,i*100,100) for i in range(3)];start=300+gap_cycles*100
        right=[row(i+5,start+i*period_right,period_right) for i in range(3)]
        original=[.2*(math.sin(2*math.pi*i/100)+.05*math.sin(4*math.pi*i/100)) for i in range(start+3*period_right)]
        return left,right,families,original
    def test_fixed_neighbor_prediction_accepts_real_coherent_cycles(self):
        left,right,families,x=self.fixture();before=copy.deepcopy((left,right,families))
        proposed,detail=m.propose_sequence_gap(left,right,families,set(),44100,1)
        self.assertEqual(len(proposed),1);self.assertEqual(proposed[0]['start_frame'],300);self.assertEqual(proposed[0]['end_frame'],400)
        self.assertIn('inferred',proposed[0]['provenance']);self.assertEqual((left,right,families),before)
        self.assertTrue(m.verify_proposal(proposed,left,right,families,x,1,44100)[0])
    def test_silence_clear_ending_and_unrelated_waveform_reject(self):
        left,right,families,x=self.fixture();proposed,_=m.propose_sequence_gap(left,right,families,set(),44100,1)
        for mode in ['silence','different','inverted']:
            changed=x[:]
            for i in range(300,400):
                changed[i]=0 if mode=='silence' else (.2*(math.sin(2*math.pi*i/100)+.8*math.sin(4*math.pi*i/100)) if mode=='different' else -x[i])
            self.assertFalse(m.verify_proposal(proposed,left,right,families,changed,1,44100)[0])
        self.assertEqual(m.propose_sequence_gap(left,[],families,set(),44100,1)[0],[])
    def test_note_transition_long_gap_and_volume_jump_reject(self):
        left,right,families,x=self.fixture(80)
        self.assertEqual(m.propose_sequence_gap(left,right,families,set(),44100,1)[0],[])
        left,right,families,x=self.fixture(gap_cycles=3)
        self.assertEqual(m.propose_sequence_gap(left,right,families,set(),44100,1)[0],[])
        left,right,families,x=self.fixture()
        for v in right:v['signature_rms_scale']=.4
        self.assertEqual(m.propose_sequence_gap(left,right,families,set(),44100,1)[0],[])
    def test_two_period_inference_and_unrelated_context_families(self):
        left,right,families,x=self.fixture(gap_cycles=2)
        proposed,_=m.propose_sequence_gap(left,right,families,set(),44100,1)
        self.assertEqual(len(proposed),2);self.assertEqual(proposed[-1]['end_frame'],500)
        self.assertTrue(m.verify_proposal(proposed,left,right,families,x,1,44100)[0])
        families[2]={**families[1],'family':2}
        for v in right:v['family']=2
        self.assertEqual(m.propose_sequence_gap(left,right,families,set(),44100,1)[0],[])

if __name__=='__main__':unittest.main()
