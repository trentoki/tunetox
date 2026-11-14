"""Evaluation-only summaries from frozen artifacts; no inference changes."""
import collections
import json
import math
from pathlib import Path
import statistics
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]

def run():
    r=json.loads((HERE/'report.json').read_text());c=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text())
    cycles={v['cycle']:v for v in c['cycles']};ambiguous=[v for v in c['assignments'] if v['status']=='ambiguous']
    sets=collections.Counter(tuple(sorted(x['family'] for x in v['candidates'])) for v in ambiguous)
    f2=c['families'][1];prototype=cycles[f2['prototype_cycle']]
    status_energy={}
    for v in r['cycle_evidence']:
        row=status_energy.setdefault(v['status'],{'cycles':0,'original_energy':0.,'residual_energy':0.})
        row['cycles']+=1;row['original_energy']+=v['original_energy'];row['residual_energy']+=v['residual_energy']
    clean=[v for v in r['spectral_windows'] if v['region'] in [1,2,3,4,14,15]]
    powers=[]
    for v in r['spectral_windows']:
        row={'region':v['region'],'window_coverage':v['window_coverage']}
        for name in ['original','reconstructed','residual']:
            total=sum(b['energy'][name] for b in v['bands']);harmonic=sum(h['energy'][name] for h in v['harmonics'])
            row[name+'_outside_harmonic_neighborhood_fraction']=1-harmonic/max(total,1e-30)
        powers.append(row)
    result={'historical_4c_ambiguity_candidate_sets':[{'families':list(k),'cycles':v} for k,v in sets.items()],
            'historical_ambiguous_median_best_similarity':statistics.median(max(x['similarity'] for x in v['candidates']) for v in ambiguous),
            'historical_ambiguous_median_best_runner_gap':statistics.median(sorted([x['similarity'] for x in v['candidates']],reverse=True)[0]-sorted([x['similarity'] for x in v['candidates']],reverse=True)[1] for v in ambiguous),
            'release_exemplar_family_2':{'prototype_cycle':prototype['cycle'],'start_seconds':prototype['start_seconds'],'absolute_rms':prototype['absolute_rms'],
                                       'primary_prototype_rms':cycles[c['families'][0]['prototype_cycle']]['absolute_rms'],
                                       'primary_exemplar_cosine':next(v['geometry_cosine'] for v in r['family_exemplar_relationships'] if v['left']==1 and v['right']==2),
                                       'occurrence_times_seconds':[cycles[i]['start_seconds'] for i in f2['occurrences']],
                                       'ambiguities_before_third_unambiguous_family_2_occurrence':sum(v['cycle']<f2['occurrences'][2] for v in ambiguous)},
            'clean_continuous_windows':[{'region':v['region'],'coverage':v['window_coverage'],'start_seconds':v['window_start_seconds'],
                                        'unique_32_harmonic_limit_hz':v['64_position_unique_harmonic_limit_hz'],
                                        'minimum_independent_positions_to_represent_phased_harmonics_through_nyquist':2*math.floor(22050/v['f0_refined_audio_hz'])+1} for v in clean],
            'maximum_absolute_bridge_band_delta_db_in_clean_windows':max(abs(b['bridge_delta_db']) for v in clean for b in v['bands']),
            'status_energy':status_energy,'outside_harmonic_neighborhood_diagnostic':powers,
            'scope':'Uses actual historical candidate lists for ambiguity causality. report.json best/runner and phase fields recompute against final exemplar dictionary and are retrospective, not replayed streaming decisions.',
            'midi_validation':'Unavailable: no MIDI sequence found or supplied. No exact MIDI timing/pitch accuracy claimed.'}
    with (HERE/'summary.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'sets':result['historical_4c_ambiguity_candidate_sets'],'status_energy':status_energy,'outside_harmonics':powers},indent=2))

if __name__=='__main__':run()
