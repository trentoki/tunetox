"""Three measured comparisons only; no new waveform processing or audio output."""
import importlib.util
import json
from pathlib import Path
import math
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def run():
    r=json.loads((HERE/'report.json').read_text());charts=load('charts',ROOT/'diagnostic_04c/plots.py');io=load('wav_io',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py')
    source=ROOT/'results/experiment-04j-independent/a-target-phase';wave={name:io.read_export(source/file) for name,file in [('Original','original_reference.wav'),('4J-A','reconstructed.wav'),('Residual','residual.wav')]}
    rate=44100;channels=2;views=[]
    for window in r['sampled_regions'][:3]:
        a=math.floor(window['start_seconds']*rate);z=round(window['end_seconds']*rate);series=[]
        for name,(_,_,values) in wave.items():series.append((name,[((i-a)/rate,values[i*channels]) for i in range(a,z)]))
        top=max(abs(v) for name,points in series for t,v in points)*1.15;body=f'<text x="80" y="35" font-size="24" font-weight="700">4K — {window["label"]}</text>'
        for row in window['cycles']:
            if row['rendered']:continue
            left=max(a,math.ceil(row['start_seconds']*rate));right=min(z,math.ceil(row['end_seconds']*rate))
            if right<=left:continue
            color='#fff0c8' if row['stage']=='detection_reliability_rejection' else '#dae8f7'
            body+=f'<rect x="{90+(left-a)/(z-a)*920:.2f}" y="120" width="{(right-left)/(z-a)*920:.2f}" height="230" fill="{color}"/>'
        body+=charts.chart(90,120,920,230,series,(z-a)/rate,-top,top,'Seconds from window start','Decoded amplitude',f'Original time {a/rate:.6f}–{z/rate:.6f} s')
        body+='<text x="90" y="475" font-size="14">Yellow: unreliable detection/periodicity. Blue shade: later recognition/neighbor rejection. No audio was changed.</text>'
        name=window['label'];path=HERE/(name+'.svg');charts.save_svg(path,'4K '+name,'Measured original/reconstructed/residual with omitted-cycle classifications.',body,510)
        svg=path.read_text().replace('id="title"',f'id="{name}-title"').replace('id="desc"',f'id="{name}-desc"').replace('aria-labelledby="title desc"',f'aria-labelledby="{name}-title {name}-desc"')
        views.append(svg)
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>4K selected boundary artifacts</title><style>body{font:17px/1.5 system-ui;max-width:1100px;margin:26px auto;padding:0 16px;color:#1d2b39}svg{max-width:100%;height:auto}a{color:#125da8}</style><h1>4K — three selected comparisons</h1><p>Frozen 4J-A audio. Selected attack, strongest transition gap, and one release. Shading identifies omitted support; unshaded residual is error within rendered cycles. This is a spot check, not a whole-recording audit.</p><p><a href="README.md">Concise findings and single recommendation</a> · <a href="report.json">Measurements</a></p>'''+''.join(views)+'''<p>No recognition or synthesis changed. SVG syntax/geometry checked; browser preview and new listening not performed.</p></html>'''
    with (HERE/'waveforms.html').open('x') as f:f.write(page)

if __name__=='__main__':run()
