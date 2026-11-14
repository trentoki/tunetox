#!/usr/bin/env python3
"""Diagnostic-only cross-component waveform relationships; never changes audio."""
import argparse
import hashlib
import json
import math
import operator
from pathlib import Path
import experiment_01c as separation


def compare(left, right, channels, max_lag):
    """Signed least-squares comparisons retain polarity and channel phase.

    Integer shifts represent temporal phase only; no fractional delay or analytic
    phase rotation is inferred. Tiny overlapping slivers cannot establish a match.
    """
    # Prefix energies avoid rescanning the same samples at every tested delay.
    def cumulative(values):
        result = [0.]
        for value in values:
            result.append(result[-1]+value*value)
        return result
    left_energy, right_energy = cumulative(left), cumulative(right)
    best = None
    for lag in range(-max_lag,max_lag+1):
        a,b = max(0,-lag)*channels,max(0,lag)*channels
        count = min(len(left)-a,len(right)-b)
        if count < 8*channels:
            continue
        x,y = left[a:a+count],right[b:b+count]
        xx,yy = left_energy[a+count]-left_energy[a],right_energy[b+count]-right_energy[b]
        # Avoid loss of precision when subtracting nearly equal prefix sums.
        if xx < left_energy[-1]*1e-10:
            xx = separation.energy(x)
        if yy < right_energy[-1]*1e-10:
            yy = separation.energy(y)
        if not xx or not yy:
            continue
        dot = sum(map(operator.mul,x,y))
        correlation = max(-1., min(1., dot/math.sqrt(xx*yy)))
        coverage = min(xx/max(left_energy[-1],1e-30),
                       yy/max(right_energy[-1],1e-30))
        score = correlation**2*coverage
        if best is None or score > best['score']:
            best = {'lag_frames':lag,'signed_gain':dot/xx,
                    'signed_correlation':correlation,'overlap_energy_coverage':coverage,
                    'score':score,'overlap_frames':count//channels}
    return best


def analyze(tracks, residual, events, channels, max_lag):
    fragments = []
    for component,track in list(enumerate(tracks))+[('residual',residual)]:
        for event,(start,end) in enumerate(events):
            values = track[start*channels:end*channels]
            if separation.energy(values)>1e-20:
                fragments.append(({'component':component,'event':event},values))
    rows=[]
    for i,(identity,left) in enumerate(fragments):
        for other,right in fragments[i+1:]:
            result = compare(left,right,channels,max_lag)
            labels=[]
            # Disjoint support is a weak complement hypothesis, never an assignment.
            peaks = max(map(abs,left),default=0),max(map(abs,right),default=0)
            active_left={k//channels for k,v in enumerate(left) if abs(v)>peaks[0]*.01}
            active_right={k//channels for k,v in enumerate(right) if abs(v)>peaks[1]*.01}
            union=active_left|active_right
            support_overlap=len(active_left&active_right)/max(len(union),1)
            if identity['event']==other['event'] and union and support_overlap<.05:
                labels.append('possible complementary disjoint fragments; identity unproven')
            if result is None:
                rows.append({'left':identity,'right':other,'full':None,
                             'active_support_overlap':support_overlap,
                             'possible_relationships':labels})
                continue
            if result['score']>=.7:
                labels.append('shared waveform structure')
                if identity['component']!=other['component']:
                    labels.append('possible duplicate assignment' if result['signed_gain']>0
                                  else 'possible inverted or complementary cancellation fragment')
            # Compare terminal regions separately: shared tails can be hidden by attacks.
            width=min(len(left),len(right))//2//channels*channels
            tail=compare(left[-width:],right[-width:],channels,max_lag) if width else None
            if tail and tail['score']>=.7:
                labels.append('shared terminal structure; inspect possible incomplete tail')
            rows.append({'left':identity,'right':other,'full':result,'terminal_half':tail,
                         'active_support_overlap':support_overlap,
                         'possible_relationships':labels})
    return {'diagnostic_only':True,'audio_reassigned':False,'comparisons':rows,
            'limits':['Relationships are hypotheses, not source identities.',
                      'Complementary nonoverlapping fragments cannot be established by correlation.',
                      'Terminal agreement does not prove missing audio or a complete sound tail.',
                      'Integer-frame signed waveform comparison; no fractional phase estimation.']}


def run(run_path, output, max_lag_ms=5):
    run_path=Path(run_path)
    report_path=run_path/'report.json'
    report=json.loads(report_path.read_text())
    rate,channels=report['sample_rate'],report['channels']
    paths=[run_path/item['file'] for item in report['outputs']]+[run_path/'residual.wav']
    hashes={str(p):separation.digest(p) for p in paths+[report_path]}
    arrays=[]
    for path in paths:
        r,c,values=separation.read_float_wav(path)
        if (r,c,len(values)//c)!=(rate,channels,report['frames']):
            raise ValueError('Inconsistent output format or length')
        arrays.append(values)
    result=analyze(arrays[:-1],arrays[-1],[(e['start_frame'],e['end_frame'])
                    for e in report['events']],channels,round(rate*max_lag_ms/1000))
    result['input_hashes']=hashes
    result['max_lag_ms']=max_lag_ms
    if any(separation.digest(Path(p))!=value for p,value in hashes.items()):
        raise ValueError('Inputs changed during analysis')
    separation.save_json(output,result)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run')
    parser.add_argument('--output',required=True)
    parser.add_argument('--max-lag-ms',type=float,default=5)
    args=parser.parse_args()
    if not math.isfinite(args.max_lag_ms) or not 0<=args.max_lag_ms<=50:
        parser.error('max-lag-ms must be finite and between 0 and 50')
    run(args.run,args.output,args.max_lag_ms)
