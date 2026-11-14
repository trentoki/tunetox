"""5E local diagnostic only: original versus already-recognized transient subtraction."""
import importlib.util,json,math,statistics,time,hashlib,resource,sys
from pathlib import Path
P=Path(__file__).resolve().parent;R=P.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run():
 begin=time.perf_counter();timing=json.loads((P/'timing-start.json').read_text());inspection=time.time()-timing['inspection_started_unix'];A=R/'results/experiment-05a-synth-clap';D=R/'results/experiment-05d-targeted-correction';files=[A/'mixture-inventory.json',A/'report.json',D/'evaluation-mix.json',D/'correction.py',R/'results/experiment-04q-provisional-continuity/report.json']+list((A/'listening').glob('*.wav'))+list((D/'listening').glob('*.wav'));before={str(p):sha(p) for p in files}
 io=load('io_local_e',R/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py');pitch=load('pitch_local_e',R/'diagnostic_04b/analysis.py');probe=load('probe_local_e',R/'results/experiment-05c-diagnostics/probes.py');one=load('presence_local_e',R/'experiment_01c.py')
 rate,ch,x=io.read_export(A/'listening/original_reference.wav');_,_,trans=io.read_export(A/'listening/separated_source_2.wav');_,_,old=io.read_export(A/'listening/separated_source_1.wav');_,_,new=io.read_export(D/'listening/separated_source_1.wav');inv=json.loads((A/'mixture-inventory.json').read_text());base=json.loads((A/'report.json').read_text());result=json.loads((D/'evaluation-mix.json').read_text());tables=base['periodic']['models']['1']['tables'];fits=[f for f in result['decisions']['fits'] if .46<=f['center_seconds']<=.77];anchor=statistics.median(f['f0'] for f in fits if f['accepted_complete_cycles']>0)
 # Only local windows are measured. Later-derived pitch is a diagnostic control, never a separation input.
 rows=[]
 for fr in inv['frames']:
  t=fr['frame']/rate
  if not .46<=t<=.77:continue
  a=fr['frame']-1024;z=a+2048;removed=[x[f*ch]-trans[f*ch] for f in range(a,z)];f0,conf=pitch.pitch(removed,rate)
  p=probe.periodic_probe(x,ch,rate,fr['frame'],anchor,tables);e=one.presence(p['model'],x[p['first_frame']*ch:p['end_frame']*ch],ch,0,round(rate*.004));small=round(rate*.004);aa=fr['frame']-small;zz=fr['frame']+small
  rms=math.sqrt(io.energy(x[aa*ch:zz*ch])/((zz-aa)*ch));trms=math.sqrt(io.energy(trans[aa*ch:zz*ch])/((zz-aa)*ch))
  rows.append({'center_seconds':t,'original_f0':fr['f0'],'original_pitch_confidence':fr['periodicity'],'after_existing_transient_subtraction_f0':f0,'after_subtraction_confidence':conf,'local_8ms_mixture_rms':rms,'local_8ms_transient_estimate_rms':trms,'later_pitch_probe_correlation':p['correlation'],'later_pitch_probe_gain':p['gain'],'later_pitch_probe_supported_windows':e['supported_windows'],'5d_was_evaluated':any(abs(t-f['center_seconds'])<1e-8 for f in fits)})
 cycles=[v for v in inv['cycles'] if .46<v['start_seconds']<.77];reason_counts={}
 for label,a,z in [('before',.46,.495),('overlap',.495,.60),('recognizable_late',.60,.627),('decay_after',.627,.69)]:
  local=[v for v in cycles if a<=v['start_seconds']<z];reason_counts[label]={'candidate_count':len(local),'reliable':sum(v['reliable'] for v in local),'periodicity_below_09':sum(v['periodicity']<.9 for v in local),'crossing_spacing_rejections':sum('crossing spacing disagrees with estimated period' in v['rejection_reasons'] for v in local)}
 recovered=[v for v in result['decisions']['new_occurrences'] if v['start_frame']/rate<.746 and v['end_frame']/rate>.489];first=min(v['start_frame'] for v in recovered);last=max(v['end_frame'] for v in recovered);aa=math.ceil(first)*ch;zz=math.ceil(last)*ch
 assert all(sha(Path(f))==h for f,h in before.items())
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 report={'scope_seconds':[.46,.77],'anchor_f0_diagnostic_only':anchor,'local_windows':rows,'cycle_reason_counts':reason_counts,'saved_5d_fits':fits,'recovered_samples':sum(math.ceil(v['end_frame'])-math.ceil(v['start_frame']) for v in recovered),'first_recovery_seconds':first/rate,'last_recovery_seconds':last/rate,'recovered_source_rms':math.sqrt(io.energy(new[aa:zz])/len(new[aa:zz])),'local_source_5a_energy':io.energy(old[round(.46*rate)*ch:round(.77*rate)*ch]),'timings':{'code_inspection_and_preparation_wall_seconds':inspection,'analysis_execution_wall_seconds':time.perf_counter()-begin},'peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'preserved_files':before,'no_algorithm_changes_or_audio_exports':True}
 with (P/'measurements.json').open('x') as f:json.dump(report,f,indent=2)
 print(json.dumps({'rows':[v for v in rows if .49<v['center_seconds']<.65],'counts':reason_counts,'recovery':[first/rate,last/rate,report['recovered_source_rms']],'timings':report['timings']},indent=2))
if __name__=='__main__':run()
