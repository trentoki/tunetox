"""4M: local frozen-output trace, no recognition or synthesis rerun."""
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import statistics
import sys
import time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def runs(flags):
 result=[];start=None
 for i,v in enumerate(list(flags)+[False]):
  if v and start is None:start=i
  elif not v and start is not None:result.append((start,i));start=None
 return result

def run():
 begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
 L=ROOT/'results/experiment-04l-boundary-periodicity';base=L/'4l-final';lr=json.loads((base/'report.json').read_text());d=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text())
 for f,h in lr['outputs'].items():assert sha(base/f)==h
 assert sha(Path(d['input_path']))==lr['input_sha256']
 l=load('frozen_l_trace',L/'methods.py');ihelp=load('reused_i_trace',ROOT/'results/experiment-04i-cycle-trace/analyze.py');io=l.j.render.d
 rate,ch,x=io.read_export(base/'original_reference.wav');_,_,y=io.read_export(base/'reconstructed.wav');_,_,res=io.read_export(base/'residual.wav');n=len(x)//ch;channels=[x[c::ch] for c in range(ch)]
 # Independent original-sample activity islands, separated by at least one old analysis window of digital silence.
 quiet=[(a,z) for a,z in runs(max(abs(x[f*ch+c]) for c in range(ch))<=1e-12 for f in range(n)) if z-a>=l.WIDTH]
 islands=[];start=0
 for a,z in quiet:
  if a>start:islands.append((start,a))
  start=z
 if start<n:islands.append((start,n))
 # Initial zero sample(s) are trimmed sample accurately, without using pitch or note times.
 islands=[(next((f for f in range(a,z) if max(abs(x[f*ch+c]) for c in range(ch))>1e-12),z),z) for a,z in islands]
 selected=islands[5:8];assert len(selected)==3
 cycles={v['cycle']:dict(v) for v in d['cycles']};assign={v['cycle']:v for v in d['assignments']};families={v['family']:v for v in d['families']}
 changed={v['cycle']:v for v in lr['boundary_diagnostics']['periodicity_changes']}
 for k,update in changed.items():
  row=cycles[k];row.update(reliable=update['new_reliable'],periodicity=update['new_periodicity'],estimated_f0_hz=update['new_f0'],rejection_reasons=update['new_reasons']);row['period_error_fraction']=abs((row['end_frame']-row['start_frame'])*row['estimated_f0_hz']/rate-1) if row['estimated_f0_hz'] else None
  if row['reliable'] and 'shape' not in row:row.update(l.c.signature(channels,row['start_frame'],row['end_frame']))
  if row['reliable'] and not next(v for v in d['cycles'] if v['cycle']==k)['reliable']:assign[k]=l.frozen_assignment(row,d['families'])
 choices={v['cycle']:v['family'] for v in d['assignments'] if v['status']=='assigned'}
 paths=[(ROOT/'results/experiment-04f-independent/b-related-shapes/occurrence-decisions.json','render_supported'),(ROOT/'results/experiment-04h-phase-neighbors/new-decisions.json','newly_supported'),(ROOT/'results/experiment-04j-independent/a-target-phase/decisions.json','newly_recognized'),(base/'decisions.json','newly_recognized')]
 for path,key in paths:
  for row in json.loads(path.read_text()):
   if row[key]:choices[row['cycle']]=row['render_family']
 for k in lr['boundary_diagnostics']['lost_baseline_ids']:choices.pop(k,None)
 decisions={v['cycle']:v for v in json.loads((base/'decisions.json').read_text())};neighbors=l.j.h.temporal_neighbors(cycles)
 timings={'load_verify_and_metadata_seconds':time.perf_counter()-begin};t=time.perf_counter();notes=[];all_records=[]
 for number,(first,last) in enumerate(selected,6):
  local=[v for v in cycles.values() if v['end_frame']>first and v['start_frame']<last];owner=[None]*(last-first);records=[]
  median_period=statistics.median(v['end_frame']-v['start_frame'] for v in local if v['reliable']);median_energy=statistics.median(io.energy(x[math.ceil(v['start_frame'])*ch:math.ceil(v['end_frame'])*ch]) for v in local if v['reliable'])
  for row in local:
   k=row['cycle'];a=max(first,math.ceil(row['start_frame']));z=min(last,math.ceil(row['end_frame']));owner[a-first:z-first]=[k]*(z-a)
   xx=x[a*ch:z*ch];yy=y[a*ch:z*ch];rr=res[a*ch:z*ch];power=io.energy(xx);model=io.energy(yy);decision=decisions.get(k);accepted=k in choices
   stage=ihelp.classify(True,row['reliable'],'shape' in row,assign[k]['status'],accepted,model/max(power,1e-30),decision.get('reasons',[]) if decision else [])
   rec={'cycle':k,'start_frame_fractional':row['start_frame'],'end_frame_fractional':row['end_frame'],'sample_start':a,'sample_end_exclusive':z,'duration_frames':row['end_frame']-row['start_frame'],'periodicity':row['periodicity'],'period_error_fraction':row['period_error_fraction'],'estimated_f0':row['estimated_f0_hz'],'reliable':row['reliable'],'signature_calculated':'shape' in row,'detection_reasons':row['rejection_reasons'],'assignment':assign[k],'recognition_decision':decision,'accepted':accepted,'inferred':False,'render_family':choices.get(k),'failure_category':stage,'original_energy':power,'residual_energy':io.energy(rr),'error_ratio':io.energy(rr)/max(power,1e-30),'output_nonzero_samples':sum(any(abs(y[f*ch+c])>1e-12 for c in range(ch)) for f in range(a,z)),'expected_rendered_samples':z-a if accepted else 0}
   # Diagnostic signatures for rejected detection intervals are explicitly separate from pipeline signatures.
   shape=row.get('shape')
   if not shape and row['end_frame']-row['start_frame']>=4:
    shape=l.c.signature(channels,row['start_frame'],row['end_frame'])['shape'];rec['diagnostic_only_signature']=True
   if shape:
    best=[]
    for family in families.values():
     prototype=family['signature_shape_64_per_channel'];probe=l.j.h.g.bounded_phase_similarity(shape,prototype)
     best.append({'family':family['family'],'direct_similarity':l.c.cosine(shape,prototype),'phase_tolerant':probe})
    rec['diagnostic_family_scores']=sorted(best,key=lambda v:-v['phase_tolerant']['similarity'])
    if not accepted:
     comparisons=[]
     for target_number,(na,nz) in enumerate(selected,6):
      candidates=[v for v in cycles.values() if v['cycle'] in choices and 'shape' in v and na<=v['start_frame']<nz]
      if candidates:
       other=max(candidates,key=lambda v:l.j.h.g.bounded_phase_similarity(shape,v['shape'])['similarity']);probe=l.j.h.g.bounded_phase_similarity(shape,other['shape'])
       comparisons.append({'note':target_number,'accepted_cycle':other['cycle'],'similarity':probe['similarity'],'shift_positions':probe['shift_positions']})
     rec['normalized_accepted_comparisons']=comparisons
   if accepted:
    edge=min(rate*.0005,(row['end_frame']-row['start_frame'])*.15)
    rec['join_regions_frames']=[[row['start_frame'],row['start_frame']+edge],[row['end_frame']-edge,row['end_frame']]]
   records.append(rec)
  byid={v['cycle']:v for v in records};peak=max(abs(v) for v in x[first*ch:last*ch]);sections=[]
  # Same saved 4I significance test, now exact local sample support, not a block mask.
  for a,z in runs(max(abs(y[f*ch+c]) for c in range(ch))<=1e-12 for f in range(first,last)):
   a+=first;z+=first;energy=io.energy(x[a*ch:z*ch]);ids=sorted(set(v for v in owner[a-first:z-first] if v is not None));sig=ihelp.significant_gap(z-a,median_period,energy,median_energy)
   sections.append({'sample_start':a,'sample_end_exclusive':z,'start_seconds':a/rate,'end_seconds':z/rate,'length_frames':z-a,'original_energy':energy,'residual_energy':io.energy(res[a*ch:z*ch]),'significant':sig,'cycles':ids,'categories':dict(collections.Counter(byid[k]['failure_category'] for k in ids))})
  spikes=[]
  for a,z in runs(max(abs(res[f*ch+c]) for c in range(ch))>.2*peak and owner[f-first] in choices for f in range(first,last)):
   a+=first;z+=first;f=max(range(a,z),key=lambda f:max(abs(res[f*ch+c]) for c in range(ch)));k=owner[f-first];row=cycles[k];edge=ihelp.sharp_edge(x,ch,row['start_frame'],row['end_frame'])
   spikes.append({'sample_start':a,'sample_end_exclusive':z,'peak_frame':f,'cycle':k,'phase':(f-row['start_frame'])/(row['end_frame']-row['start_frame']),'width_frames':z-a,'distance_to_original_sharp_edge_frames':abs(f-edge['frame']) if edge else None,'residual_energy':io.energy(res[a*ch:z*ch])})
  total=io.energy(res[first*ch:last*ch]);energy_by=collections.Counter()
  for f,k in enumerate(owner,first):energy_by[byid[k]['failure_category'] if k else 'no_candidate']+=sum(res[f*ch+c]**2 for c in range(ch))
  notes.append({'ordinal':number,'sample_start':first,'sample_end_exclusive':last,'start_seconds':first/rate,'end_seconds':last/rate,'f0_median_hz':statistics.median(v['frequency_hz'] for v in local if v['reliable']),'cycles':records,'zero_output_sections':sections,'significant_zero_sections':sum(v['significant'] for v in sections),'rendered_error_events_threshold':'.2 * local original absolute peak; diagnostics only','rendered_error_events':spikes,'residual_energy':total,'residual_energy_by_stage':dict(energy_by),'original_energy':io.energy(x[first*ch:last*ch]),'conservation_max_error':max(abs(x[i]-y[i]-res[i]) for i in range(first*ch,last*ch)),'accepted_cycles':sum(v['accepted'] for v in records),'rejected_candidates':sum(not v['accepted'] for v in records),'accepted_rendering_omissions':sum(v['accepted'] and v['output_nonzero_samples']!=v['expected_rendered_samples'] for v in records)})
  all_records.extend(records)
 assert all(sha(Path(f))==h for f,h in prior.items())
 timings['local_trace_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_report_seconds']=time.perf_counter()-begin
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
 report={'experiment':'4M','baseline':'4L final','input_sha256':lr['input_sha256'],'audio_islands_frames':islands,'selection':'Seventh activity island separated by >=2048 samples digital silence; adjacent sixth and eighth also traced. No supplied note times or pitches.','notes':notes,'thresholds':{'discovery':l.c.POLICY,'recognition':l.j.h.f.RELATION_POLICY,'neighbor_max_gap_periods':l.j.h.MAX_GAP_PERIODS},'timings':timings,'peak_process_rss_bytes':peak,'source_sha256':sha(Path(__file__)),'prior_files_verified':len(prior),'no_algorithm_or_audio_changed':True}
 for name,value in [('report.json',report),('preservation.json',prior)]:
  with (HERE/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False)
 print(json.dumps({'timings':timings,'peak_mib':peak/2**20,'notes':[{k:v for k,v in note.items() if k not in ['cycles','zero_output_sections','rendered_error_events']} for note in notes]},indent=2))
if __name__=='__main__':run()
