"""Non-destructive diagnostic replay and isolated Component 2 self-separation."""
from pathlib import Path
import runpy
import json
import struct
import math

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ORIGINAL = ROOT / 'results' / 'recording-02-restart'
adapter = runpy.run_path(str(ORIGINAL / 'run_adapter.py'))
algorithm = runpy.run_path(str(ROOT / 'experiment_01b.py'))


def save(name, value):
    algorithm['save_json'](HERE / name, value)


def boundary(values, frame, channels):
    """Samples/slopes straddling a cut; slope is amplitude change per frame."""
    result = []
    for c in range(channels):
        def at(i):
            return values[i * channels + c] if 0 <= i < len(values)//channels else None
        a,b,d,e = (at(frame + offset) for offset in (-2,-1,0,1))
        result.append({'channel': c, 'before_previous': a, 'before': b, 'after': d,
                       'after_next': e, 'jump': d-b if b is not None and d is not None else None,
                       'slope_before': b-a if b is not None and a is not None else None,
                       'slope_after': e-d if e is not None and d is not None else None})
    return result


if __name__ == '__main__':
    paths = [ROOT / 'experiment_01b.py', ROOT / 'experiment_01.py', adapter['SOURCE']]
    paths += [p for p in ORIGINAL.rglob('*') if p.is_file()]
    hashes = {str(p): adapter['sha'](p) for p in paths}
    save('preservation.json', hashes)
    report = json.loads((ORIGINAL / 'separation/report.json').read_text())
    rate,ch,x = adapter['decode_aifc'](adapter['SOURCE'])
    events = report['events']
    slices = [x[t['start_frame']*ch:t['end_frame']*ch] for t in events]
    residuals = [v[:] for v in slices]
    tracks, details = [], []
    for index, p in enumerate(report['passes']):
        if 'template_event' not in p:
            break
        ti = p['template_event']
        template = residuals[ti][:]
        track = [0.] * len(x)
        allocations = []
        for a in p['allocations']:
            j,lag,gain = a['event'],a['lag_frames'],a['gain']
            model = algorithm['shifted'](template,len(residuals[j]),lag,ch)
            start = events[j]['start_frame']
            for k,value in enumerate(model):
                value *= gain
                track[start*ch+k] += value
                residuals[j][k] -= value
            first = start + max(0,lag)
            last = start + min(len(residuals[j])//ch, len(template)//ch+lag)
            allocations.append({'event_one_based': j+1, 'gain':gain,'lag_frames':lag,
                                'segment_start_frame': first, 'segment_end_exclusive':last})
        _,_,exported = algorithm['read_float_wav'](ORIGINAL / ('separation/component_%02d.wav'%(index+1)))
        rounded = list(struct.unpack('<'+'f'*len(track),struct.pack('<'+'f'*len(track),*track)))
        assert rounded == exported
        cuts=[]
        for a in allocations:
            for kind,key in [('start','segment_start_frame'),('end','segment_end_exclusive')]:
                f=a[key]
                cuts.append({'event':a['event_one_based'],'kind':kind,'frame':f,'seconds':f/rate,
                             'component':boundary(exported,f,ch),'original':boundary(x,f,ch)})
        # Full template chronology retained as 10 ms energy/peak measurements.
        bins=[]
        hop=round(rate*.01)*ch
        original_template=slices[ti]
        for k in range(0,len(template),hop):
            v=template[k:k+hop];orig=original_template[k:k+hop]
            removed=[a-b for a,b in zip(orig,v)]
            bins.append({'start_ms': k/ch/rate*1000,'residual_template_energy':algorithm['energy'](v),
                         'original_event_energy':algorithm['energy'](orig),
                         'previously_removed_energy':algorithm['energy'](removed),
                         'template_peak':max(map(abs,v),default=0)})
        row=next(q for q in p['comparisons'] if q['candidate']==ti)
        details.append({'component':index+1,'template_event_one_based':ti+1,
                        'template_energy':algorithm['energy'](template),
                        'selected_candidate':row,'allocations':allocations,'boundaries':cuts,
                        'export_exactly_equals_float32_replay': True,'template_bins':bins})
        tracks.append(exported)
    _,_,residual=algorithm['read_float_wav'](ORIGINAL / 'separation/residual.wav')
    errors=[value-sum(t[i] for t in tracks)-residual[i] for i,value in enumerate(x)]
    template=slices[report['passes'][0]['template_event']]
    explained,lag,gain=algorithm['fit'](template,slices[7],ch,round(rate*.005),
                                      events[7]['leading_context_frames']-events[4]['leading_context_frames'])
    save('analysis.json',{'components':details,'event8_component1_fit':{'gain':gain,'lag_frames':lag,
                          'explained_fraction':explained/algorithm['energy'](slices[7]),
                          'threshold':.65},'reconstruction':{'max_abs_error':max(map(abs,errors)),
                          'rms_error':math.sqrt(algorithm['energy'](errors)/len(errors)),
                          'tolerance':1e-6,'passes':max(map(abs,errors))<1e-6}})
    print('Replay, boundaries and reconstruction verified', flush=True)
    # Isolated diagnostic run: only Component 2's exported float32 samples enter inference.
    import importlib.util
    import argparse
    spec=importlib.util.spec_from_file_location('diagnostic_algorithm',ROOT/'experiment_01b.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.read_audio=module.read_float_wav
    module.run(argparse.Namespace(input=str(ORIGINAL/'separation/component_02.wav'),
                                 output=str(HERE/'component2-self-separation'),threshold=.015,max_lag_ms=5))
    changed=[p for p,h in hashes.items() if adapter['sha'](Path(p))!=h]
    assert not changed
    save('preservation_verified.json',{'checked_files':len(hashes),'changed':changed,
                                      'self_test_input':'component_02.wav only',
                                      'algorithm_sha256':adapter['sha'](ROOT/'experiment_01b.py')})
