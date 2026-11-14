"""Focused multi-period controls; real inputs learn their own tables, never these."""
import math,random,unittest
import correction as d
class Controls(unittest.TestCase):
 def fixture(self,kind='related',confidence=.95,refs=3):
  rate=8000;period=100;n=2000;shape=lambda phase:math.sqrt(2)*math.sin(2*math.pi*phase)
  table=[shape(i/256) for i in range(256)];s64=[shape(i/64) for i in range(64)];raw=[.1*shape(i/period) for i in range(n)]
  if kind=='different':raw[500:1500]=[.1*math.sin(6*math.pi*i/period) for i in range(500,1500)]
  if kind=='silence':raw[500:1500]=[0.]*1000
  if kind=='noise':
   rng=random.Random(9);raw[500:1500]=[rng.uniform(-.2,.2) for i in range(1000)]
  cycles=[{'cycle':k,'start_frame':100*k,'end_frame':100*(k+1),'frequency_hz':80,'signature_rms_scale':.1,'absolute_rms':.1,'channel_offsets':[0]} for k in range(1,refs+1)];old=[0.]*n
  for row in cycles:old[int(row['start_frame']):int(row['end_frame'])]=raw[int(row['start_frame']):int(row['end_frame'])]
  inv={'cycles':cycles,'frames':[{'frame':1000,'f0':80,'periodicity':confidence,'active':True}],'families':[{'family':1,'shape':s64,'occurrences':list(range(1,refs+1))}]};detail={'groups':[{'cycle_ids':list(range(1,refs+1)),'family_ids':[1],'inferred_occurrences':[]}],'models':{1:{'tables':[table]}}}
  return raw,[old],inv,detail,rate,1
 def test_related_periodic_material_recognized_without_crossings(self):
  args=self.fixture();output,mask,info=d.apply(*args);self.assertGreaterEqual(info['new_cycle_count'],3);self.assertGreater(sum(mask),0)
 def test_different_shape_rejected(self):
  _,mask,info=d.apply(*self.fixture('different'));self.assertEqual(sum(mask),0)
 def test_noise_and_real_silence_not_filled(self):
  for kind in ['noise','silence']:
   _,mask,_=d.apply(*self.fixture(kind));self.assertEqual(sum(mask),0)
 def test_low_confidence_and_unknown_pitch_stay_unassigned(self):
  _,mask,_=d.apply(*self.fixture(confidence=.89));self.assertEqual(sum(mask),0)
  args=list(self.fixture());args[2]['frames'][0]['f0']=94
  _,mask,_=d.apply(*args);self.assertEqual(sum(mask),0)
 def test_insufficient_references_and_no_structure_do_not_invent_identity(self):
  _,mask,_=d.apply(*self.fixture(refs=1));self.assertEqual(sum(mask),0)
  args=list(self.fixture());args[1]=[];args[3]={'groups':[]};_,mask,info=d.apply(*args);self.assertEqual(sum(mask),0);self.assertFalse(info['applied'])
 def test_genuine_pitch_change_is_not_bridged(self):
  args=list(self.fixture());raw=args[0]
  raw[1000:1500]=[.1*math.sqrt(2)*math.sin(4*math.pi*i/100) for i in range(1000,1500)]
  _,mask,_=d.apply(*args);self.assertTrue(all(not v for v in mask[1000:1500]))
 def test_previous_audio_preserved_and_new_cycles_disjoint(self):
  args=self.fixture();out,mask,info=d.apply(*args);old=args[1][0]
  self.assertTrue(all(out[0][i]==old[i] for i in range(len(old)) if old[i]!=0));rows=sorted(info['new_occurrences'],key=lambda r:r['start_frame']);self.assertTrue(all(a['end_frame']<=b['start_frame']+1e-8 for a,b in zip(rows,rows[1:])))
  residual=[x-y for x,y in zip(args[0],out[0])];self.assertTrue(all(abs(x-y-r)<1e-15 for x,y,r in zip(args[0],out[0],residual)))
if __name__=='__main__':unittest.main()
