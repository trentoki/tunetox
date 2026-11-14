"""Listening export for the single selected candidate, after three-input evaluation."""
import csv,hashlib,json,math,resource,sys,time
from pathlib import Path
import evaluate as e
P=Path(__file__).resolve().parent;R=P.parents[1]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();exclude={P,R/'results/experiment-05c-diagnostics'};prior={str(p.resolve()):sha(p) for p in R.rglob('*') if p.is_file() and not any(v in p.parents for v in exclude)}
 measured=json.loads((P/'evaluation-mix.json').read_text());assert measured['new_cycles_provisional']>0 and measured['special']['third_note_new_cycles']>0
 raw,rate,ch,inv,old,other,detail,meta=e.prepare('mix');new,newmask,decisions=e.d.apply(raw,old,inv,detail,rate,ch);assert sum(newmask)==measured['new_frames'] and decisions['new_cycle_count']==measured['new_cycles_provisional'];out=P/'listening';out.mkdir(exist_ok=False);writer=e.a.one.write_float_wav;reader=e.a.n.l.j.render.d.read_export
 writer(out/'original_reference.wav',rate,ch,raw)
 tracks=new+other
 for i,track in enumerate(tracks,1):writer(out/f'separated_source_{i}.wav',rate,ch,track)
 tracks=[reader(out/f'separated_source_{i}.wav')[2] for i in range(1,len(tracks)+1)];total=[sum(t[i] for t in tracks) for i in range(len(raw))];writer(out/'residual.wav',rate,ch,[x-y for x,y in zip(raw,total)]);res=reader(out/'residual.wav')[2];writer(out/'recombined.wav',rate,ch,[x+y for x,y in zip(total,res)]);rec=reader(out/'recombined.wav')[2]
 frames=len(raw)//ch;oldmask=e.d.support_mask(detail,{v['cycle']:v for v in inv['cycles']},frames);labels=bytearray((1 if oldmask[f] else 0)|(2 if newmask[f] else 0)|(4 if any(abs(t[f*ch+c])>1e-12 for t in other for c in range(ch)) else 0) for f in range(frames));rows=[];start=0
 for f in range(1,frames+1):
  if f<frames and labels[f]==labels[start]:continue
  rows.append({'sample_start':start,'sample_end_exclusive':f,'start_seconds':start/rate,'end_seconds':f/rate,'existing_5a_periodic':bool(labels[start]&1),'new_5d_provisional_periodic':bool(labels[start]&2),'unchanged_5a_transient_template':bool(labels[start]&4),'confidence':'Categorical evidence only; true source purity unverified'});start=f
 with (P/'assignment-map.csv').open('x',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
 pitch_results={}
 for name,values in [('5a',old[0]),('5d',tracks[0])]:
  ff,_=e.a.c.frame_analysis([values[c::ch] for c in range(ch)],rate);supported=agree=0;errors=[]
  for original,estimate in zip(inv['frames'],ff):
   if original['f0'] and original['periodicity']>=.9 and estimate['f0'] and estimate['periodicity']>=.9:
    error=abs(estimate['f0']/original['f0']-1);errors.append(error);supported+=1;agree+=error<=.02
  pitch_results[name]={'joint_high_confidence_frames':supported,'within_2pct_of_mixture_f0':agree,'median_relative_f0_error':__import__('statistics').median(errors),'scope':'Agreement with observed mixture f0, not true source pitch ground truth'}
 assert all(sha(Path(p))==h for p,h in prior.items());error=max(abs(x-y-r) for x,y,r in zip(raw,total,res));assert error<=2e-7
 assert all(tracks[0][f*ch+c]==old[0][f*ch+c] for f in range(frames) if oldmask[f] for c in range(ch));assert tracks[1]==other[0]
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;report={'selected':'5D only; no combined changes','source_sha256':{f:sha(P/f) for f in ['correction.py','evaluate.py','export.py']},'input_sha256':sha(R/'audio/MajorsawwackClap.aif'),'outputs':{p.name:sha(p) for p in out.glob('*.wav')},'conservation_max_error':error,'recombined_reference_max_error':max(abs(x-y) for x,y in zip(raw,rec)),'old_periodic_samples_unchanged':True,'source_2_samples_unchanged':True,'source_2_export_bit_identical':sha(out/'separated_source_2.wav')==sha(R/'results/experiment-05a-synth-clap/listening/separated_source_2.wav'),'pitch_agreement_proxy':pitch_results,'runtime_seconds':time.perf_counter()-begin,'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'prior_files_verified':len(prior),'no_new_model_or_threshold_search':True,'listening_performed':False}
 for name,value in [('export-report.json',report),('preservation.json',prior)]:
  with (P/name).open('x') as f:json.dump(value,f,indent=2)
 print(json.dumps(report,indent=2))
if __name__=='__main__':run()
