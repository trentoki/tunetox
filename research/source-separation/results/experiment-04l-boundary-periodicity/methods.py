"""4L boundary context only; frozen 4J-A target gates and 64-point renderer."""
import copy
import importlib.util
import math
from pathlib import Path
import statistics
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
j=load('j_methods_4l',ROOT/'results/experiment-04j-independent/methods.py')
c=load('c_math_4l',ROOT/'diagnostic_04c/analysis.py')
WIDTH=2048

def silence_intervals(values,channels,rate):
    """Same 2-ms relative activity screen used in 4I/4J gap evaluation."""
    block=round(rate*.002);frames=len(values)//channels
    rms=[math.sqrt(j.render.d.energy(values[a*channels:min(a+block,frames)*channels])/((min(a+block,frames)-a)*channels)) for a in range(0,frames,block)]
    cutoff=max(rms)*c.POLICY['active_rms_fraction'];quiet=[];start=None
    for i,v in enumerate(rms+[float('inf')]):
        if v<=cutoff and start is None:start=i*block
        elif v>cutoff and start is not None:
            end=min(i*block,frames)
            if end-start>=WIDTH:quiet.append((start,end))
            start=None
    return quiet

def boundaries(discovery,quiet):
    """Bracket changes with confident saved f0s, refine by observed period lengths.

    Three-period candidate margins, 2% change, and .9 confidence reuse existing context
    and period policies. No fixed times, pitches, or note count are supplied.
    """
    rate=discovery['sample_rate'];cycles=discovery['cycles'];result=[];previous=None
    for frame in discovery['frames']:
        if not(frame['active'] and frame['f0'] and frame['periodicity']>=j.h.f.RELATION_POLICY['target_periodicity_min']):continue
        nearest=sorted(cycles,key=lambda row:abs((row['start_frame']+row['end_frame'])/2-frame['frame']))[:3]
        local_period=statistics.median(v['end_frame']-v['start_frame'] for v in nearest)
        if abs(local_period*frame['f0']/rate-1)>j.h.f.RELATION_POLICY['target_period_error_max']:continue
        if previous:
            left,right=previous['frame'],frame['frame']
            changed=abs(frame['f0']/previous['f0']-1)>j.h.f.RELATION_POLICY['neighbor_period_change_max']
            silent=any(a<right and z>left for a,z in quiet)
            if changed and right-left<=2*WIDTH and not silent:
                candidates=[]
                for i in range(3,len(cycles)-3):
                    split=cycles[i]['start_frame']
                    if not left<=split<=right:continue
                    score=0
                    for rows,f0 in [([v for v in cycles[:i] if v['start_frame']>=left],previous['f0']),([v for v in cycles[i:] if v['end_frame']<=right],frame['f0'])]:
                        score+=sum(min(abs((v['end_frame']-v['start_frame'])*f0/rate-1),c.POLICY['maximum_period_error_fraction']) for v in rows)
                    candidates.append((score,split))
                if candidates:
                    score,split=min(candidates)
                    result.append({'frame':split,'seconds':split/rate,'left_f0':previous['f0'],'right_f0':frame['f0'],'bracket_frames':[left,right],'period_split_score':score})
        previous=frame
    return result

def adjust_periodicity(discovery,channel_audio,bounds,quiet):
    """Shift only crossing analysis windows; never optimize confidence or shape."""
    cycles=copy.deepcopy(discovery['cycles']);rate=discovery['sample_rate'];n=len(channel_audio[0]);cache={};changes=[]
    edges=sorted(set([0,n]+[b['frame'] for b in bounds]+[v for pair in quiet for v in pair]))
    previous=None
    for row in cycles:
        center=(row['start_frame']+row['end_frame'])/2
        fi=max(0,min(len(discovery['frames'])-1,round((center-1024)/round(rate*.01))))
        frame=discovery['frames'][fi];a=frame['frame']-1024;z=a+WIDTH
        crossed=[b for b in [v['frame'] for v in bounds]+[end for start,end in quiet] if a<b<z]
        if not crossed:
            previous=row if row.get('shape') and row['reliable'] else None
            continue
        lo=max(b for b in edges if b<=center);hi=min(b for b in edges if b>=center)
        # A complete observed period and a full analysis window must fit one side.
        if row['start_frame']<lo or row['end_frame']>hi or math.floor(hi)-math.ceil(lo)<WIDTH:
            previous=row if row.get('shape') and row['reliable'] else None
            continue
        start=max(math.ceil(lo),min(a,math.floor(hi)-WIDTH))
        # The bracket, rather than one uncertain crossing, separates confident
        # contexts. Targets may lie in the bracket; no target PCM is synthesized.
        for boundary in bounds:
            if boundary['frame'] not in crossed:continue
            left,right=boundary['bracket_frames']
            start=left-WIDTH if center<boundary['frame'] else right
            if start<0 or start+WIDTH>n:continue
        key=start
        if key not in cache:cache[key]=c.p.pitch(channel_audio[discovery['reference_channel_zero_based']][start:start+WIDTH],rate)
        f0,confidence=cache[key];duration=row['end_frame']-row['start_frame'];error=abs(duration*f0/rate-1) if f0 else None
        reasons=[]
        if not frame['active']:reasons.append('below relative activity screen')
        if f0 is None or confidence<c.POLICY['minimum_periodicity']:reasons.append('uncertain local periodicity')
        if error is None or error>c.POLICY['maximum_period_error_fraction']:reasons.append('crossing spacing disagrees with estimated period')
        if duration<4:reasons.append('insufficient observed samples')
        old={'reliable':row['reliable'],'periodicity':row['periodicity'],'f0':row['estimated_f0_hz'],'reasons':row['rejection_reasons']}
        row.update(estimated_f0_hz=f0,periodicity=confidence,period_error_fraction=error)
        if not reasons:
            row.update(c.signature(channel_audio,row['start_frame'],row['end_frame']))
            similarity=c.cosine(row['shape'],previous['shape']) if previous else None
            row['previous_eligible_cycle_similarity']=similarity
            if previous and row['start_frame']-previous['end_frame']<rate*.01 and similarity<c.POLICY['neighbor_shape_min']:reasons.append('neighbor cycle geometry is unstable')
            previous=row
        else:previous=None
        row['rejection_reasons']=reasons;row['reliable']=not reasons
        changes.append({'cycle':row['cycle'],'old':old,'new_reliable':row['reliable'],'new_periodicity':confidence,'new_f0':f0,'new_reasons':reasons,'window_frames':[start,start+WIDTH]})
    return cycles,changes,len(cache)

def frozen_assignment(row,families):
    """Match a newly eligible signature to frozen 4C exemplars; no reclustering."""
    if not row['reliable']:return {'cycle':row['cycle'],'status':'unreliable','family':None}
    scores=sorted([(c.cosine(row['shape'],v['signature_shape_64_per_channel']),v['family']) for v in families],reverse=True)
    eligible=[{'family':f,'similarity':s} for s,f in scores if s>=c.POLICY['family_shape_min']]
    if not eligible:return {'cycle':row['cycle'],'status':'unmatched','family':None}
    if len(eligible)>1 and eligible[0]['similarity']-eligible[1]['similarity']<c.POLICY['ambiguous_gap']:
        return {'cycle':row['cycle'],'status':'ambiguous','family':None,'candidates':eligible}
    family=eligible[0]['family'];status=next(v['status'] for v in families if v['family']==family)
    return {'cycle':row['cycle'],'status':'assigned' if status=='recurring' else 'provisional','family':family}

def first_cycles_after_silence(cycles,quiet,rate):
    """First complete cycle only, within one observed period of measured onset."""
    result=set()
    for a,z in quiet:
        after=[v for v in cycles.values() if v['start_frame']>=z and v['reliable']]
        if not after:continue
        row=min(after,key=lambda v:v['start_frame']);duration=row['end_frame']-row['start_frame']
        if row['start_frame']-z<=duration+round(rate*.002):result.add(row['cycle'])
    return result

def choose(row,assignment,cycles,families,allowed,neighbors,onset):
    family,evidence=j.target_phase_choice(row,assignment,cycles,families,allowed,neighbors)
    # Waive only a missing/distant predecessor, with independent silence evidence.
    waived={'no reliable previous temporal neighbor','reliable previous neighbor outside time bound'}
    reasons=evidence.get('reasons',[])
    if row['cycle'] in onset and reasons and set(reasons)<=waived and evidence.get('target_gates_passed'):
        family=max(assignment['candidates'],key=lambda v:v['similarity'])['family']
        evidence={**evidence,'reasons':[],'waived_predecessor_reasons':reasons,'silence_supported_onset':True}
    return family,evidence
