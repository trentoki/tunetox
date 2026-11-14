"""4G frozen-artifact diagnostics. No recognition, grouping, or rendering decisions changed."""
import collections
import cmath
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
C=ROOT/'results/experiment-04c-majorsaw-shapes';D=ROOT/'results/experiment-04d-majorsaw-reconstruction';F=ROOT/'results/experiment-04f-independent'

def load(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
io=load('frozen_audio_reader',D/'reconstruct.py')
p=load('independent_diagnostic_math',ROOT/'diagnostic_04b/analysis.py')

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def stats(values):
    if not values:return None
    x=sorted(values);return {'count':len(x),'min':x[0],'median':statistics.median(x),'q95':x[round(.95*(len(x)-1))],'max':x[-1]}

def runs(flags):
    result=[];start=None
    for i,value in enumerate(flags):
        if value and start is None:start=i
        if not value and start is not None:result.append((start,i));start=None
    if start is not None:result.append((start,len(flags)))
    return result

def mask_from_cycles(cycles,accepted,frames):
    mask=bytearray(frames)
    for i in accepted:
        row=cycles[i];a=max(0,math.ceil(row['start_frame']));b=min(frames,math.ceil(row['end_frame']))
        mask[a:b]=bytes([1])*(b-a)
    return mask

def aligned_fit(x,y,channels,max_lag=3):
    """Evaluation-only shift/gain probes; never applied to any saved audio."""
    norm=io.energy(x);base=io.energy([a-b for a,b in zip(x,y)])
    yy=io.energy(y);dot=sum(a*b for a,b in zip(x,y));gain=max(0.,dot/yy) if yy else 0.
    scaled=io.energy([a-gain*b for a,b in zip(x,y)])
    best={'lag_frames':0,'gain':gain,'error_ratio':scaled/max(norm,1e-30),'relative_error_reduction':(base-scaled)/max(base,1e-30)}
    for lag in range(-max_lag,max_lag+1):
        if not lag:continue
        a=max(0,lag)*channels;b=max(0,-lag)*channels;count=min(len(x)-a,len(y)-b)
        if count<=channels*8:continue
        xx=x[a:a+count];yy=y[b:b+count];norm2=io.energy(xx);dot=sum(v*w for v,w in zip(xx,yy));power=io.energy(yy)
        g=max(0.,dot/power) if power else 0.;err=io.energy([v-g*w for v,w in zip(xx,yy)])
        original_same_support=io.energy([v-w for v,w in zip(x[a:a+count],y[a:a+count])])
        reduction=(original_same_support-err)/max(original_same_support,1e-30)
        if err/max(norm2,1e-30)<best['error_ratio']:best={'lag_frames':lag,'gain':g,'error_ratio':err/max(norm2,1e-30),'relative_error_reduction':reduction}
    return {'unshifted_gain':gain,'gain_only_error_reduction':(base-scaled)/max(base,1e-30),'best_shift_gain':best}

def classify_cycle(accepted,original_status,input_energy,error_ratio,fit):
    if not accepted:
        return {'ambiguous':'ambiguous assignment / frozen eligibility rejection',
                'unreliable':'uncertain cycle detection','provisional':'unconfirmed shape family'}.get(original_status,'unmodeled boundary/context')
    if error_ratio<=.25:return 'accepted-cycle detail mismatch (not substantially inaccurate by energy)'
    if fit['gain_only_error_reduction']>=.5 and abs(fit['unshifted_gain']-1)>.1:return 'amplitude-scale mismatch evidence'
    if fit['best_shift_gain']['lag_frames'] and fit['best_shift_gain']['relative_error_reduction']>=.5:return 'phase/alignment mismatch evidence'
    return 'substantially inaccurate shape/articulation model'

def energy_parts(original,residual,mask,channels):
    return {'omitted_original':sum(residual[i]**2 for i in range(len(residual)) if not mask[i//channels]),
            'accepted_model_error':sum(residual[i]**2 for i in range(len(residual)) if mask[i//channels])}

def phase_class(row,region,cycles,rate,level=None):
    """Audio-envelope evidence; labels are approximate, not MIDI note phases."""
    t=(row['start_frame']+row['end_frame'])/2/rate
    if region is None:return 'outside stable pitch region'
    near_start=abs(t-region['start_seconds'])<.025;near_end=abs(t-region['end_seconds'])<.025
    if level is None:
        local=[c['absolute_rms'] for c in cycles if c['reliable'] and region['start_seconds']<=(c['start_frame']+c['end_frame'])/2/rate<=region['end_seconds']]
        level=sorted(local)[round(.9*(len(local)-1))] if local else max(row['absolute_rms'],1e-30)
    if row['absolute_rms']<.5*level and (near_end or t>region['start_seconds']+.5*(region['end_seconds']-region['start_seconds'])):return 'release / low-level decay'
    if near_start and region['start_seconds']<.04:return 'recording-start / attack (censored)'
    if near_start:return 'attack or pitch transition (boundary uncertain)'
    if near_end:return 'pitch-region edge / transition'
    if row['absolute_rms']>=.8*level:return 'sustain-like stable level'
    return 'envelope-varying / uncertain phase'


def run():
    begin=time.perf_counter();prior={str(path.resolve()):sha(path) for path in ROOT.rglob('*') if path.is_file() and HERE not in path.parents}
    discovery=json.loads((C/'report.json').read_text());fverify=json.loads((F/'verification.json').read_text());b=json.loads((F/'b-related-shapes/report.json').read_text())
    for name,expected in fverify['files_sha256'].items():
        if name=='verification.json':continue  # Historical manifest hashed its own empty file; preserve and disclose.
        # Preserve frozen 4F source and exports, including its nested variant artifacts.
        if sha(F/name)!=expected:raise ValueError('4F artifact hash mismatch: '+name)
    cycles={v['cycle']:v for v in discovery['cycles']};assign={v['cycle']:v for v in discovery['assignments']}
    decisions={v['cycle']:v for v in json.loads((F/'b-related-shapes/occurrence-decisions.json').read_text())}
    regions=discovery['regions'];rate,channels,original=io.read_export(D/'original_reference.wav');frames=len(original)//channels
    if sha(Path(discovery['input_path']))!=discovery['input_sha256']:raise ValueError('Original input hash mismatch')
    cycle_owner=[0]*frames
    for row in cycles.values():
        a=max(0,math.ceil(row['start_frame']));z=min(frames,math.ceil(row['end_frame']));cycle_owner[a:z]=[row['cycle']]*(z-a)
    base_ids={v['cycle'] for v in assign.values() if v['status']=='assigned'}
    variant_files={'4D':D,'A-cubic64':F/'a-cubic64','A-linear256':F/'a-linear256','A-harmonic':F/'a-harmonic','4F-B':F/'b-related-shapes'}
    data={};masks={};variant_reports={}
    for name,path in variant_files.items():
        _,_,y=io.read_export(path/'reconstructed.wav');_,_,res=io.read_export(path/'residual.wav')
        report=json.loads((path/'report.json').read_text());ids=set(report['accepted_cycle_ids']) if name!='4D' else base_ids
        mask=mask_from_cycles(cycles,ids,frames);masks[name]=mask;data[name]=(y,res);variant_reports[name]=report
        assert all(y[i]==0 for i in range(len(y)) if not mask[i//channels])
    block=max(1,round(rate*.002));block_rms=[math.sqrt(io.energy(original[i*channels:min(i+block,frames)*channels])/((min(i+block,frames)-i)*channels)) for i in range(0,frames,block)]
    active_threshold=max(block_rms)*.04;active=bytearray(frames)
    for i,rms in enumerate(block_rms):
        if rms>active_threshold:
            a=i*block;z=min(frames,a+block);active[a:z]=bytes([1])*(z-a)
    timings={'load_verify_decode_seconds':time.perf_counter()-begin};t=time.perf_counter()
    y,res=data['4F-B'];mask=masks['4F-B'];records=[]
    def region_for(row):
        center=(row['start_seconds']+row['end_seconds'])/2
        matches=[r for r in regions if r['start_seconds']<=center<=r['end_seconds']]
        return min(matches,key=lambda r:abs(center-(r['start_seconds']+r['end_seconds'])/2)) if matches else None
    region_levels={}
    for region in regions:
        local=[v['absolute_rms'] for v in cycles.values() if v['reliable'] and region['start_seconds']<=(v['start_frame']+v['end_frame'])/2/rate<=region['end_seconds']]
        region_levels[region['region']]=sorted(local)[round(.9*(len(local)-1))] if local else 1e-30
    b_accepted=set(b['accepted_cycle_ids']);b_added=set(b['added_cycle_ids'])
    for row in cycles.values():
        a=math.ceil(row['start_frame']);z=math.ceil(row['end_frame']);x=original[a*channels:z*channels];yp=y[a*channels:z*channels];rp=res[a*channels:z*channels]
        power=io.energy(x);error=io.energy(rp);accepted=row['cycle'] in b_accepted
        fit=aligned_fit(x,yp,channels) if accepted and power>1e-12 else None
        region=region_for(row);tag=phase_class(row,region,list(cycles.values()),rate,region_levels[region['region']] if region else None)
        records.append({'cycle':row['cycle'],'start_frame':row['start_frame'],'end_frame':row['end_frame'],
                        'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],'original_status':assign[row['cycle']]['status'],
                        'accepted_by_b':accepted,'recovered_by_b':row['cycle'] in b_added,
                        'original_family':assign[row['cycle']]['family'],'render_family':decisions[row['cycle']]['render_family'] if row['cycle'] in decisions and decisions[row['cycle']]['render_supported'] else assign[row['cycle']]['family'],
                        'region':region['region'] if region else None,'audio_phase_evidence':tag,
                        'original_energy':power,'residual_energy':error,'error_ratio':error/max(power,1e-30),
                        'significant':power/max((z-a)*channels,1)>active_threshold**2,
                        'cause':classify_cycle(accepted,assign[row['cycle']]['status'],power,error/max(power,1e-30),fit) if fit or not accepted else 'low-energy accepted cycle',
                        'alignment_gain_probe':fit,'rejection_reasons':row['rejection_reasons'],
                        'b_rejection_reasons':decisions[row['cycle']]['reasons'] if row['cycle'] in decisions else [],
                        'period_error_fraction':row['period_error_fraction'],'shape_best_score':max((v['similarity'] for v in assign[row['cycle']].get('candidates',[])),default=None)})
    # Contiguous active original support with no modeled cycle; zero-crossing value alone is not a gap.
    gaps=[]
    for index,(a,z) in enumerate(runs([bool(active[i] and not mask[i]) for i in range(frames)])):
        owners=collections.Counter(cycle_owner[a:z]);cause_energy=collections.Counter();ids=sorted(i for i in owners if i)
        for frame in range(a,z):
            owner=cycle_owner[frame];status=assign[owner]['status'] if owner else 'no candidate'
            cause_energy[status]+=sum(original[frame*channels+c]**2 for c in range(channels))
        x=original[a*channels:z*channels]
        gaps.append({'interruption':index+1,'start_seconds':a/rate,'end_seconds':z/rate,'duration_ms':(z-a)/rate*1000,
                     'original_energy':io.energy(x),'cycle_ids':ids,'status_energy':dict(cause_energy),
                     'dominant_cause':max(cause_energy,key=cause_energy.get) if cause_energy else 'no candidate',
                     'residual_equals_original':all(res[i]==original[i] for i in range(a*channels,z*channels))})
    # Spike detection uses a fixed original-referenced threshold across variants.
    peak=max(map(abs,original));spike_threshold=.2*peak;spikes={};parts={}
    for name,(yy,rr) in data.items():
        mm=masks[name];events=[];flags=[max(abs(rr[i*channels+c]) for c in range(channels))>=spike_threshold for i in range(frames)]
        for a,z in runs(flags):
            peak_frame=max(range(a,z),key=lambda i:max(abs(rr[i*channels+c]) for c in range(channels)))
            owner=cycle_owner[peak_frame];row=cycles.get(owner);phase=(peak_frame-row['start_frame'])/(row['end_frame']-row['start_frame']) if row else None
            if row:
                left=max(1,math.ceil(row['start_frame']));right=min(frames,math.ceil(row['end_frame']))
                edge=max(range(left,right),key=lambda i:max(abs(original[i*channels+c]-original[(i-1)*channels+c]) for c in range(channels))) if right>left else left
                distance=abs(edge-peak_frame);period=row['end_frame']-row['start_frame']
            else:distance=None;period=None
            modeled=sum(mm[a:z])/(z-a);narrow=period is not None and (z-a)<=.15*period
            events.append({'start_seconds':a/rate,'end_seconds':z/rate,'peak_seconds':peak_frame/rate,'cycle':owner or None,
                           'width_frames':z-a,'modeled_fraction':modeled,'narrow_relative_to_period':narrow,'phase':phase,
                           'distance_to_original_sharpest_edge_frames':distance,
                           'near_original_sharp_edge':distance is not None and distance<=max(2,.05*period),
                           'peak_in_bridge_zone':phase is not None and (phase<.15 or phase>.85),
                           'residual_energy':io.energy(rr[a*channels:z*channels])})
        selected=[e for e in events if e['narrow_relative_to_period'] and e['modeled_fraction']==1]
        concentration=abs(sum(cmath.exp(2j*math.pi*e['phase']) for e in selected))/len(selected) if selected else None
        spikes[name]={'events':events,'threshold_absolute':spike_threshold,'narrow_fully_modeled_count':len(selected),
                      'near_sharp_edge_fraction':sum(e['near_original_sharp_edge'] for e in selected)/max(len(selected),1),
                      'bridge_zone_fraction':sum(e['peak_in_bridge_zone'] for e in selected)/max(len(selected),1),
                      'phase_concentration':concentration,'phase_distribution':stats([e['phase'] for e in selected])}
        parts[name]=energy_parts(original,rr,mm,channels)
    timings['cycle_interruption_and_spike_seconds']=time.perf_counter()-t;t=time.perf_counter()
    # Audio-energy onsets after at least 20 ms observed quiet, independent of MIDI.
    onsets=[];quiet=math.ceil(.02*rate/block);last_active=-quiet-1
    for i,rms in enumerate(block_rms):
        if rms<=active_threshold:continue
        if i-last_active>quiet:
            a=i*block;windows=[]
            for ms in [5,10,20,40]:
                z=min(frames,a+round(ms/1000*rate));power=io.energy(original[a*channels:z*channels]);err=io.energy(res[a*channels:z*channels]);omitted=sum(res[j]**2 for j in range(a*channels,z*channels) if not mask[j//channels])
                windows.append({'milliseconds':ms,'error_ratio':err/max(power,1e-30),'omitted_fraction_of_error':omitted/max(err,1e-30),'coverage':sum(mask[a:z])/max(z-a,1)})
            onsets.append({'onset_seconds':a/rate,'recording_start_censored':i==0,'windows':windows})
        last_active=i
    # Family summaries retain separate exemplar/occurrence counts and uncertainty.
    by_cycle={v['cycle']:v for v in records};families=[]
    for family in discovery['families']:
        rows=[cycles[i] for i in family['occurrences']];rec=[by_cycle[v['cycle']] for v in rows];prototype=cycles[family['prototype_cycle']]
        families.append({'family':family['family'],'status':family['status'],'exemplar_count':1,'historical_unambiguous_cycles':len(rows),
                         'b_rendered_cycles':sum(v['render_family']==family['family'] and v['accepted_by_b'] for v in records),
                         'prototype_cycle':prototype['cycle'],'prototype_time_seconds':prototype['start_seconds'],
                         'prototype_audio_phase':by_cycle[prototype['cycle']]['audio_phase_evidence'],
                         'prototype_rms':prototype['absolute_rms'],'prototype_period_error':prototype['period_error_fraction'],
                         'prototype_shape':prototype['shape'],'pitch_distribution_hz':stats([v['frequency_hz'] for v in rows]),
                         'audio_regions':dict(collections.Counter(str(v['region']) for v in rec)),
                         'audio_phase_counts':dict(collections.Counter(v['audio_phase_evidence'] for v in rec)),
                         'period_error_distribution':stats([v['period_error_fraction'] for v in rows]),
                         'original_occurrence_times_seconds':[v['start_seconds'] for v in rows]})
    family_pairs=[]
    for i,left in enumerate(discovery['families']):
        for right in discovery['families'][i+1:]:
            x=cycles[left['prototype_cycle']];y0=cycles[right['prototype_cycle']];xshape=x['shape'];yshape=y0['shape'];scores=[]
            for shift in range(64):
                rotated=[yshape[c*64+(j+shift)%64] for c in range(channels) for j in range(64)]
                scores.append(p.cosine(xshape,rotated))
            family_pairs.append({'left':left['family'],'right':right['family'],'geometry':p.cosine(xshape,yshape),
                                 'harmonics':p.cosine(x['harmonics'],y0['harmonics']),
                                 'best_cyclic_similarity':max(scores),'best_shift_positions':scores.index(max(scores)),
                                 'phase_probe_scope':'Diagnostic only; no family or phase assignments changed.'})
    # Remaining/recovered comparison and nearest-reliable-neighbor evidence.
    ordered=list(cycles.values());previous={};following={};last=None
    for row in ordered:
        previous[row['cycle']]=last
        if row['reliable']:last=row
    last=None
    for row in reversed(ordered):
        following[row['cycle']]=last
        if row['reliable']:last=row
    groups={};neighbor_cases=[]
    for label,recovered in [('recovered_522',True),('remaining_194',False)]:
        ids=[i for i,v in decisions.items() if v['render_supported']==recovered];rows=[cycles[i] for i in ids]
        groups[label]={'count':len(ids),'source_energy':sum(by_cycle[i]['original_energy'] for i in ids),
                       'start_times_seconds':[v['start_seconds'] for v in rows],
                       'shape_best_score':stats([by_cycle[i]['shape_best_score'] for i in ids]),
                       'period_error':stats([v['period_error_fraction'] for v in rows]),
                       'periodicity':stats([v['periodicity'] for v in rows]),
                       'absolute_rms':stats([v['absolute_rms'] for v in rows]),
                       'regions':dict(collections.Counter(str(by_cycle[i]['region']) for i in ids)),
                       'audio_phases':dict(collections.Counter(by_cycle[i]['audio_phase_evidence'] for i in ids))}
    for i,decision in decisions.items():
        if set(decision['reasons'])!={'unreliable immediate neighbor'}:continue
        row=cycles[i];duration=row['end_frame']-row['start_frame'];bad=[];evidence=[]
        for offset in [-1,1]:
            near=cycles.get(i+offset)
            if near and not near['reliable']:bad.append({'cycle':near['cycle'],'duration_frames':near['end_frame']-near['start_frame'],'reasons':near['rejection_reasons']})
            reliable=previous[i] if offset<0 else following[i]
            if reliable:
                gap=row['start_frame']-reliable['end_frame'] if offset<0 else reliable['start_frame']-row['end_frame']
                evidence.append({'side':offset,'nearest_reliable_cycle':reliable['cycle'],'gap_periods':gap/duration,
                                 'geometry':p.cosine(row['shape'],reliable['shape']),
                                 'relative_period_change':abs((reliable['end_frame']-reliable['start_frame'])/duration-1)})
        neighbor_cases.append({'cycle':i,'time_seconds':row['start_seconds'],'source_energy':by_cycle[i]['original_energy'],
                               'invalid_immediate_neighbors':bad,'nearest_reliable_evidence':evidence,
                               'scope':'Inspection only. No skipped interval or rejected target was reconstructed.'})
    region_summary=[]
    for region in regions:
        a=math.ceil(region['start_seconds']*rate);z=min(frames,math.floor(region['end_seconds']*rate));rows=[v for v in records if v['region']==region['region']]
        metrics={}
        for name,(yy,rr) in data.items():
            xx=original[a*channels:z*channels];rp=rr[a*channels:z*channels];mm=masks[name]
            metrics[name]={'coverage':sum(mm[a:z])/max(z-a,1),'error_ratio':io.energy(rp)/max(io.energy(xx),1e-30)}
        region_summary.append({'region':region['region'],'start_seconds':a/rate,'end_seconds':z/rate,'f0_audio_hz':region['f0_median_hz'],
                               'metrics':metrics,'b_omitted_causes':dict(collections.Counter(v['cause'] for v in rows if not v['accepted_by_b'])),
                               'substantially_inaccurate_accepted_cycles':sum(v['accepted_by_b'] and v['error_ratio']>.25 and v['significant'] for v in rows)})
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['family_attack_and_neighbor_seconds']=time.perf_counter()-t;timings['total_before_report_seconds']=time.perf_counter()-begin
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;memory=rss if sys.platform=='darwin' else rss*1024
    report={'experiment':'4G','input_sha256':discovery['input_sha256'],'sample_rate':rate,'channels':channels,'frames':frames,
            'source_sha256':sha(Path(__file__)),'timings':timings,'peak_process_rss_bytes':memory,
            'policy':{'active_2ms_rms_fraction':.04,'residual_event_absolute_threshold':spike_threshold,'narrow_event_max_period_fraction':.15,
                      'substantially_inaccurate_cycle_error_ratio':.25,'phase_amplitude_probe_max_lag_frames':3,
                      'scope':'Diagnostic labels only; no discovery/grouping/synthesis policy was changed.'},
            'cycle_records':records,'interruptions':gaps,'residual_spikes':spikes,'residual_energy_parts':parts,
            'audio_energy_onsets':onsets,'families':families,'family_pairs':family_pairs,'threshold_sensitivity_from_4c':discovery['sensitivity'],
            'ambiguous_comparison':groups,'neighbor_only_cases':neighbor_cases,'regions':region_summary,
            'remaining_reason_combinations':[{'reasons':list(k),'count':v} for k,v in collections.Counter(tuple(sorted(set(v['reasons']))) for v in decisions.values() if not v['render_supported']).items()],
            'unmodeled_placement_check':'All saved reconstructions exactly zero outside accepted-cycle frame supports; no out-of-support placement found.',
            'verification_notes':['4F verification.json contains an invalid self-hash of its empty file at creation. That self-entry is excluded; every other recorded source/audio/output hash matched. The old manifest is not modified.'],
            'prior_files_verified_unchanged':len(prior),'new_audio_exported':False,'midi_used':False,'combined_a_b_rendered':False,
            'limits':['Cycle/region boundaries and phase labels are approximate audio-derived evidence, not physical-source or MIDI truth.',
                      'Spike thresholds and 25%-error criterion are diagnostic choices, not audibility measurements.',
                      'No new reconstruction or family reassignment was computed. Local shift/gain and cyclic-shape comparisons are evaluation probes only.']}
    with (HERE/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (HERE/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    with (HERE/'interruptions.csv').open('x',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['interruption','start_seconds','end_seconds','duration_ms','original_energy','dominant_cause','cycle_ids']);writer.writeheader()
        for row in gaps:writer.writerow({k:row[k] for k in writer.fieldnames})
    print(json.dumps({'timings':timings,'peak_mib':memory/2**20,'gaps':len(gaps),'neighbor_only_cases':len(neighbor_cases),
                      'spikes':{k:{key:v[key] for key in ['narrow_fully_modeled_count','near_sharp_edge_fraction','bridge_zone_fraction','phase_concentration']} for k,v in spikes.items()}},indent=2))

if __name__=='__main__':run()
