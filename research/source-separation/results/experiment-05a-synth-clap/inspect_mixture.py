"""Mixture-only structure inventory, no separation or reference recordings."""
import importlib.util,json,statistics,time
from pathlib import Path
P=Path(__file__).resolve().parent;R=P.parents[1]
s=importlib.util.spec_from_file_location('c_5a_inventory',R/'diagnostic_04c/analysis.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
t=time.perf_counter();rate,ch,x=c.p.decode_aifc(R/'audio/MajorsawwackClap.aif');channels=[x[i::ch] for i in range(ch)];frames,strongest=c.frame_analysis(channels,rate);cycles,level=c.extract_cycles(channels,rate,frames,strongest)
families,assign,comparisons=c.cluster(cycles,c.POLICY['family_shape_min'])
r={'rate':rate,'channels':ch,'frames':frames,'cycles':cycles,'level':level,'reference_channel':strongest,'families':[{'family':v['family'],'status':v['status'],'prototype_cycle':v['prototype']['cycle'],'shape':v['prototype']['shape'],'occurrences':v['occurrences']} for v in families],'assignments':assign,'elapsed_seconds':time.perf_counter()-t}
with (P/'mixture-inventory.json').open('x') as f:json.dump(r,f,indent=2)
print({'elapsed':r['elapsed_seconds'],'reliable':sum(v['reliable'] for v in cycles),'candidates':len(cycles),'families':[(v['family'],v['status'],len(v['occurrences'])) for v in families],'confident_frames':sum(v['periodicity']>=.9 for v in frames)})
