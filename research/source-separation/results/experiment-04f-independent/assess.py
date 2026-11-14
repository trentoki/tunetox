"""Post-run evaluation only; never changes frozen WAVs or recognition decisions."""
import importlib.util
import json
import math
from pathlib import Path
import statistics
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def run():
    io=load('frozen_io',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py')
    ev=load('frozen_spectral',ROOT/'results/experiment-04e-reconstruction-errors/analyze.py')
    base=json.loads((ROOT/'results/experiment-04d-majorsaw-reconstruction/report.json').read_text())
    e=json.loads((ROOT/'results/experiment-04e-reconstruction-errors/report.json').read_text())
    baseline_clean=[v for v in e['spectral_windows'] if v['region'] in [1,2,3,4,14,15]]
    modes=['a-cubic64','a-linear256','a-harmonic','b-related-shapes'];summary=[];alignment=[]
    for mode in modes:
        r=json.loads((HERE/mode/'report.json').read_text());item={'directory':mode,'metrics':r['metrics'],'timings':r['timings'],'peak_rss_mib':r['peak_process_rss_bytes']/2**20,
              'accepted_runs':r['model']['accepted_runs'],'added_cycles':len(r['added_cycle_ids'])}
        item['upper_band_medians']=[{'low_hz':r['spectral_clean_windows'][0]['bands'][i]['low_hz'],
              'level_db':statistics.median(v['bands'][i]['reconstructed_db_to_original'] for v in r['spectral_clean_windows']),
              'residual_energy_ratio':statistics.median(v['bands'][i]['residual_to_original_energy_ratio'] for v in r['spectral_clean_windows'])} for i in [3,4]]
        summary.append(item)
        for w in r['spectral_clean_windows']:
            b=w['bands'][4];ratio=10**(b['reconstructed_db_to_original']/10)
            cross=(1+ratio-b['residual_to_original_energy_ratio'])/(2*math.sqrt(ratio))
            alignment.append({'directory':mode,'region':w['region'],'15k_to_nyquist_level_db':b['reconstructed_db_to_original'],
                              '15k_to_nyquist_error_ratio':b['residual_to_original_energy_ratio'],
                              'real_normalized_band_cross_spectrum':cross,
                              'interpretation':'Phase-sensitive alignment from E(error)=E(original)+E(model)-2 Re(cross). It also depends on within-band amplitude distribution; not a source identity metric.'})
    b=json.loads((HERE/'b-related-shapes/report.json').read_text());decisions=json.loads((HERE/'b-related-shapes/occurrence-decisions.json').read_text())
    import collections
    bdetails={'new_render_family_counts':dict(collections.Counter(v['render_family'] for v in decisions if v['render_supported'])),
              'remaining_ambiguous_cycles':sum(not v['render_supported'] for v in decisions),
              'rejection_reasons':dict(collections.Counter(s for v in decisions for s in v['reasons'])),
              'family_labels_merged':False,'identity_assignments_for_new_cycles':'Still ambiguous/unresolved; render-family choice is a waveform estimate.'}
    # Same garbled region-6 window used by 4E, without selecting a new favorable interval.
    window=next(v for v in e['spectral_windows'] if v['region']==6);rate=base['sample_rate'];channels=base['channels'];start=round(window['window_start_seconds']*rate)
    source=ROOT/'results/experiment-04d-majorsaw-reconstruction'
    proxies={}
    for label,path in [('original',source/'original_reference.wav'),('4d',source/'reconstructed.wav'),('4f_b',HERE/'b-related-shapes/reconstructed.wav')]:
        _,_,v=io.read_export(path);power=ev.power_spectrum(v[start*channels:(start+2048)*channels],channels);total=sum(power);harmonics=0.
        for h in window['harmonics']:
            center=h['frequency_hz'];half=min(.25*window['f0_refined_audio_hz'],max(2*rate/4096,.01*center))
            harmonics+=ev.band_energy(power,rate,max(0,center-half),min(rate/2+.01,center+half))
        proxies[label]=1-harmonics/total
    result={'variants':summary,'baseline':{'metrics':base['metrics'],'timings':base['timings'],'peak_rss_mib':base['peak_process_rss_bytes']/2**20,
             'upper_band_medians':[{'low_hz':baseline_clean[0]['bands'][i]['low_hz'],
                 'level_db':statistics.median(v['bands'][i]['ratio_db_to_original']['reconstructed'] for v in baseline_clean),
                 'residual_energy_ratio':statistics.median(v['bands'][i]['energy']['residual']/v['bands'][i]['energy']['original'] for v in baseline_clean)} for i in [3,4]]},
            'high_band_phase_sensitive_evidence':alignment,'b_relationship_evaluation':bdetails,
            'region6_outside_harmonic_neighborhood_fraction':proxies,
            'scope':'Held 4E windows fixed. Whole-process memory/time are single fresh-process observations, not controlled hardware benchmarks. No audio or methods were changed during evaluation.'}
    with (HERE/'comparison.json').open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
    print('B newly rendered families',bdetails['new_render_family_counts']);print('Region6 off-harmonic proxy',proxies)

if __name__=='__main__':run()
