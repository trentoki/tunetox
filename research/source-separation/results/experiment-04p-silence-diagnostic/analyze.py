"""4P: saved decisions plus RMS remeasurement; no DSP or exports rerun."""
import hashlib,importlib.util,json,math,resource,sys,time
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
 l=load('l_p',ROOT/'results/experiment-04l-boundary-periodicity/methods.py');m=load('m_p',ROOT/'results/experiment-04m-missing-sections/analyze.py');io=l.j.render.d
 N=ROOT/'results/experiment-04n-robust-period/listening';nr=json.loads((N/'report.json').read_text());d=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text());o=json.loads((ROOT/'results/experiment-04o-note-boundaries/report.json').read_text())
 assert sha(Path(d['input_path']))==nr['input_sha256']
 for f,h in nr['outputs'].items():assert sha(N/f)==h
 rate,ch,x=io.read_export(N/'original_reference.wav');_,_,y=io.read_export(N/'reconstructed.wav');_,_,res=io.read_export(N/'residual.wav');frames=len(x)//ch
 width=2048;hop=round(rate*.01);block=round(rate*.002)
 cutoff_frame=.04*max(v['rms'] for v in d['frames'])
 rms=[math.sqrt(io.energy(x[a*ch:min(a+block,frames)*ch])/((min(a+block,frames)-a)*ch)) for a in range(0,frames,block)];cutoff_block=.04*max(rms)
 quiet=l.silence_intervals(x,ch,rate);assert [list(v) for v in quiet]==nr['boundary_diagnostics']['silence_intervals_frames']
 timings={'load_and_rms_seconds':time.perf_counter()-begin};t=time.perf_counter();cy={v['cycle']:v for v in d['cycles']};changes={v['cycle']:v for v in nr['boundary_diagnostics']['periodicity_changes']};dec={v['cycle']:v for v in json.loads((N/'decisions.json').read_text())}
 cases=[]
 for k in [702,703,705,117,239,428,685,1835,1840,1852,1853]:
  row=cy[k];center=(row['start_frame']+row['end_frame'])/2;fi=max(0,min(len(d['frames'])-1,round((center-1024)/hop)));fr=d['frames'][fi];a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);values=x[a*ch:z*ch];blocks=rms[a//block:(z-1)//block+1]
  update=changes.get(k,{});reasons=update.get('new_reasons',row['rejection_reasons']);mask_overlap=sum(max(0,min(z,end)-max(a,start)) for start,end in quiet)
  cases.append({'cycle':k,'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],'candidate_rms':math.sqrt(io.energy(values)/max(len(values),1)),'duration_frames':row['end_frame']-row['start_frame'],'frame_index':fi,'frame_window':[fr['frame']-1024,fr['frame']+1024],'frame_rms':fr['rms'],'frame_active':fr['active'],'frame_cutoff':cutoff_frame,'block_rms_min':min(blocks),'block_rms_max':max(blocks),'block_cutoff':cutoff_block,'sustained_quiet_overlap_frames':mask_overlap,'periodicity':update.get('new_periodicity',row['periodicity']),'rejection_reasons':reasons,'decision':dec.get(k),'model_energy':io.energy(y[a*ch:z*ch]),'residual_energy':io.energy(res[a*ch:z*ch])})
 gap_evidence=[]
 for gap in nr['significant_gaps']:
  a=round(gap['start_seconds']*rate);z=round(gap['end_seconds']*rate);owners=[v for v in cy.values() if v['end_frame']>a and v['start_frame']<z];inactive=[]
  for row in owners:
   reasons=changes.get(row['cycle'],{}).get('new_reasons',row['rejection_reasons'])
   if 'below relative activity screen' in reasons:inactive.append(row['cycle'])
  gap_evidence.append({**gap,'candidate_ids': [v['cycle'] for v in owners],'activity_rejected_candidate_ids':inactive,'sustained_quiet_overlap_frames':sum(max(0,min(z,end)-max(a,start)) for start,end in quiet)})
 # Local zero/near-zero runs are counted only as diagnostics, never as a silence mask.
 selected=next(v for v in o['audio_derived_inventory'] if v['group']=='long' and v['ordinal']==1);start=math.ceil(selected['sample_start']);end=frames
 sample_cutoff=.04*max(map(abs,x))
 runs=m.runs(max(abs(x[f*ch+c]) for c in range(ch))<=sample_cutoff for f in range(start,end))
 interior_runs=[(a+start,z+start) for a,z in runs if a>0 and z<end-start]
 longest=max(interior_runs,key=lambda v:v[1]-v[0]);f=(longest[0]+longest[1])//2
 crossing_example={'sample_start':longest[0],'sample_end_exclusive':longest[1],'length_frames':longest[1]-longest[0],'diagnostic_sample_cutoff':.04*max(map(abs,x)),'containing_2ms_block_rms':rms[f//block],'block_cutoff':cutoff_block,'sustained_quiet_overlap':any(a<longest[1] and z>longest[0] for a,z in quiet)}
 # Saved active flags agree with the documented RMS comparison for every frame.
 assert all(fr['active']==(fr['rms']>cutoff_frame) for fr in d['frames'])
 assert not any(a<frames and z>start for a,z in quiet)
 assert all(sha(Path(f))==h for f,h in prior.items())
 timings['trace_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_json_seconds']=time.perf_counter()-begin
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
 report={'experiment':'4P','input_sha256':nr['input_sha256'],'activity_window_frames':width,'activity_hop_frames':hop,'activity_rms_cutoff':cutoff_frame,'quiet_block_frames':block,'quiet_block_rms_cutoff':cutoff_block,'sustained_quiet_min_frames':width,'saved_quiet_intervals_frames':quiet,'representative_cases':cases,'all_remaining_significant_gaps':gap_evidence,'near_zero_run_example':crossing_example,'continuous_passage_min_block_rms':min(rms[start//block:]),'continuous_passage_quiet_intervals':0,'frame_activity_flags_checked':len(d['frames']),'timings':timings,'peak_process_rss_bytes':peak,'prior_files_verified':len(prior),'source_sha256':sha(Path(__file__)),'no_algorithm_or_audio_changes':True}
 for name,value in [('report.json',report),('preservation.json',prior)]:
  with (HERE/name).open('x') as out:json.dump(value,out,indent=2,allow_nan=False)
 print(json.dumps({'timings':timings,'peak_mib':peak/2**20,'cutoffs':[cutoff_frame,cutoff_block],'zero_example':crossing_example,'min_continuous_rms':report['continuous_passage_min_block_rms']},indent=2))
if __name__=='__main__':run()
