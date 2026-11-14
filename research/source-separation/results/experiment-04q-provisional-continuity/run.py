"""4Q adds original-sample provisional support only after a frozen 4N rerun."""
import collections,csv,hashlib,importlib.util,json,math,resource,sys,time
from pathlib import Path
import methods as m
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(s);s.loader.exec_module(module);return module
def run():
 begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
 B=HERE/'baseline-4n';saved=ROOT/'results/experiment-04n-robust-period/listening';base=json.loads((B/'report.json').read_text());saved_report=json.loads((saved/'report.json').read_text());assert base['outputs']==saved_report['outputs']
 for name,h in base['outputs'].items():assert sha(B/name)==h
 c=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text());assert sha(Path(c['input_path']))==base['input_sha256']
 io=load('q_frozen_io',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py');rate,ch,x=io.read_export(B/'original_reference.wav');_,_,old=io.read_export(B/'reconstructed.wav');frames=len(x)//ch;cycles={v['cycle']:v for v in c['cycles']}
 f=json.loads((ROOT/'results/experiment-04f-independent/b-related-shapes/report.json').read_text());h=json.loads((ROOT/'results/experiment-04h-phase-neighbors/report.json').read_text());j=json.loads((ROOT/'results/experiment-04j-independent/a-target-phase/report.json').read_text());l=json.loads((ROOT/'results/experiment-04l-boundary-periodicity/4l-final/report.json').read_text())
 accepted=set(f['accepted_cycle_ids'])|set(h['new_cycle_ids'])|set(j['recognized_cycle_ids'])|set(l['recognized_cycle_ids'])|set(base['recognized_cycle_ids']);assert len(accepted)==base['metrics']['directly_recognized_total']
 timings={'load_verify_seconds':time.perf_counter()-begin};t=time.perf_counter();y,labels,regions,policy=m.assign(x,old,ch,rate,cycles,accepted);timings['provisional_assignment_seconds']=time.perf_counter()-t;t=time.perf_counter()
 output=HERE/'listening';output.mkdir(exist_ok=False);io.write_float(output/'reconstructed.wav',rate,ch,y);io.write_float(output/'residual.wav',rate,ch,[a-b for a,b in zip(x,y)])
 with (output/'original_reference.wav').open('xb') as f:f.write((B/'original_reference.wav').read_bytes())
 _,_,y=io.read_export(output/'reconstructed.wav');_,_,res=io.read_export(output/'residual.wav')
 assert all(y[i]==old[i] for i in range(len(x)) if labels[i//ch]==1)
 assert all(y[i]==x[i] and res[i]==0 for i in range(len(x)) if labels[i//ch]==2)
 assert all(y[i]==old[i]==0 for i in range(len(x)) if labels[i//ch]==0)
 assert all(math.isfinite(v) for seq in [y,res] for v in seq)
 conservation=max(abs(a-b-c) for a,b,c in zip(x,y,res));assert conservation<=1e-8
 names={0:'unassigned',1:'recognized',2:'provisional'};intervals=[]
 for a,z in m.runs([True]*frames):pass
 start=0
 for f in range(1,frames+1):
  if f<frames and labels[f]==labels[start]:continue
  intervals.append({'sample_start':start,'sample_end_exclusive':f,'start_seconds':start/rate,'end_seconds':f/rate,'assignment':names[labels[start]],'provenance':'original recorded PCM; provisional single-source assumption' if labels[start]==2 else 'frozen 4N waveform synthesis' if labels[start]==1 else 'no assignment'});start=f
 with (HERE/'assignment-map.csv').open('x',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=list(intervals[0]));writer.writeheader();writer.writerows(intervals)
 with (HERE/'assignment-labels.u8').open('xb') as f:f.write(labels)
 provisional=[v for v in intervals if v['assignment']=='provisional'];switches=[v['sample_start'] for v in intervals[1:] if 'provisional' in [v['assignment'],next(w['assignment'] for w in intervals if w['sample_end_exclusive']==v['sample_start'])]]
 # Raw sample discontinuities measured without fitting, fades or smoothing.
 boundary=[]
 for frame in switches:
  def delta(seq):return [seq[frame*ch+c]-seq[(frame-1)*ch+c] for c in range(ch)]
  dq,dx,dn=delta(y),delta(x),delta(old)
  boundary.append({'frame':frame,'seconds':frame/rate,'4q_step':max(map(abs,dq)),'original_step':max(map(abs,dx)),'4n_step':max(map(abs,dn)),'4q_minus_original_step_max':max(abs(a-b) for a,b in zip(dq,dx))})
 active_missing=m.runs(labels[f]==0 and max(abs(x[f*ch+c]) for c in range(ch))>m.DIGITAL_QUIET for f in range(frames))
 count=collections.Counter(labels);power=io.energy(x)
 for f,h in prior.items():assert sha(Path(f))==h
 timings['exports_map_checks_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_json_seconds']=time.perf_counter()-begin
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
 report={'experiment':'4Q','baseline':'unchanged 4N rerun','input_sha256':base['input_sha256'],'baseline_bit_identical':True,'policy':policy,'known_single_source_control':True,'recognized_cycles_unchanged':len(accepted),'assignment_counts_frames':{names[k]:count[k] for k in names},'metrics':{'total_coverage_fraction':(count[1]+count[2])/frames,'recognized_fraction':count[1]/frames,'provisional_fraction':count[2]/frames,'provisional_sections':len(provisional),'provisional_duration_seconds':count[2]/rate,'remaining_active_waveform_gaps':len(active_missing),'remaining_active_gap_duration_seconds':sum(z-a for a,z in active_missing)/rate,'unassigned_runs_including_genuine_quiet':sum(v['assignment']=='unassigned' for v in intervals),'unassigned_duration_seconds':count[0]/rate,'residual_energy_ratio':io.energy(res)/power,'float32_sum_max_error':conservation},'baseline_metrics':base['metrics'],'continuous_regions':regions,'provisional_sections':provisional,'remaining_active_gap_frames':active_missing,'provisional_boundary_steps':boundary,'largest_provisional_boundary_step':max(boundary,key=lambda v:v['4q_step']),'largest_boundary_error_step':max(boundary,key=lambda v:v['4q_minus_original_step_max']),'timings':timings,'peak_process_rss_bytes':peak,'baseline_timings':base['timings'],'baseline_peak_process_rss_bytes':base['peak_process_rss_bytes'],'outputs':{name:sha(output/name) for name in ['original_reference.wav','reconstructed.wav','residual.wav']},'assignment_map_labels':{'0':'unassigned','1':'recognized 4N synthesis','2':'provisional original PCM'},'source_sha256':{name:sha(HERE/name) for name in ['methods.py','run.py']},'prior_files_verified':len(prior),'no_smoothing_or_threshold_changes':True,'listening_performed':False}
 for name,value in [('report.json',report),('preservation.json',prior)]:
  with (HERE/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False)
 print(json.dumps({'metrics':report['metrics'],'timings':timings,'peak_mib':peak/2**20,'largest_step':report['largest_provisional_boundary_step'],'largest_error_step':report['largest_boundary_error_step']},indent=2))
if __name__=='__main__':run()
