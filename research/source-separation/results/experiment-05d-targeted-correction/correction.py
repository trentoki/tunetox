"""5D: multi-period presence can infer complete cycles rejected by mixture crossings.

One alternate provisional recognition path. Existing 5A estimates remain unchanged.
Only learned mixture tables, mixture pitch frames and mixture-derived references enter.
"""
import importlib.util,math,statistics
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
base=load('frozen_5a_d',ROOT/'results/experiment-05a-synth-clap/methods.py')
probe=load('multiperiod_probe_d',ROOT/'results/experiment-05c-diagnostics/probes.py')
POLICY={'periods_per_probe':8,'phase_positions':64,'phase_refinement_positions':512,'pitch_confidence_min':.9,'reference_period_tolerance':.02,'minimum_reference_cycles':3,'maximum_gain_over_reference':1.2,'presence_correlation':.85,'minimum_supported_windows':3,'minimum_proposed_complete_cycles':3}

def support_mask(detail,cycles,frames):
 mask=bytearray(frames)
 for group in detail['groups']:
  for k in group['cycle_ids']:
   row=cycles[k];a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);mask[a:z]=bytes([1])*(z-a)
  for row in group['inferred_occurrences']:
   a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);mask[a:z]=bytes([1])*(z-a)
 return mask

def apply(original,periodic_tracks,inventory,detail,rate,channels):
 frames=len(original)//channels;cycles={v['cycle']:v for v in inventory['cycles']};oldmask=support_mask(detail,cycles,frames);log=[]
 if len(periodic_tracks)!=1:return periodic_tracks,bytearray(frames),{'applied':False,'reason':'Requires one established periodic hypothesis; no source count forced','fits':[],'new_occurrences':[]}
 group=detail['groups'][0];families={v['family']:v for v in inventory['families']};family=max(group['family_ids'],key=lambda k:len(families[k]['occurrences']));models=detail['models'];model=models.get(family,models.get(str(family)));tables=model['tables'];references=[cycles[k] for k in group['cycle_ids']];candidates=[];window=round(rate*.004)
 for fr in inventory['frames']:
  if not fr['active'] or not fr['f0'] or fr['periodicity']<POLICY['pitch_confidence_min']:continue
  width=min(2048,max(512,round(8*rate/fr['f0'])));a=max(0,min(frames-width,round(fr['frame']-width/2)));z=a+width
  gap_run=longest_gap=0
  for value in oldmask[a:z]:
   gap_run=0 if value else gap_run+1;longest_gap=max(longest_gap,gap_run)
  if longest_gap<3*rate/fr['f0']:continue
  refs=[v for v in references if abs(v['frequency_hz']/fr['f0']-1)<=.02]
  if len(refs)<3:continue
  fit=probe.periodic_probe(original,channels,rate,fr['frame'],fr['f0'],tables,8);a,z=fit['first_frame'],fit['end_frame'];evidence=base.one.presence(fit['model'],original[a*channels:z*channels],channels,0,window)
  scale=statistics.median(v.get('signature_rms_scale',v['absolute_rms']) for v in refs);reasons=[]
  if not evidence['present'] or evidence['supported_windows']<3:reasons.append('insufficient local presence')
  if fit['gain']>1.2*scale:reasons.append('gain exceeds independent same-pitch reference range')
  if len(evidence['correlations'])!=math.ceil((z-a)/window):reasons.append('ambiguous informative-window indexing')
  record={k:v for k,v in fit.items() if k!='model'}|{'center_seconds':fr['frame']/rate,'pitch_confidence':fr['periodicity'],'reference_cycle_count':len(refs),'reference_scale':scale,'presence':evidence,'reasons':reasons,'accepted_complete_cycles':0};log.append(record)
  if reasons:continue
  valid=bytearray(z-a)
  for j,corr in enumerate(evidence['correlations']):
   if corr>=.85:
    left=j*window;right=min(z-a,left+window);valid[left:right]=bytes([1])*(right-left)
  period=rate/fr['f0'];clock=a-fit['phase']*period;start=clock+math.ceil((a-clock)/period)*period;proposed=[]
  offset=[statistics.median(v.get('channel_offsets',[0.]*channels)[c] for v in refs) for c in range(channels)]
  while start+period<=z+1e-8:
   end=start+period;left,right=math.ceil(start),math.ceil(end)
   if right>left and all(valid[f-a] and not oldmask[f] for f in range(left,right)):
    proposed.append({'start_frame':start,'end_frame':end,'signature_rms_scale':fit['gain'],'channel_offsets':offset,'family':family,'status':'assigned','reliable':True,'provenance':'5D provisional multi-period presence, not original crossing recognition'})
   start=end
  run=longest=0;previous=None
  for row in proposed:
   run=run+1 if previous and abs(row['start_frame']-previous['end_frame'])<1e-8 else 1
   longest=max(longest,run);previous=row
  if longest<3:record['reasons'].append('fewer than three consecutive supported complete cycles in original gap');continue
  candidates.append((fit['correlation'],proposed,len(log)-1))
 occupied=bytearray(oldmask);chosen=[]
 for score,rows,index in sorted(candidates,key=lambda v:-v[0]):
  for row in rows:
   a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame'])
   if any(occupied[a:z]) or any(row['start_frame']<other['end_frame']-1e-8 and row['end_frame']>other['start_frame']+1e-8 for other in chosen):continue
   occupied[a:z]=bytes([1])*(z-a);chosen.append({**row,'cycle':-(len(chosen)+1)});log[index]['accepted_complete_cycles']+=1
 shape=families[family]['shape'];family_for_render=[{'family':family,'status':'recurring','signature_shape_64_per_channel':shape}]
 def sampler(values,channel,phase,scale,offset,duration):
  value,slope=base.n.h.f.linear_table(tables[channel],phase)
  return value*scale+offset,slope*scale/duration
 prediction,newmask,bridge,meta=base.n.l.j.render.synthesize(family_for_render,chosen,frames,channels,rate,sampler)
 assert all(not oldmask[f] for f,v in enumerate(newmask) if v)
 output=[a+b for a,b in zip(periodic_tracks[0],prediction)];assert all(output[f*channels+c]==periodic_tracks[0][f*channels+c] for f in range(frames) if oldmask[f] for c in range(channels))
 return [output],newmask,{'applied':True,'family':family,'fits':log,'new_occurrences':chosen,'new_cycle_count':len(chosen),'new_frames':sum(newmask),'render_model':'unchanged 5A 256-position table and frozen Hermite joins; new support only','policy':POLICY}
