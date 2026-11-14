"""Bounded experimental 5A separation; inputs are the mixture and code only."""
import collections,csv,hashlib,json,math,resource,sys,time
from pathlib import Path
import methods as m
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def runs(flags):
 out=[];a=None
 for i,v in enumerate(list(flags)+[False]):
  if v and a is None:a=i
  elif not v and a is not None:out.append((a,i));a=None
 return out

def run():
 begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
 source=ROOT/'audio/MajorsawwackClap.aif';digest=sha(source);assert digest=='5eb47bcae4b439165ee318ac9eca95c05f508ae08e7e229860ca0746429f7b23';rate,ch,x=m.c.p.decode_aifc(source);frames=len(x)//ch;inventory=json.loads((HERE/'mixture-inventory.json').read_text());timings={'load_hash_seconds':time.perf_counter()-begin,'separate_inventory_seconds':inventory['elapsed_seconds']}
 t=time.perf_counter();events,novelty=m.event_candidates(x,ch,rate);periodic,period_detail=m.periodic(inventory,x,rate,ch);timings['structure_detection_periodic_model_seconds']=time.perf_counter()-t
 print(json.dumps({'stage':'periodic modeled','periodic_hypotheses':len(periodic),'event_candidates':len(events),'periodic_groups':[{'families':v['family_ids'],'direct':v['direct_cycles'],'inferred':v['inferred_cycles'],'coverage':v['modeled_frames']/frames} for v in period_detail['groups']],'elapsed':time.perf_counter()-begin}),flush=True)
 t=time.perf_counter();periodsum=[sum(v[i] for v in periodic) for i in range(len(x))];remainder=[v-y for v,y in zip(x,periodsum)];transient,transient_detail=m.transients(remainder,x,rate,ch,events);timings['transient_recurrence_seconds']=time.perf_counter()-t
 tracks=periodic+transient;out=HERE/'listening';out.mkdir(exist_ok=False);m.one.write_float_wav(out/'original_reference.wav',rate,ch,x)
 for k,track in enumerate(tracks,1):m.one.write_float_wav(out/('separated_source_%d.wav'%k),rate,ch,track)
 io=m.n.l.j.render.d;tracks=[io.read_export(out/('separated_source_%d.wav'%(k+1)))[2] for k in range(len(tracks))];stemsum=[sum(v[i] for v in tracks) for i in range(len(x))];residual=[v-y for v,y in zip(x,stemsum)];m.one.write_float_wav(out/'residual.wav',rate,ch,residual);residual=io.read_export(out/'residual.wav')[2];recombined=[v+y for v,y in zip(stemsum,residual)];m.one.write_float_wav(out/'recombined.wav',rate,ch,recombined);recombined=io.read_export(out/'recombined.wav')[2]
 t=time.perf_counter();power=m.one.energy(x);conservation=max(abs(v-y-r) for v,y,r in zip(x,stemsum,residual));assert conservation<=2e-7;assert max(abs(v-y) for v,y in zip(x,recombined))<=2e-7
 # Categorical assignment/provenance map: overlapping models are explicit, not copies of mixture.
 labels=[];maprows=[];cy={v['cycle']:v for v in inventory['cycles']};directmask=bytearray(frames);predictionmask=bytearray(frames)
 for group in period_detail['groups']:
  for k in group['cycle_ids']:
   row=cy[k];a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);directmask[a:z]=bytes([1])*(z-a)
  for row in group['inferred_occurrences']:
   a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);predictionmask[a:z]=bytes([1])*(z-a)
 transientmask=bytearray(frames)
 for track in tracks[len(periodic):]:
  for f in range(frames):
   if any(abs(track[f*ch+c])>1e-12 for c in range(ch)):transientmask[f]=1
 for f in range(frames):labels.append((1 if directmask[f] else 0)|(2 if predictionmask[f] else 0)|(4 if transientmask[f] else 0))
 start=0
 for f in range(1,frames+1):
  if f<frames and labels[f]==labels[start]:continue
  maprows.append({'sample_start':start,'sample_end_exclusive':f,'periodic_direct':bool(labels[start]&1),'periodic_provisional_prediction':bool(labels[start]&2),'recurring_residual_template':bool(labels[start]&4),'uncertainty':'All source identities provisional; residual preserves unexplained material'});start=f
 with (HERE/'assignment-map.csv').open('x',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(maprows[0]));w.writeheader();w.writerows(maprows)
 characteristics=[]
 for k,track in enumerate(tracks):
  ff,_=m.c.frame_analysis([track[c::ch] for c in range(ch)],rate);active=[v for v in ff if v['active']];characteristics.append({'source':k+1,'method':'periodic waveform model' if k<len(periodic) else 'recurring residual-event waveform','energy_ratio':m.one.energy(track)/power,'peak':max(map(abs,track),default=0),'active_frames':len(active),'high_periodicity_fraction':sum(v['periodicity']>=.9 for v in active)/max(1,len(active)),'median_f0_hz':statistics_median([v['f0'] for v in active if v['periodicity']>=.9 and v['f0']]),'identity_confidence':'Provisional; characteristics only, not source purity'})
 # Event overlap and continuity diagnostics do not use supplied note locations.
 event_metrics=[]
 matched=set(a['event'] for v in transient_detail['passes'] for a in v.get('allocations',[]))
 for event in events:
  a=max(0,event['start_frame']-round(rate*.02));z=min(frames,event['start_frame']+round(rate*.1));active=[f for f in range(a,z) if max(abs(x[f*ch+c]) for c in range(ch))>.04*max(map(abs,x[a*ch:z*ch]))] if False else None
  missing=runs(not directmask[f] and not predictionmask[f] for f in range(a,z))
  event_metrics.append({**event,'recurring_waveform_supported':event['event'] in matched,'periodic_support_fraction_near_event':sum(bool(directmask[f] or predictionmask[f]) for f in range(a,z))/(z-a),'maximum_unmodeled_periodic_interval_seconds':max((end-start for start,end in missing),default=0)/rate,'window_seconds':[a/rate,z/rate]})
 pitch=[{'time_seconds':v['frame']/rate,'f0_hz':v['f0'],'periodicity':v['periodicity'],'active':v['active'],'status':'observed mixture estimate; unreliable values not forced'} for v in inventory['frames']]
 with (HERE/'pitch-trajectory.csv').open('x',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(pitch[0]));w.writeheader();w.writerows(pitch)
 assert all(sha(Path(p))==h for p,h in prior.items());timings['evaluation_preservation_seconds']=time.perf_counter()-t;timings['total_run_seconds']=time.perf_counter()-begin
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
 report={'experiment':'5A','input_path':str(source.resolve()),'input_sha256':digest,'sample_rate':rate,'channels':ch,'frames':frames,'source_count_estimated_models':len(tracks),'periodic_structure_hypotheses':len(periodic),'recurring_transient_templates':len(transient),'detected_change_event_count':len(events),'recurring_transient_event_count':len(matched),'events':event_metrics,'periodic':period_detail,'transients':transient_detail,'source_characteristics':characteristics,'residual_energy_ratio':m.one.energy(residual)/power,'recombined_definition':'Sum of all estimated sources AND unresolved residual. Stem-only sum is not asserted to equal original.','conservation_max_abs_error':conservation,'recombined_reference_max_abs_error':max(abs(v-y) for v,y in zip(x,recombined)),'periodic_coverage_fraction':sum(bool(directmask[f] or predictionmask[f]) for f in range(frames))/frames,'periodic_provisional_frames':sum(predictionmask),'policy':m.POLICY,'novelty_summary':{k:v for k,v in novelty.items() if k not in ['envelope','rise']},'timings':timings,'peak_process_rss_bytes':peak,'source_templates_used':[],'isolated_audio_used':False,'normalized_or_clipped':False,'listening_performed':False,'limitation':'Observed mixture/residual templates can retain interference; no verified ground-truth separation. Explicit residual is not discarded.','source_sha256':{name:sha(HERE/name) for name in ['run.py','methods.py','inspect_mixture.py']},'outputs':{v.name:sha(v) for v in out.glob('*.wav')},'prior_files_verified':len(prior)}
 for name,value in [('report.json',report),('preservation.json',prior)]:
  with (HERE/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False)
 print(json.dumps({'sources':characteristics,'events':event_metrics,'residual_ratio':report['residual_energy_ratio'],'timings':timings,'peak_mib':peak/2**20},indent=2))
def statistics_median(values):
 import statistics
 return statistics.median(values) if values else None
if __name__=='__main__':run()
