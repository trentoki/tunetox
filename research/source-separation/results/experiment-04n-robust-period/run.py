"""4N from frozen 4L metadata, with unchanged synthesis and metric functions."""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import resource
import sys
import time
import methods as n
b=n.l
m=b.j
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
H=ROOT/'results/experiment-04h-phase-neighbors';F=ROOT/'results/experiment-04f-independent';C=ROOT/'results/experiment-04c-majorsaw-shapes'

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def run(variant,output):
    begin=time.perf_counter();output=Path(output).resolve();output.mkdir(parents=True,exist_ok=False)
    prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
    base=json.loads((ROOT/'results/experiment-04l-boundary-periodicity/4l-final/report.json').read_text());discovery=json.loads((C/'report.json').read_text());fbase=json.loads((F/'b-related-shapes/report.json').read_text())
    source_audio=ROOT/'results/experiment-04l-boundary-periodicity/4l-final'
    assert sha(Path(discovery['input_path']))==base['input_sha256']
    for name,digest in base['outputs'].items():assert sha(source_audio/name)==digest
    io=m.render.d;rate,channels,original=io.read_export(source_audio/'original_reference.wav');_,_,old_y=io.read_export(source_audio/'reconstructed.wav');frames=len(original)//channels
    channel_audio=[original[c::channels] for c in range(channels)]
    quiet=base['boundary_diagnostics']['silence_intervals_frames'];bounds=base['boundary_diagnostics']['boundaries']
    # Replay saved metadata only; no periodicity or discovery rerun.
    import copy
    updated=copy.deepcopy(discovery['cycles']);changes=base['boundary_diagnostics']['periodicity_changes'];change_map={v['cycle']:v for v in changes};probes=0;boundary_seconds=0.
    for row in updated:
        update=change_map.get(row['cycle'])
        if update is None:continue
        row.update(reliable=update['new_reliable'],periodicity=update['new_periodicity'],estimated_f0_hz=update['new_f0'],rejection_reasons=update['new_reasons'])
        row['period_error_fraction']=abs((row['end_frame']-row['start_frame'])*row['estimated_f0_hz']/rate-1) if row['estimated_f0_hz'] else None
        if row['reliable']:row.update(b.c.signature(channel_audio,row['start_frame'],row['end_frame']))
    cycles={v['cycle']:v for v in updated};original_cycles={v['cycle']:v for v in discovery['cycles']}
    assign={v['cycle']:v for v in discovery['assignments']};families={v['family']:v for v in discovery['families']}
    for row in updated:
        if row['reliable'] and not original_cycles[row['cycle']]['reliable']:assign[row['cycle']]=b.frozen_assignment(row,discovery['families'])
    choices={v['cycle']:v['family'] for v in discovery['assignments'] if v['status']=='assigned'}
    for path,key in [(F/'b-related-shapes/occurrence-decisions.json','render_supported'),(H/'new-decisions.json','newly_supported'),(ROOT/'results/experiment-04j-independent/a-target-phase/decisions.json','newly_recognized'),(source_audio/'decisions.json','newly_recognized')]:
        for row in json.loads(path.read_text()):
            if row[key]:choices[row['cycle']]=row['render_family']
    original_ids=set(choices);original_choices=dict(choices)
    choices={i:f for i,f in choices.items() if cycles[i]['reliable']}
    base_ids=set(choices);allowed={tuple(v['families']) for v in fbase['family_relationships'] if v['relationship_supported']}
    baseline_rows=[{**cycles[i],'status':'assigned','family':family} for i,family in choices.items()];baseline_rows.sort(key=lambda v:v['start_frame'])
    onset=b.first_cycles_after_silence(cycles,quiet,rate) if True else set()
    timings={'setup_load_hash_seconds':time.perf_counter()-begin};t=time.perf_counter();recognized={};inferred=[];decisions=[]
    neighbors=m.h.temporal_neighbors(cycles)
    frozen_choose=m.h.choose
    m.h.choose=n.make_choose(bounds,quiet)
    for i,assignment in assign.items():
        if i in base_ids or not cycles[i]['reliable']:continue
        if assignment['status']=='assigned':family,evidence=assignment['family'],{'reasons':[],'frozen_exemplar_match':True}
        elif assignment['status']=='ambiguous':family,evidence=b.choose(cycles[i],assignment,cycles,families,allowed,neighbors,onset)
        else:family,evidence=None,{'reasons':['no supported recurring exemplar']}
        if family is not None:recognized[i]=family
        decisions.append({'cycle':i,'newly_recognized':family is not None,'render_family':family,'identity_family':None,**evidence})
    timings['recognition_or_sequence_analysis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    occurrences=baseline_rows+[{**cycles[i],'status':'assigned','family':family} for i,family in recognized.items()]+inferred
    y,mask,bridge,model=m.render.synthesize(discovery['families'],occurrences,frames,channels,rate,io.base_value_slope)
    base_mask=bytearray(frames)
    for row in baseline_rows:
        a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);base_mask[a:z]=bytes([1])*(z-a)
    assert all(not base_mask[i] or mask[i] for i in range(frames))
    new_mask=bytearray(mask[i] and not base_mask[i] for i in range(frames))
    timings['frozen_synthesis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    residual=[x-v for x,v in zip(original,y)]
    io.write_float(output/'reconstructed.wav',rate,channels,y);io.write_float(output/'residual.wav',rate,channels,residual)
    with (output/'original_reference.wav').open('xb') as f:f.write((source_audio/'original_reference.wav').read_bytes())
    timings['residual_and_exports_seconds']=time.perf_counter()-t;t=time.perf_counter()
    r,c,y=io.read_export(output/'reconstructed.wav');r2,c2,res=io.read_export(output/'residual.wav');rr,cc,reference=io.read_export(output/'original_reference.wav')
    assert (r,c,len(y))==(r2,c2,len(res))==(rr,cc,len(reference))==(rate,channels,len(original));assert reference==original
    error=[x-v for x,v in zip(original,y)];power=io.energy(original)
    supported_power=sum(original[i]**2 for i in range(len(original)) if mask[i//channels]);supported_error=sum(error[i]**2 for i in range(len(error)) if mask[i//channels])
    new_power=sum(original[i]**2 for i in range(len(original)) if new_mask[i//channels]);new_error=sum(error[i]**2 for i in range(len(error)) if new_mask[i//channels])
    ambiguous_ids=[i for i,v in assign.items() if v['status']=='ambiguous' and i not in base_ids]
    modeled_ambiguous=0;partial_ambiguous=0
    for i in ambiguous_ids:
        row=cycles[i];a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);fraction=sum(mask[a:z])/max(z-a,1)
        if fraction>=.95:modeled_ambiguous+=1
        elif fraction>0:partial_ambiguous+=1
    # Same significant-gap definition as 4I; no new gap detector tuned to results.
    diagnostic=m.load('frozen_4i_gap_math',ROOT/'results/experiment-04i-cycle-trace/analyze.py')
    owner=[0]*frames
    for row in cycles.values():
        a,z=math.ceil(row['start_frame']),math.ceil(row['end_frame']);owner[a:z]=[row['cycle']]*(z-a)
    med_energy=statistics_median([io.energy(original[math.ceil(v['start_frame'])*channels:math.ceil(v['end_frame'])*channels]) for v in cycles.values() if v['reliable']])
    med_period=statistics_median([v['end_frame']-v['start_frame'] for v in cycles.values() if v['reliable']])
    block=round(rate*.002);rms=[math.sqrt(io.energy(original[a*channels:min(a+block,frames)*channels])/((min(a+block,frames)-a)*channels)) for a in range(0,frames,block)];active=bytearray(frames)
    active_cutoff=.04*max(rms)
    for j,value in enumerate(rms):
        if value>active_cutoff:
            a=j*block;z=min(frames,a+block);active[a:z]=bytes([1])*(z-a)
    gap_records=[]
    for a,z in diagnostic.g.runs([bool(active[i] and max(abs(y[i*channels+c]) for c in range(channels))<=1e-12) for i in range(frames)]):
        ids=set(owner[a:z])-{0};period=statistics_median([cycles[i]['end_frame']-cycles[i]['start_frame'] for i in ids]) if ids else med_period
        energy=io.energy(original[a*channels:z*channels])
        if diagnostic.significant_gap(z-a,period,energy,med_energy):gap_records.append({'start_seconds':a/rate,'end_seconds':z/rate,'original_energy':energy})
    # Evaluate all new/inferred regions after final shared joins, without fitting them.
    cycle_metrics=[]
    for row in occurrences:
        if row['cycle'] in base_ids:continue
        a,z=math.ceil(row['start_frame'])*channels,math.ceil(row['end_frame'])*channels
        cycle_metrics.append({'cycle':row['cycle'],'provenance':row.get('provenance','phase-recognized'),
                              'error_ratio':io.energy(error[a:z])/max(io.energy(original[a:z]),1e-30),
                              'rms_ratio':math.sqrt(io.energy(y[a:z])/max(io.energy(original[a:z]),1e-30))})
    boundary_frames=sorted({math.ceil(row[key]) for row in occurrences for key in ['start_frame','end_frame']})
    def steps(values):
        bsteps=[max(abs(values[i*channels+c]-values[(i-1)*channels+c]) for c in range(channels)) for i in boundary_frames if 0<i<frames]
        return {'maximum_boundary_step':max(bsteps,default=0),'median_boundary_step':statistics_median(bsteps),
                'maximum_whole_step':max(abs(values[i]-values[i-channels]) for i in range(channels,len(values)))}
    assert all(y[i]==0 for i in range(len(y)) if not mask[i//channels])
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['evaluation_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_json_seconds']=time.perf_counter()-begin
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
    report={'variant':variant,'input_sha256':base['input_sha256'],'baseline':'4L','timings':timings,'peak_process_rss_bytes':peak,
            'metrics':{'newly_recognized_cycles':len(recognized),'inferred_cycles':len(inferred),'directly_recognized_total':len(base_ids)+len(recognized),
                       'original_ambiguous_cycles_newly_modeled_95pct':modeled_ambiguous,'partially_modeled_ambiguous':partial_ambiguous,
                       'remaining_unmodeled_ambiguous_cycles':len(ambiguous_ids)-modeled_ambiguous,'identity_labels_remain_unresolved':True,
                       'coverage_fraction':sum(mask)/frames,'significant_gap_intervals':len(gap_records),'accepted_runs':model['accepted_runs'],
                       'residual_energy_ratio':io.energy(res)/power,'reconstruction_rmse':math.sqrt(io.energy(error)/len(error)),
                       'modeled_error_ratio':supported_error/supported_power,'new_region_error_ratio':new_error/max(new_power,1e-30),
                       'float32_sum_maximum_error':max(abs(x-v-w) for x,v,w in zip(original,y,res))},
            'baseline_metrics':base['metrics'],'baseline_runs':base['metrics']['accepted_runs'],'baseline_significant_gaps':base['metrics']['significant_gap_intervals'],
            'baseline_timing':base['timings'],'baseline_peak_process_rss_bytes':base['peak_process_rss_bytes'],
            'new_region_cycle_metrics':cycle_metrics,'step_checks':{'4l_at_new_boundaries':steps(old_y),'variant':steps(y),'original':steps(original)},
            'recognized_cycle_ids':sorted(recognized),'inferred_occurrences':inferred,'significant_gaps':gap_records,
            'period_policy':{'context_per_side':n.CONTEXT_PER_SIDE,'minimum_references':n.MIN_REFERENCES,'duration_tolerance':n.TOLERANCE,'unchanged_other_thresholds':True},'frozen_64_position_sampler':True,
            'variants_combined':False,'midi_used':False,'original_fallback_used':False,'normalized_or_clipped':False,'listening_performed':False,
            'source_sha256':{name:sha(HERE/name) for name in ['methods.py','run.py']},'baseline_report_sha256':sha(source_audio/'report.json'),
            'outputs':{name:sha(output/name) for name in ['reconstructed.wav','residual.wav','original_reference.wav']},
            'prior_research_files_verified_unchanged':len(prior)}
    # Audit the new period comparison for previously accepted targets too.
    audit=[]
    for i in base_ids:
        row=cycles[i];period,detail=n.local_period(row,cycles,neighbors,bounds,quiet)
        if period is not None and abs(period/(row['end_frame']-row['start_frame'])-1)>n.TOLERANCE:
            audit.append({'cycle':i,'local_period':detail})
    report['previously_accepted_new_period_failures']=audit
    report['guard_specific_recovery']=[]
    for decision in decisions:
        if not decision['newly_recognized']:continue
        row=cycles[decision['cycle']];assignment=assign[decision['cycle']]
        m.h.choose=frozen_choose
        family,old_evidence=b.choose(row,assignment,cycles,families,allowed,neighbors,onset)
        m.h.choose=n.make_choose(bounds,quiet)
        assert family is None and any('neighbor period mismatch' in v for v in old_evidence['reasons'])
        report['guard_specific_recovery'].append({'cycle':row['cycle'],'old_reasons':old_evidence['reasons'],'new_evidence':decision})
    assert not audit, 'New period guard would reject previously accepted cycles'
    report['boundary_diagnostics']={'boundaries':bounds,'silence_intervals_frames':quiet,'periodicity_changes':changes,'periodicity_probes':probes,'periodicity_seconds':boundary_seconds,'onset_candidate_ids':sorted(onset),'lost_baseline_ids':sorted(original_ids-set(choices))}
    final_ids=set(choices)|set(recognized)
    report['recognized_cycle_ids']=sorted(final_ids-original_ids)
    report['metrics']['newly_recognized_cycles']=len(final_ids-original_ids)
    report['metrics']['lost_baseline_cycles']=len(original_ids-final_ids)
    report['metrics']['previously_unreliable_recovered']=sum(not original_cycles[i]['reliable'] for i in final_ids-original_ids)
    # Re-evaluate the six 4K gaps at identical sample locations.
    k=json.loads((ROOT/'results/experiment-04k-boundary-artifacts/report.json').read_text())
    report['six_4k_gap_recovery']=[]
    for gap in k['six_largest_saved_gaps']:
        a=round(gap['start_seconds']*rate);z=round(gap['end_seconds']*rate)
        ox=original[a*channels:z*channels];err=error[a*channels:z*channels];power_gap=io.energy(ox)
        report['six_4k_gap_recovery'].append({**gap,'coverage_fraction':sum(mask[a:z])/(z-a),'residual_energy_ratio':io.energy(err)/power_gap})
    for name,value in [('report.json',report),('decisions.json',decisions),('preservation.json',prior)]:
        with (output/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'variant':variant,'metrics':report['metrics'],'timings':timings,'peak_mib':peak/2**20,'step_checks':report['step_checks']},indent=2))

def statistics_median(values):
    import statistics
    return statistics.median(values) if values else 0.

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--variant',choices=['robust-period'],required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();run(args.variant,args.output)
