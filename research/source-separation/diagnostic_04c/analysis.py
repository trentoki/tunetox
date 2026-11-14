"""Experiment 4C: observed cycle geometry, not source separation or identity proof."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import statistics
import sys
import time

# Share only 4B's independent decoding/FFT/periodicity primitives, never 1C.
PRIMITIVES = Path(__file__).resolve().parents[1]/'diagnostic_04b/analysis.py'
spec=importlib.util.spec_from_file_location('diagnostic_primitives',PRIMITIVES)
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

POINTS=64
POLICY={'minimum_periodicity':.8,'maximum_period_error_fraction':.15,
        'neighbor_shape_min':.90,'family_shape_min':.985,'ambiguous_gap':.01,
        'minimum_family_occurrences':3,'active_rms_fraction':.04,
        'f0_range_hz':[60,2000],'signature_positions':POINTS}


def quantiles(values):
    if not values:return None
    x=sorted(values)
    def at(q):return x[round((len(x)-1)*q)]
    return {'min':x[0],'q05':at(.05),'median':statistics.median(x),'q95':at(.95),'max':x[-1]}


def cosine(x,y): return p.cosine(x,y)


def signature(channels,start,end,points=POINTS):
    """One observed cycle; preserve joint stereo ratios, offsets and polarity."""
    vectors=[[p.interpolate(ch,start+(end-start)*i/points) for i in range(points)] for ch in channels]
    means=[sum(v)/points for v in vectors]
    centered=[q-means[c] for c,v in enumerate(vectors) for q in v]
    scale=math.sqrt(p.energy(centered)/max(len(centered),1))
    shape=[q/scale for q in centered] if scale>1e-20 else [0.]*len(centered)
    slopes=[];curvature=[]
    for c in range(len(channels)):
        v=shape[c*points:(c+1)*points]
        slopes.extend(v[(i+1)%points]-v[i] for i in range(points))
        curvature.extend(v[(i+1)%points]-2*v[i]+v[(i-1)%points] for i in range(points))
    # Magnitudes lose phase; keep them as auxiliary evidence, never a replacement.
    harmonics=[0.]*12
    for c in range(len(channels)):
        ft=p.fft(shape[c*points:(c+1)*points])
        harmonics=[a+abs(ft[h+1])**2 for h,a in enumerate(harmonics)]
    return {'shape':shape,'slopes':slopes,'curvature':curvature,
            'harmonics':[math.sqrt(v) for v in harmonics],
            'channel_offsets':means,'signature_rms_scale':scale}


def crossings(values,level):
    """Fractional rising level crossings; no waveform-family assumption."""
    return [i-1+(level-values[i-1])/(values[i]-values[i-1])
            for i in range(1,len(values)) if values[i-1]<=level<values[i]]


def frame_analysis(channels,rate):
    width=2048;hop=round(rate*.01);strongest=max(range(len(channels)),key=lambda c:p.energy(channels[c]))
    frames=[]
    for start in range(0,len(channels[0])-width+1,hop):
        rms=math.sqrt(sum(p.energy(ch[start:start+width]) for ch in channels)/(width*len(channels)))
        frames.append({'frame':start+width//2,'rms':rms})
    cutoff=max((row['rms'] for row in frames),default=0)*POLICY['active_rms_fraction']
    for row in frames:
        start=row['frame']-width//2
        f0,confidence=p.pitch(channels[strongest][start:start+width],rate) if row['rms']>cutoff else (None,0.)
        row.update({'f0':f0,'periodicity':confidence,'active':row['rms']>cutoff})
    return frames,strongest


def extract_cycles(channels,rate,frames,strongest):
    level=sum(channels[strongest])/len(channels[strongest]);edges=crossings(channels[strongest],level)
    hop=round(rate*.01);rows=[];last=None
    for index,(start,end) in enumerate(zip(edges,edges[1:])):
        center=(start+end)/2
        fi=max(0,min(len(frames)-1,round((center-1024)/hop)))
        frame=frames[fi];f0=frame['f0'];duration=end-start
        reasons=[]
        error=abs(duration*f0/rate-1) if f0 else None
        if not frame['active']:reasons.append('below relative activity screen')
        if f0 is None or frame['periodicity']<POLICY['minimum_periodicity']:reasons.append('uncertain local periodicity')
        if error is None or error>POLICY['maximum_period_error_fraction']:reasons.append('crossing spacing disagrees with estimated period')
        if duration<4:reasons.append('insufficient observed samples')
        first=max(0,math.ceil(start));stop=min(len(channels[0]),math.ceil(end))
        raw=[v for ch in channels for v in ch[first:stop]]
        row={'cycle':index+1,'start_frame':start,'end_frame':end,'start_seconds':start/rate,
             'end_seconds':end/rate,'duration_seconds':duration/rate,'frequency_hz':rate/duration,
             'estimated_f0_hz':f0,'period_error_fraction':error,'periodicity':frame['periodicity'],
             'absolute_peak':max(map(abs,raw),default=0),
             'absolute_rms':math.sqrt(p.energy(raw)/max(len(raw),1)),
             'per_channel_peak':[max(map(abs,ch[first:stop]),default=0) for ch in channels],
             'per_channel_rms':[math.sqrt(p.energy(ch[first:stop])/max(stop-first,1)) for ch in channels],
             'rejection_reasons':reasons,'boundary_level':level,
             'phase_origin':'rising reference-channel recording-mean crossing','reference_channel_zero_based':strongest}
        if not reasons:
            row.update(signature(channels,start,end))
            previous_similarity=cosine(row['shape'],last['shape']) if last else None
            row['previous_eligible_cycle_similarity']=previous_similarity
            # A change of shape makes this cycle uncertain; retain signature and evidence.
            if last and start-last['end_frame']<rate*.01 and previous_similarity<POLICY['neighbor_shape_min']:
                row['rejection_reasons'].append('neighbor cycle geometry is unstable')
            last=row
        else:last=None
        row['reliable']=not row['rejection_reasons']
        rows.append(row)
    return rows,level


def shape_scores(left,right):
    return {'geometry':cosine(left['shape'],right['shape']),
            'slope':cosine(left['slopes'],right['slopes']),
            'curvature':cosine(left['curvature'],right['curvature']),
            'harmonic_magnitudes':cosine(left['harmonics'],right['harmonics'])}


def cluster(cycles,threshold=.985):
    """Fixed observed exemplars avoid transitive centroid drift. No forced count."""
    families=[];assignments=[];comparisons=0
    for row in cycles:
        if not row['reliable']:
            assignments.append({'cycle':row['cycle'],'family':None,'status':'unreliable'});continue
        scores=sorted([(cosine(row['shape'],f['prototype']['shape']),i) for i,f in enumerate(families)],reverse=True)
        comparisons+=len(scores)
        if scores and scores[0][0]>=threshold:
            best,index=scores[0];runner=scores[1][0] if len(scores)>1 else None
            if runner is not None and runner>=threshold and best-runner<POLICY['ambiguous_gap']:
                assignments.append({'cycle':row['cycle'],'family':None,'status':'ambiguous',
                                    'candidates':[{'family':families[i]['family'],'similarity':s} for s,i in scores if s>=threshold]});continue
            f=families[index];f['occurrences'].append(row['cycle'])
            assignments.append({'cycle':row['cycle'],'family':f['family'],'status':'assigned',
                                'prototype_scores':shape_scores(row,f['prototype']),
                                'runner_up_similarity':runner})
        else:
            number=len(families)+1
            families.append({'family':number,'prototype':row,'occurrences':[row['cycle']]})
            assignments.append({'cycle':row['cycle'],'family':number,'status':'assigned',
                                'prototype_scores':shape_scores(row,row),'runner_up_similarity':scores[0][0] if scores else None})
    stable={f['family'] for f in families if len(f['occurrences'])>=POLICY['minimum_family_occurrences']}
    for f in families:f['status']='recurring' if f['family'] in stable else 'provisional'
    for row in assignments:
        if row['family'] is not None and row['family'] not in stable:row['status']='provisional'
    return families,assignments,comparisons


def region_amplitudes(channels,rate,frames,cycles,assignments):
    groups=p.regions_from_frames(frames,rate,round(rate*.01));regions=[];pair_envelopes=[]
    step=round(rate*.005)
    for index,g in enumerate(groups):
        # Midpoint boundaries of detected stable-frame supports; not supplied notes.
        start=max(0,g[0]['frame']-round(rate*.005));end=min(len(channels[0]),g[-1]['frame']+round(rate*.005))
        local=[row for row in cycles if start<= (row['start_frame']+row['end_frame'])/2 <end and row['reliable']]
        vals=[v for ch in channels for v in ch[start:end]]
        curve=[math.sqrt(sum(p.energy(ch[k:min(k+step,end)]) for ch in channels)/(min(step,end-k)*len(channels)))
               for k in range(start,end,step)]
        # Time-normalized envelope is saved in addition to absolute amplitude.
        env=[p.interpolate(curve,(len(curve)-1)*i/63) for i in range(64)] if len(curve)>1 else [0.]*64
        rms=[row['absolute_rms'] for row in local];peaks=[row['absolute_peak'] for row in local]
        regions.append({'region':index+1,'start_seconds':start/rate,'end_seconds':end/rate,
                        'f0_median_hz':statistics.median(row['f0'] for row in g),
                        'absolute_peak':max(map(abs,vals),default=0),
                        'absolute_rms':math.sqrt(p.energy(vals)/max(len(vals),1)),
                        'reliable_cycle_count':len(local),'cycle_peak_distribution':quantiles(peaks),
                        'cycle_rms_distribution':quantiles(rms),
                        'cycle_rms_coefficient_of_variation':statistics.pstdev(rms)/statistics.mean(rms) if rms and statistics.mean(rms)>0 else None,
                        'absolute_5ms_rms_curve':curve,'duration_normalized_envelope_64':env,
                        'cycle_ids':[row['cycle'] for row in local]})
    for i,left in enumerate(regions):
        for right in regions[i+1:]:
            pair_envelopes.append({'left':left['region'],'right':right['region'],
                                  'time_normalized_envelope_cosine':cosine(left['duration_normalized_envelope_64'],right['duration_normalized_envelope_64']),
                                  'absolute_peak_ratio':left['absolute_peak']/max(right['absolute_peak'],1e-30),
                                  'absolute_rms_ratio':left['absolute_rms']/max(right['absolute_rms'],1e-30)})
    return regions,pair_envelopes


def run(source,output,expected):
    begin=time.perf_counter();source=Path(source).resolve();output=Path(output).resolve()
    sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
    if sha(source)!=expected:raise ValueError('Input hash mismatch')
    root=Path(__file__).resolve().parents[1]
    prior={str(path.resolve()):sha(path) for path in root.rglob('*') if path.is_file()}
    output.mkdir(parents=True,exist_ok=False)
    rate,count,raw=p.decode_aifc(source);channels=[raw[c::count] for c in range(count)]
    timings={'decode_and_preservation_snapshot_seconds':time.perf_counter()-begin}
    t=time.perf_counter();frames,strongest=frame_analysis(channels,rate);timings['periodicity_seconds']=time.perf_counter()-t
    t=time.perf_counter();cycles,level=extract_cycles(channels,rate,frames,strongest);timings['cycle_extraction_and_signatures_seconds']=time.perf_counter()-t
    t=time.perf_counter();families,assignments,comparisons=cluster(cycles,POLICY['family_shape_min']);timings['family_assignment_seconds']=time.perf_counter()-t
    sensitivity=[]
    for threshold in (.97,.985,.995):
        f,a,n=cluster(cycles,threshold)
        sensitivity.append({'threshold':threshold,'recurring_families':sum(v['status']=='recurring' for v in f),
                            'provisional_families':sum(v['status']=='provisional' for v in f),
                            'assigned_cycles':sum(v['status']=='assigned' for v in a),'ambiguous_cycles':sum(v['status']=='ambiguous' for v in a)})
    timings['clustering_with_sensitivity_seconds']=time.perf_counter()-t
    t=time.perf_counter();regions,envelopes=region_amplitudes(channels,rate,frames,cycles,assignments);timings['amplitude_analysis_seconds']=time.perf_counter()-t
    # One representative observed cycle per region; only 64-position comparisons.
    representatives=[]
    for region in regions:
        valid=[cycles[i-1] for i in region['cycle_ids']]
        if valid:representatives.append((region['region'],valid[len(valid)//2]))
    region_pairs=[]
    for i,(left_id,left) in enumerate(representatives):
        for right_id,right in representatives[i+1:]:
            region_pairs.append({'left_region':left_id,'right_region':right_id,
                                 'frequency_ratio':left['frequency_hz']/right['frequency_hz'],
                                 **shape_scores(left,right)})
    assert sha(source)==expected
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['total_before_report_seconds']=time.perf_counter()-begin
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_bytes=rss if sys.platform=='darwin' else rss*1024
    support=sum((row['end_frame']-row['start_frame']) for row in cycles if row['reliable'])
    assigned={v['cycle'] for v in assignments if v['status']=='assigned'}
    report={'experiment':'4C','input_path':str(source),'input_sha256':expected,'sample_rate':rate,'channels':count,'duration_seconds':len(channels[0])/rate,
            'diagnostic_source_sha256':sha(Path(__file__)),'primitives_source_sha256':sha(PRIMITIVES),
            'policy':POLICY,'timings':timings,'peak_process_rss_bytes':peak_bytes,
            'memory_scope':'OS process high-water RSS, includes decoded PCM, Python runtime, features and preservation hashes; excludes later plotting/tests.',
            'source_writes':False,'audio_reassigned':False,'prior_files_verified_unchanged':len(prior),
            'reference_channel_zero_based':strongest,'crossing_level':level,'frames':frames,'cycles':cycles,
            'families':[{'family':f['family'],'status':f['status'],'prototype_cycle':f['prototype']['cycle'],
                         'signature_shape_64_per_channel':f['prototype']['shape'],'occurrences':f['occurrences']} for f in families],
            'assignments':assignments,'sensitivity':sensitivity,'cycle_to_prototype_comparisons':comparisons,
            'regions':regions,'region_shape_relationships':region_pairs,'amplitude_envelope_relationships':envelopes,
            'summary':{'candidate_cycles':len(cycles),'reliable_cycles':sum(row['reliable'] for row in cycles),
                       'recognized_cycles':len(assigned),'recurring_families':sum(f['status']=='recurring' for f in families),
                       'provisional_families':sum(f['status']=='provisional' for f in families),
                       'ambiguous_cycles':sum(v['status']=='ambiguous' for v in assignments),
                       'reliable_cycle_time_seconds':support/rate,'other_time_seconds':len(channels[0])/rate-support/rate}}
    with (output/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (output/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    print(json.dumps({'summary':report['summary'],'timings':timings,'peak_rss_mib':peak_bytes/2**20},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input');parser.add_argument('--output',required=True);parser.add_argument('--sha256',required=True)
    args=parser.parse_args();run(args.input,args.output,args.sha256)
