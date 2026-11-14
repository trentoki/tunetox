"""4I diagnostic trace of frozen 4H gaps. No algorithm decisions or WAVs changed."""
import collections
import csv
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import statistics
import sys
import time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
H=ROOT/'results/experiment-04h-phase-neighbors';F=ROOT/'results/experiment-04f-independent';C=ROOT/'results/experiment-04c-majorsaw-shapes';G=ROOT/'results/experiment-04g-gap-family-diagnostics'

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

g=load('frozen_4g_diagnostics',G/'analyze.py')
phase_probe=load('frozen_4g_phase_probe',G/'contextualize.py')
c_math=load('frozen_4c_signature',ROOT/'diagnostic_04c/analysis.py')
io=g.io

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def summary(values):
    if not values:return None
    x=sorted(values);return {'count':len(x),'min':x[0],'median':statistics.median(x),'q95':x[round(.95*(len(x)-1))],'max':x[-1]}

def classify(detected,reliable,has_signature,status,accepted,output_ratio,reasons):
    """Exclusive diagnostic stage labels, not new eligibility decisions."""
    if accepted:return 'accepted_not_rendered' if output_ratio<1e-6 else 'rendered_model_error'
    if not detected:return 'outside_candidate_support'
    if not reliable:return 'detection_reliability_rejection'
    if not has_signature:return 'signature_missing'
    if status=='provisional':return 'provisional_family_rejection'
    if status=='ambiguous':
        if any('unsupported competing-family' in v for v in reasons):return 'unsupported_family_relationship'
        if 'target shape similarity too low' in reasons:return 'target_shape_rejection'
        if 'period confidence insufficient' in reasons:return 'target_period_confidence_rejection'
        return 'neighbor_rejection'
    return 'accepted_decision_not_in_render_support'

def sharp_edge(original,channels,start,end):
    """Audio-derived maximum slope, not a hardcoded ramp/reset direction."""
    first=max(1,math.ceil(start));last=min(len(original)//channels,math.ceil(end))
    if last<=first:return None
    def strength(frame):return max(abs(original[frame*channels+c]-original[(frame-1)*channels+c]) for c in range(channels))
    frame=max(range(first,last),key=strength);delta=0.
    if first<frame<last-1:
        a,b,c=[strength(i) for i in [frame-1,frame,frame+1]];den=a-2*b+c
        if den:delta=max(-.5,min(.5,.5*(a-c)/den))
    return {'frame':frame,'fractional_frame':frame+delta,'absolute_step':strength(frame),
            'cycle_phase':(frame+delta-start)/(end-start),'location_uncertainty':'Sampled max-slope proxy, not a physical discontinuity timestamp.'}

def significant_gap(length,period,energy,median_cycle_energy):
    return energy>=.01*median_cycle_energy and (length>=.2*period or energy>=.1*median_cycle_energy)


def run():
    begin=time.perf_counter();prior={str(path.resolve()):sha(path) for path in ROOT.rglob('*') if path.is_file() and HERE not in path.parents}
    h=json.loads((H/'report.json').read_text());hv=json.loads((H/'verification.json').read_text())
    for name,digest in hv['files_sha256'].items():
        if sha(H/name)!=digest:raise ValueError('Frozen 4H artifact changed: '+name)
    discovery=json.loads((C/'report.json').read_text());baseline=json.loads((F/'b-related-shapes/report.json').read_text())
    if sha(C/'report.json')!=h['discovery_report_sha256']:raise ValueError('4C discovery changed')
    rate,channels,original=io.read_export(H/'original_reference.wav');_,_,y=io.read_export(H/'reconstructed.wav');_,_,res=io.read_export(H/'residual.wav')
    if sha(Path(discovery['input_path']))!=h['input_sha256']:raise ValueError('Original input changed')
    frames=len(original)//channels;audio_channels=[original[c::channels] for c in range(channels)]
    cycles={v['cycle']:v for v in discovery['cycles']};assign={v['cycle']:v for v in discovery['assignments']};families={v['family']:v for v in discovery['families']}
    h_decisions={v['cycle']:v for v in json.loads((H/'new-decisions.json').read_text())}
    b_decisions={v['cycle']:v for v in json.loads((F/'b-related-shapes/occurrence-decisions.json').read_text())}
    accepted=set(baseline['accepted_cycle_ids'])|set(h['new_cycle_ids']);mask=g.mask_from_cycles(cycles,accepted,frames)
    render_family={i:v['family'] for i,v in assign.items() if v['status']=='assigned'}
    render_family.update({i:v['render_family'] for i,v in b_decisions.items() if v['render_supported']})
    render_family.update({i:v['render_family'] for i,v in h_decisions.items() if v['newly_supported']})
    owner=[0]*frames
    for row in cycles.values():
        a=math.ceil(row['start_frame']);z=math.ceil(row['end_frame']);owner[a:z]=[row['cycle']]*(z-a)
    median_cycle_energy=statistics.median(io.energy(original[math.ceil(v['start_frame'])*channels:math.ceil(v['end_frame'])*channels]) for v in cycles.values() if v['reliable'])
    block=round(rate*.002);powers=[math.sqrt(io.energy(original[a*channels:min(frames,a+block)*channels])/((min(frames,a+block)-a)*channels)) for a in range(0,frames,block)]
    threshold=.04*max(powers);active=bytearray(frames)
    for i,power in enumerate(powers):
        a=i*block;z=min(frames,a+block)
        if power>threshold:active[a:z]=bytes([1])*(z-a)
    timings={'setup_verify_load_seconds':time.perf_counter()-begin};t=time.perf_counter()
    records=[];edges={};by_id={}
    for i,row in cycles.items():
        a=math.ceil(row['start_frame']);z=math.ceil(row['end_frame']);x=original[a*channels:z*channels];model=y[a*channels:z*channels];error=res[a*channels:z*channels]
        power=io.energy(x);model_power=io.energy(model);error_power=io.energy(error);is_accepted=i in accepted
        reasons=h_decisions[i]['reasons'] if i in h_decisions and not h_decisions[i]['newly_supported'] else []
        stage=classify(True,row['reliable'],'shape' in row,assign[i]['status'],is_accepted,model_power/max(power,1e-30),reasons)
        edge=sharp_edge(original,channels,row['start_frame'],row['end_frame']);edges[i]=edge
        record={'cycle':i,'start_frame':row['start_frame'],'end_frame':row['end_frame'],'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],
                'candidate_detected':True,'detected_duration_frames':row['end_frame']-row['start_frame'],
                'estimated_f0_hz':row['estimated_f0_hz'],'periodicity':row['periodicity'],'period_error_fraction':row['period_error_fraction'],
                'detection_reliability':row['reliable'],'detection_rejection_reasons':row['rejection_reasons'],
                'signature_present':'shape' in row,'original_grouping_status':assign[i]['status'],'original_family':assign[i]['family'],
                'historical_family_candidates':assign[i].get('candidates',[]),'render_family':render_family.get(i),
                '4f_b_supported':i in set(baseline['accepted_cycle_ids']),'4h_supported':is_accepted,
                'recognition_rejection_reasons':reasons,'failure_category':stage,'original_energy':power,'model_energy':model_power,
                'residual_energy':error_power,'error_ratio':error_power/max(power,1e-30),'sharpest_original_edge':edge}
        if is_accepted and power>1e-12:
            record['lag_gain_probe']=g.aligned_fit(x,model,channels,max_lag=1)
            record['actual_output_nonzero']=model_power>1e-12
        if not is_accepted and row['reliable'] and 'shape' in row:
            regenerated=c_math.signature(audio_channels,row['start_frame'],row['end_frame'])
            record['signature_regeneration_max_difference']=max(abs(v-w) for v,w in zip(regenerated['shape'],row['shape']))
            if assign[i].get('candidates'):
                best=max(assign[i]['candidates'],key=lambda v:v['similarity']);prototype=families[best['family']]['signature_shape_64_per_channel']
                record['historical_best_family']=best['family'];record['historical_best_similarity']=best['similarity']
                record['recomputed_same_signature_similarity']=g.p.cosine(row['shape'],prototype)
                record['bounded_descriptor_phase_probe']=phase_probe.bounded_phase_similarity(row['shape'],prototype)
                shifted=[]
                for delta in [-1,-.5,0,.5,1]:
                    if row['start_frame']+delta<0 or row['end_frame']+delta>frames:continue
                    vector=c_math.signature(audio_channels,row['start_frame']+delta,row['end_frame']+delta)['shape']
                    shifted.append({'shift_original_frames':delta,'similarity':g.p.cosine(vector,prototype)})
                record['boundary_translation_probe']=max(shifted,key=lambda v:v['similarity'])
                record['probe_scope']='Diagnostic remeasurement/comparison only. No stored boundary, signature, acceptance, or waveform was changed.'
        records.append(record);by_id[i]=record
    # Reset-to-reset spacing is compared with crossing period, not mistaken for its phase origin.
    for i,row in cycles.items():
        following=cycles.get(i+1);previous=cycles.get(i-1);edge=edges[i]
        if edge and following and edges[i+1]:
            by_id[i]['next_edge_context_reliable']=following['reliable']
            by_id[i]['next_period_change_fraction']=abs((following['end_frame']-following['start_frame'])/(row['end_frame']-row['start_frame'])-1)
            by_id[i]['next_edge_interval_frames']=edges[i+1]['fractional_frame']-edge['fractional_frame']
            by_id[i]['edge_interval_vs_crossing_period_fraction']=abs(by_id[i]['next_edge_interval_frames']/(row['end_frame']-row['start_frame'])-1)
        if edge and previous and edges[i-1]:by_id[i]['previous_edge_interval_frames']=edge['fractional_frame']-edges[i-1]['fractional_frame']
    # Nearest accepted cycles are evaluated only as context, never as a new rule.
    previous={};following={};last=None
    for row in cycles.values():
        previous[row['cycle']]=last
        if row['cycle'] in accepted:last=row
    last=None
    for row in reversed(list(cycles.values())):
        following[row['cycle']]=last
        if row['cycle'] in accepted:last=row
    for record in records:
        if record['4h_supported']:continue
        duration=record['end_frame']-record['start_frame'];neighbors=[]
        for side,other in [('previous',previous[record['cycle']]),('following',following[record['cycle']])]:
            if not other:continue
            gap=record['start_frame']-other['end_frame'] if side=='previous' else other['start_frame']-record['end_frame']
            neighbors.append({'side':side,'cycle':other['cycle'],'gap_periods':gap/duration,'error_ratio':by_id[other['cycle']]['error_ratio']})
        record['adjacent_rendered_context']=neighbors
        record['isolated_ordinary_gap']=record['detection_reliability'] and len(neighbors)==2 and all(v['gap_periods']<=.1 and v['error_ratio']<=.05 for v in neighbors)
    # Trace actual flat output runs, independently of the declared support mask.
    zero=[bool(active[frame] and max(abs(y[frame*channels+c]) for c in range(channels))<=1e-12) for frame in range(frames)]
    gaps=[]
    for index,(a,z) in enumerate(g.runs(zero)):
        power=io.energy(original[a*channels:z*channels]);ids=sorted(set(owner[a:z])-{0})
        local_period=statistics.median(cycles[i]['end_frame']-cycles[i]['start_frame'] for i in ids) if ids else statistics.median(row['end_frame']-row['start_frame'] for row in cycles.values() if row['reliable'])
        cause_energy=collections.Counter()
        for frame in range(a,z):
            i=owner[frame];stage=by_id[i]['failure_category'] if i else 'outside_candidate_support'
            cause_energy[stage]+=sum(original[frame*channels+c]**2 for c in range(channels))
        gaps.append({'gap':index+1,'start_frame':a,'end_frame':z,'start_seconds':a/rate,'end_seconds':z/rate,
                     'duration_frames':z-a,'original_energy':power,'significant':significant_gap(z-a,local_period,power,median_cycle_energy),
                     'cycle_ids':ids,'trace_categories':dict(cause_energy),'dominant_category':max(cause_energy,key=cause_energy.get),
                     'any_declared_rendered_frames':bool(sum(mask[a:z])),
                     'residual_equals_original':all(res[j]==original[j] for j in range(a*channels,z*channels))})
    timings['trace_and_boundary_probes_seconds']=time.perf_counter()-t;t=time.perf_counter()
    # Narrow internal spikes, separately from entirely missing ramps.
    spike_threshold=.2*max(map(abs,original));spike_flags=[max(abs(res[i*channels+c]) for c in range(channels))>=spike_threshold for i in range(frames)];spikes=[]
    for a,z in g.runs(spike_flags):
        peak=max(range(a,z),key=lambda f:max(abs(res[f*channels+c]) for c in range(channels)));i=owner[peak]
        if not i or i not in accepted:continue
        row=cycles[i];duration=row['end_frame']-row['start_frame']
        if (z-a)>.15*duration or not all(mask[a:z]):continue
        edge=edges[i];phi=(peak-row['start_frame'])/duration
        spikes.append({'start_seconds':a/rate,'end_seconds':z/rate,'peak_seconds':peak/rate,'cycle':i,'width_frames':z-a,
                       'phase':phi,'source_sharp_edge_offset_frames':abs(peak-edge['frame']) if edge else None,
                       'in_bridge_phase_zone':phi<.15 or phi>.85,'energy':io.energy(res[a*channels:z*channels])})
    categories=collections.defaultdict(lambda:{'cycle_count':0,'original_energy':0.,'residual_energy':0.})
    for record in records:
        row=categories[record['failure_category']];row['cycle_count']+=1;row['original_energy']+=record['original_energy'];row['residual_energy']+=record['residual_energy']
    unowned=[i for i,v in enumerate(owner) if not v]
    categories['outside_candidate_support']={'cycle_count':0,'fragment_count':len(g.runs([v==0 for v in owner])),
        'original_energy':sum(original[i*channels+c]**2 for i in unowned for c in range(channels)),
        'residual_energy':sum(res[i*channels+c]**2 for i in unowned for c in range(channels))}
    total_residual=io.energy(res)
    for row in categories.values():row['fraction_of_total_residual']=row['residual_energy']/total_residual
    isolated=[v for v in records if v.get('isolated_ordinary_gap')]
    low=[v for v in records if v['failure_category']=='target_shape_rejection']
    diagnostic_counts={'isolated_ordinary_rejected_cycles':len(isolated),
        'isolated_categories':dict(collections.Counter(v['failure_category'] for v in isolated)),
        'target_shape_rejections_exclusive':len(low),
        'target_shape_rejections_with_descriptor_probe_at_least_0995':sum(v['bounded_descriptor_phase_probe']['similarity']>=.995 for v in low),
        'target_shape_rejections_with_boundary_translation_probe_at_least_0995':sum(v['boundary_translation_probe']['similarity']>=.995 for v in low),
        'maximum_regenerated_signature_difference':max((v.get('signature_regeneration_max_difference',0) for v in records),default=0),
        'accepted_not_rendered_cycles':sum(v['failure_category']=='accepted_not_rendered' for v in records),
        'unexpected_render_outside_support_samples':sum(not mask[i//channels] and y[i]!=0 for i in range(len(y))),
        'significant_flat_gap_intervals':sum(v['significant'] for v in gaps)}
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['spikes_aggregation_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_json_seconds']=time.perf_counter()-begin
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
    report={'experiment':'4I','baseline':'4H','input_sha256':h['input_sha256'],'rate':rate,'channels':channels,'frames':frames,
            'timings':timings,'peak_process_rss_bytes':peak,'source_sha256':sha(Path(__file__)),
            'category_summary':dict(categories),'diagnostic_counts':diagnostic_counts,'cycles':records,'gaps':gaps,'spikes':spikes,
            'spike_summary':{'narrow_rendered_events':len(spikes),'median_width_frames':statistics.median(v['width_frames'] for v in spikes) if spikes else None,
                             'median_phase':statistics.median(v['phase'] for v in spikes) if spikes else None,
                             'median_edge_offset_frames':statistics.median(v['source_sharp_edge_offset_frames'] for v in spikes if v['source_sharp_edge_offset_frames'] is not None) if spikes else None,
                             'bridge_phase_events':sum(v['in_bridge_phase_zone'] for v in spikes),
                             'energy':sum(v['energy'] for v in spikes)},
            'significance_policy':{'active_2ms_rms_fraction':.04,'gap_minimum_energy_fraction_of_median_cycle':.01,
                                   'gap_minimum_period_fraction':.2,'or_strong_gap_energy_fraction':.1,
                                   'median_reliable_cycle_energy':median_cycle_energy,'spike_threshold_absolute':spike_threshold,
                                   'scope':'Diagnostic prioritization only; not audibility or recognition criteria.'},
            'prior_files_verified_unchanged':len(prior),'no_audio_written':True,'no_algorithm_changed':True,'midi_used':False,
            'limits':['A rising crossing is the detector phase origin; the sharp internal reset is intentionally elsewhere in the cycle.',
                      'Descriptor shifting and boundary translation probes change sampling/interpolation, not just physical phase; improved cosine does not prove the original boundary was wrong.',
                      'All probes are diagnostic; no recognition decision, boundary, family or rendering phase was changed.']}
    with (HERE/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (HERE/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    with (HERE/'gap-trace.csv').open('x',newline='') as f:
        writer=csv.writer(f);writer.writerow(['gap','start_seconds','end_seconds','significant','original_energy','dominant_category','cycle_ids'])
        for row in gaps:writer.writerow([row[k] for k in ['gap','start_seconds','end_seconds','significant','original_energy','dominant_category','cycle_ids']])
    print(json.dumps({'timings':timings,'peak_mib':peak/2**20,'counts':diagnostic_counts,'categories':dict(categories),'spikes':report['spike_summary']},indent=2))

if __name__=='__main__':run()
