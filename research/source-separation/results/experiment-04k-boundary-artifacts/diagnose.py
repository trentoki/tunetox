"""Small 4K read-only spot check: five short regions, three optional figures."""
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import sys
import time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]

def load(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run():
    begin=time.perf_counter();prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
    A=ROOT/'results/experiment-04j-independent/a-target-phase';H=ROOT/'results/experiment-04h-phase-neighbors';F=ROOT/'results/experiment-04f-independent'
    a=json.loads((A/'report.json').read_text());c=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text())
    for name,digest in a['outputs'].items():
        if sha(A/name)!=digest:raise ValueError('4J-A export changed')
    if sha(Path(c['input_path']))!=a['input_sha256']:raise ValueError('Original changed')
    diagnostic=load('reused_4i_helpers',ROOT/'results/experiment-04i-cycle-trace/analyze.py');io=diagnostic.io;p=diagnostic.g.p
    rate,channels,x=io.read_export(A/'original_reference.wav');_,_,y=io.read_export(A/'reconstructed.wav');_,_,r=io.read_export(A/'residual.wav');frames=len(x)//channels
    cycles=c['cycles'];assign={v['cycle']:v for v in c['assignments']};jdec={v['cycle']:v for v in json.loads((A/'decisions.json').read_text())}
    h=json.loads((H/'report.json').read_text());f=json.loads((F/'b-related-shapes/report.json').read_text());accepted=set(f['accepted_cycle_ids'])|set(h['new_cycle_ids'])|set(a['recognized_cycle_ids'])
    controls=json.loads((ROOT/'results/experiment-04b-majorsaw-diagnostics/envelope-and-pitch-controls.json').read_text())
    onsets=[v['onset_seconds'] for v in controls['onset_controls'] if 'onset_seconds' in v]
    onset_gap=max((v for v in a['significant_gaps'] if min(abs(v['start_seconds']-t) for t in onsets)<.006 and v['start_seconds']<2.01),key=lambda v:v['original_energy'])
    transition_pairs=[(left,right,(left['end_seconds']+right['start_seconds'])/2) for left,right in zip(c['regions'],c['regions'][1:]) if right['start_seconds']-left['end_seconds']<.04 and left['end_seconds']>2.1]
    transition_gap=max((v for v in a['significant_gaps'] if any(v['start_seconds']-.025<=boundary<=v['end_seconds']+.025 for left,right,boundary in transition_pairs)),key=lambda v:v['original_energy'])
    transition=min(transition_pairs,key=lambda triple:abs(triple[2]-(transition_gap['start_seconds']+transition_gap['end_seconds'])/2))
    release=next(v for v in c['families'] if v['family']==2)['prototype_cycle'];release_cycle=next(v for v in cycles if v['cycle']==release)
    final_gap=a['significant_gaps'][-1]
    windows=[('attack',max(0,onset_gap['start_seconds']-.003),onset_gap['end_seconds']+.007),
             ('transition',transition_gap['start_seconds']-.004,transition_gap['end_seconds']+.006),
             ('release',release_cycle['start_seconds']-.006,release_cycle['start_seconds']+.018),
             ('steady-control',.083,.095),('recording-end',final_gap['start_seconds']-.004,frames/rate)]
    timings={'load_and_selection_seconds':time.perf_counter()-begin};t=time.perf_counter();results=[]
    for label,start,stop in windows:
        first=max(0,math.floor(start*rate));last=min(frames,math.ceil(stop*rate));owners=[None]*(last-first)
        rows=[v for v in cycles if v['end_frame']>first and v['start_frame']<last];details=[]
        for row in rows:
            i=row['cycle'];left=max(first,math.ceil(row['start_frame']));right=min(last,math.ceil(row['end_frame']))
            for frame in range(left,right):owners[frame-first]=row
            ca=math.ceil(row['start_frame'])*channels;cz=math.ceil(row['end_frame'])*channels;xx=x[ca:cz];yy=y[ca:cz];rr=r[ca:cz]
            reasons=jdec[i]['reasons'] if i in jdec and not jdec[i]['newly_recognized'] else []
            stage=diagnostic.classify(True,row['reliable'],'shape' in row,assign[i]['status'],i in accepted,io.energy(yy)/max(io.energy(xx),1e-30),reasons)
            detail={'cycle':i,'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],'stage':stage,'rendered':i in accepted,
                    'absolute_rms':row['absolute_rms'],'periodicity':row['periodicity'],'period_error':row['period_error_fraction'],
                    'detection_reasons':row['rejection_reasons'],'recognition_reasons':reasons,'error_ratio':io.energy(rr)/max(io.energy(xx),1e-30),
                    'original_energy':io.energy(xx),'model_rms_ratio':math.sqrt(io.energy(yy)/max(io.energy(xx),1e-30))}
            if i in accepted and io.energy(xx)>1e-12:detail['gain_phase_probe']=diagnostic.g.aligned_fit(xx,yy,channels,max_lag=1)
            details.append(detail)
        energy=collections.Counter();run_edge_steps=[];inside_steps=[];spikes=[];threshold=.2*max(map(abs,x))
        for frame in range(first,last):
            row=owners[frame-first];status='outside complete candidates' if row is None else next(v['stage'] for v in details if v['cycle']==row['cycle'])
            energy[status]+=sum(r[frame*channels+ch]**2 for ch in range(channels))
            if frame>first:
                previous=owners[frame-first-1];before=previous is not None and previous['cycle'] in accepted;after=row is not None and row['cycle'] in accepted
                step=max(abs(y[frame*channels+ch]-y[(frame-1)*channels+ch]) for ch in range(channels))
                (run_edge_steps if before!=after else inside_steps).append(step)
        flags=[max(abs(r[frame*channels+ch]) for ch in range(channels))>=threshold for frame in range(first,last)]
        for left,right in diagnostic.g.runs(flags):
            peak=max(range(left,right),key=lambda q:max(abs(r[(first+q)*channels+ch]) for ch in range(channels)));row=owners[peak]
            if row is None or row['cycle'] not in accepted:continue
            duration=row['end_frame']-row['start_frame']
            if right-left>.15*duration:continue
            phase=(first+peak-row['start_frame'])/duration;edge=diagnostic.sharp_edge(x,channels,row['start_frame'],row['end_frame'])
            spikes.append({'peak_seconds':(first+peak)/rate,'width_frames':right-left,'phase':phase,
                           'source_edge_offset_frames':abs(first+peak-edge['frame']) if edge else None,'bridge_phase':phase<.15 or phase>.85})
        results.append({'label':label,'start_seconds':first/rate,'end_seconds':last/rate,'cycles':details,
                        'original_energy':io.energy(x[first*channels:last*channels]),'residual_energy':io.energy(r[first*channels:last*channels]),
                        'residual_by_stage':dict(energy),'max_run_open_close_step':max(run_edge_steps,default=0),
                        'max_other_step':max(inside_steps,default=0),'narrow_rendered_spikes':spikes})
    # Same frozen pitch math, diagnostic clips only. No detection results are updated.
    boundary=round(transition[2]*rate);mono=x[::channels];pitch_probes=[]
    for label,start in [('left-only',boundary-2048),('centered-mixed',boundary-1024),('right-only',boundary)]:
        values=mono[start:start+2048];f0,confidence=p.pitch(values,rate)
        pitch_probes.append({'window':label,'start_seconds':start/rate,'end_seconds':(start+2048)/rate,'estimated_f0_hz':f0,'periodicity':confidence})
    total_residual=io.energy(r);top6=sorted(a['significant_gaps'],key=lambda v:-v['original_energy'])[:6]
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['selected_window_analysis_seconds']=time.perf_counter()-t;timings['total_before_report_seconds']=time.perf_counter()-begin
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
    report={'experiment':'4K','baseline':'4J-A','input_sha256':a['input_sha256'],'timings':timings,'peak_process_rss_bytes':peak,
            'sampled_regions':results,'transition_boundary_audio_seconds':transition[2],
            'transition_f0_flanks_hz':[transition[0]['f0_median_hz'],transition[1]['f0_median_hz']],
            'unchanged_math_periodicity_probes':pitch_probes,'six_largest_saved_gaps':top6,
            'six_largest_gaps_fraction_of_total_residual_energy':sum(v['original_energy'] for v in top6)/total_residual,
            'remaining_4j_a_rejection_reasons':dict(collections.Counter(reason for v in jdec.values() if not v['newly_recognized'] for reason in v['reasons'])),
            'last_original_sample_per_channel':x[-channels:],'prior_files_verified_unchanged':len(prior),
            'source_sha256':sha(Path(__file__)),'no_audio_or_algorithm_changed':True,'no_correction_implemented':True,
            'scope':'Five short regions only, plus saved gap ranking and three diagnostic pitch-window probes. Not an exhaustive recording audit.'}
    with (HERE/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (HERE/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    print(json.dumps({'timings':timings,'peak_mib':peak/2**20,'top6_residual_fraction':report['six_largest_gaps_fraction_of_total_residual_energy'],
                     'pitch_probes':pitch_probes,'regions':[{'label':v['label'],'stage_energy':v['residual_by_stage'],'run_edge_max':v['max_run_open_close_step'],'other_step_max':v['max_other_step']} for v in results]},indent=2))

if __name__=='__main__':run()
