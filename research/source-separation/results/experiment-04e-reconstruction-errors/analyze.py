"""4E read-only diagnostics of frozen 4C/4D artifacts. No audio output or revised model."""
import cmath
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import statistics
import sys
import time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
C=ROOT/'results/experiment-04c-majorsaw-shapes';D=ROOT/'results/experiment-04d-majorsaw-reconstruction'

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

p=load('four_b_numerics',ROOT/'diagnostic_04b/analysis.py')
d=load('four_d_readonly_math',D/'reconstruct.py')

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def distribution(values):
    if not values:return None
    x=sorted(values)
    return {'min':x[0],'q05':x[round(.05*(len(x)-1))],'median':statistics.median(x),'q95':x[round(.95*(len(x)-1))],'max':x[-1]}

def decibels(numerator,denominator):
    return 10*math.log10(numerator/denominator) if numerator>0 and denominator>0 else None

def attenuation(harmonic,points=64):
    x=math.pi*harmonic/points
    return (math.sin(x)/x)**2 if x else 1.


def power_spectrum(values,channels):
    # Hann-windowed stereo power sum; no channel cancellation or peak normalization.
    frames=len(values)//channels;result=[0.]*2049
    for channel in range(channels):
        power=p.spectrum(values[channel::channels],4096)
        result=[a+b for a,b in zip(result,power)]
    return result


def band_energy(power,rate,low,high):
    step=rate/(2*(len(power)-1))
    return sum(v for i,v in enumerate(power) if low<=i*step<high)


def chosen_window(region,mask,original,channels,rate,width=2048):
    start=max(0,math.ceil(region['start_seconds']*rate));end=min(len(mask),math.floor(region['end_seconds']*rate))
    choices=[]
    for a in range(start,max(start+1,end-width+1),round(rate*.005)):
        b=min(len(mask),a+width)
        if b-a!=width:continue
        coverage=sum(mask[a:b])/width
        energy=p.energy(original[a*channels:b*channels])
        choices.append(((coverage,energy),a))
    return max(choices)[1] if choices else max(0,min(len(mask)-width,start))


def probe_basis(cycles,assignments,families,frame_owner,start,width,channels,mode):
    """Short spectral attribution query, not new reconstruction or WAV generation.

    mode=family uses the exact unbridged 4D base formula. mode=individual uses a
    saved occurrence's own 64-position measurements to diagnose prototype mismatch.
    Both remain at 64 positions; no signature resolution or threshold is changed.
    """
    values=[]
    for frame in range(start,start+width):
        cycle_id=frame_owner[frame]
        if cycle_id==0:values.extend([0.]*channels);continue
        row=cycles[cycle_id];assignment=assignments[cycle_id]
        shape=families[assignment['family']]['signature_shape_64_per_channel'] if mode=='family' else row['shape']
        phase=(frame-row['start_frame'])/(row['end_frame']-row['start_frame'])
        for channel in range(channels):
            value,slope=d.base_value_slope(shape,channel,phase,row['signature_rms_scale'],row['channel_offsets'][channel],row['end_frame']-row['start_frame'])
            values.append(value)
    return values


def run():
    begin=time.perf_counter();prior={str(path.resolve()):sha(path) for path in ROOT.rglob('*') if path.is_file() and HERE not in path.parents}
    verification=json.loads((D/'verification.json').read_text())
    for name in ['reconstructed.wav','residual.wav','original_reference.wav']:
        if sha(D/name)!=verification['source_and_output_sha256'][name]:raise ValueError('4D WAV differs from saved verification')
    discovery=json.loads((C/'report.json').read_text());old=json.loads((D/'report.json').read_text())
    if sha(C/'report.json')!=old['discovery_artifacts']['report.json']:raise ValueError('Discovery differs from frozen 4D input')
    rate,channels,original=d.read_export(D/'original_reference.wav');_,_,reconstructed=d.read_export(D/'reconstructed.wav');_,_,residual=d.read_export(D/'residual.wav')
    expected=old['input_sha256']
    if sha(Path(old['input_path']))!=expected:raise ValueError('Original input hash mismatch')
    cycles={v['cycle']:v for v in discovery['cycles']};assignments={v['cycle']:v for v in discovery['assignments']};families={v['family']:v for v in discovery['families']}
    frames=len(original)//channels;mask=bytearray(frames);bridge=bytearray(frames);owner=[0]*frames
    for row in cycles.values():
        assignment=assignments[row['cycle']]
        if assignment['status']!='assigned' or not row['reliable']:continue
        duration=row['end_frame']-row['start_frame'];edge=min(rate*.0005,duration*.15)
        for frame in range(math.ceil(row['start_frame']),min(frames,math.ceil(row['end_frame']))):
            owner[frame]=row['cycle'];mask[frame]=1
            if frame-row['start_frame']<edge or row['end_frame']-frame<edge:bridge[frame]=1
    assert all(reconstructed[i]==0 for i in range(len(reconstructed)) if not mask[i//channels])
    timings={'verify_and_load_seconds':time.perf_counter()-begin};t=time.perf_counter()
    regions=[];spectra=[];cycle_evidence=[]
    for row in cycles.values():
        assignment=assignments[row['cycle']];a=math.ceil(row['start_frame']);b=math.ceil(row['end_frame'])
        actual=original[a*channels:b*channels];error=residual[a*channels:b*channels]
        record={'cycle':row['cycle'],'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],
                'status':assignment['status'],'family':assignment['family'],'reliable':row['reliable'],
                'period_error_fraction':row['period_error_fraction'],'rejection_reasons':row['rejection_reasons'],
                'original_energy':p.energy(actual),'residual_energy':p.energy(error)}
        if row['reliable']:
            scores=sorted([(p.cosine(row['shape'],f['signature_shape_64_per_channel']),f['family']) for f in families.values()],reverse=True)
            record.update({'best_family_similarity':scores[0][0],'runner_up_similarity':scores[1][0],
                           'best_runner_gap':scores[0][0]-scores[1][0],
                           'top_two_family_ids':[scores[0][1],scores[1][1]]})
            prototype=families[assignment['family']]['signature_shape_64_per_channel'] if assignment['family'] else families[scores[0][1]]['signature_shape_64_per_channel']
            fa=p.fft(row['shape'][:64])[1];fb=p.fft(prototype[:64])[1]
            delta=cmath.phase(fa*fb.conjugate())
            record['fundamental_phase_offset_cycles']=delta/(2*math.pi)
        cycle_evidence.append(record)
    for region in discovery['regions']:
        a=max(0,math.ceil(region['start_seconds']*rate));b=min(frames,math.floor(region['end_seconds']*rate))
        rows=[v for v in cycle_evidence if a/rate<= (v['start_seconds']+v['end_seconds'])/2 <b/rate]
        counts={status:sum(v['status']==status for v in rows) for status in ['assigned','ambiguous','provisional','unreliable']}
        covered_energy=sum(original[i]**2 for i in range(a*channels,b*channels) if mask[i//channels])
        total_energy=p.energy(original[a*channels:b*channels]);err=p.energy(residual[a*channels:b*channels])
        modeled_error=sum(residual[i]**2 for i in range(a*channels,b*channels) if mask[i//channels])
        runs=sum(mask[f] and (f==a or not mask[f-1]) for f in range(a,b))
        regions.append({'region':region['region'],'start_seconds':a/rate,'end_seconds':b/rate,'f0_audio_hz':region['f0_median_hz'],
                        'frame_coverage':sum(mask[a:b])/max(b-a,1),'status_counts':counts,'accepted_runs':runs,
                        'residual_energy_ratio':err/max(total_energy,1e-30),
                        'unmodeled_input_energy_ratio':(total_energy-covered_energy)/max(total_energy,1e-30),
                        'modeled_error_ratio_of_modeled_input':modeled_error/max(covered_energy,1e-30),
                        'accepted_phase_offset_cycles':distribution([abs(v['fundamental_phase_offset_cycles']) for v in rows if v['status']=='assigned']),
                        'reliable_period_error_fraction':distribution([v['period_error_fraction'] for v in rows if v['reliable']])})
        start=chosen_window(region,mask,original,channels,rate)
        sample=original[start*channels:(start+2048)*channels]
        powers={'original':power_spectrum(sample,channels),
                'reconstructed':power_spectrum(reconstructed[start*channels:(start+2048)*channels],channels),
                'residual':power_spectrum(residual[start*channels:(start+2048)*channels],channels)}
        fully_covered=sum(mask[start:start+2048])==2048
        if fully_covered:
            powers['unbridged_family_probe']=power_spectrum(probe_basis(cycles,assignments,families,owner,start,2048,channels,'family'),channels)
            powers['individual_64_probe']=power_spectrum(probe_basis(cycles,assignments,families,owner,start,2048,channels,'individual'),channels)
        bands=[]
        for low,high in [(0,2000),(2000,5000),(5000,10000),(10000,15000),(15000,rate/2+.01)]:
            energy={name:band_energy(v,rate,low,high) for name,v in powers.items()}
            bands.append({'low_hz':low,'high_hz':high,'energy':energy,
                          'ratio_db_to_original':{name:decibels(value,energy['original']) for name,value in energy.items() if name!='original'},
                          'bridge_delta_db':decibels(energy['reconstructed'],energy['unbridged_family_probe']) if fully_covered else None})
        step=rate/4096;f0=region['f0_median_hz'];k0=max(1,round(f0/step));near=range(max(1,k0-2),min(2048,k0+3));peak=max(near,key=lambda k:powers['original'][k]);logs=[math.log(max(powers['original'][k],1e-30)) for k in [peak-1,peak,peak+1]]
        den=logs[0]-2*logs[1]+logs[2];delta=.5*(logs[0]-logs[2])/den if den else 0;refined=(peak+max(-.5,min(.5,delta)))*step
        harmonics=[]
        for h in range(1,math.floor((rate/2)/refined)+1):
            center=h*refined;half=min(.25*refined,max(2*step,.01*center));energy={name:band_energy(v,rate,max(0,center-half),min(rate/2+.01,center+half)) for name,v in powers.items()}
            harmonics.append({'harmonic':h,'frequency_hz':center,'energy':energy,'reconstructed_db_to_original':decibels(energy['reconstructed'],energy['original'])})
        spectra.append({'region':region['region'],'window_start_seconds':start/rate,'window_seconds':2048/rate,
                        'window_coverage':sum(mask[start:start+2048])/2048,'f0_refined_audio_hz':refined,
                        '64_position_unique_harmonic_limit_hz':32*refined,'bands':bands,'harmonics':harmonics})
    timings['cycle_region_and_spectral_analysis_seconds']=time.perf_counter()-t;t=time.perf_counter()
    family_relationships=[]
    for i,left in enumerate(discovery['families']):
        for right in discovery['families'][i+1:]:
            family_relationships.append({'left':left['family'],'right':right['family'],
                                         'geometry_cosine':p.cosine(left['signature_shape_64_per_channel'],right['signature_shape_64_per_channel'])})
    input_energy=p.energy(original)
    error_parts={'outside_modeled_support':sum(residual[i]**2 for i in range(len(residual)) if not mask[i//channels]),
                 'modeled_bridge_frames':sum(residual[i]**2 for i in range(len(residual)) if bridge[i//channels]),
                 'modeled_nonbridge_frames':sum(residual[i]**2 for i in range(len(residual)) if mask[i//channels] and not bridge[i//channels])}
    uncertain_times=[(v['start_frame'],v['end_frame']) for v in cycles.values() if not v['reliable']]
    boundaries=sorted({r['start_seconds'] for r in discovery['regions']}|{r['end_seconds'] for r in discovery['regions']})
    boundary_cycles=[]
    for record in cycle_evidence:
        center=(record['start_seconds']+record['end_seconds'])/2
        record['within_25ms_of_detected_region_edge']=min(abs(center-v) for v in boundaries)<.025
    nearby=[v for v in cycle_evidence if v['within_25ms_of_detected_region_edge']]
    interior=[v for v in cycle_evidence if not v['within_25ms_of_detected_region_edge']]
    transition_summary={label:{'cycle_candidates':len(rows),'unreliable_fraction':sum(not v['reliable'] for v in rows)/max(len(rows),1),
                               'ambiguous_fraction_of_reliable':sum(v['status']=='ambiguous' for v in rows)/max(sum(v['reliable'] for v in rows),1)}
                        for label,rows in [('near_detected_edges',nearby),('interior',interior)]}
    assert all(sha(Path(path))==digest for path,digest in prior.items())
    timings['decomposition_and_preservation_seconds']=time.perf_counter()-t;timings['total_before_report_seconds']=time.perf_counter()-begin
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;memory=rss if sys.platform=='darwin' else rss*1024
    report={'experiment':'4E','mode':'Diagnostic only; no WAVs, no signature changes, no revised reconstruction exported.',
            'source_sha256':sha(Path(__file__)),'input_sha256':expected,
            'artifact_hashes':{str(path):sha(path) for path in [C/'report.json',D/'reconstruct.py',D/'reconstructed.wav',D/'residual.wav',D/'original_reference.wav']},
            'timings':timings,'peak_process_rss_bytes':memory,'regions':regions,'spectral_windows':spectra,
            'cycle_evidence':cycle_evidence,'family_exemplar_relationships':family_relationships,
            'residual_energy_decomposition':{'absolute':error_parts,'fraction_of_input':{k:v/input_energy for k,v in error_parts.items()},
                                             'fraction_of_residual':{k:v/p.energy(residual) for k,v in error_parts.items()}},
            'transition_summary':transition_summary,
            'interpolation_theory':[{'harmonic':h,'amplitude_factor_sinc_squared':attenuation(h),'energy_db':20*math.log10(attenuation(h))} for h in [5,10,15,20,25,30,32]],
            'prior_files_verified_unchanged':len(prior),'midi_ground_truth':'Not found in project at analysis time. Audio-derived regions used for analysis; known note order used only to label listening-reported groups afterward.',
            'limits':['Spectral windows are Hann-windowed finite observations; per-band powers are relative comparisons, not calibrated whole-note energy.',
                      'Probe vectors are short mathematical evaluations at the existing 64-position resolution; not alternative listening outputs or a revised separation method.',
                      'Pitch and boundaries come from audio and are uncertain. No MIDI pitches/times are supplied to discovery.']}
    with (HERE/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (HERE/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    print(json.dumps({'timings':timings,'peak_rss_mib':memory/2**20,'decomposition':report['residual_energy_decomposition'],'transition_summary':transition_summary},indent=2))

if __name__=='__main__':run()
