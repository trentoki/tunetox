"""4O frozen-output boundary diagnostic. No recognition or synthesis rerun."""
import collections,hashlib,importlib.util,json,math,resource,statistics,sys,time
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
 m=load('m_helpers_o',ROOT/'results/experiment-04m-missing-sections/analyze.py');l=load('l_helpers_o',ROOT/'results/experiment-04l-boundary-periodicity/methods.py');h=load('i_helpers_o',ROOT/'results/experiment-04i-cycle-trace/analyze.py');io=l.j.render.d
 N=ROOT/'results/experiment-04n-robust-period/listening';nr=json.loads((N/'report.json').read_text());d=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text())
 assert sha(Path(d['input_path']))==nr['input_sha256']
 for f,v in nr['outputs'].items():assert sha(N/f)==v
 rate,ch,x=io.read_export(N/'original_reference.wav');_,_,y=io.read_export(N/'reconstructed.wav');_,_,res=io.read_export(N/'residual.wav');n=len(x)//ch;audio=[x[c::ch] for c in range(ch)]
 quiet=[(a,z) for a,z in m.runs(max(abs(x[f*ch+c]) for c in range(ch))<=1e-12 for f in range(n)) if z-a>=2048]
 islands=[];a=0
 for start,end in quiet:
  if start>a:islands.append((a,start))
  a=end
 if a<n:islands.append((a,n))
 islands=[(next(f for f in range(a,z) if max(abs(x[f*ch+c]) for c in range(ch))>1e-12),z) for a,z in islands]
 cycles={v['cycle']:dict(v) for v in d['cycles']};assign={v['cycle']:v for v in d['assignments']};families={v['family']:v for v in d['families']}
 changes={v['cycle']:v for v in nr['boundary_diagnostics']['periodicity_changes']}
 for k,update in changes.items():
  row=cycles[k];row.update(reliable=update['new_reliable'],periodicity=update['new_periodicity'],estimated_f0_hz=update['new_f0'],rejection_reasons=update['new_reasons']);row['period_error_fraction']=abs((row['end_frame']-row['start_frame'])*row['estimated_f0_hz']/rate-1) if row['estimated_f0_hz'] else None
  if row['reliable'] and 'shape' not in row:row.update(l.c.signature(audio,row['start_frame'],row['end_frame']))
  if row['reliable'] and assign[k]['status']=='unreliable':assign[k]=l.frozen_assignment(row,d['families'])
 choices={v['cycle']:v['family'] for v in d['assignments'] if v['status']=='assigned'};decisions={}
 for folder,key in [('experiment-04f-independent/b-related-shapes','render_supported'),('experiment-04h-phase-neighbors','newly_supported'),('experiment-04j-independent/a-target-phase','newly_recognized'),('experiment-04l-boundary-periodicity/4l-final','newly_recognized'),('experiment-04n-robust-period/listening','newly_recognized')]:
  file=ROOT/'results'/folder/('occurrence-decisions.json' if key=='render_supported' else 'new-decisions.json' if key=='newly_supported' else 'decisions.json')
  for row in json.loads(file.read_text()):
   decisions[row['cycle']]=row
   if row[key]:choices[row['cycle']]=row['render_family']
 for k in nr['boundary_diagnostics']['lost_baseline_ids']:choices.pop(k,None)
 # Identify short/long populations from durations, and pitch directions from measured f0s only.
 bounds=nr['boundary_diagnostics']['boundaries'];long_edges=[islands[-1][0]]+[v['frame'] for v in bounds]+[n];longs=list(zip(long_edges,long_edges[1:]));shorts=islands[:-1]
 inventory=[]
 for kind,spans in [('short',shorts),('long',longs)]:
  for ordinal,(a,z) in enumerate(spans,1):
   rows=[v for v in cycles.values() if a<=v['start_frame']<z and v['reliable']];inventory.append({'group':kind,'ordinal':ordinal,'sample_start':a,'sample_end_exclusive':z,'duration_seconds':(z-a)/rate,'measured_frequency_median':statistics.median(v['frequency_hz'] for v in rows)})
 tail_scores=[]
 for ordinal,(a,z) in enumerate(shorts,1):
  local=[v for v in cycles.values() if a<=v['start_frame']<z and v['reliable']];stable=statistics.median(v['absolute_rms'] for v in local);decay=[v for v in local if v['start_frame']>(a+z)/2 and .01*stable<v['absolute_rms']<.5*stable]
  if len(decay)<3:continue
  power=error=0.
  for row in decay:
   left,right=math.ceil(row['start_frame'])*ch,math.ceil(row['end_frame'])*ch;power+=io.energy(x[left:right]);error+=io.energy(res[left:right])
  tail_scores.append({'ordinal':ordinal,'error_ratio':error/power,'decay_cycle_ids':[v['cycle'] for v in decay]})
 best_short=min(tail_scores,key=lambda v:v['error_ratio']);short=shorts[best_short['ordinal']-1]
 candidates=[]
 for boundary in bounds:
  for gap in nr['significant_gaps']:
   a,z=gap['start_seconds']*rate,gap['end_seconds']*rate
   if a<boundary['frame']<z:candidates.append((boundary['frame']-a,boundary,gap))
 _,boundary,gap=max(candidates,key=lambda v:v[0]);b=boundary['frame'];width=round(rate*.025)
 windows=[('short-attack',short[0],short[0]+width),('short-decay',short[1]-2*width,short[1]),('first-long-attack',longs[0][0],longs[0][0]+width),('long-transition',b-width,b+width)]
 timings={'load_verify_selection_seconds':time.perf_counter()-begin};t=time.perf_counter();traces=[]
 for label,a,z in windows:
  a=max(0,math.floor(a));z=min(n,math.ceil(z));records=[];energy=collections.Counter()
  for row in cycles.values():
   if row['end_frame']<=a or row['start_frame']>=z:continue
   k=row['cycle'];left,right=max(a,math.ceil(row['start_frame'])),min(z,math.ceil(row['end_frame']));xx=x[left*ch:right*ch];rr=res[left*ch:right*ch];yy=y[left*ch:right*ch];power=io.energy(xx);decision=decisions.get(k);accepted=k in choices
   reasons=decision.get('reasons',[]) if decision and not accepted else []
   stage=h.classify(True,row['reliable'],'shape' in row,assign[k]['status'],accepted,io.energy(yy)/max(power,1e-30),reasons);energy[stage]+=io.energy(rr)
   center=(row['start_frame']+row['end_frame'])/2;fi=max(0,min(len(d['frames'])-1,round((center-1024)/round(rate*.01))));fr=d['frames'][fi];original_window=[fr['frame']-1024,fr['frame']+1024];actual_window=changes.get(k,{}).get('window_frames',original_window)
   record={'cycle':k,'start_frame':row['start_frame'],'end_frame':row['end_frame'],'sample_start':left,'sample_end_exclusive':right,'duration_frames':row['end_frame']-row['start_frame'],'candidate_absolute_rms':row['absolute_rms'],'clipped_window_rms':math.sqrt(power/max(len(xx),1)),'original_peak':max(map(abs,xx),default=0),'periodicity':row['periodicity'],'period_error_fraction':row['period_error_fraction'],'estimated_f0':row['estimated_f0_hz'],'reliable':row['reliable'],'signature_present':'shape' in row,'detection_reasons':row['rejection_reasons'],'assignment':assign[k],'recognition_decision':decision,'accepted':accepted,'stage':stage,'error_ratio':io.energy(rr)/max(power,1e-30),'original_energy':power,'residual_energy':io.energy(rr),'original_analysis_window':original_window,'actual_analysis_window':actual_window,'original_window_crosses_quiet':any(qa<original_window[1] and qz>original_window[0] for qa,qz in quiet),'actual_window_crosses_quiet':any(qa<actual_window[1] and qz>actual_window[0] for qa,qz in quiet),'actual_window_crosses_selected_boundary':actual_window[0]<b<actual_window[1]}
   shape=row.get('shape')
   if shape:
    scores=[]
    for family in families.values():
     probe=l.j.h.g.bounded_phase_similarity(shape,family['signature_shape_64_per_channel']);scores.append({'family':family['family'],'status':family['status'],'direct_similarity':l.c.cosine(shape,family['signature_shape_64_per_channel']),'bounded_phase_similarity':probe['similarity']})
    record['family_scores']=sorted(scores,key=lambda v:-v['bounded_phase_similarity'])
    previous=cycles.get(k-1)
    if previous and 'shape' in previous:record['previous_cycle_normalized_similarity']=l.j.h.g.bounded_phase_similarity(shape,previous['shape'])['similarity'];record['previous_cycle_amplitude_ratio']=row['absolute_rms']/max(previous['absolute_rms'],1e-30)
   else:
    record['complete_cycle_evidence']='No valid pipeline signature. Intervals across silence or gross period disagreement are not established complete oscillations.'
   if accepted:record['all_sampled_support_nonzero']=all(any(abs(y[f*ch+c])>1e-12 for c in range(ch)) for f in range(left,right))
   records.append(record)
  traces.append({'label':label,'sample_start':a,'sample_end_exclusive':z,'cycles':records,'original_energy':io.energy(x[a*ch:z*ch]),'residual_energy':io.energy(res[a*ch:z*ch]),'residual_by_stage':dict(energy),'conservation_max_error':max(abs(x[i]-y[i]-res[i]) for i in range(a*ch,z*ch))})
 # Amplitude-matched contrast: accepted decay versus rejected transition, diagnostic only.
 shortrows=traces[1]['cycles'];longrows=traces[3]['cycles'];pairs=[]
 for row in longrows:
  if row['accepted'] or row['clipped_window_rms']<.001:continue
  eligible=[v for v in shortrows if v['accepted'] and v['clipped_window_rms']>0]
  if not eligible:continue
  other=min(eligible,key=lambda v:abs(math.log(v['clipped_window_rms']/row['clipped_window_rms'])))
  pairs.append({'long_cycle':row['cycle'],'long_rms':row['clipped_window_rms'],'short_cycle':other['cycle'],'short_rms':other['clipped_window_rms'],'amplitude_ratio':other['clipped_window_rms']/row['clipped_window_rms'],'long_stage':row['stage']})
 noise=[]
 for a,z in quiet:
  mid=(a+z)//2;values=x[(mid-220)*ch:(mid+220)*ch];noise.append(math.sqrt(io.energy(values)/len(values)))
 assert all(sha(Path(p))==v for p,v in prior.items())
 timings['local_trace_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_json_seconds']=time.perf_counter()-begin
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
 report={'experiment':'4O','baseline':'4N','input_sha256':nr['input_sha256'],'audio_derived_inventory':inventory,'digital_quiet_intervals':quiet,'quiet_center_rms':noise,'short_decay_selection':best_short,'all_short_decay_scores':tail_scores,'selected_transition_boundary':boundary,'selection_gap':gap,'traces':traces,'amplitude_matched_pairs':pairs,'timings':timings,'peak_process_rss_bytes':peak,'thresholds':{'discovery':l.c.POLICY,'recognition':l.j.h.f.RELATION_POLICY},'final_original_samples':x[-ch:],'prior_files_verified':len(prior),'source_sha256':sha(Path(__file__)),'audio_and_algorithms_unchanged':True}
 for name,value in [('report.json',report),('preservation.json',prior)]:
  with (HERE/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False)
 print(json.dumps({'timings':timings,'peak_mib':peak/2**20,'short_selected':best_short,'transition':boundary,'traces':[{'label':v['label'],'residual_by_stage':v['residual_by_stage']} for v in traces],'matched':pairs},indent=2))
if __name__=='__main__':run()
