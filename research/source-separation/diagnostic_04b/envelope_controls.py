"""Post-hoc onset and pitch-sensitivity controls. Reads diagnostic results only."""
import argparse
import itertools
import json
from pathlib import Path
import statistics
import time
import analysis as a


def onset_probe(channels,rate,region,peak):
    step=round(rate*.005);start=round(region['start_seconds']*rate)
    envelope=[(i, (sum(a.energy(ch[i:i+step]) for ch in channels)/(step*len(channels)))**.5)
              for i in range(start,min(len(channels[0])-step,start+round(rate*.18)),step)]
    local_peak=max(v for i,v in envelope)
    low=next((k for k,(i,v) in enumerate(envelope) if v>=.1*local_peak),None)
    # A first-active region clipped by recording start can still have an observed
    # rise. Later regions require actual observed low energy before the rise.
    preceding_silence=low is not None and low>=2 and max(v for i,v in envelope[:low])<.1*local_peak
    if low is None or (not preceding_silence and start!=0):
        return {'region':region['region'],'observed_silence_backed_onset':False,
                'attack_10_90_seconds':None,'reason':'No observed preceding low-energy interval; pitch boundary is not a reliable onset.'}
    high=next(k for k in range(low,len(envelope)) if envelope[k][1]>=.9*local_peak)
    onset=envelope[low][0]
    curve=[(sum(a.energy(ch[i:i+step]) for ch in channels)/(step*len(channels)))**.5
           for i in range(onset,onset+round(rate*.1),step)]
    return {'region':region['region'],'observed_silence_backed_onset':preceding_silence,
            'recording_start_clipped':start==0,'onset_seconds':onset/rate,
            'attack_10_90_seconds':(high-low)*step/rate,'aligned_100ms_rms':curve,
            'limits':'5 ms grid and local peak criterion; absolute attack onset and true maximum may differ.'}


def run(report_path,output):
    begin=time.perf_counter();r=json.loads(Path(report_path).read_text());rate,ch,values=a.decode_aifc(r['input_path'])
    channels=[values[c::ch] for c in range(ch)]
    step=round(rate*.005);peak=max((sum(a.energy(v[i:i+step]) for v in channels)/(step*ch))**.5
                                 for i in range(0,len(channels[0])-step,step))
    onsets=[onset_probe(channels,rate,region,peak) for region in r['regions']]
    valid=[row for row in onsets if 'aligned_100ms_rms' in row]
    pair_scores=[{'left':x['region'],'right':y['region'],
                  'aligned_envelope_cosine':a.cosine(x['aligned_100ms_rms'],y['aligned_100ms_rms'])}
                 for x,y in itertools.combinations(valid,2)]
    # Controlled f0 errors are diagnostic sensitivity probes, never separation inputs.
    controls=[]
    for pair in r['pairs']:
        if pair['pitch_distance_cents']<=100:continue
        left=r['regions'][pair['left']-1];right=r['regions'][pair['right']-1]
        if left['region']!=1:continue
        for factor in (.99,1.,1.01,2.):
            changed=dict(right);changed['f0']*=factor
            result=a.waveform_compare(channels,left,changed,rate,True)
            controls.append({'left':left['region'],'right':right['region'],
                             'target_f0_multiplier':factor,'absolute_correlation':abs(result['signed_correlation'])})
    result={'onset_controls':onsets,'aligned_envelope_pairs':pair_scores,
            'pitch_error_sensitivity':controls,'elapsed_seconds':time.perf_counter()-begin,
            'scope':'Post-hoc controls only; base analysis and all separation results unchanged.'}
    with Path(output).open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
    print('Reliable/clipped observed rises',len(valid),'attack seconds',[row['attack_10_90_seconds'] for row in valid])
    print('Aligned envelope median',statistics.median(row['aligned_envelope_cosine'] for row in pair_scores))
    for factor in (.99,1.,1.01,2.):
        print('F0 factor',factor,'median waveform similarity',statistics.median(v['absolute_correlation'] for v in controls if v['target_f0_multiplier']==factor))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('report');parser.add_argument('--output',required=True)
    args=parser.parse_args();run(args.report,args.output)
