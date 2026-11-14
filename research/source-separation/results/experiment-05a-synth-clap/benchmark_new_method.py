"""5A method on benchmark mixture; baseline outputs used for evaluation only."""
import itertools,json,resource,sys,time
from pathlib import Path
import methods as m
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def run():
 begin=time.perf_counter();rate,ch,x=m.c.p.decode_aifc(ROOT/'audio/varvol2.aif');audio=[x[k::ch] for k in range(ch)];ff,strong=m.c.frame_analysis(audio,rate);cc,level=m.c.extract_cycles(audio,rate,ff,strong);families,assign,_=m.c.cluster(cc,m.c.POLICY['family_shape_min']);inventory={'frames':ff,'cycles':cc,'reference_channel':strong,'assignments':assign,'families':[{'family':v['family'],'status':v['status'],'prototype_cycle':v['prototype']['cycle'],'shape':v['prototype']['shape'],'occurrences':v['occurrences']} for v in families]}
 events,novelty=m.event_candidates(x,ch,rate);periodic,p=m.periodic(inventory,x,rate,ch);rem=[v-sum(track[i] for track in periodic) for i,v in enumerate(x)];transient,t=m.transients(rem,x,rate,ch,events);tracks=periodic+transient;io=m.n.l.j.render.d
 # Baseline comparison begins only after the method completes.
 baseline=[io.read_export(HERE/'regression-1c'/f'component_{i:02d}.wav')[2] for i in [1,2]]
 correlations=[[m.c.cosine(a,b) for b in baseline] for a in tracks];output=HERE/'benchmark-5a';output.mkdir(exist_ok=False)
 for i,track in enumerate(tracks,1):m.one.write_float_wav(output/f'source_{i}.wav',rate,ch,track)
 residual=[v-sum(track[i] for track in tracks) for i,v in enumerate(x)];m.one.write_float_wav(output/'residual.wav',rate,ch,residual)
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 report={'input':'varvol2.aif','periodic_models':len(periodic),'transient_templates':len(transient),'sources':len(tracks),'detected_changes':len(events),'recurrence_events':sorted(set(a['event'] for p in t['passes'] for a in p.get('allocations',[]))),'residual_energy_ratio':m.one.energy(residual)/m.one.energy(x),'signed_whole_track_correlations_to_1c_estimates':correlations,'comparison_scope':'1C outputs are reference estimates for post-hoc regression comparison, not ground truth, and were not discovery inputs.','timing_seconds':time.perf_counter()-begin,'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024}
 with (HERE/'benchmark-5a-report.json').open('x') as f:json.dump(report,f,indent=2)
 print(json.dumps(report,indent=2))
if __name__=='__main__':run()
