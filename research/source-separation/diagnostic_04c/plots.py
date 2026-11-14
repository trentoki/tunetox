"""Standalone SVG figures from saved results; no inference or audio writes."""
import argparse
import html
import json
import math
from pathlib import Path
import statistics

COLORS=['#125da8','#b44c13','#6845a1','#177b55','#bd3972']

def chart(x,y,width,height,series,xmax,ymin,ymax,xlabel,ylabel,title):
    out=[f'<text x="{x}" y="{y-40}" font-size="22" font-weight="600">{html.escape(title)}</text>']
    for i in range(6):
        fraction=i/5;xx=x+fraction*width;yy=y+height-fraction*height
        out.extend([f'<line x1="{xx}" x2="{xx}" y1="{y}" y2="{y+height}" stroke="#dde2e8"/>',
                    f'<line x1="{x}" x2="{x+width}" y1="{yy}" y2="{yy}" stroke="#dde2e8"/>',
                    f'<text x="{xx}" y="{y+height+26}" text-anchor="middle" font-size="14">{fraction*xmax:.2g}</text>',
                    f'<text x="{x-12}" y="{yy+5}" text-anchor="end" font-size="14">{ymin+fraction*(ymax-ymin):.2g}</text>'])
    for index,(label,points) in enumerate(series):
        coords=' '.join(f'{x+a/xmax*width:.2f},{y+height-(b-ymin)/(ymax-ymin)*height:.2f}' for a,b in points)
        out.append(f'<polyline points="{coords}" fill="none" stroke="{COLORS[index%len(COLORS)]}" stroke-width="2.3"/>')
        lx=x+(index%3)*300;ly=y+height+72+(index//3)*25
        out.append(f'<line x1="{lx}" x2="{lx+25}" y1="{ly-5}" y2="{ly-5}" stroke="{COLORS[index%len(COLORS)]}" stroke-width="3"/><text x="{lx+32}" y="{ly}" font-size="15">{html.escape(label)}</text>')
    out.extend([f'<text x="{x+width/2}" y="{y+height+49}" text-anchor="middle" font-size="16">{html.escape(xlabel)}</text>',
                f'<text x="{x}" y="{y-13}" font-size="15">{html.escape(ylabel)}</text>'])
    return '\n'.join(out)


def save_svg(path,title,description,body,height=1000):
    text=f'<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="{height}" viewBox="0 0 1100 {height}" role="img" aria-labelledby="title desc"><title id="title">{html.escape(title)}</title><desc id="desc">{html.escape(description)}</desc><rect width="1100" height="{height}" fill="white"/><g font-family="system-ui, sans-serif" fill="#202c38">{body}</g></svg>'
    with path.open('x') as f:f.write(text)


def run(path):
    root=Path(path);r=json.loads((root/'report.json').read_text());cycles={c['cycle']:c for c in r['cycles']}
    choices=[]
    ordered=sorted([v for v in r['regions'] if v['cycle_ids']],key=lambda v:v['f0_median_hz'])
    for i in (0,len(ordered)//2,len(ordered)-1):
        region=ordered[i];row=cycles[region['cycle_ids'][len(region['cycle_ids'])//2]]
        choices.append((f"Region {region['region']}: {row['frequency_hz']:.1f} Hz",[(j/64,v) for j,v in enumerate(row['shape'][:64])]))
    bounds=[b for label,pts in choices for a,b in pts];padding=.1*(max(bounds)-min(bounds))
    body='<text x="80" y="36" font-size="25" font-weight="700">Experiment 4C — observed cycle geometry</text>'
    body+=chart(90,120,920,250,choices,1,min(bounds)-padding,max(bounds)+padding,'Normalized cycle position (0–1)','Amplitude / joint stereo RMS','Representative cycles at different frequencies')
    fam=[]
    for f in r['families']:
        if f['status']!='recurring':continue
        row=cycles[f['prototype_cycle']]
        fam.append((f"Family {f['family']}: {len(f['occurrences'])} cycles",[(j/64,v) for j,v in enumerate(row['shape'][:64])]))
    bounds=[b for label,pts in fam for a,b in pts];padding=.1*(max(bounds)-min(bounds))
    body+=chart(90,610,920,250,fam,1,min(bounds)-padding,max(bounds)+padding,'Normalized cycle position (0–1)','Amplitude / joint stereo RMS','Recurring family exemplars — small splits remain uncertain')
    body+='<text x="90" y="985" font-size="14">Reference channel only; full stereo signatures, phase anchors and raw amplitudes remain in report.json.</text>'
    save_svg(root/'shapes.svg','Normalized shapes across frequency and families','Two line charts comparing observed normalized cycle shapes at different frequencies and recurring family exemplars.',body,1010)
    # Aggregate 20ms bins for timeline recognition counts; no audio reassignment.
    assigned={a['cycle']:a for a in r['assignments']};bins={}
    for row in r['cycles']:
        t=(row['start_seconds']+row['end_seconds'])/2;k=int(t/.02)
        key='recognized' if assigned[row['cycle']]['status']=='assigned' else 'ambiguous' if assigned[row['cycle']]['status']=='ambiguous' else 'unreliable/provisional'
        bins.setdefault(k,{}).setdefault(key,0);bins[k][key]+=1
    categories=['recognized','ambiguous','unreliable/provisional']
    series=[(key,[(k*.02+.01,v.get(key,0)) for k,v in sorted(bins.items())]) for key in categories]
    top=max(b for label,pts in series for a,b in pts)*1.1
    body='<text x="80" y="36" font-size="25" font-weight="700">Experiment 4C — occurrence and amplitude evidence</text>'
    body+=chart(90,120,920,250,series,6,0,top,'Original recording time (seconds)','Cycle count per 20 ms bin','Recognized, ambiguous and unmodeled cycle candidates')
    # Absolute 5ms RMS curves and per-cycle peaks, binned to avoid 2500-point plots.
    peakbins={};rmsbins={}
    for row in r['cycles']:
        if not row['reliable']:continue
        k=int((row['start_seconds']+row['end_seconds'])/.04)
        peakbins.setdefault(k,[]).append(row['absolute_peak']);rmsbins.setdefault(k,[]).append(row['absolute_rms'])
    series=[('Median cycle peak',[(k*.02+.01,statistics.median(v)) for k,v in sorted(peakbins.items())]),
            ('Median cycle RMS',[(k*.02+.01,statistics.median(v)) for k,v in sorted(rmsbins.items())])]
    top=max(b for label,pts in series for a,b in pts)*1.1
    body+=chart(90,610,920,250,series,6,0,top,'Original recording time (seconds)','Absolute decoded amplitude','Peak and RMS are measured independently of normalized shape')
    body+='<text x="90" y="972" font-size="14">Lines connect observed bins; blank/silent intervals are not modeled cycles. See JSON for exact occurrence intervals.</text>'
    save_svg(root/'occurrences-and-amplitude.svg','Cycle assignments and absolute amplitude','Timeline of recognition status and absolute peak and RMS amplitude.',body,1000)
    with (root/'figures.html').open('x') as f:
        f.write('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experiment 4C figures</title><style>body{font:16px system-ui;margin:24px auto;max-width:1100px;padding:0 12px;color:#202c38}img{max-width:100%;height:auto}a{color:#125da8}</style><h1>Experiment 4C figures</h1><p>Observed shape families are hypotheses, not sound identities. No audio reassignment.</p><p><a href="README.md">Findings and uncertainty</a> · <a href="report.json">Full numerical evidence</a></p><img src="shapes.svg" alt="Normalized observed cycles across frequency and recurring family exemplars"><img src="occurrences-and-amplitude.svg" alt="Cycle recognition and absolute amplitude timelines"></html>''')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('run');args=parser.parse_args();run(args.run)
