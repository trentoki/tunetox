"""Additional evaluation context and bounded phase probes. No render eligibility output."""
import importlib.util
import json
import math
from pathlib import Path
import statistics
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
s=importlib.util.spec_from_file_location('four_g_helpers',HERE/'analyze.py');g=importlib.util.module_from_spec(s);s.loader.exec_module(g)

def rotated(shape,shift):
    result=[]
    for channel in range(len(shape)//64):
        for j in range(64):
            position=j+shift;i=math.floor(position);f=position-i
            result.append(shape[channel*64+i%64]*(1-f)+shape[channel*64+(i+1)%64]*f)
    return result

def bounded_phase_similarity(x,y):
    options=[{'shift_positions':shift,'similarity':g.p.cosine(x,rotated(y,shift))} for shift in [-.5,-.25,0,.25,.5]]
    return max(options,key=lambda v:v['similarity'])

def run():
    r=json.loads((HERE/'report.json').read_text());c=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text());cycles={v['cycle']:v for v in c['cycles']};onsets=[v['onset_seconds'] for v in r['audio_energy_onsets']]
    contexts={}
    for record in r['cycle_records']:
        row=cycles[record['cycle']];center=(row['start_seconds']+row['end_seconds'])/2;label=record['audio_phase_evidence']
        nearest=min((abs(center-t),t) for t in onsets)
        if nearest[0]<.02 and label not in ['release / low-level decay']:
            label='recording-start attack (censored)' if nearest[1]==0 else 'silence-backed attack'
        elif label=='attack or pitch transition (boundary uncertain)':label='continuous pitch-region transition'
        contexts[row['cycle']]=label
    pair_probes=[]
    families=c['families'][:4]
    for i,left in enumerate(families):
        for right in families[i+1:]:
            x=cycles[left['prototype_cycle']]['shape'];y=cycles[right['prototype_cycle']]['shape']
            pair_probes.append({'left':left['family'],'right':right['family'],'direct_similarity':g.p.cosine(x,y),
                                'bounded_half_position_probe':bounded_phase_similarity(x,y),
                                'scope':'Linear fractional shifting changes sampled shape slightly; diagnostic increase does not prove pure physical phase error.'})
    neighbor_probes=[]
    for case in r['neighbor_only_cases']:
        target=cycles[case['cycle']];entries=[]
        for evidence in case['nearest_reliable_evidence']:
            other=cycles[evidence['nearest_reliable_cycle']]
            entries.append({**evidence,'bounded_half_position_probe':bounded_phase_similarity(target['shape'],other['shape'])})
        neighbor_probes.append({'cycle':case['cycle'],'time_seconds':case['time_seconds'],'source_energy':case['source_energy'],
                                'nearest_reliable_comparisons':entries})
    def compatible(case,phase):
        return len(case['nearest_reliable_comparisons'])==2 and all(v['gap_periods']<=.1 and v['relative_period_change']<=.02 and
                    (v['bounded_half_position_probe']['similarity'] if phase else v['geometry'])>=.995 for v in case['nearest_reliable_comparisons'])
    phase_distribution={}
    for f in families:
        import collections
        phase_distribution[f['family']]={'prototype_context':contexts[f['prototype_cycle']],
                                         'occurrence_contexts':dict(collections.Counter(contexts[i] for i in f['occurrences']))}
    result={'refined_family_contexts':phase_distribution,'recurring_family_fractional_phase_probes':pair_probes,
            'neighbor_only_bounded_probes':neighbor_probes,
            'nearest_reliable_direct_compatible_count':sum(compatible(v,False) for v in neighbor_probes),
            'nearest_reliable_phase_probe_compatible_count':sum(compatible(v,True) for v in neighbor_probes),
            'scope':'All comparisons are retrospective diagnostics. No grouping, eligibility, source phase, or audio was changed. Counts are not reconstructed cycles or quality guarantees.'}
    with (HERE/'context-and-phase-probes.json').open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
    print('Nearest reliable direct / phase-probe compatible',result['nearest_reliable_direct_compatible_count'],result['nearest_reliable_phase_probe_compatible_count'])
    print('Family context',phase_distribution)

if __name__=='__main__':run()
