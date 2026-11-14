"""5C: saved decision traces, multi-period probes, and reference eligibility checks."""
import collections,hashlib,importlib.util,json,math,resource,statistics,sys,time
from pathlib import Path
from probes import periodic_probe
P=Path(__file__).resolve().parent;R=P.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in R.rglob('*') if p.is_file() and P not in p.parents};a=load('frozen_1c_diag_c',R/'experiment_01c.py');d=load('pitch_diag_c',R/'diagnostic_04b/analysis.py')
 A=R/'results/experiment-05a-synth-clap';base=json.loads((A/'report.json').read_text());inv=json.loads((A/'mixture-inventory.json').read_text());b=json.loads((R/'results/experiment-05b-original-1c-on-synth-clap/separation/report.json').read_text());kick=json.loads((R/'results/varvol2-01c/separation/report.json').read_text());q=json.loads((R/'results/experiment-04q-provisional-continuity/report.json').read_text());rate,ch,x=a.read_float_wav(A/'listening/original_reference.wav');_,_,periodic=a.read_float_wav(A/'listening/separated_source_1.wav');_,_,transient=a.read_float_wav(A/'listening/separated_source_2.wav');_,_,res=a.read_float_wav(A/'listening/residual.wav')
 for f,h in base['outputs'].items():assert sha(A/'listening'/f)==h
 recurrence=[]
 for label,r in [('1C variable volume',kick),('5B original 1C',b)]:
  recurrence.append({'run':label,'events':len(r['events']),'components':r['component_count'],'passes':[{'template_event':v.get('template_event'),'members':[a['event'] for a in v.get('allocations',[])],'candidate_member_counts':[len(c['members']) for c in v['comparisons']],'stop':v.get('stop')} for v in r['passes']]})
 # Third original-1C region and next well-supported periodic novelty bracket the neighborhood.
 start=b['events'][2]['start_frame'];next_start=next(v['start_frame'] for v in base['events'] if v['start_frame']>start+2048 and v['periodic_support_fraction_near_event']>.5)
 rows=[v for v in inv['cycles'] if v['end_frame']>start and v['start_frame']<next_start];dec={v['cycle']:v for v in base['periodic']['recognition_decisions']};assign={v['cycle']:v for v in inv['assignments']};stages=collections.Counter();examples=[]
 for row in rows:
  if not row['reliable']:stage='detected, cycle reliability rejected'
  elif row['periodicity']<.9 or row['period_error_fraction']>.05:stage='detected, stricter periodic-model screen rejected'
  elif assign[row['cycle']]['status']=='provisional':stage='detected, provisional family not established'
  elif dec[row['cycle']]['supported_family'] is None:stage='detected, recognition/neighbor rejected'
  else:stage='recognized'
  stages[stage]+=1
  if row['periodicity']>=.9:examples.append({'cycle':row['cycle'],'start_seconds':row['start_seconds'],'duration_frames':row['end_frame']-row['start_frame'],'periodicity':row['periodicity'],'period_error':row['period_error_fraction'],'reasons':row['rejection_reasons'],'assignment':assign[row['cycle']],'decision':dec[row['cycle']]})
 probes=[];tables=base['periodic']['models']['1']['tables']
 for frame in inv['frames']:
  if not(start<=frame['frame']<next_start and frame['f0'] and frame['periodicity']>=.9):continue
  result=periodic_probe(x,ch,rate,frame['frame'],frame['f0'],tables);first,last=result['first_frame'],result['end_frame'];presence=a.presence(result['model'],x[first*ch:last*ch],ch,0,round(rate*.004));probes.append({k:v for k,v in result.items() if k!='model'}|{'frame_center_seconds':frame['frame']/rate,'pitch_confidence':frame['periodicity'],'presence':presence})
 # Same event-template alignment, then examine the previously unobserved next 32 ms.
 pass0=base['transients']['passes'][0];length=pass0['template_end_frame']-pass0['template_start_frame'];event_lookup={v['event']:v for v in base['events']};tails=[]
 for alloc in pass0['allocations']:
  end=event_lookup[alloc['event']]['start_frame']+alloc['lag_frames']+length
  tails.append({'event':alloc['event'],'first_frame':end,'values':res[end*ch:(end+round(rate*.032))*ch]})
 pairs=[]
 for i,left in enumerate(tails):
  for right in tails[i+1:]:
   _,lag,gain=a.fit(left['values'],right['values'],ch,round(rate*.002));evidence=a.presence(left['values'],right['values'],ch,lag,round(rate*.004));pairs.append({'left_event':left['event'],'right_event':right['event'],'lag_frames':lag,'gain':gain,'whole_correlation_at_zero':d.cosine(left['values'],right['values']),'presence':evidence})
 # Reference eligibility is post-hoc only. Reject mismatched waveform as source truth.
 rr,cc,single=d.decode_aifc(R/'audio/Majorsaw.aif');exact=sum(a==b for a,b in zip(x,single))/len(x);block=2048;clean=[]
 for f in range(0,min(len(single),len(x))//ch-block,block):
  xx=x[f*ch:(f+block)*ch];ss=single[f*ch:(f+block)*ch];power=d.energy(ss)
  if power>1e-5:clean.append({'time_seconds':f/rate,'gain_at_zero_lag':sum(a*b for a,b in zip(xx,ss))/power,'error_ratio_at_unity':d.energy([a-b for a,b in zip(xx,ss)])/power})
 references={'single_synth_file':'audio/Majorsaw.aif','same_dimensions':(rr,cc,len(single))==(rate,ch,len(x)),'exact_sample_fraction':exact,'zero_lag_checks':clean,'eligible_as_aligned_mixture_source_reference':False,'reason':'Different waveform phase/content; matching duration and musical pattern do not establish aligned source truth. Single-synth benchmark remains valid on its own input.','isolated_clap_reference_available':False,'unverifiable_metrics':['true source SDR/SIR','true transient false-negative count','absolute synth/clap leakage']}
 assert all(sha(Path(f))==h for f,h in prior.items());rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 report={'experiment':'5C','recurrence_comparison':recurrence,'third_note_neighborhood_frames':[start,next_start],'third_note_neighborhood_seconds':[start/rate,next_start/rate],'third_note_cycle_count':len(rows),'third_note_failure_stages':dict(stages),'third_note_high_periodicity_cycle_traces':examples,'third_note_periodic_output_energy':d.energy(periodic[start*ch:next_start*ch]),'multi_period_probes':probes,'transient_template_duration_seconds':length/rate,'post_template_residual_tail_recurrence':pairs,'4q_control':{'coverage':q['metrics']['total_coverage_fraction'],'provisional_copied_frames':q['assignment_counts_frames']['provisional'],'provisional_sections':q['metrics']['provisional_sections'],'scope':'Single-source original-PCM assignment cannot be used as overlap separation.'},'reference_eligibility':references,'runtime_seconds':time.perf_counter()-begin,'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'source_sha256':{f:sha(P/f) for f in ['analyze.py','probes.py']},'prior_files_verified':len(prior),'no_corrections_implemented_in_this_phase':True}
 for name,value in [('report.json',report),('preservation.json',prior)]:
  with (P/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False)
 print(json.dumps({'third_interval':report['third_note_neighborhood_seconds'],'stages':stages,'probes':[{k:v for k,v in p.items() if k not in ['presence']}|{'presence_pass':p['presence']['present']} for p in probes],'tail_pairs':[(v['left_event'],v['right_event'],v['whole_correlation_at_zero'],v['presence']['supported_windows']) for v in pairs],'runtime':report['runtime_seconds'],'peak_mib':report['peak_process_rss_bytes']/2**20},indent=2))
if __name__=='__main__':run()
