"""Separate 4F variants. Fresh process per variant for independent timing/RSS."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import sys
import time
import methods
import render

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
C=ROOT/'results/experiment-04c-majorsaw-shapes';D=ROOT/'results/experiment-04d-majorsaw-reconstruction';E=ROOT/'results/experiment-04e-reconstruction-errors'

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def db(x,y):return 10*math.log10(x/y) if x>0 and y>0 else None


def run(mode,output):
    started=time.perf_counter();output=Path(output).resolve();output.mkdir(parents=True,exist_ok=False)
    prior={str(p.resolve()):sha(p) for p in ROOT.rglob('*') if p.is_file() and HERE not in p.parents}
    discovery=json.loads((C/'report.json').read_text());baseline=json.loads((D/'report.json').read_text());fixed_windows=json.loads((E/'report.json').read_text())['spectral_windows']
    if sha(C/'report.json')!=baseline['discovery_artifacts']['report.json']:raise ValueError('4C changed')
    for item in baseline['outputs']:
        if sha(D/item['file'])!=item['sha256']:raise ValueError('4D changed')
    if sha(Path(baseline['input_path']))!=baseline['input_sha256']:raise ValueError('Input changed')
    io=render.d;rate,channels,original=io.read_export(D/'original_reference.wav');frames=len(original)//channels
    cycles={r['cycle']:r for r in discovery['cycles']};families=discovery['families'];family_lookup={v['family']:v for v in families};assignments=discovery['assignments']
    occurrences=[{**cycles[r['cycle']],'status':r['status'],'family':r['family']} for r in assignments]
    original_accepted={r['cycle'] for r in occurrences if r['status']=='assigned' and r['reliable']}
    timings={'load_verify_preservation_seconds':time.perf_counter()-started};t=time.perf_counter();decision_details=[];models={};relations=[]
    if mode=='relationships':
        allowed,relations=methods.related_pairs(families,cycles,assignments)
        for occurrence,assignment in zip(occurrences,assignments):
            if assignment['status']!='ambiguous':continue
            family,reasons=methods.choose_related(cycles[assignment['cycle']],assignment,cycles,family_lookup,allowed)
            decision_details.append({'cycle':occurrence['cycle'],'original_status':'ambiguous','identity_family':None,
                                     'render_family':family,'render_supported':family is not None,'reasons':reasons,
                                     'identity_interpretation':'Label remains unresolved; no family merging.'})
            if family is not None:occurrence['status']='assigned';occurrence['family']=family
        sampler=io.base_value_slope
    else:
        primitives=load('numerical_interpolation',ROOT/'diagnostic_04b/analysis.py')
        sampler,models=methods.make_sampler(mode,families,cycles,[original[c::channels] for c in range(channels)],primitives.interpolate)
    timings['method_preparation_seconds']=time.perf_counter()-t;t=time.perf_counter()
    reconstructed,mask,bridge,model=render.synthesize(families,occurrences,frames,channels,rate,sampler)
    timings['synthesis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    accepted={r['cycle'] for r in occurrences if r['status']=='assigned' and r['reliable']}
    if mode!='relationships' and accepted!=original_accepted:raise ValueError('A coverage/assignments changed')
    if mode=='relationships' and not original_accepted<=accepted:raise ValueError('B removed baseline assignments')
    if mode!='relationships' and sum(mask)!=baseline['metrics']['covered_frames']:raise ValueError('A frame coverage changed')
    residual=[v-w for v,w in zip(original,reconstructed)]
    io.write_float(output/'reconstructed.wav',rate,channels,reconstructed);io.write_float(output/'residual.wav',rate,channels,residual)
    _,_,y=io.read_export(output/'reconstructed.wav');_,_,res=io.read_export(output/'residual.wav')
    timings['residual_export_and_readback_seconds']=time.perf_counter()-t;t=time.perf_counter()
    input_energy=io.energy(original);error=[v-w for v,w in zip(original,y)]
    modeled_input=sum(original[i]**2 for i in range(len(original)) if mask[i//channels]);modeled_error=sum(error[i]**2 for i in range(len(error)) if mask[i//channels])
    evaluation=load('frozen_spectral_analysis',E/'analyze.py');spectral=[]
    for window in fixed_windows:
        if window['region'] not in [1,2,3,4,14,15]:continue
        start=round(window['window_start_seconds']*rate);a=start*channels;b=(start+2048)*channels
        power={name:evaluation.power_spectrum(v[a:b],channels) for name,v in [('original',original),('reconstructed',y),('residual',res)]}
        bands=[]
        for previous in window['bands']:
            low,high=previous['low_hz'],previous['high_hz'];values={name:evaluation.band_energy(v,rate,low,high) for name,v in power.items()}
            bands.append({'low_hz':low,'high_hz':high,'reconstructed_db_to_original':db(values['reconstructed'],values['original']),
                          'residual_to_original_energy_ratio':values['residual']/max(values['original'],1e-30),
                          'baseline_reconstructed_db_to_original':previous['ratio_db_to_original']['reconstructed']})
        spectral.append({'region':window['region'],'start_seconds':start/rate,'coverage':sum(mask[start:start+2048])/2048,'bands':bands})
    region_metrics=[]
    for region in discovery['regions']:
        a=math.ceil(region['start_seconds']*rate);b=min(frames,math.floor(region['end_seconds']*rate))
        metrics=io.interval_metrics(original,y,channels,a,b)
        region_metrics.append({'region':region['region'],'coverage':sum(mask[a:b])/max(b-a,1),**metrics})
    added=accepted-original_accepted
    added_energy=sum(original[i]**2 for r in added for i in range(math.ceil(cycles[r]['start_frame'])*channels,math.ceil(cycles[r]['end_frame'])*channels))
    added_error=sum(error[i]**2 for r in added for i in range(math.ceil(cycles[r]['start_frame'])*channels,math.ceil(cycles[r]['end_frame'])*channels))
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['evaluation_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_report_seconds']=time.perf_counter()-started
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;peak=rss if sys.platform=='darwin' else rss*1024
    result={'variant':mode,'input_sha256':baseline['input_sha256'],'sample_rate':rate,'channels':channels,'frames':frames,
            'timings':timings,'peak_process_rss_bytes':peak,'peak_memory_scope':'Fresh-process high-water RSS including metadata loading, source PCM, rendering and export/spectral QA; excludes later plotting/tests.',
            'fixed_cycle_detection':True,'a_fixed_assignments_and_support':mode!='relationships',
            'b_frozen_4d_linear64_synthesis':mode=='relationships','combined_improvements':False,'midi_used':False,
            'model':model,'accepted_cycle_ids':sorted(accepted),'added_cycle_ids':sorted(added),
            'relationship_policy':methods.RELATION_POLICY if mode=='relationships' else None,'family_relationships':relations,
            'metrics':{'coverage_fraction':sum(mask)/frames,'covered_frames':sum(mask),'reconstructed_energy_ratio':io.energy(y)/input_energy,
                       'residual_energy_ratio':io.energy(res)/input_energy,'reconstruction_rmse':math.sqrt(io.energy(error)/len(error)),
                       'modeled_error_to_modeled_input_ratio':modeled_error/max(modeled_input,1e-30),
                       'new_cycles_error_to_new_cycles_input_ratio':added_error/added_energy if added_energy else None,
                       'maximum_reconstruction_error':max(map(abs,error)),
                       'float32_sum_maximum_error':max(abs(v-w-z) for v,w,z in zip(original,y,res)),
                       'waveform_max_adjacent_step':max(abs(y[i]-y[i-channels]) for i in range(channels,len(y)))},
            'spectral_clean_windows':spectral,'region_metrics':region_metrics,
            'prior_research_files_verified_unchanged':len(prior),'original_fallback_used':False,'normalized_or_clipped':False,'listening_performed':False,
            'outputs':{name:sha(output/name) for name in ['reconstructed.wav','residual.wav']},
            'source_hashes':{p.name:sha(p) for p in [HERE/'run.py',HERE/'methods.py',HERE/'render.py']},
            'baseline_report_sha256':sha(D/'report.json'),'discovery_report_sha256':sha(C/'report.json')}
    for name,value in [('report.json',result),('occurrence-decisions.json',decision_details),('learned-exemplar-models.json',models),('preservation.json',prior)]:
        with (output/name).open('x') as f:json.dump(value,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'variant':mode,'timings':timings,'peak_mib':peak/2**20,'added_cycles':len(added),'metrics':result['metrics'],
                      'upper_band_median_db':[sorted([w['bands'][i]['reconstructed_db_to_original'] for w in spectral])[3] for i in [3,4]]},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--variant',choices=['cubic64','linear256','harmonic','relationships'],required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();run(args.variant,args.output)
