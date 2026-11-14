"""4N: one robust duration reference; frozen 4L target gates and synthesis."""
import importlib.util
from pathlib import Path
import statistics
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(s);s.loader.exec_module(module);return module
l=load('frozen_l_for_n',ROOT/'results/experiment-04l-boundary-periodicity/methods.py')
h=l.j.h
TOLERANCE=h.f.RELATION_POLICY['neighbor_period_change_max']
CONTEXT_PER_SIDE=3
MIN_REFERENCES=3

def local_period(row,cycles,neighbors,bounds,quiet):
 """At most three reliable periods per side, excluding the target itself.

 Refuse uncertain pitch-boundary brackets, silence/onsets, discontinuous context,
 discordant f0, or disagreeing flank medians. No recursively accepted evidence.
 """
 start,end=row['start_frame'],row['end_frame'];duration=end-start
 barriers=[tuple(v['bracket_frames']) for v in bounds]+[tuple(v) for v in quiet]
 if any(a<end and z>start for a,z in barriers):return None,{'fallback':'target overlaps boundary/silence bracket'}
 context=[];sides=[]
 for side,lookup in [('previous',neighbors[0]),('following',neighbors[1])]:
  cursor=row;flank=[]
  for _ in range(CONTEXT_PER_SIDE):
   other=lookup.get(cursor['cycle'])
   if other is None:break
   a=min(other['start_frame'],cursor['start_frame']);z=max(other['end_frame'],cursor['end_frame'])
   if any(lo<z and hi>a for lo,hi in barriers):break
   gap=cursor['start_frame']-other['end_frame'] if side=='previous' else other['start_frame']-cursor['end_frame']
   if gap< -1e-8 or gap/duration>h.MAX_GAP_PERIODS:break
   if not other.get('estimated_f0_hz') or not row.get('estimated_f0_hz'):break
   if abs(other['estimated_f0_hz']/row['estimated_f0_hz']-1)>TOLERANCE:break
   flank.append(other);cursor=other
  sides.append(flank);context.extend(flank)
 detail={'reference_cycle_ids':[v['cycle'] for v in context],'flank_counts':[len(v) for v in sides]}
 if len(context)<MIN_REFERENCES or any(not flank for flank in sides):return None,{**detail,'fallback':'insufficient reliable two-sided context'}
 medians=[statistics.median(v['end_frame']-v['start_frame'] for v in flank) for flank in sides]
 if abs(medians[0]/medians[1]-1)>TOLERANCE:return None,{**detail,'fallback':'flank period change','flank_medians':medians}
 periods=[v['end_frame']-v['start_frame'] for v in context];median=statistics.median(periods)
 mad=statistics.median(abs(v-median) for v in periods)
 if mad/median>TOLERANCE:return None,{**detail,'fallback':'unstable local periods'}
 return median,{**detail,'period_frames':median,'reference_periods_frames':periods,'flank_medians':medians,'relative_median_absolute_deviation':mad/median,'target_deviation':abs(median/duration-1)}


def make_choose(bounds,quiet):
 """Frozen 4H neighbor logic with only its period reference substituted."""
 def choose(row,assignment,cycles,families,allowed,neighbors):
  _,old_reasons=h.f.choose_related(row,assignment,cycles,families,allowed)
  reasons=[reason for reason in old_reasons if reason not in h.NEIGHBOR_REASONS]
  if reasons:return None,{'reasons':reasons,'neighbors':[],'target_gates_passed':False}
  duration=row['end_frame']-row['start_frame'];evidence=[]
  robust,period_detail=local_period(row,cycles,neighbors,bounds,quiet)
  for side,lookup in [('previous',neighbors[0]),('following',neighbors[1])]:
   neighbor=lookup.get(row['cycle'])
   if neighbor is None:
    reasons.append('no reliable '+side+' temporal neighbor');continue
   gap=row['start_frame']-neighbor['end_frame'] if side=='previous' else neighbor['start_frame']-row['end_frame']
   gap_periods=gap/duration;single_change=abs((neighbor['end_frame']-neighbor['start_frame'])/duration-1)
   period_change=abs(robust/duration-1) if robust is not None else single_change
   detail={'side':side,'cycle':neighbor['cycle'],'gap_periods':gap_periods,'relative_period_change':period_change,'original_single_neighbor_deviation':single_change}
   if gap< -1e-8 or gap_periods>h.MAX_GAP_PERIODS:
    reasons.append('reliable '+side+' neighbor outside time bound');evidence.append(detail);continue
   if period_change>TOLERANCE:
    reasons.append('reliable '+side+' neighbor period mismatch');evidence.append(detail);continue
   probe=h.g.bounded_phase_similarity(row['shape'],neighbor['shape'])
   detail.update({'direct_similarity':h.f.cosine(row['shape'],neighbor['shape']),'phase_tolerant_similarity':probe['similarity'],'comparison_shift_positions':probe['shift_positions']});evidence.append(detail)
   if probe['similarity']<h.f.RELATION_POLICY['neighbor_geometry_min']:reasons.append('reliable '+side+' neighbor geometry mismatch')
  detail={'reasons':reasons,'neighbors':evidence,'target_gates_passed':True,'local_period_estimate':period_detail,'robust_period_used':robust is not None}
  if reasons:return None,detail
  family=max(assignment['candidates'],key=lambda v:v['similarity'])['family']
  return family,{**detail,'identity_interpretation':'Render supported; no family identity merge.'}
 return choose
