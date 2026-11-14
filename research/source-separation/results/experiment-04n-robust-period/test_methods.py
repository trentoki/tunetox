"""Focused estimator, transition, fallback and shape safeguards."""
import math
import unittest
from unittest.mock import patch
import methods as n

class PeriodChecks(unittest.TestCase):
 def context(self,periods=None):
  periods=periods or [100,100,100,101,98.5,100,100]
  shape=[math.sin(2*math.pi*i/64) for i in range(64)];cursor=100.;rows={}
  for i,duration in enumerate(periods,1):
   rows[i]={'cycle':i,'start_frame':cursor,'end_frame':cursor+duration,'reliable':True,'estimated_f0_hz':440.,'shape':shape};cursor+=duration
  return rows,rows[4],n.h.temporal_neighbors(rows)
 def test_median_reduces_boundary_outlier_without_lowering_tolerance(self):
  rows,target,neighbors=self.context();period,detail=n.local_period(target,rows,neighbors,[],[])
  self.assertEqual(n.TOLERANCE,.02);self.assertEqual(period,100.)
  self.assertGreater(abs(98.5/101-1),.02);self.assertLess(detail['target_deviation'],.02)
  self.assertNotIn(4,detail['reference_cycle_ids'])
 def test_insufficient_context_falls_back_exactly(self):
  rows,target,neighbors=self.context();rows={k:v for k,v in rows.items() if k in [3,4,5]};neighbors=n.h.temporal_neighbors(rows)
  self.assertIsNone(n.local_period(target,rows,neighbors,[],[])[0])
  with patch.object(n.h.f,'choose_related',return_value=(None,['neighbor period/continuity mismatch'])):
   assignment={'candidates':[{'family':1,'similarity':1.}]}
   old=n.h.choose(target,assignment,rows,{},set(),neighbors)
   new=n.make_choose([],[])(target,assignment,rows,{},set(),neighbors)
   self.assertEqual(old[0],new[0]);self.assertEqual(old[1]['reasons'],new[1]['reasons'])
 def test_silence_or_boundary_prevents_pooling(self):
  rows,target,neighbors=self.context();start=target['start_frame'];end=target['end_frame']
  self.assertIsNone(n.local_period(target,rows,neighbors,[{'bracket_frames':[start-1,end+1]}],[])[0])
  self.assertIsNone(n.local_period(target,rows,neighbors,[],[(start-1,end+1)])[0])
  # At an onset, loss of all preceding context prevents a two-sided estimate.
  self.assertIsNone(n.local_period(target,rows,neighbors,[],[(0,start)])[0])
 def test_unmarked_genuine_period_change_is_not_averaged(self):
  rows,target,neighbors=self.context([100,100,100,100,110,110,110])
  self.assertIsNone(n.local_period(target,rows,neighbors,[],[])[0])
  for k in [5,6,7]:rows[k]['estimated_f0_hz']=400.
  self.assertIsNone(n.local_period(target,rows,n.h.temporal_neighbors(rows),[],[])[0])
 def test_unrelated_shape_and_failed_target_still_reject(self):
  rows,target,neighbors=self.context();rows[5]['shape']=[math.sin(6*math.pi*i/64) for i in range(64)]
  assignment={'candidates':[{'family':1,'similarity':1.}]}
  with patch.object(n.h.f,'choose_related',return_value=(None,['neighbor period/continuity mismatch'])):
   family,detail=n.make_choose([],[])(target,assignment,rows,{},set(),neighbors)
   self.assertIsNone(family);self.assertIn('reliable following neighbor geometry mismatch',detail['reasons'])
  with patch.object(n.h.f,'choose_related',return_value=(None,['target shape similarity too low'])):
   family,detail=n.make_choose([],[])(target,assignment,rows,{},set(),neighbors)
   self.assertIsNone(family);self.assertFalse(detail['target_gates_passed'])
if __name__=='__main__':unittest.main()
