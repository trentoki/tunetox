import math
import unittest
import methods as m
import render

def signal(second=0,phase=0):return [math.sin(2*math.pi*i/64)+second*math.sin(4*math.pi*i/64+phase) for i in range(64)]
def harmonic_vector(shape):
    return [abs(sum(v*complex(math.cos(-2*math.pi*h*i/64),math.sin(-2*math.pi*h*i/64)) for i,v in enumerate(shape))) for h in range(1,13)]
def row(n,shape):return {'cycle':n,'shape':shape,'harmonics':harmonic_vector(shape),'reliable':True,'periodicity':1.,'period_error_fraction':0.,'start_frame':(n-1)*100.,'end_frame':n*100.}

class IndependentMethods(unittest.TestCase):
    def test_frozen_renderer_matches_4d_exactly(self):
        families=[{'family':1,'status':'recurring','signature_shape_64_per_channel':signal(.2)}]
        rows=[{**row(i,signal(.2)),'family':1,'status':'assigned','channel_offsets':[.01],'signature_rms_scale':.2*i} for i in [1,2]]
        x=render.d.synthesize(families,rows,220,1,44100)
        y=render.synthesize(families,rows,220,1,44100,render.d.base_value_slope)
        self.assertEqual(x,y)

    def test_cubic_improves_represented_harmonic_without_new_samples(self):
        h=15;shape=[math.cos(2*math.pi*h*i/64) for i in range(64)];n=4096
        linear=2*sum(m.linear_table(shape,i/n)[0]*math.cos(2*math.pi*h*i/n) for i in range(n))/n
        cubic=2*sum(m.cubic_table(shape,i/n)[0]*math.cos(2*math.pi*h*i/n) for i in range(n))/n
        self.assertGreater(cubic,linear)
        self.assertLessEqual(cubic,1.01)

    def test_native_exemplar_harmonic_fit_and_pitch_band_limit(self):
        start=1.3;duration=141.8;values=[.2+2*(math.sin(2*math.pi*(i-start)/duration)+.3*math.sin(14*math.pi*(i-start)/duration)) for i in range(300)]
        fit=m.fit_harmonics([values],start,start+duration,[.2],2)
        self.assertLess(fit['normalized_exemplar_fit_rmse'][0],1e-10)
        for phase in [.1,.33,.8]:
            v,d=m.harmonic_value(fit['coefficients'][0],phase,fit['maximum_harmonic'])
            self.assertAlmostEqual(v,math.sin(2*math.pi*phase)+.3*math.sin(14*math.pi*phase),places=9)
            low,_=m.harmonic_value(fit['coefficients'][0],phase,6)
            self.assertAlmostEqual(low,math.sin(2*math.pi*phase),places=9)

    def fixtures(self,second_b=.15,phase_b=0):
        x=signal(.1);y=signal(second_b,phase_b);target=signal(.125)
        cycles={i:row(i,target) for i in range(1,6)};cycles[101]=row(101,x);cycles[102]=row(102,y)
        families=[{'family':i,'status':'recurring','prototype_cycle':100+i,'signature_shape_64_per_channel':shape} for i,shape in [(1,x),(2,y)]]
        candidates=[{'family':1,'similarity':m.cosine(target,x)},{'family':2,'similarity':m.cosine(target,y)}]
        assignments=[{'cycle':i,'status':'ambiguous','family':None,'candidates':candidates} for i in [2,3,4]]
        return cycles,families,assignments

    def test_related_variants_can_support_waveform_without_merging_identity(self):
        cycles,families,assignments=self.fixtures();allowed,details=m.related_pairs(families,cycles,assignments)
        family,reasons=m.choose_related(cycles[3],assignments[1],cycles,{f['family']:f for f in families},allowed)
        self.assertIsNotNone(family)
        self.assertEqual(reasons,[])
        self.assertIsNone(assignments[1]['family'])

    def test_genuinely_different_shape_and_phase_collision_reject(self):
        for second,phase in [(.7,0),(.8,math.pi/2)]:
            cycles,families,assignments=self.fixtures(second,phase)
            allowed,details=m.related_pairs(families,cycles,assignments)
            self.assertEqual(allowed,set())
            family,reasons=m.choose_related(cycles[3],assignments[1],cycles,{f['family']:f for f in families},allowed)
            self.assertIsNone(family)

    def test_equal_harmonic_magnitudes_with_different_phase_are_not_merged(self):
        cycles,families,assignments=self.fixtures(.8,math.pi/2)
        x=signal(.8);cycles[101]=row(101,x);families[0]['signature_shape_64_per_channel']=x
        self.assertGreater(m.cosine(cycles[101]['harmonics'],cycles[102]['harmonics']),.999)
        self.assertEqual(m.related_pairs(families,cycles,assignments)[0],set())

    def test_transitions_bad_neighbors_and_provisional_relationships_reject(self):
        cycles,families,assignments=self.fixtures();allowed,_=m.related_pairs(families,cycles,assignments)
        cycles[2]['end_frame']-=8
        self.assertIsNone(m.choose_related(cycles[3],assignments[1],cycles,{f['family']:f for f in families},allowed)[0])
        cycles[2]['end_frame']+=8;cycles[3]['reliable']=False
        self.assertIsNone(m.choose_related(cycles[3],assignments[1],cycles,{f['family']:f for f in families},allowed)[0])
        families[1]['status']='provisional'
        self.assertEqual(m.related_pairs(families,cycles,assignments)[0],set())

    def test_polarity_is_not_automatically_equivalent(self):
        x=signal(.3);self.assertLess(m.cosine(x,[-v for v in x]),-.999)
        self.assertAlmostEqual(m.phase_distance(x,[-v for v in x]),.5)

if __name__=='__main__':unittest.main()
