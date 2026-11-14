"""Focused positive/negative controls, not proof of real source purity."""
import math,random,unittest
import methods as m
class Controls(unittest.TestCase):
 def test_local_presence_with_overlapping_periodic_interference(self):
  rng=random.Random(5);template=[rng.uniform(-1,1)*math.exp(-i/500) for i in range(1200)]
  observed=[v+.03*math.sin(2*math.pi*i/43) for i,v in enumerate(template)]
  self.assertTrue(m.one.presence(template,observed,1,0,64)['present'])
  self.assertFalse(m.one.presence(template,[-v for v in template],1,0,64)['present'])
  other=random.Random(6);self.assertFalse(m.one.presence(template,[other.uniform(-1,1) for _ in template],1,0,64)['present'])
 def test_repeated_transient_recurrence_without_timing_labels(self):
  rng=random.Random(3);event=[rng.uniform(-1,1)*math.exp(-i/180) for i in range(640)]
  events=[[v+.005*math.sin(2*math.pi*i/37+p) for i,v in enumerate(event)] for p in [0,.8,2.1]]
  best,_=m.one.discover(events,1,0,window_frames=32)
  self.assertIsNotNone(best);self.assertEqual(len(best[3]),3)
 def test_pitch_normalization_does_not_force_different_shapes_together(self):
  wave=lambda period:[math.sin(2*math.pi*i/period)+.2*math.sin(4*math.pi*i/period) for i in range(period+1)]
  a=m.c.signature([wave(100)],0,100)['shape'];b=m.c.signature([wave(150)],0,150)['shape'];other=m.c.signature([[math.sin(6*math.pi*i/100) for i in range(101)]],0,100)['shape']
  self.assertGreater(m.c.cosine(a,b),.995);self.assertLess(m.c.cosine(a,other),.985)
 def test_candidates_computationally_capped(self):
  rate=8000;x=[0.]*24000
  for a in range(0,len(x)-80,600):
   for i in range(80):x[a+i]=math.exp(-i/20)
  events,detail=m.event_candidates(x,1,rate);self.assertLessEqual(len(events),m.POLICY['max_event_candidates'])
 def test_residual_is_explicit_not_duplicated(self):
  original=[.8,-.4,.3];first=[.2,-.1,.1];second=[.3,-.2,.05];residual=[v-a-b for v,a,b in zip(original,first,second)]
  self.assertGreater(m.one.energy(residual),0)
  self.assertTrue(all(abs(v-a-b-r)<1e-15 for v,a,b,r in zip(original,first,second,residual)))
if __name__=='__main__':unittest.main()
