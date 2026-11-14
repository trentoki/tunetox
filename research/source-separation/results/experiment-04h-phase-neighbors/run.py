"""Narrow 4H experiment using frozen 4F-B synthesis and saved 4C discoveries."""
import collections
import hashlib
import json
import math
from pathlib import Path
import resource
import sys
import time
import recognition as h

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
F=ROOT/'results/experiment-04f-independent';B=F/'b-related-shapes';C=ROOT/'results/experiment-04c-majorsaw-shapes';D=ROOT/'results/experiment-04d-majorsaw-reconstruction'

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def selected_samples(values,cycle_ids,cycles,channels):
    return [value for i in cycle_ids for value in values[math.ceil(cycles[i]['start_frame'])*channels:math.ceil(cycles[i]['end_frame'])*channels]]


def run():
    total_start=time.perf_counter();setup_start=total_start
    prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
    baseline=json.loads((B/'report.json').read_text());baseline_decisions=json.loads((B/'occurrence-decisions.json').read_text());discovery=json.loads((C/'report.json').read_text())
    if sha(C/'report.json')!=baseline['discovery_report_sha256']:raise ValueError('Discovery changed since 4F-B')
    if sha(Path(discovery['input_path']))!=discovery['input_sha256']:raise ValueError('Input hash mismatch')
    for name,digest in baseline['outputs'].items():
        if sha(B/name)!=digest:raise ValueError('4F-B WAV changed')
    renderer=h.load('frozen_4f_renderer',F/'render.py');io=renderer.d
    rate,channels,original=io.read_export(D/'original_reference.wav');_,_,old_y=io.read_export(B/'reconstructed.wav')
    frames=len(original)//channels;cycles={v['cycle']:v for v in discovery['cycles']};assignments={v['cycle']:v for v in discovery['assignments']};families={v['family']:v for v in discovery['families']}
    old_ids=set(baseline['accepted_cycle_ids']);old_choices={v['cycle']:v['render_family'] for v in baseline_decisions if v['render_supported']}
    allowed={tuple(v['families']) for v in baseline['family_relationships'] if v['relationship_supported']}
    timings={'setup_load_and_hash_seconds':time.perf_counter()-setup_start};t=time.perf_counter()
    neighbors=h.temporal_neighbors(cycles);new_choices={};decisions=[]
    for assignment in assignments.values():
        i=assignment['cycle']
        if assignment['status']!='ambiguous' or i in old_ids:continue
        family,evidence=h.choose(cycles[i],assignment,cycles,families,allowed,neighbors)
        if family is not None:new_choices[i]=family
        decisions.append({'cycle':i,'original_status':'ambiguous','identity_family':None,'render_family':family,
                          'newly_supported':family is not None,**evidence})
    timings['recognition_analysis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    occurrences=[]
    for i,row in cycles.items():
        assignment=assignments[i];family=assignment['family'];status=assignment['status']
        if i in old_choices:family=old_choices[i];status='assigned'
        if i in new_choices:family=new_choices[i];status='assigned'
        occurrences.append({**row,'family':family,'status':status})
    y,mask,bridge,model=renderer.synthesize(discovery['families'],occurrences,frames,channels,rate,io.base_value_slope)
    accepted={v['cycle'] for v in occurrences if v['status']=='assigned' and v['reliable']}
    assert accepted==old_ids|set(new_choices)
    timings['synthesis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    residual=[x-v for x,v in zip(original,y)]
    io.write_float(HERE/'reconstructed.wav',rate,channels,y);io.write_float(HERE/'residual.wav',rate,channels,residual)
    # Reference only: byte-identical copy of the existing exact decoded conversion.
    with (HERE/'original_reference.wav').open('xb') as f:f.write((D/'original_reference.wav').read_bytes())
    timings['residual_and_three_wav_exports_seconds']=time.perf_counter()-t;t=time.perf_counter()
    exports={name:io.read_export(HERE/name) for name in ['reconstructed.wav','residual.wav','original_reference.wav']}
    for r,c,v in exports.values():assert (r,c,len(v))==(rate,channels,len(original))
    y=exports['reconstructed.wav'][2];res=exports['residual.wav'][2]
    assert exports['original_reference.wav'][2]==original
    error=[x-v for x,v in zip(original,y)];input_energy=io.energy(original)
    covered_input=sum(original[i]**2 for i in range(len(original)) if mask[i//channels]);covered_error=sum(error[i]**2 for i in range(len(error)) if mask[i//channels])
    new_original=selected_samples(original,new_choices,cycles,channels);new_error=selected_samples(error,new_choices,cycles,channels)
    # New-cycle waveform metrics; no gain/phase adjustment is applied to saved audio.
    new_cycle_metrics=[]
    for i in new_choices:
        row=cycles[i];a=math.ceil(row['start_frame'])*channels;b=math.ceil(row['end_frame'])*channels;x=original[a:b];v=y[a:b]
        power=io.energy(x);ypower=io.energy(v)
        new_cycle_metrics.append({'cycle':i,'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],
                                  'error_energy_ratio':io.energy(error[a:b])/max(power,1e-30),
                                  'render_to_original_rms_ratio':math.sqrt(ypower/max(power,1e-30)),
                                  'render_peak':max(map(abs,v),default=0),'original_peak':max(map(abs,x),default=0)})
    boundaries=sorted({math.ceil(cycles[i][key]) for i in accepted for key in ['start_frame','end_frame']})
    def step_stats(values):
        steps=[max(abs(values[f*channels+c]-values[(f-1)*channels+c]) for c in range(channels)) for f in boundaries if 0<f<frames]
        all_steps=[abs(values[i]-values[i-channels]) for i in range(channels,len(values))]
        return {'maximum_cycle_boundary_sample_step':max(steps,default=0),'median_cycle_boundary_sample_step':sorted(steps)[len(steps)//2] if steps else 0,
                'maximum_whole_waveform_sample_step':max(all_steps,default=0),'rms_whole_waveform_sample_step':math.sqrt(io.energy(all_steps)/max(len(all_steps),1))}
    artifact_steps={'original':step_stats(original),'4f_b_at_4h_boundaries':step_stats(old_y),'4h':step_stats(y)}
    assert all(y[i]==0 for i in range(len(y)) if not mask[i//channels])
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['evaluation_and_preservation_seconds']=time.perf_counter()-t;timings['total_run_before_json_seconds']=time.perf_counter()-total_start
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
    report={'experiment':'4H','input_sha256':discovery['input_sha256'],'sample_rate':rate,'channels':channels,'frames':frames,
            'analysis_scope':'Only the 194 originally ambiguous cycles still omitted by frozen 4F-B are evaluated for added rendering.',
            'timings':timings,'peak_process_rss_bytes':peak,'memory_scope':'Whole-process high-water RSS including metadata, original/baseline/new PCM, export QA and artifact metrics; excludes tests and HTML generation.',
            'baseline_metrics':baseline['metrics'],'baseline_timings':baseline['timings'],'baseline_peak_process_rss_bytes':baseline['peak_process_rss_bytes'],
            'metrics':{'additional_cycles':len(new_choices),'total_rendered_cycles':len(accepted),'remaining_ambiguous_cycles':len(decisions)-len(new_choices),
                       'coverage_fraction':sum(mask)/frames,'covered_frames':sum(mask),'reconstructed_energy_ratio':io.energy(y)/input_energy,
                       'residual_energy_ratio':io.energy(res)/input_energy,'reconstruction_rmse':math.sqrt(io.energy(error)/len(error)),
                       'modeled_error_to_modeled_input_ratio':covered_error/covered_input,
                       'additional_cycles_error_ratio':io.energy(new_error)/max(io.energy(new_original),1e-30),
                       'float32_sum_maximum_error':max(abs(x-v-z) for x,v,z in zip(original,y,res)),
                       'energetic_new_cycles_over_25pct_error':sum(v['error_energy_ratio']>.25 and v['original_peak']>.01 for v in new_cycle_metrics)},
            'model':model,'new_cycle_metrics':new_cycle_metrics,'artifact_sample_steps':artifact_steps,
            'neighbor_policy':{'maximum_gap_periods':h.MAX_GAP_PERIODS,'comparison_shift_positions':[-.5,-.25,0,.25,.5],
                               'neighbor_shape_min':h.f.RELATION_POLICY['neighbor_geometry_min'],'neighbor_period_change_max':h.f.RELATION_POLICY['neighbor_period_change_max'],
                               'all_target_gates':'Unchanged calls to frozen 4F-B chooser; only its neighbor rejection reasons are replaced.'},
            'new_cycle_ids':sorted(new_choices),'baseline_cycle_ids_preserved':True,'source_identity_labels_merged':False,
            'renderer':'Exact frozen 4F sampler-injected renderer with exact frozen 4D base_value_slope (64-position linear). No 4F-A sampler.',
            'synthesis_phase_shifts_applied':False,'cycle_detection_or_pitch_changed':False,'original_fallback_used':False,
            'midi_used':False,'normalized_or_clipped':False,'listening_performed':False,
            'outputs':{name:sha(HERE/name) for name in exports},'baseline_report_sha256':sha(B/'report.json'),'discovery_report_sha256':sha(C/'report.json'),
            'frozen_code_sha256':{str(path):sha(path) for path in [F/'methods.py',F/'render.py',D/'reconstruct.py',ROOT/'results/experiment-04g-gap-family-diagnostics/contextualize.py']},
            'source_sha256':{name:sha(HERE/name) for name in ['recognition.py','run.py']},'prior_research_files_verified_unchanged':len(prior),
            'limits':['Fractional phase comparison slightly interpolates/smooths descriptors; matching is not proof of common physical origin.',
                      'No new listening has been performed. Sample-step and error checks do not certify absence of audible artifacts.',
                      'All 64-position high-frequency limitations remain intentionally unchanged.']}
    for name,value in [('report.json',report),('new-decisions.json',decisions),('preservation.json',prior)]:
        with (HERE/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'timings':timings,'peak_mib':peak/2**20,'metrics':report['metrics'],'accepted_runs':model['accepted_runs'],'artifact_steps':artifact_steps},indent=2))

if __name__=='__main__':run()
