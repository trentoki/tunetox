"""Controlled single-source assignment of original PCM into omitted support."""
import math
DIGITAL_QUIET=1e-12
MIN_QUIET_FRAMES=2048
MIN_RECOGNIZED_CYCLES=3

def runs(flags):
 out=[];start=None
 for i,v in enumerate(list(flags)+[False]):
  if v and start is None:start=i
  elif not v and start is not None:out.append((start,i));start=None
 return out

def assign(original,baseline,channels,rate,cycles,accepted):
 """Never alter recognized samples. Require original activity plus frozen anchors.

 Long near-digital-silence runs define candidate regions; individual crossings do
 not. The threshold only trims digital near-zero tails, not low relative RMS.
 No identity is inferred: this is an explicit known-single-source control.
 """
 frames=len(original)//channels
 quiet=[(a,z) for a,z in runs(max(abs(original[f*channels+c]) for c in range(channels))<=DIGITAL_QUIET for f in range(frames)) if z-a>=MIN_QUIET_FRAMES]
 islands=[];start=0
 for a,z in quiet:
  if a>start:islands.append((start,a))
  start=z
 if start<frames:islands.append((start,frames))
 islands=[(next((f for f in range(a,z) if max(abs(original[f*channels+c]) for c in range(channels))>DIGITAL_QUIET),z),z) for a,z in islands]
 labels=bytearray(frames)
 for k in accepted:
  row=cycles[k];a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);labels[a:z]=bytes([1])*(z-a)
 block=round(rate*.002)
 rms=[math.sqrt(sum(v*v for v in original[a*channels:min(a+block,frames)*channels])/((min(a+block,frames)-a)*channels)) for a in range(0,frames,block)]
 cutoff=.04*max(rms,default=0);regions=[];result=list(baseline)
 for a,z in islands:
  anchors=[k for k in accepted if cycles[k]['start_frame']>=a and cycles[k]['end_frame']<=z]
  strong=any(v>cutoff for v in rms[a//block:(z-1)//block+1]);eligible=strong and len(anchors)>=MIN_RECOGNIZED_CYCLES
  regions.append({'sample_start':a,'sample_end_exclusive':z,'anchor_cycle_count':len(anchors),'strong_activity':strong,'provisional_assignment_supported':eligible})
  if not eligible:continue
  for f in range(a,z):
   if labels[f]:continue
   labels[f]=2
   result[f*channels:(f+1)*channels]=original[f*channels:(f+1)*channels]
 return result,labels,regions,{'digital_quiet':DIGITAL_QUIET,'minimum_quiet_frames':MIN_QUIET_FRAMES,'minimum_anchors':MIN_RECOGNIZED_CYCLES,'activity_block_frames':block,'activity_rms_cutoff':cutoff}
