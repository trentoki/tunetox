"""Post-run diagnostics only; never feed 5A or pitch information to 1C."""
import csv,hashlib,importlib.util,json,math,resource,statistics,sys,time
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def summary(values):return {'min':min(values),'median':statistics.median(values),'max':max(values)} if values else None
def run():
 begin=time.perf_counter();provenance=json.loads((P/'provenance.json').read_text());r=json.loads((P/'separation/report.json').read_text());a=load('original_io_compare',ROOT/'experiment_01c.py');pitch=load('diagnostic_pitch_only',ROOT/'diagnostic_04b/analysis.py')
 rate,ch,x=a.read_float_wav(P/'original_reference.wav');tracks=[a.read_float_wav(P/'separation'/v['file'])[2] for v in r['outputs']];frames=len(x)//ch
 five=json.loads((ROOT/'results/experiment-05a-synth-clap/report.json').read_text());observations=[v for v in five['events'] if v['recurring_waveform_supported']]
 long=max(r['events'],key=lambda v:v['end_frame']-v['start_frame']);components=[];frame_width=2048;hop=round(rate*.01)
 for k,track in enumerate(tracks,1):
  # The independent historical pitch diagnostic is read-only evaluation, not recognition/separation.
  mono=[track[f*ch] for f in range(frames)];pitch_rows=[]
  for start in range(0,frames-frame_width+1,hop):
   xx=mono[start:start+frame_width];power=sum(v*v for v in xx)/frame_width
   f0,conf=pitch.pitch(xx,rate) if power>1e-8 else (None,0.)
   pitch_rows.append({'time_seconds':(start+frame_width/2)/rate,'f0_hz':f0,'periodicity':conf,'rms':math.sqrt(power)})
  xx=x[long['start_frame']*ch:long['end_frame']*ch];yy=track[long['start_frame']*ch:long['end_frame']*ch];power=a.energy(xx);ypower=a.energy(yy);dot=sum(v*w for v,w in zip(xx,yy));gain=dot/max(power,1e-30);fiterror=a.energy([w-gain*v for v,w in zip(xx,yy)])/max(ypower,1e-30)
  component={'component':k,'file':r['outputs'][k-1]['file'],'template_event':r['passes'][k-1]['template_event'],'allocations':r['passes'][k-1]['allocations'],'energy_ratio':a.energy(track)/a.energy(x),'peak':max(map(abs,track),default=0),'nonzero_frame_fraction':sum(any(abs(track[f*ch+c])>1e-12 for c in range(ch)) for f in range(frames))/frames,'longest_event_mixture_correlation':dot/math.sqrt(max(power*ypower,1e-30)),'longest_event_fitted_mixture_gain':gain,'longest_event_error_from_scaled_mixture':fiterror,'longest_event_exact_mixture_max_error':max(abs(v-w) for v,w in zip(xx,yy)),'high_periodicity_frames':sum(v['periodicity']>=.9 for v in pitch_rows),'pitch_range_confident':summary([v['f0_hz'] for v in pitch_rows if v['periodicity']>=.9 and v['f0_hz']]),'recurring_fragment_windows':[]}
  for event in observations:
   first=event['start_frame'];last=min(frames,first+round(rate*.032));xx=x[first*ch:last*ch];yy=track[first*ch:last*ch];component['recurring_fragment_windows'].append({'time_seconds':first/rate,'mixture_energy':a.energy(xx),'component_energy':a.energy(yy),'component_mixture_cosine':pitch.cosine(xx,yy),'component_nonzero_fraction':sum(any(abs(track[f*ch+c])>1e-12 for c in range(ch)) for f in range(first,last))/(last-first)})
  components.append(component)
 # Whole-mixture active-mask coverage compares numerical support only, not source identity.
 block=round(rate*.002);powers=[a.energy(x[f*ch:min(frames,f+block)*ch])/((min(frames,f+block)-f)*ch) for f in range(0,frames,block)];cut=max(powers)*.015**2;active=bytearray(frames)
 for j,power in enumerate(powers):
  if power>cut:
   first=j*block;last=min(frames,first+block);active[first:last]=bytes([1])*(last-first)
 support=[]
 for k,track in enumerate(tracks,1):
  gaps=[];start=None
  for f in range(frames+1):
   missing=f<frames and active[f] and not any(abs(track[f*ch+c])>1e-12 for c in range(ch))
   if missing and start is None:start=f
   elif not missing and start is not None:
    if f-start>=round(rate*.001):gaps.append({'start_seconds':start/rate,'end_seconds':f/rate,'duration_seconds':(f-start)/rate})
    start=None
  support.append({'component':k,'active_mixture_frames':sum(active),'support_on_active_mixture_fraction':sum(active[f] and any(abs(track[f*ch+c])>1e-12 for c in range(ch)) for f in range(frames))/max(sum(active),1),'gaps_at_least_1ms_with_active_mixture':gaps})
 rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 comparison={'posthoc_only':True,'no_references_to_separator':True,'five_a_fragment_times_are_not_ground_truth_onsets':True,'longest_detected_event':long,'components':components,'numerical_support':support,'5a_comparison':{'source_count':five['source_count_estimated_models'],'residual_energy_ratio':five['residual_energy_ratio'],'periodic_coverage_fraction':five['periodic_coverage_fraction'],'periodic_support_at_recurring_fragments':[v['periodic_support_fraction_near_event'] for v in observations],'processing_seconds_including_inventory':five['timings']['total_run_seconds']+five['timings']['separate_inventory_seconds'],'peak_process_rss_bytes':five['peak_process_rss_bytes']},'diagnostic_runtime_seconds':time.perf_counter()-begin,'diagnostic_peak_process_rss_bytes':rss if sys.platform=='darwin' else rss*1024,'listening_performed':False}
 with (P/'comparison.json').open('x') as f:json.dump(comparison,f,indent=2,allow_nan=False)
 print(json.dumps(comparison,indent=2))
if __name__=='__main__':run()
