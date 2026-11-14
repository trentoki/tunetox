"""Same fixed 5D correction on three inputs; no intermediate WAV exports."""
import argparse,hashlib,json,math,resource,statistics,struct,sys,time
from pathlib import Path
import correction as d
P=Path(__file__).resolve().parent;R=P.parents[1];a=d.base

def inventory(raw,rate,ch):
 audio=[raw[k::ch] for k in range(ch)];ff,strong=a.c.frame_analysis(audio,rate);cycles,level=a.c.extract_cycles(audio,rate,ff,strong);fam,assign,_=a.c.cluster(cycles,a.c.POLICY['family_shape_min'])
 return {'frames':ff,'cycles':cycles,'reference_channel':strong,'assignments':assign,'families':[{'family':v['family'],'status':v['status'],'prototype_cycle':v['prototype']['cycle'],'shape':v['prototype']['shape'],'occurrences':v['occurrences']} for v in fam]}
def f32(values):return list(struct.unpack('<'+'f'*len(values),struct.pack('<'+'f'*len(values),*values)))
def prepare(dataset):
 io=a.n.l.j.render.d
 if dataset=='mix':
  B=R/'results/experiment-05a-synth-clap';report=json.loads((B/'report.json').read_text());rate,ch,raw=io.read_export(B/'listening/original_reference.wav');inv=json.loads((B/'mixture-inventory.json').read_text());tracks=[io.read_export(B/'listening'/f'separated_source_{k+1}.wav')[2] for k in range(report['source_count_estimated_models'])]
  return raw,rate,ch,inv,tracks[:1],tracks[1:],report['periodic'],{'source':'frozen 5A','transient_recognized_events':report['recurring_transient_event_count'],'detected_change_events':report['detected_change_event_count'],'baseline_report':str(B/'report.json')}
 source=R/'audio'/('varvol2.aif' if dataset=='kick' else 'Majorsaw.aif');rate,ch,raw=a.c.p.decode_aifc(source);inv=inventory(raw,rate,ch);periodic,detail=a.periodic(inv,raw,rate,ch)
 if dataset=='kick':
  assert len(periodic)==0
  B=R/'results/experiment-05a-synth-clap';report=json.loads((B/'benchmark-5a-report.json').read_text());other=[io.read_export(B/'benchmark-5a'/f'source_{k+1}.wav')[2] for k in range(report['sources'])];meta={'source':'frozen 5A benchmark exports; fresh periodic inventory confirms no periodic group','transient_recognized_events':len(report['recurrence_events']),'detected_change_events':report['detected_changes']}
 else:
  events,_=a.event_candidates(raw,ch,rate);rem=[x-sum(t[i] for t in periodic) for i,x in enumerate(raw)];other,td=a.transients(rem,raw,rate,ch,events);meta={'source':'5A unchanged functions on single-synth input','transient_recognized_events':len(set(v['event'] for p in td['passes'] for v in p.get('allocations',[]))),'detected_change_events':len(events)}
 return raw,rate,ch,inv,[f32(v) for v in periodic],[f32(v) for v in other],detail,meta

def gap_summary(mask,raw,rate,ch):
 if not mask:return None
 block=round(rate*.002);rms=[math.sqrt(sum(v*v for v in raw[a*ch:min(a+block,len(mask))*ch])/((min(a+block,len(mask))-a)*ch)) for a in range(0,len(mask),block)];cut=.04*max(rms);flags=[not mask[f] and rms[f//block]>cut for f in range(len(mask))];runs=[];start=None
 for f,v in enumerate(flags+[False]):
  if v and start is None:start=f
  elif not v and start is not None:
   if f-start>=round(rate*.001):runs.append((start,f))
   start=None
 return {'count_at_least_1ms':len(runs),'duration_seconds':sum(z-a for a,z in runs)/rate,'maximum_seconds':max((z-a for a,z in runs),default=0)/rate,'locations_seconds':[[a/rate,z/rate] for a,z in runs]}
def run(dataset):
 begin=time.perf_counter();raw,rate,ch,inv,oldperiodic,other,detail,meta=prepare(dataset);setup=time.perf_counter()-begin;t=time.perf_counter();newperiodic,newmask,decisions=d.apply(raw,oldperiodic,inv,detail,rate,ch);increment=time.perf_counter()-t
 newperiodic=[f32(v) for v in newperiodic];cycles={v['cycle']:v for v in inv['cycles']};frames=len(raw)//ch;oldmask=d.support_mask(detail,cycles,frames);mask=bytearray(oldmask[i] or newmask[i] for i in range(frames));power=a.one.energy(raw);oldtracks=oldperiodic+other;newtracks=newperiodic+other
 def metrics(tracks,pmask):
  stems=[sum(v[i] for v in tracks) for i in range(len(raw))];res=f32([x-y for x,y in zip(raw,stems)]);f0=[]
  if oldperiodic:
   ff,_=a.c.frame_analysis([tracks[0][c::ch] for c in range(ch)],rate);f0=[v['f0'] for v in ff if v['periodicity']>=.9 and v['f0']]
  return {'source_models':len(tracks),'periodic_structures':len(oldperiodic),'periodic_coverage_fraction':sum(pmask)/frames,'residual_energy_ratio':a.one.energy(res)/power,'continuity_gaps':gap_summary(pmask,raw,rate,ch) if oldperiodic else None,'periodic_high_confidence_frames':len(f0),'periodic_pitch_range_hz':[min(f0),max(f0)] if f0 else None,'additive_max_error':max(abs(x-y-r) for x,y,r in zip(raw,stems,res))}
 before=metrics(oldtracks,oldmask);after=metrics(newtracks,mask);newpower=sum(raw[i]**2 for i in range(len(raw)) if newmask[i//ch]);newerror=sum((raw[i]-newperiodic[0][i])**2 for i in range(len(raw)) if newmask[i//ch]) if newperiodic else 0
 delta=[v-w for v,w in zip(newperiodic[0],oldperiodic[0])] if oldperiodic else [0.]*len(raw);trans=[sum(v[i] for v in other) for i in range(len(raw))];boundaries=[f for f in range(1,frames) if newmask[f]!=newmask[f-1]];boundary=[]
 for f in boundaries:
  change=lambda values:[values[f*ch+c]-values[(f-1)*ch+c] for c in range(ch)]
  oldstep,newstep,originalstep=change(oldperiodic[0]),change(newperiodic[0]),change(raw)
  boundary.append({'frame':f,'new_step':max(map(abs,newstep)),'old_step':max(map(abs,oldstep)),'original_step':max(map(abs,originalstep)),'new_error_step':max(abs(a-b) for a,b in zip(newstep,originalstep))})
 special={}
 if dataset=='mix':
  c=json.loads((R/'results/experiment-05c-diagnostics/report.json').read_text());a0,z0=c['third_note_neighborhood_frames'];special['third_note_coverage_before']=sum(oldmask[a0:z0])/(z0-a0);special['third_note_coverage_after']=sum(mask[a0:z0])/(z0-a0);special['third_note_new_frames']=sum(newmask[a0:z0]);special['third_note_new_cycles']=sum(v['end_frame']>a0 and v['start_frame']<z0 for v in decisions['new_occurrences']);special['true_source_leakage']='Unavailable: no aligned isolated synth/clap references';special['added_periodic_vs_existing_transient_cosine']=a.c.cosine(delta,trans)
 elif dataset=='single':
  q=json.loads((R/'results/experiment-04q-provisional-continuity/report.json').read_text());special['4q_residual_energy_ratio']=q['metrics']['residual_energy_ratio'];special['4q_coverage_fraction']=q['metrics']['total_coverage_fraction'];special['4q_comparison_scope']='Single-source control includes original PCM provisional support, so it is not the same separation method';special['false_extra_transient_models']=len(other);special['nonperiodic_model_energy_ratio']=sum(a.one.energy(v) for v in other)/power
 else:
  one=json.loads((R/'results/varvol2-01c/separation/report.json').read_text());special['1c_source_count']=one['component_count'];special['1c_residual_energy_ratio']=one['residual_energy_fraction'];special['comparison_to_1c_estimates_only']=True;io=a.n.l.j.render.d;ref=[io.read_export(R/'results/varvol2-01c/separation'/f'component_{i:02d}.wav')[2] for i in [1,2]];special['whole_track_correlations_to_1c']=[[a.c.cosine(t,r) for r in ref] for t in newtracks]
 assert all(newperiodic[0][f*ch+c]==oldperiodic[0][f*ch+c] for f in range(frames) if oldmask[f] for c in range(ch)) if oldperiodic else True
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;result={'dataset':dataset,'baseline_5a':before,'5d':after,'new_cycles_provisional':decisions.get('new_cycle_count',0),'new_frames':sum(newmask),'new_region_error_ratio_to_mixture_or_single_input':newerror/max(newpower,1e-30),'direct_5a_samples_unchanged':True,'transient_estimates_unchanged':True,'new_boundaries':boundary,'maximum_new_boundary_step':max((v['new_step'] for v in boundary),default=0),'special':special,'meta':meta,'decisions':decisions,'timings':{'baseline_load_or_compute_seconds':setup,'correction_seconds':increment,'total_evaluation_seconds':time.perf_counter()-begin},'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'source_sha256':{p.name:__import__('hashlib').sha256(p.read_bytes()).hexdigest() for p in [P/'correction.py',P/'evaluate.py']}}
 with (P/f'evaluation-{dataset}.json').open('x') as f:json.dump(result,f,indent=2,allow_nan=False)
 print(json.dumps({k:v for k,v in result.items() if k not in ['decisions','new_boundaries','source_sha256']},indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('dataset',choices=['mix','single','kick']);run(p.parse_args().dataset)
