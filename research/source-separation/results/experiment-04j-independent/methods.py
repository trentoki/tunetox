"""Independent 4J branches. A changes target comparison; B infers bounded sequence gaps."""
import collections
import importlib.util
import math
from pathlib import Path
import statistics

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
h=load('frozen_4h_recognition',ROOT/'results/experiment-04h-phase-neighbors/recognition.py')
render=load('frozen_64_renderer',ROOT/'results/experiment-04f-independent/render.py')

SEQUENCE_POLICY={'context_cycles_per_side':3,'context_gap_periods_max':.1,'maximum_inferred_cycles':2,
                 'period_deviation_max':.02,'amplitude_ratio_max':1.2,'context_geometry_min':.99,
                 'prediction_error_max':.05,'prediction_correlation_min':.98,
                 'per_cycle_error_max':.08,'per_cycle_correlation_min':.97,'minimum_relative_source_rms':.5,'quiet_block_to_prediction_rms_min':.25}


def target_phase_choice(row,assignment,cycles,families,allowed,neighbors):
    """Keep the best historical family and threshold; bound its target alignment."""
    if assignment['status']!='ambiguous' or not row['reliable']:
        return None,{'reasons':['not a reliable ambiguous target']}
    best=max(assignment['candidates'],key=lambda v:v['similarity'])
    prototype=families[best['family']]['signature_shape_64_per_channel']
    probe=h.g.bounded_phase_similarity(row['shape'],prototype)
    adjusted={**assignment,'candidates':[dict(v) for v in assignment['candidates']]}
    for candidate in adjusted['candidates']:
        if candidate['family']==best['family']:candidate['similarity']=probe['similarity']
    family,evidence=h.choose(row,adjusted,cycles,families,allowed,neighbors)
    return family,{**evidence,'original_target_similarity':best['similarity'],
                   'phase_tolerant_target_similarity':probe['similarity'],
                   'comparison_shift_positions':probe['shift_positions'],
                   'synthesis_phase_shift':0,'identity_family':None}


def agreement(original,model):
    power=render.d.energy(original);pred=render.d.energy(model)
    return {'error_ratio':render.d.energy([a-b for a,b in zip(original,model)])/max(power,1e-30),
            'correlation':h.f.cosine(original,model),
            'source_to_prediction_rms_ratio':math.sqrt(power/max(pred,1e-30))}


def propose_sequence_gap(left,right,families,allowed,rate,serial):
    """Neighbor-only oscillator continuation; never reads the missing waveform."""
    policy=SEQUENCE_POLICY;reasons=[];ncontext=policy['context_cycles_per_side']
    if len(left)!=ncontext or len(right)!=ncontext:return [],{'reasons':['insufficient stable context']}
    context=left+right;durations=[v['end_frame']-v['start_frame'] for v in context];period=statistics.median(durations)
    if any(abs(v/period-1)>policy['period_deviation_max'] for v in durations):reasons.append('unstable flank periods or transition')
    for flank in [left,right]:
        if any((b['start_frame']-a['end_frame'])/period>policy['context_gap_periods_max'] or b['start_frame']<a['end_frame']-1e-8 for a,b in zip(flank,flank[1:])):
            reasons.append('context is interrupted')
    scales=[v['signature_rms_scale'] for v in context]
    if min(scales)<=0 or max(scales)/min(scales)>policy['amplitude_ratio_max']:reasons.append('unstable flank amplitude / ending')
    ids=[v['family'] for v in context]
    if any(a!=b and tuple(sorted([a,b])) not in allowed for a in ids for b in ids):reasons.append('unrelated flank families')
    if any(h.g.bounded_phase_similarity(a['shape'],b['shape'])['similarity']<policy['context_geometry_min'] for a,b in zip(context,context[1:])):
        reasons.append('flank geometry is not coherent')
    dominant,count=collections.Counter(ids).most_common(1)[0]
    if count<4 or families[dominant]['status']!='recurring':reasons.append('no stable dominant learned exemplar')
    start=left[-1]['end_frame'];end=right[0]['start_frame'];gap=end-start;number=round(gap/period)
    if not 1<=number<=policy['maximum_inferred_cycles']:reasons.append('gap not one or two supported periods')
    if number and abs(gap/number/period-1)>policy['period_deviation_max']:reasons.append('phase closure mismatch')
    detail={'start_frame':start,'end_frame':end,'expected_period_frames':period,'inferred_period_count':number,
            'left_cycle_ids':[v['cycle'] for v in left],'right_cycle_ids':[v['cycle'] for v in right],
            'render_family':dominant,'reasons':reasons,'inferred':True,'identity_family':None}
    if reasons:return [],detail
    # Linearly interpolate phase increments and amplitude metadata, closing exactly
    # at observed anchors. No target signature, target scale or raw PCM is copied.
    pleft=statistics.median(durations[:ncontext]);pright=statistics.median(durations[ncontext:])
    increments=[pleft+(pright-pleft)*(i+1)/(number+1) for i in range(number)];factor=gap/sum(increments)
    result=[];cursor=start
    for i,increment in enumerate(increments):
        finish=end if i==number-1 else cursor+increment*factor;u=(i+.5)/number
        scale=left[-1]['signature_rms_scale']*(1-u)+right[0]['signature_rms_scale']*u
        offsets=[a*(1-u)+b*u for a,b in zip(left[-1]['channel_offsets'],right[0]['channel_offsets'])]
        result.append({'cycle':-(serial*10+i+1),'start_frame':cursor,'end_frame':finish,
                       'family':dominant,'status':'assigned','reliable':True,'signature_rms_scale':scale,
                       'channel_offsets':offsets,'provenance':'sequence-inferred, not directly recognized','identity_family':None})
        cursor=finish
    return result,detail


def verify_proposal(proposed,left,right,families,original,channels,rate):
    """Test a fixed neighbor-derived prediction; no fitting/minimum-residual search."""
    origin=math.floor(left[0]['start_frame']);end=math.ceil(right[-1]['end_frame']);local=[]
    for row in left+proposed+right:local.append({**row,'start_frame':row['start_frame']-origin,'end_frame':row['end_frame']-origin})
    model,mask,bridge,meta=render.synthesize(list(families.values()),local,end-origin,channels,rate,render.d.base_value_slope)
    first=math.ceil(proposed[0]['start_frame']);last=math.ceil(proposed[-1]['end_frame'])
    observed=original[first*channels:last*channels];predicted=model[(first-origin)*channels:(last-origin)*channels]
    result=agreement(observed,predicted);reasons=[];policy=SEQUENCE_POLICY
    if result['source_to_prediction_rms_ratio']<policy['minimum_relative_source_rms']:reasons.append('original is quiet/silent relative to continuation')
    if result['error_ratio']>policy['prediction_error_max']:reasons.append('original waveform disagrees with fixed prediction')
    if result['correlation']<policy['prediction_correlation_min']:reasons.append('original phase/shape correlation insufficient')
    block=max(1,round(rate*.002));whole_prediction_rms=math.sqrt(render.d.energy(predicted)/max(len(predicted),1))
    for a in range(0,len(observed),block*channels):
        ox=observed[a:a+block*channels];py=predicted[a:a+block*channels]
        actual_rms=math.sqrt(render.d.energy(ox)/max(len(ox),1));expected_rms=math.sqrt(render.d.energy(py)/max(len(py),1))
        if expected_rms>.1*whole_prediction_rms and actual_rms<policy['quiet_block_to_prediction_rms_min']*expected_rms:
            reasons.append('observed silence/ending within proposed continuation')
    per_cycle=[]
    for row in proposed:
        a=math.ceil(row['start_frame']);b=math.ceil(row['end_frame']);metrics=agreement(original[a*channels:b*channels],model[(a-origin)*channels:(b-origin)*channels]);per_cycle.append(metrics)
        if metrics['error_ratio']>policy['per_cycle_error_max'] or metrics['correlation']<policy['per_cycle_correlation_min']:
            reasons.append('an inferred cycle is unsupported')
    return not reasons,{**result,'per_cycle':per_cycle,'reasons':sorted(set(reasons)),
                        'scope':'Read-only verification of one neighbor prediction. No target waveform fallback, gain fit or phase optimization.'}
