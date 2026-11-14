"""Two compact figures and supplementary timing/edge checks for 4M only."""
import json,math,time,statistics
from pathlib import Path
import analyze as a
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def run():
 begin=time.perf_counter();r=json.loads((HERE/'report.json').read_text());h=a.load('i_extra',ROOT/'results/experiment-04i-cycle-trace/analyze.py');io=h.io
 B=ROOT/'results/experiment-04l-boundary-periodicity/4l-final';rate,ch,x=io.read_export(B/'original_reference.wav');_,_,y=io.read_export(B/'reconstructed.wav');_,_,res=io.read_export(B/'residual.wav');d=json.loads((ROOT/'results/experiment-04c-majorsaw-shapes/report.json').read_text());cy={v['cycle']:v for v in d['cycles']}
 evidence=[]
 for k in [491,535,428,685]:
  row=cy[k];following=cy[k+1];previous=cy[k-1];edges=[h.sharp_edge(x,ch,v['start_frame'],v['end_frame']) for v in [previous,row,following]]
  spans=[edges[i+1]['fractional_frame']-edges[i]['fractional_frame'] for i in range(2)]
  evidence.append({'cycle':k,'crossing_duration_frames':row['end_frame']-row['start_frame'],'following_crossing_duration_frames':following['end_frame']-following['start_frame'],'crossing_period_change':abs((following['end_frame']-following['start_frame'])/(row['end_frame']-row['start_frame'])-1),'sharp_edge_intervals_frames':spans,'sharp_edge_interval_change':abs(spans[1]/spans[0]-1),'caveat':'Maximum-slope parabolic proxy; not physical edge ground truth.'})
 n=r['notes'][1];energy={'join_zone':0.,'central_shape_zone':0.,'within_2_samples_of_sharp_edge':0.}
 for v in n['cycles']:
  if not v['accepted']:continue
  row=cy[v['cycle']];edge=h.sharp_edge(x,ch,row['start_frame'],row['end_frame']);width=min(rate*.0005,(row['end_frame']-row['start_frame'])*.15)
  for f in range(v['sample_start'],v['sample_end_exclusive']):
   e=sum(res[f*ch+c]**2 for c in range(ch));local=f-row['start_frame'];energy['join_zone' if local<width or row['end_frame']-f<width else 'central_shape_zone']+=e
   if abs(f-edge['frame'])<=2:energy['within_2_samples_of_sharp_edge']+=e
 # Residual data never enters target recognition: confirm concrete example of rejected cycle serving as reliable neighbor.
 rejected_neighbor_examples=[]
 for note in r['notes']:
  local={v['cycle']:v for v in note['cycles']}
  for v in note['cycles']:
   dec=v.get('recognition_decision') or {}
   for neighbor in dec.get('neighbors',[]):
    other=local.get(neighbor['cycle'])
    if other and not other['accepted']:
     rejected_neighbor_examples.append({'target_cycle':v['cycle'],'neighbor_cycle':other['cycle'],'neighbor_reliable':other['reliable'],'neighbor_decision':other['recognition_decision'],'side':neighbor['side']})
 supplement={'period_evidence':evidence,'seventh_rendered_error_partition':energy,'rejected_but_reliable_neighbor_examples':rejected_neighbor_examples,'supplement_analysis_seconds':time.perf_counter()-begin}
 with (HERE/'supplement.json').open('x') as f:json.dump(supplement,f,indent=2)
 charts=a.load('plots_m',ROOT/'diagnostic_04c/plots.py')
 for label,first,last in [('beginning',66145,66310),('interior-gap',68100,68320)]:
  body=f'<text x="80" y="35" font-size="23">4M: seventh region — {label}</text>'
  for row in n['cycles']:
   left=max(first,row['start_frame_fractional']);right=min(last,row['end_frame_fractional'])
   if right<=left:continue
   xx=90+(left-first)/(last-first)*920
   if not row['accepted']:body+=f'<rect x="{xx:.3f}" y="120" width="{(right-left)/(last-first)*920:.3f}" height="230" fill="#ffe0d8"/>'
   if first<=row['start_frame_fractional']<last:body+=f'<path d="M {xx:.3f} 115 V 355" stroke="#666" stroke-dasharray="3 3"/><text x="{xx+3:.3f}" y="102" font-size="12">{row["cycle"]}</text>'
  series=[(name,[(f-first,values[f*ch]) for f in range(first,last)]) for name,values in [('Original',x),('4L',y),('Residual',res)]]
  body+=charts.chart(90,120,920,230,series,last-first,-.15,.15,'Sample offset (44,100 frames/second)','Amplitude',f'Absolute frames [{first}, {last}); channel 1; no decimation')
  body+='<text x="90" y="465" font-size="13">Dashed lines: fractional detected boundaries; IDs above. Shading: rejected support. Lines use every sample.</text>'
  charts.save_svg(HERE/(label+'.svg'),'4M '+label,'Sample-accurate original, unchanged 4L reconstruction, residual and detected boundaries.',body,500)
 print(json.dumps(supplement,indent=2))
if __name__=='__main__':run()
