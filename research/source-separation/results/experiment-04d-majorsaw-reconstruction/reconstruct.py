"""4D research: family-shape synthesis. No separation or raw-PCM synthesis fallback."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import struct
import sys
import time

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SOURCE=ROOT/'audio/Majorsaw.aif'
DISCOVERY=ROOT/'results/experiment-04c-majorsaw-shapes'
EXPECTED='5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134'


def energy(values):return sum(v*v for v in values)

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def base_value_slope(shape,channel,phase,scale,offset,duration):
    """Periodic linear interpolation; derivative is per original sample frame."""
    position=(phase%1)*64;index=math.floor(position);fraction=position-index
    a=shape[channel*64+index];b=shape[channel*64+(index+1)%64]
    return (a+(b-a)*fraction)*scale+offset,(b-a)*64*scale/duration


def hermite(value0,slope0,value1,slope1,fraction,length):
    u=fraction
    return ((2*u**3-3*u**2+1)*value0+(u**3-2*u**2+u)*length*slope0+
            (-2*u**3+3*u**2)*value1+(u**3-u**2)*length*slope1)


def synthesize(families,occurrences,frames,channels,rate):
    """Receives discovered shapes/metadata only. No original waveform argument."""
    prototypes={f['family']:f['signature_shape_64_per_channel'] for f in families if f['status']=='recurring'}
    for shape in prototypes.values():
        if len(shape)!=channels*64 or not all(math.isfinite(v) for v in shape):raise ValueError('Invalid family signature')
    accepted=[];excluded=[]
    for row in occurrences:
        if row['status']!='assigned' or not row['reliable'] or row['family'] not in prototypes:
            excluded.append({'cycle':row['cycle'],'status':row['status']});continue
        start,end=row['start_frame'],row['end_frame'];scale=row['signature_rms_scale'];offsets=row['channel_offsets']
        if not all(math.isfinite(v) for v in [start,end,scale]+offsets) or not (0<=start<end<=frames) or scale<=0 or len(offsets)!=channels:
            raise ValueError('Invalid occurrence metadata')
        accepted.append(dict(row))
    accepted.sort(key=lambda row:row['start_frame'])
    for left,right in zip(accepted,accepted[1:]):
        if left['end_frame']>right['start_frame']+1e-8:raise ValueError('Overlapping discovered cycles')
    result=[0.]*(frames*channels);mask=bytearray(frames);bridged=bytearray(frames);runs=0
    def adjacent(left,right):return abs(left['end_frame']-right['start_frame'])<1e-8
    # Anchors depend on neighboring model predictions only, never original PCM.
    for i,row in enumerate(accepted):
        start,end=row['start_frame'],row['end_frame'];duration=end-start
        shape=prototypes[row['family']];scale=row['signature_rms_scale'];offsets=row['channel_offsets']
        left=accepted[i-1] if i and adjacent(accepted[i-1],row) else None
        right=accepted[i+1] if i+1<len(accepted) and adjacent(row,accepted[i+1]) else None
        if left is None:runs+=1
        edge=min(rate*.0005,duration*.15)
        anchors=[]
        for channel in range(channels):
            def endpoint(other,at_end):
                values=prototypes[other['family']];d=other['end_frame']-other['start_frame']
                # Approach phase 1 from below to get the incoming end slope.
                return base_value_slope(values,channel,1-1e-12 if at_end else 0,
                                        other['signature_rms_scale'],other['channel_offsets'][channel],d)
            own_start=endpoint(row,False);own_end=endpoint(row,True)
            if left:
                value,slope=endpoint(left,True);begin=((value+own_start[0])/2,(slope+own_start[1])/2)
            else:begin=(0.,0.)
            if right:
                value,slope=endpoint(right,False);finish=((value+own_end[0])/2,(slope+own_end[1])/2)
            else:finish=(0.,0.)
            anchors.append((begin,finish))
        for frame in range(math.ceil(start),min(frames,math.ceil(end))):
            local=frame-start;mask[frame]=1
            for channel in range(channels):
                phase=local/duration
                value,_=base_value_slope(shape,channel,phase,scale,offsets[channel],duration)
                if local<edge:
                    v,m=base_value_slope(shape,channel,edge/duration,scale,offsets[channel],duration)
                    anchor=anchors[channel][0];value=hermite(anchor[0],anchor[1],v,m,local/edge,edge)
                    bridged[frame]=1
                elif duration-local<edge:
                    v,m=base_value_slope(shape,channel,1-edge/duration,scale,offsets[channel],duration)
                    anchor=anchors[channel][1];value=hermite(v,m,anchor[0],anchor[1],(local-(duration-edge))/edge,edge)
                    bridged[frame]=1
                result[frame*channels+channel]=value
    return result,mask,bridged,{'accepted_cycles':len(accepted),'excluded_cycles':excluded,'accepted_runs':runs,
                              'accepted_families':sorted({row['family'] for row in accepted}),
                              'modeled_cycle_time_seconds':sum(row['end_frame']-row['start_frame'] for row in accepted)/rate,
                              'join_model':'Cubic Hermite on min(0.5 ms, 15% cycle duration) per edge. Shared model value/slope at adjacent accepted joins; zero value/slope at gaps.'}


def write_float(path,rate,channels,values):
    if len(values)%channels or not all(math.isfinite(v) for v in values):raise ValueError('Invalid output')
    payload=struct.pack('<'+'f'*len(values),*values)
    fmt=struct.pack('<HHIIHH',3,channels,rate,rate*channels*4,channels*4,32)
    body=b'WAVEfmt '+struct.pack('<I',len(fmt))+fmt+b'fact'+struct.pack('<II',4,len(values)//channels)+b'data'+struct.pack('<I',len(payload))+payload
    with Path(path).open('xb') as f:f.write(b'RIFF'+struct.pack('<I',len(body))+body)


def read_export(path):
    raw=Path(path).read_bytes();assert raw[:4]==b'RIFF' and raw[8:12]==b'WAVE'
    pos=12;fmt=None;payload=None
    while pos+8<=len(raw):
        name,size=struct.unpack_from('<4sI',raw,pos);chunk=raw[pos+8:pos+8+size]
        if len(chunk)!=size:raise ValueError('Truncated export')
        if name==b'fmt ':fmt=struct.unpack('<HHIIHH',chunk)
        if name==b'data':payload=chunk
        pos+=8+size+size%2
    if fmt is None or fmt[0]!=3 or fmt[5]!=32 or payload is None:raise ValueError('Expected float32 export')
    return fmt[2],fmt[1],list(struct.unpack('<'+'f'*(len(payload)//4),payload))


def interval_metrics(original,reconstruction,channels,start,end):
    a=max(0,math.floor(start))*channels;b=min(len(original)//channels,math.ceil(end))*channels
    x=original[a:b];y=reconstruction[a:b];error=energy([v-w for v,w in zip(x,y)])
    return {'start_frame':a//channels,'end_frame':b//channels,'input_energy':energy(x),'error_energy':error,
            'error_to_input_energy_ratio':error/max(energy(x),1e-30),
            'maximum_absolute_error':max((abs(v-w) for v,w in zip(x,y)),default=0)}


def run():
    started=time.perf_counter()
    if sha(SOURCE)!=EXPECTED:raise ValueError('Input hash mismatch')
    prior={str(path.resolve()):sha(path) for path in ROOT.rglob('*') if path.is_file() and HERE not in path.parents}
    for name in ['report.json','signature-library.json']:
        if (DISCOVERY/name).stat().st_size>64*1024**2:raise ValueError('Oversized discovery artifact')
    verification=json.loads((DISCOVERY/'verification.json').read_text())
    for name in ['report.json','signature-library.json']:
        if sha(DISCOVERY/name)!=verification['output_sha256'][name]:raise ValueError('4C artifact differs from saved verification')
    discovery=json.loads((DISCOVERY/'report.json').read_text());library=json.loads((DISCOVERY/'signature-library.json').read_text())
    if discovery['input_sha256']!=EXPECTED or library['source_sha256']!=EXPECTED:raise ValueError('Discovery input mismatch')
    spec=importlib.util.spec_from_file_location('independent_decoder',ROOT/'diagnostic_04b/analysis.py');decoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(decoder)
    rate,channels,original=decoder.decode_aifc(SOURCE);frames=len(original)//channels
    if (rate,channels)!=(discovery['sample_rate'],discovery['channels']):raise ValueError('Discovery format mismatch')
    cycles={row['cycle']:row for row in discovery['cycles']};assignments={row['cycle']:row for row in discovery['assignments']};occurrences=[]
    for location in library['occurrences']:
        row=cycles[location['cycle']];assignment=assignments[row['cycle']]
        for key in ['start_frame','end_frame']:
            if location[key]!=row[key]:raise ValueError('Inconsistent occurrence timing')
        if location['status']!=assignment['status'] or location['family']!=assignment['family']:raise ValueError('Inconsistent occurrence assignment')
        occurrences.append({**row,'status':location['status'],'family':location['family']})
    timings={'load_verify_decode_seconds':time.perf_counter()-started};t=time.perf_counter()
    reconstructed,mask,bridged,model=synthesize(library['families'],occurrences,frames,channels,rate)
    timings['shape_synthesis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    residual=[v-w for v,w in zip(original,reconstructed)]
    for name,values in [('reconstructed.wav',reconstructed),('residual.wav',residual),('original_reference.wav',original)]:
        write_float(HERE/name,rate,channels,values)
    timings['residual_and_wav_export_seconds']=time.perf_counter()-t;t=time.perf_counter()
    exports={name:read_export(HERE/name) for name in ['reconstructed.wav','residual.wav','original_reference.wav']}
    for r,c,v in exports.values():
        if (r,c,len(v))!=(rate,channels,len(original)):raise ValueError('Export format mismatch')
    if exports['original_reference.wav'][2]!=original:raise ValueError('Reference conversion changed decoded values')
    y=exports['reconstructed.wav'][2];res=exports['residual.wav'][2]
    error=[v-w for v,w in zip(original,y)];input_energy=energy(original)
    coverage=sum(mask);covered_error=energy([error[i] for i in range(len(error)) if mask[i//channels]])
    covered_input=energy([original[i] for i in range(len(original)) if mask[i//channels]])
    boundaries=sorted({round(region[key]*rate) for region in discovery['regions'] for key in ['start_seconds','end_seconds']})
    transitions=[interval_metrics(original,y,channels,b-rate*.02,b+rate*.02) for b in boundaries]
    region_metrics=[{'region':region['region'],**interval_metrics(original,y,channels,region['start_seconds']*rate,region['end_seconds']*rate)} for region in discovery['regions']]
    step_stats={}
    for name,v in [('original',original),('reconstructed',y),('residual',res)]:
        steps=[abs(v[i]-v[i-channels]) for i in range(channels,len(v))]
        step_stats[name]={'maximum_adjacent_sample_step':max(steps,default=0),'rms_adjacent_sample_step':math.sqrt(energy(steps)/max(len(steps),1))}
    for path,digest in prior.items():
        if sha(Path(path))!=digest:raise ValueError('Earlier research file changed')
    if sha(SOURCE)!=EXPECTED:raise ValueError('Input changed')
    timings['evaluation_export_qa_and_preservation_seconds']=time.perf_counter()-t
    timings['total_before_report_seconds']=time.perf_counter()-started
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
    report={'experiment':'4D','input_path':str(SOURCE.resolve()),'input_sha256':EXPECTED,
            'discovery_artifacts':{name:sha(DISCOVERY/name) for name in ['report.json','signature-library.json']},
            'source_sha256':sha(Path(__file__)),'sample_rate':rate,'channels':channels,'frames':frames,
            'timings':timings,'peak_process_rss_bytes':peak,'memory_scope':'OS high-water process RSS, including decoded discovery JSON, PCM, masks, synthesis and export QA; excludes plots/tests.',
            'model':model,'normalized':False,'clipped':False,'source_pcm_used_by_synthesizer':False,
            'metrics':{'input_energy':input_energy,'reconstructed_energy_ratio':energy(y)/input_energy,
                       'residual_energy_ratio':energy(res)/input_energy,'reconstruction_error_energy_ratio':energy(error)/input_energy,
                       'reconstruction_rmse':math.sqrt(energy(error)/len(error)),
                       'maximum_absolute_reconstruction_error':max(map(abs,error)),
                       'covered_frames':coverage,'coverage_fraction':coverage/frames,'modeled_seconds':coverage/rate,
                       'covered_input_energy_fraction':covered_input/input_energy,
                       'covered_error_to_covered_input_energy_ratio':covered_error/max(covered_input,1e-30),
                       'hermite_bridge_frames':sum(bridged),'hermite_bridge_fraction':sum(bridged)/frames,
                       'float32_sum_maximum_error':max(abs(v-(w+z)) for v,w,z in zip(original,y,res)),
                       'reference_export_exact_decoded_sample_match':True},
            'region_reconstruction_errors':region_metrics,'transition_and_release_windows_20ms':transitions,
            'adjacent_sample_step_diagnostics':step_stats,'prior_research_files_verified_unchanged':len(prior),
            'outputs':[{'file':name,'sha256':sha(HERE/name),'peak':max(map(abs,v[2]))} for name,v in exports.items()],
            'listening_performed':False,'limits':['Residual conservation is bookkeeping, not reconstruction quality.',
                      'No anti-alias resynthesis filter; linear 64-position interpolation is lossy.',
                      'Ambiguous/provisional/unreliable cycles remain unexplained; no PCM fallback.',
                      'Hermite bridges ensure model boundary continuity, not perceptual click-free playback.',
                      'No overlapping-source separation or identity count is inferred.']}
    with (HERE/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (HERE/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    with (HERE/'occurrence-decisions.json').open('x') as f:json.dump([{'cycle':v['cycle'],'family':v['family'],'status':v['status'],'reliable':v['reliable'],'start_frame':v['start_frame'],'end_frame':v['end_frame']} for v in occurrences],f,indent=2);f.write('\n')
    print(json.dumps({'timings':timings,'peak_memory_mib':peak/2**20,'metrics':report['metrics']},indent=2))

if __name__=='__main__':run()
