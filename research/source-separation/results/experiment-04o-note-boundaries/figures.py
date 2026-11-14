"""Only two selected waveform comparisons; original exports read only."""
import json
from pathlib import Path
import analyze as a
P=Path(__file__).resolve().parent;R=P.parents[1]
def run():
 r=json.loads((P/'report.json').read_text());io=a.load('io_o',R/'results/experiment-04d-majorsaw-reconstruction/reconstruct.py');charts=a.load('plots_o',R/'diagnostic_04c/plots.py');base=R/'results/experiment-04n-robust-period/listening'
 wave={name:io.read_export(base/file)[2] for name,file in [('Original','original_reference.wav'),('4N','reconstructed.wav'),('Residual','residual.wav')]}
 for trace in [r['traces'][1],r['traces'][3]]:
  first,last=trace['sample_start'],trace['sample_end_exclusive'];body=f'<text x="80" y="35" font-size="24">4O — {trace["label"]}</text>'
  for row in trace['cycles']:
   if row['accepted']:continue
   left=max(first,row['start_frame']);right=min(last,row['end_frame']);x=90+(left-first)/(last-first)*920
   body+=f'<rect x="{x:.3f}" y="120" width="{(right-left)/(last-first)*920:.3f}" height="230" fill="#ffe4db"/>'
  if trace['label']=='long-transition':
   b=r['selected_transition_boundary']['frame'];x=90+(b-first)/(last-first)*920;body+=f'<path d="M {x:.3f} 100 V 360" stroke="#666" stroke-dasharray="4 4"/><text x="{x+4:.3f}" y="94" font-size="12">4L split estimate</text>'
  series=[(name,[((f-first)/44100,values[f*2]) for f in range(first,last)]) for name,values in wave.items()]
  body+=charts.chart(90,120,920,230,series,(last-first)/44100,-.23,.23,'Seconds from window start','Amplitude',f'Absolute frames [{first}, {last}); channel 1; every sample')
  body+='<text x="90" y="475" font-size="13">Shaded support: rejected candidates, not an original-signal silence. Three unchanged, aligned float32 exports.</text>'
  charts.save_svg(P/(trace['label']+'.svg'),'4O '+trace['label'],'Original, unchanged 4N reconstruction and residual. Shading marks rejected support.',body,510)
if __name__=='__main__':run()
