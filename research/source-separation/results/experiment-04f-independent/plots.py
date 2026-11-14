"""Measured comparisons only; saved WAVs remain unchanged."""
import importlib.util
import json
from pathlib import Path
import statistics
import math
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def run():
    charts=load('charts',ROOT/'diagnostic_04c/plots.py');io=load('io4d',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py')
    comparison=json.loads((HERE/'comparison.json').read_text());e=json.loads((ROOT/'results/experiment-04e-reconstruction-errors/report.json').read_text())
    modes=[('a-cubic64','A: cubic 64'),('a-linear256','A: linear 256'),('a-harmonic','A: harmonic fit')];reports={mode:json.loads((HERE/mode/'report.json').read_text()) for mode,label in modes}
    centers=[1000,3500,7500,12500,18525];baseline=[v for v in e['spectral_windows'] if v['region'] in [1,2,3,4,14,15]]
    series=[('4D baseline',[(center,statistics.median(v['bands'][i]['ratio_db_to_original']['reconstructed'] for v in baseline)) for i,center in enumerate(centers)])]
    for mode,label in modes:
        series.append((label,[(center,statistics.median(v['bands'][i]['reconstructed_db_to_original'] for v in reports[mode]['spectral_clean_windows'])) for i,center in enumerate(centers)]))
    body='<text x="80" y="36" font-size="25" font-weight="700">4F-A — spectral energy and waveform fidelity are different</text>'
    body+=charts.chart(90,120,920,240,series,22050,-18,2,'Band center (Hz)','Reconstruction / original band energy (dB)','Median levels in the six fixed, fully covered windows')
    series=[('4D baseline',[(v['region'],v['bands'][4]['energy']['residual']/v['bands'][4]['energy']['original']) for v in baseline])]
    for mode,label in modes[1:]:series.append((label,[(v['region'],v['bands'][4]['residual_to_original_energy_ratio']) for v in reports[mode]['spectral_clean_windows']]))
    body+=charts.chart(90,630,920,230,series,15,0,2.5,'Audio-derived region index','15–22.05 kHz error / original band energy','Highest-band error can worsen even when energy is restored')
    body+='<text x="90" y="985" font-size="14">All A curves use identical 4D cycle decisions and support. No B cycle additions are included.</text>'
    charts.save_svg(HERE/'a-spectral-tradeoffs.svg','4F-A spectral tradeoffs','Upper-frequency energy improves with richer models, but highest-band waveform error can worsen across pitches.',body,1020)
    b=json.loads((HERE/'b-related-shapes/report.json').read_text())
    series=[('4D baseline',[(v['region'],100*v['frame_coverage']) for v in e['regions']]),('4F-B related shapes',[(v['region'],100*v['coverage']) for v in b['region_metrics']])]
    body='<text x="80" y="36" font-size="25" font-weight="700">4F-B — coverage improvement with frozen 64-position synthesis</text>'
    body+=charts.chart(90,120,920,240,series,15,0,100,'Audio-derived region index','Covered time (%)','Conservative relationship evidence restores some omitted cycles')
    w=next(v for v in e['spectral_windows'] if v['region']==6);rate=44100;channels=2;start=math.floor((w['window_start_seconds']+.015)*rate);end=start+round(.02*rate)
    series=[]
    for label,path in [('Original',ROOT/'results/experiment-04d-majorsaw-reconstruction/original_reference.wav'),('4D baseline',ROOT/'results/experiment-04d-majorsaw-reconstruction/reconstructed.wav'),('4F-B',HERE/'b-related-shapes/reconstructed.wav')]:
        _,_,v=io.read_export(path);series.append((label,[((i-start)/rate,v[i*channels]) for i in range(start,end)]))
    top=max(abs(v) for label,pts in series for x,v in pts)*1.1
    body+=charts.chart(90,620,920,230,series,(end-start)/rate,-top,top,'Seconds from window start','Decoded amplitude',f'Fixed region-6 comparison at {start/rate:.4f} seconds')
    body+='<text x="90" y="975" font-size="14">B retains all original family labels and uncertainty records; only render eligibility changes. No A synthesis improvements are included.</text>'
    charts.save_svg(HERE/'b-coverage.svg','4F-B coverage and waveform comparison','Increased coverage and a measured waveform comparison using unchanged 4D interpolation.',body,1010)
    # Local listening report, no autoplay, normalization or external requests.
    rows=[]
    for mode,label in modes+[('b-related-shapes','4F-B: related shapes')]:
        r=json.loads((HERE/mode/'report.json').read_text());m=r['metrics']
        rows.append(f'<section><h2>{label}</h2><p>Coverage {100*m["coverage_fraction"]:.2f}% · Residual energy {100*m["residual_energy_ratio"]:.2f}% · Runtime {r["timings"]["total_before_report_seconds"]:.2f} s</p><p><a href="{mode}/reconstructed.wav">Reconstructed WAV</a> · <a href="{mode}/residual.wav">Residual WAV</a></p><label>Reconstructed <audio controls preload="none" src="{mode}/reconstructed.wav"></audio></label><label>Residual <audio controls preload="none" src="{mode}/residual.wav"></audio></label></section>')
    html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Independent 4F listening comparisons</title><style>body{font:16px system-ui;max-width:1100px;margin:24px auto;padding:0 14px;color:#202c38}section{margin:28px 0;padding-top:10px;border-top:1px solid #bbc6d1}audio{display:block;margin:8px 0 18px;max-width:100%}img{max-width:100%;height:auto}a{color:#125da8}</style><h1>Independent Experiment 4F comparisons</h1><p>A changes synthesis only. B changes render eligibility only. No combined variant exists. Highest-frequency energy restoration does not guarantee correct phase or waveform.</p><p><a href="README.md">Full findings</a> · <a href="../experiment-04d-majorsaw-reconstruction/original_reference.wav">Original reference</a> · <a href="../experiment-04d-majorsaw-reconstruction/reconstructed.wav">Unchanged 4D baseline</a></p>'''+''.join(rows)+'''<h2>Measured comparisons</h2><img src="a-spectral-tradeoffs.svg" alt="A spectral energy and error tradeoffs"><img src="b-coverage.svg" alt="B coverage and waveform comparison"></html>'''
    with (HERE/'listen.html').open('x') as f:f.write(html)

if __name__=='__main__':run()
