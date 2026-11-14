"""Frozen 4D support/join logic, with explicit sampler injection for A-only comparisons.
B passes the exact unchanged 4D linear sampler. No original PCM is received here.
"""
import math
from pathlib import Path
import importlib.util
s=importlib.util.spec_from_file_location('frozen_4d_io',Path(__file__).resolve().parents[1]/'experiment-04d-majorsaw-reconstruction/reconstruct.py')
d=importlib.util.module_from_spec(s);s.loader.exec_module(d)
hermite=d.hermite

def synthesize(families,occurrences,frames,channels,rate,sampler):
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
                return sampler(values,channel,1-1e-12 if at_end else 0,
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
                value,_=sampler(shape,channel,phase,scale,offsets[channel],duration)
                if local<edge:
                    v,m=sampler(shape,channel,edge/duration,scale,offsets[channel],duration)
                    anchor=anchors[channel][0];value=hermite(anchor[0],anchor[1],v,m,local/edge,edge)
                    bridged[frame]=1
                elif duration-local<edge:
                    v,m=sampler(shape,channel,1-edge/duration,scale,offsets[channel],duration)
                    anchor=anchors[channel][1];value=hermite(v,m,anchor[0],anchor[1],(local-(duration-edge))/edge,edge)
                    bridged[frame]=1
                result[frame*channels+channel]=value
    return result,mask,bridged,{'accepted_cycles':len(accepted),'excluded_cycles':excluded,'accepted_runs':runs,
                              'accepted_families':sorted({row['family'] for row in accepted}),
                              'modeled_cycle_time_seconds':sum(row['end_frame']-row['start_frame'] for row in accepted)/rate,
                              'join_model':'Cubic Hermite on min(0.5 ms, 15% cycle duration) per edge. Shared model value/slope at adjacent accepted joins; zero value/slope at gaps.'}

