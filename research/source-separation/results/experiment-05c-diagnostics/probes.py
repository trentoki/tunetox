"""Read-only multi-period and observation-length probes for 5C."""
import math

def table_value(table,phase):
 p=(phase%1)*len(table);i=math.floor(p);u=p-i
 return table[i]*(1-u)+table[(i+1)%len(table)]*u

def periodic_probe(values,channels,rate,center,f0,tables,periods=8):
 width=min(2048,max(512,round(periods*rate/f0)));first=max(0,min(len(values)//channels-width,round(center-width/2)));x=values[first*channels:(first+width)*channels]
 normx=sum(v*v for v in x);best=None
 def fit(phase):
  model=[table_value(tables[c],f*f0/rate+phase) for f in range(width) for c in range(channels)];norm=sum(v*v for v in model);dot=sum(a*b for a,b in zip(x,model));gain=max(0,dot/max(norm,1e-30));score=dot/math.sqrt(max(norm*normx,1e-30));return {'phase':phase%1,'gain':gain,'correlation':score,'explained_energy':gain*gain*norm,'model':model}
 for i in range(64):
  row=fit(i/64)
  if best is None or row['explained_energy']>best['explained_energy']:best=row
 phase=best['phase']
 for i in range(-4,5):
  row=fit(phase+i/512)
  if row['explained_energy']>best['explained_energy']:best=row
 best.update(first_frame=first,end_frame=first+width,f0=f0)
 return best
