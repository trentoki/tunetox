import math,unittest
import methods as m
class AssignmentChecks(unittest.TestCase):
 def fixture(self):
  one=[.1*math.sin(2*math.pi*i/100) for i in range(1200)];x=one+[0.]*2300+one
  cycles={i:{'start_frame':100*i,'end_frame':100*(i+1)} for i in range(1,4)};old=[0.]*len(x)
  for row in cycles.values():
   for f in range(row['start_frame'],row['end_frame']):old[f]=.9*x[f]
  return x,old,cycles
 def test_known_samples_preserved_and_original_only_provisionals(self):
  x,old,cy=self.fixture();y,labels,regions,policy=m.assign(x,old,1,44100,cy,set(cy))
  self.assertTrue(any(v==2 for v in labels))
  self.assertTrue(all(y[i]==old[i] for i,v in enumerate(labels) if v==1))
  self.assertTrue(all(y[i]==x[i] for i,v in enumerate(labels) if v==2))
 def test_real_silence_and_unanchored_sound_are_not_copied(self):
  x,old,cy=self.fixture();y,labels,regions,policy=m.assign(x,old,1,44100,cy,set(cy))
  self.assertTrue(all(v==0 for v in y[1200:]));self.assertFalse(regions[1]['provisional_assignment_supported'])
 def test_one_cycle_cannot_establish_region(self):
  x,old,cy=self.fixture();y,labels,regions,policy=m.assign(x,old,1,44100,cy,{1})
  self.assertNotIn(2,labels)
 def test_isolated_zero_crossings_do_not_split_region(self):
  x,old,cy=self.fixture();y,labels,regions,policy=m.assign(x[:1200],old[:1200],1,44100,cy,set(cy))
  self.assertEqual(len(regions),1);self.assertEqual(labels[700],2)
if __name__=='__main__':unittest.main()
