"""5A mixture-only periodic modeling and bounded recurring-transient extraction."""
import importlib.util,math,statistics
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
n=load('frozen_n_5a',ROOT/'results/experiment-04n-robust-period/methods.py');c=n.l.c
one=load('frozen_1c_5a',ROOT/'experiment_01c.py')
POLICY={'max_event_candidates':24,'max_transient_components':4,'transient_window_max_seconds':.25,'discovery_decimation':4,'novelty_mad_multiplier':6,'minimum_periodic_run_cycles':3,'maximum_prediction_seconds':.1,'prediction_presence_min_windows':3}

def event_candidates(values,channels,rate):
 """2-ms stereo power, 8-ms smoothed energy-rise and 6-MAD novelty."""
 hop=round(rate*.002);frames=len(values)//channels
 power=[sum(v*v for v in values[a*channels:min(a+hop,frames)*channels])/((min(a+hop,frames)-a)*channels) for a in range(0,frames,hop)]
 envelope=[math.sqrt(statistics.mean(power[max(0,i-1):min(len(power),i+3)])) for i in range(len(power))]
 rise=[max(0,v-(envelope[i-4] if i>=4 else 0)) for i,v in enumerate(envelope)];median=statistics.median(rise);mad=statistics.median(abs(v-median) for v in rise);cut=max(median+POLICY['novelty_mad_multiplier']*mad,.04*max(envelope))
 candidates=[i for i,v in enumerate(rise) if v>cut and v==max(rise[max(0,i-6):min(len(rise),i+7)])]
 # Bound work by strength; the count is never a source/event-count prior.
 ordered=sorted(candidates,key=lambda i:-rise[i])[:POLICY['max_event_candidates']];ordered.sort()
 return [{'event':j,'novelty_peak_frame':i*hop,'start_frame':max(0,(i-3)*hop),'time_seconds':max(0,(i-3)*hop)/rate,'energy_rise':rise[i]} for j,i in enumerate(ordered)],{'hop_frames':hop,'smooth_frames':4*hop,'difference_frames':4*hop,'threshold':cut,'uncapped_candidate_count':len(candidates),'candidate_cap_reached':len(candidates)>len(ordered),'envelope':envelope,'rise':rise}

def periodic(discovery,original,rate,channels):
 audio=[original[k::channels] for k in range(channels)];families=[{'family':v['family'],'status':v['status'],'prototype_cycle':v['prototype_cycle'],'signature_shape_64_per_channel':v['shape']} for v in discovery['families']]
 oldcycles={v['cycle']:v for v in discovery['cycles']};allow,relations=n.h.f.related_pairs(families,oldcycles,discovery['assignments']);quiet=n.l.silence_intervals(original,channels,rate)
 adapted={'sample_rate':rate,'reference_channel_zero_based':discovery['reference_channel'],'frames':discovery['frames'],'cycles':discovery['cycles']};bounds=n.l.boundaries(adapted,quiet);rows,changes,probes=n.l.adjust_periodicity(adapted,audio,bounds,quiet);cycles={v['cycle']:v for v in rows};assign={v['cycle']:v for v in discovery['assignments']};lookup={v['family']:v for v in families}
 for row in rows:
  if row['reliable'] and not oldcycles[row['cycle']]['reliable']:assign[row['cycle']]=n.l.frozen_assignment(row,families)
 neighbors=n.h.temporal_neighbors(cycles);onset=n.l.first_cycles_after_silence(cycles,quiet,rate);n.h.choose=n.make_choose(bounds,quiet);choices={};decisions=[]
 for row in rows:
  k=row['cycle'];assignment=assign[k];family=None;detail={}
  if row['reliable'] and row['periodicity']>=.9 and row['period_error_fraction']<=.05:
   if assignment['status']=='assigned':family=assignment['family']
   elif assignment['status']=='ambiguous':family,detail=n.l.choose(row,assignment,cycles,lookup,allow,neighbors,onset)
  if family is not None and lookup[family]['status']=='recurring':choices[k]=family
  decisions.append({'cycle':k,'supported_family':family,'evidence':detail})
 # Related render families form connected hypotheses, not forced identities.
 parent={v['family']:v['family'] for v in families if v['status']=='recurring'}
 def find(i):
  while parent[i]!=i:i=parent[i]
  return i
 for a,b in allow:
  ra,rb=find(a),find(b);parent[rb]=ra
 groups={}
 for k,family in choices.items():groups.setdefault(find(family),[]).append(k)
 retained=[];rejected=[]
 for group,ids in groups.items():
  ids.sort(key=lambda k:cycles[k]['start_frame']);run=[];stable=False
  for k in ids:
   row=cycles[k]
   if run:
    prev=cycles[run[-1]];gap=row['start_frame']-prev['end_frame'];period=row['end_frame']-row['start_frame']
    if gap/period>.1 or abs((prev['end_frame']-prev['start_frame'])/period-1)>.02 or max(row['signature_rms_scale'],prev['signature_rms_scale'])/min(row['signature_rms_scale'],prev['signature_rms_scale'])>1.2:run=[]
   run.append(k)
   if len(run)>=POLICY['minimum_periodic_run_cycles']:stable=True
  (retained if stable else rejected).append({'group':group,'cycle_ids':ids,'family_ids':sorted(set(choices[k] for k in ids))})
 # Reuse existing 4F 256-position sampler, learned from mixture exemplars only.
 sample,models=n.h.f.make_sampler('linear256',families,cycles,audio,c.p.interpolate)
 tracks=[];metas=[]
 for group in retained:
  occurrences=[{**cycles[k],'family':choices[k],'status':'assigned','provenance':'direct mixture-shape recognition'} for k in group['cycle_ids']];occurrences.sort(key=lambda v:v['start_frame']);direct=list(occurrences);inferred=[];proposals=[]
  for index,(left,right) in enumerate(zip(direct,direct[1:])):
   gap=right['start_frame']-left['end_frame'];period=left['end_frame']-left['start_frame']
   if gap<=1e-8 or gap/rate>POLICY['maximum_prediction_seconds'] or index<2 or index+3>=len(direct):continue
   flanks=direct[index-2:index+1]+direct[index+1:index+4];periods=[v['end_frame']-v['start_frame'] for v in flanks];median=statistics.median(periods);count=round(gap/median)
   if count<1 or abs(gap/count/median-1)>.02 or max(periods)/min(periods)>1.02:continue
   if any(a<right['start_frame'] and z>left['end_frame'] for a,z in quiet):continue
   if any(v['bracket_frames'][0]<right['start_frame'] and v['bracket_frames'][1]>left['end_frame'] for v in bounds):continue
   scales=[v['signature_rms_scale'] for v in flanks]
   if max(scales)/min(scales)>1.2:continue
   if any(n.h.g.bounded_phase_similarity(a['shape'],b['shape'])['similarity']<.995 for a,b in zip(flanks,flanks[1:])):continue
   if any((b['start_frame']-a['end_frame'])/(a['end_frame']-a['start_frame'])>.1 for side in [flanks[:3],flanks[3:]] for a,b in zip(side,side[1:])):continue
   proposal=[]
   for j in range(count):
    u=(j+.5)/count;proposal.append({'cycle':-(len(inferred)+j+1),'start_frame':left['end_frame']+j*gap/count,'end_frame':left['end_frame']+(j+1)*gap/count,'family':left['family'],'status':'assigned','reliable':True,'signature_rms_scale':left['signature_rms_scale']*(1-u)+right['signature_rms_scale']*u,'channel_offsets':[a*(1-u)+b*u for a,b in zip(left['channel_offsets'],right['channel_offsets'])],'provenance':'provisional flank-interpolated periodic estimate'})
   first=math.floor(proposal[0]['start_frame']);end=math.ceil(proposal[-1]['end_frame']);local=[{**v,'start_frame':v['start_frame']-first,'end_frame':v['end_frame']-first} for v in proposal]
   model,_,_,_=n.l.j.render.synthesize(families,local,end-first,channels,rate,sample)
   evidence=one.presence(model,original[first*channels:end*channels],channels,0,round(rate*.004));proposals.append({'start_frame':first,'end_frame':end,'cycle_count':count,'presence':evidence,'accepted':evidence['present']})
   if evidence['present']:inferred.extend(proposal)
  y,mask,bridge,meta=n.l.j.render.synthesize(families,direct+inferred,len(original)//channels,channels,rate,sample)
  tracks.append(y);metas.append({**group,'direct_cycles':len(direct),'inferred_cycles':len(inferred),'inferred_occurrences':inferred,'proposals':proposals,'modeled_frames':sum(mask),'accepted_runs':meta['accepted_runs'],'model':'mixture-learned 256-position exemplars; frozen Hermite joins'})
 return tracks,{'groups':metas,'unsupported_periodic_groups':rejected,'related_pairs':relations,'boundaries':bounds,'quiet_intervals':quiet,'periodicity_metadata_updates':len(changes),'periodicity_probes':probes,'recognition_decisions':decisions,'models':models}

def decimate(values,channels,factor=4):
 frames=len(values)//channels
 return [sum(values[(f+j)*channels+c] for j in range(min(factor,frames-f)))/min(factor,frames-f) for f in range(0,frames,factor) for c in range(channels)]

def transients(remainder,original,rate,channels,events):
 """1C recurrence on bounded candidate intervals; full-rate final fitting/export."""
 frames=len(remainder)//channels;windows=[]
 for i,event in enumerate(events):
  a=event['start_frame'];z=min(frames,a+round(rate*POLICY['transient_window_max_seconds']),events[i+1]['start_frame'] if i+1<len(events) else frames)
  if z-a<round(rate*.012):continue
  windows.append({**event,'end_frame':z})
 residuals=[remainder[v['start_frame']*channels:v['end_frame']*channels] for v in windows];original_energies=[one.energy(v) for v in residuals];tracks=[];details=[]
 for iteration in range(POLICY['max_transient_components']):
  small=[decimate(v,channels) for v in residuals]
  best,comparisons=one.discover(small,channels,round(rate/4*.005),original_energies=[v/4 for v in original_energies],input_energy=one.energy(original)/4,window_frames=round(rate/4*.004))
  if best is None:details.append({'stop':'No recurring candidate','comparisons':comparisons});break
  _,index,fits,members=best;template=residuals[index][:];track=[0.]*len(remainder);allocations=[]
  for j in members:
   center=fits[j][1]*4;explained,lag,gain=one.fit(template,residuals[j],channels,4,center);evidence=one.presence(template,residuals[j],channels,lag,round(rate*.004))
   if not evidence['present']:continue
   model=one.shifted(template,len(residuals[j]),lag,channels);start=windows[j]['start_frame']*channels
   for k,v in enumerate(model):track[start+k]+=gain*v;residuals[j][k]-=gain*v
   allocations.append({'event':windows[j]['event'],'start_seconds':windows[j]['start_frame']/rate,'lag_frames':lag,'gain':gain,'presence':evidence})
  if len(allocations)<2:details.append({'stop':'Coarse recurrence failed full-rate verification','comparisons':comparisons,'allocations':allocations});break
  if one.energy(track)<one.energy(original)*1e-5:break
  tracks.append(track);details.append({'template_event':windows[index]['event'],'template_start_frame':windows[index]['start_frame'],'template_end_frame':windows[index]['end_frame'],'allocations':allocations,'comparisons':comparisons,'confidence':'Waveform recurrence only; residual-template purity unproven'})
 return tracks,{'event_windows':windows,'passes':details,'limitations':'Whole observed residual events may contain periodic leakage; no ground-truth template or automatic identity label.'}
