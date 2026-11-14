"""Measured waveform and envelope plots; reads listening exports, never alters audio."""
import importlib.util
import json
from pathlib import Path
import math

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def run():
    model=load('four_d_io',HERE/'reconstruct.py');charts=load('prior_chart_helpers',ROOT/'diagnostic_04c/plots.py')
    report=json.loads((HERE/'report.json').read_text());discovery=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text())
    data={name:model.read_export(HERE/file)[2] for name,file in [('Original','original_reference.wav'),('Reconstructed','reconstructed.wav'),('Residual','residual.wav')]}
    rate=report['sample_rate'];channels=report['channels'];n=report['frames'];duration=n/rate
    decisions=json.loads((HERE/'occurrence-decisions.json').read_text())
    accepted=[v for v in decisions if v['status']=='assigned' and v['reliable']]
    ambiguous=[v for v in decisions if v['status']=='ambiguous']
    regions=discovery['regions']
    transition=next((right['start_seconds'] for left,right in zip(regions,regions[1:])
                     if left['end_seconds']-left['start_seconds']>.3 and right['start_seconds']-left['end_seconds']<.04),regions[len(regions)//2]['start_seconds'])
    windows=[('First modeled onset',(accepted[0]['start_frame']+accepted[0]['end_frame'])/2/rate),
             ('Ambiguous cycle remains in residual',(ambiguous[0]['start_frame']+ambiguous[0]['end_frame'])/2/rate),
             ('Detected continuing-passage transition',transition),
             ('Final modeled release / recording boundary',accepted[-1]['end_frame']/rate)]
    body='<text x="80" y="35" font-size="25" font-weight="700">Experiment 4D — original, reconstruction and residual</text>'
    for index,(label,center) in enumerate(windows):
        start=max(0,min(duration-.025,center-.0125));stop=min(duration,start+.025)
        first=math.floor(start*rate);last=math.ceil(stop*rate)
        series=[(name,[((frame-first)/rate,values[frame*channels]) for frame in range(first,last)]) for name,values in data.items()]
        top=max(abs(v) for name,points in series for t,v in points)*1.1
        body+=charts.chart(90,120+index*360,920,190,series,(last-first)/rate,-top,top,
                           'Seconds from window start','Decoded amplitude',f'{label} ({first/rate:.4f}–{last/rate:.4f} s)')
    body+='<text x="90" y="1535" font-size="14">Reference channel shown; no visual normalization. Full stereo WAVs retain the six-second original timeline.</text>'
    charts.save_svg(HERE/'waveform-comparisons.svg','4D measured waveform comparisons','Four measured original/reconstruction/residual waveform overlays at onset, ambiguity, transition and final release.',body,1560)
    step=round(rate*.01);series=[]
    for name,values in data.items():
        points=[]
        for first in range(0,n,step):
            v=values[first*channels:min(n,first+step)*channels]
            points.append((first/rate,math.sqrt(model.energy(v)/max(len(v),1))))
        series.append((name,points))
    top=max(v for name,points in series for t,v in points)*1.1
    body='<text x="80" y="35" font-size="25" font-weight="700">Experiment 4D — full-recording RMS envelopes</text>'
    body+=charts.chart(90,120,920,300,series,duration,0,top,'Original time (seconds)','Absolute 10 ms RMS','No envelope normalization; gaps remain unexplained')
    charts.save_svg(HERE/'recording-envelopes.svg','Absolute original/reconstruction/residual RMS envelopes','Measured stereo 10 ms RMS envelopes across the original six-second timeline.',body,540)
    with (HERE/'figures.html').open('x') as f:
        f.write('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experiment 4D reconstruction figures</title><style>body{font:16px system-ui;margin:24px auto;max-width:1100px;padding:0 12px;color:#202c38}img{max-width:100%;height:auto}a{color:#125da8}</style><h1>Experiment 4D reconstruction</h1><p>Measured waveform overlays and absolute RMS envelopes. Successful residual conservation does not prove reconstruction quality.</p><p><a href="reconstructed.wav">Reconstruction</a> · <a href="residual.wav">Residual</a> · <a href="original_reference.wav">Original reference</a> · <a href="README.md">Findings</a></p><img src="recording-envelopes.svg" alt="Absolute RMS envelopes of original, reconstruction and residual"><img src="waveform-comparisons.svg" alt="Measured waveform overlays around onset, ambiguity, transition and recording end"></html>''')

if __name__=='__main__':run()
