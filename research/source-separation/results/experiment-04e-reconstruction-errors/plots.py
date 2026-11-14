"""Static measured comparisons for 4E; no audio generation."""
import importlib.util
import json
from pathlib import Path
import statistics
import math
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def run():
    charts=load('saved_chart_helpers',ROOT/'diagnostic_04c/plots.py');io=load('frozen_wav_reader',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py')
    r=json.loads((HERE/'report.json').read_text());sp={v['region']:v for v in r['spectral_windows']}
    series=[]
    for i in [1,4,14,15]:
        series.append((f'Region {i} (100% covered window)',[(v['frequency_hz'],v['reconstructed_db_to_original']) for v in sp[i]['harmonics'] if v['reconstructed_db_to_original'] is not None]))
    body='<text x="80" y="36" font-size="25" font-weight="700">Problem 1 — high-frequency loss without missing cycles</text>'
    body+=charts.chart(90,120,920,250,series,22050,-35,2,'Audio-derived harmonic frequency (Hz)','Reconstructed / original power (dB)','Harmonics in fully modeled note interiors')
    keys=['reconstructed','individual_64_probe'];clean=[sp[i] for i in [1,2,3,4,14,15]]
    series=[]
    for key,label in zip(keys,['Saved 4D output','Own-cycle 64-position diagnostic probe']):
        points=[]
        for i in range(5):
            bands=[v['bands'][i] for v in clean]
            points.append(((bands[0]['low_hz']+bands[0]['high_hz'])/2,statistics.median(v['ratio_db_to_original'][key] for v in bands)))
        series.append((label,points))
    body+=charts.chart(90,650,920,230,series,22050,-16,1,'Band center (Hz)','Median band power / original (dB)','64-position information loss persists without family reuse')
    body+='<text x="90" y="1005" font-size="14">Across these six windows, removing bridges changes band levels by less than 0.006 dB. Probes are not new audio outputs.</text>'
    charts.save_svg(HERE/'harmonic-loss.svg','4E continuous-window harmonic loss','Measured harmonic attenuation in four fully covered windows and spectral-band comparisons across six continuous interiors.',body,1040)
    data={label:io.read_export(ROOT/'results/experiment-04d-majorsaw-reconstruction'/name)[2]
          for label,name in [('Original','original_reference.wav'),('Reconstructed','reconstructed.wav'),('Residual','residual.wav')]}
    rate=44100;channels=2
    decisions=json.loads((ROOT/'results/experiment-04d-majorsaw-reconstruction/occurrence-decisions.json').read_text());mask=bytearray(len(data['Original'])//channels)
    for row in decisions:
        if row['status']=='assigned' and row['reliable']:
            mask[math.ceil(row['start_frame']):math.ceil(row['end_frame'])]=bytes([1])*(math.ceil(row['end_frame'])-math.ceil(row['start_frame']))
    ambiguous=next(v for v in decisions if v['status']=='ambiguous' and 1.25<v['start_frame']/rate<1.4)
    windows=[('Continuous region 1 — sharp-edge detail',sp[1]['window_start_seconds']+.015,.008),
             ('Garbled region 6 — unassigned cycles shaded',ambiguous['start_frame']/rate-.004,.025)]
    body='<text x="80" y="36" font-size="25" font-weight="700">Separate waveform mechanisms</text>'
    for index,(label,start,span) in enumerate(windows):
        a=math.floor(start*rate);b=math.ceil((start+span)*rate);y=120+index*440
        if index:
            cursor=a
            while cursor<b:
                end=cursor+1
                while end<b and mask[end]==mask[cursor]:end+=1
                if not mask[cursor]:
                    xx=90+(cursor-a)/(b-a)*920;ww=(end-cursor)/(b-a)*920
                    body+=f'<rect x="{xx}" y="{y}" width="{ww}" height="230" fill="#dce2e8"/>'
                cursor=end
        series=[(label,[((frame-a)/rate,values[frame*channels]) for frame in range(a,b)]) for label,values in data.items()]
        top=max(abs(v) for label,pts in series for t,v in pts)*1.1
        body+=charts.chart(90,y,920,230,series,(b-a)/rate,-top,top,'Seconds from window start','Decoded amplitude',f'{label} ({a/rate:.4f} s)')
    body+='<text x="90" y="940" font-size="14">Upper panel: no coverage holes. Lower panel: the saved output is exactly zero on excluded cycles; residual retains original structure.</text>'
    charts.save_svg(HERE/'waveform-mechanisms.svg','4E continuous spectral loss versus omitted cycles','Original, reconstruction and residual overlays in a fully modeled window and a garbled interval with unassigned cycles shaded.',body,980)
    series=[('Modeled time coverage',[(v['region'],100*v['frame_coverage']) for v in r['regions']]),
            ('Residual / input energy',[(v['region'],100*v['residual_energy_ratio']) for v in r['regions']])]
    body='<text x="80" y="36" font-size="25" font-weight="700">Problem 2 — omissions versus accepted-cycle errors</text>'
    body+=charts.chart(90,120,920,250,series,15,0,100,'Audio-derived region index (evaluation order)','Percent','Coverage and residual across detected region supports')
    series=[('Accepted-frame error / accepted-frame input',[(v['region'],100*v['modeled_error_ratio_of_modeled_input']) for v in r['regions']])]
    body+=charts.chart(90,610,920,230,series,15,0,2,'Audio-derived region index (evaluation order)','Percent','Accepted-cycle error remains much smaller than omitted audio')
    body+='<text x="90" y="965" font-size="14">Region supports include quiet margins/releases; selected clean spectral windows are 100% covered. No MIDI timings were supplied.</text>'
    charts.save_svg(HERE/'coverage-and-error.svg','4E coverage and accepted-cycle error','Regional coverage, residual energy and accepted-cycle error.',body,1000)
    with (HERE/'figures.html').open('x') as f:
        f.write('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experiment 4E diagnostics</title><style>body{font:16px system-ui;margin:24px auto;max-width:1100px;padding:0 12px;color:#202c38}img{max-width:100%;height:auto}a{color:#125da8}</style><h1>Experiment 4E — two different reconstruction failures</h1><p>Diagnostic analysis of frozen 4D files. No changed reconstruction, thresholds or signature resolution.</p><p><a href="README.md">Findings and recommendations</a> · <a href="report.json">Numerical evidence</a></p><img src="harmonic-loss.svg" alt="High-frequency attenuation in fully covered windows"><img src="waveform-mechanisms.svg" alt="Continuous shape loss and unassigned-cycle gaps shown separately"><img src="coverage-and-error.svg" alt="Regional omission and accepted-cycle error measurements"></html>''')

if __name__=='__main__':run()
