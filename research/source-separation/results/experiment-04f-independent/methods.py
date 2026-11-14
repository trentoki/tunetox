"""Independent 4F methods; A changes only sampling, B changes only render eligibility."""
import cmath
import math

RELATION_POLICY={'shared_ambiguities_min':3,'pair_geometry_min':.98,'pair_harmonics_min':.995,
                 'pair_phase_cycles_max':.025,'target_geometry_min':.995,'target_harmonics_min':.995,
                 'target_phase_cycles_max':.01,'target_periodicity_min':.9,
                 'target_period_error_max':.05,'neighbor_geometry_min':.995,
                 'neighbor_period_change_max':.02}


def energy(x):return sum(v*v for v in x)
def cosine(x,y):
    norm=math.sqrt(energy(x)*energy(y))
    return sum(a*b for a,b in zip(x,y))/norm if norm>1e-30 else 0.

def fundamental_phase(shape):
    return cmath.phase(sum(v*cmath.exp(-2j*math.pi*i/64) for i,v in enumerate(shape[:64])))

def phase_distance(x,y):return abs((fundamental_phase(x)-fundamental_phase(y)+math.pi)%(2*math.pi)-math.pi)/(2*math.pi)


def linear_table(values,phase):
    n=len(values);position=(phase%1)*n;i=math.floor(position);u=position-i
    a,b=values[i],values[(i+1)%n]
    return a+(b-a)*u,(b-a)*n


def cubic_table(values,phase):
    n=len(values);position=(phase%1)*n;i=math.floor(position);u=position-i
    a,b,c,d=[values[j%n] for j in [i-1,i,i+1,i+2]]
    c0=b;c1=.5*(c-a);c2=a-2.5*b+2*c-.5*d;c3=.5*(d-a)+1.5*(b-c)
    return c0+c1*u+c2*u*u+c3*u*u*u,(c1+2*c2*u+3*c3*u*u)*n


def fit_harmonics(channels,start,end,offsets,scale):
    """Real trigonometric least squares on one observed family exemplar only.

    Reorthogonalized modified Gram-Schmidt; no nonlinear frequency fit, no target
    occurrence fitting, no waveform-library priors. Keep full complex phase.
    """
    first,last=math.ceil(start),math.ceil(end);duration=end-start;n=last-first
    harmonics=min((n-1)//2,math.floor((duration-1e-7)/2))
    positions=[(i-start)/duration for i in range(first,last)]
    columns=[[1.]*n]
    for h in range(1,harmonics+1):
        columns.extend([[math.cos(2*math.pi*h*u) for u in positions],[math.sin(2*math.pi*h*u) for u in positions]])
    size=len(columns);q=[];matrix=[[0.]*size for i in range(size)];diagonal=[]
    for j,column in enumerate(columns):
        v=column[:]
        for _ in range(2):
            for i,orthogonal in enumerate(q):
                projection=sum(a*b for a,b in zip(v,orthogonal));matrix[i][j]+=projection
                v=[a-projection*b for a,b in zip(v,orthogonal)]
        norm=math.sqrt(energy(v))
        if norm<1e-8:raise ValueError('Ill-conditioned exemplar harmonic basis')
        matrix[j][j]=norm;diagonal.append(norm);q.append([a/norm for a in v])
    coefficients=[];errors=[]
    for channel,values in enumerate(channels):
        observed=[(values[i]-offsets[channel])/scale for i in range(first,last)]
        rhs=[sum(a*b for a,b in zip(observed,v)) for v in q];coef=[0.]*size
        for j in range(size-1,-1,-1):
            coef[j]=(rhs[j]-sum(matrix[j][k]*coef[k] for k in range(j+1,size)))/matrix[j][j]
        error=sum((observed[i]-sum(coef[j]*columns[j][i] for j in range(size)))**2 for i in range(n))
        coefficients.append(coef);errors.append(math.sqrt(error/n))
    return {'coefficients':coefficients,'maximum_harmonic':harmonics,'native_samples':n,
            'qr_diagonal_ratio':min(diagonal)/max(diagonal),'normalized_exemplar_fit_rmse':errors}


def harmonic_value(coefficients,phase,maximum):
    theta=2*math.pi*(phase%1);c,s=math.cos(theta),math.sin(theta);ch,sh=1.,0.;value=coefficients[0];slope=0.
    for h in range(1,min(maximum,(len(coefficients)-1)//2)+1):
        ch,sh=ch*c-sh*s,sh*c+ch*s
        a,b=coefficients[2*h-1:2*h+1];value+=a*ch+b*sh;slope+=2*math.pi*h*(-a*sh+b*ch)
    return value,slope


def make_sampler(mode,families,cycles,original_channels,interpolate):
    """A-only preparation. Every occurrence reuses a family-level model."""
    models={};by_shape={}
    for family in families:
        if family['status']!='recurring':continue
        row=cycles[family['prototype_cycle']];shape=family['signature_shape_64_per_channel']
        by_shape[id(shape)]=family['family']
        if mode=='cubic64':models[family['family']]={'tables':[shape[c*64:(c+1)*64] for c in range(len(original_channels))]}
        elif mode=='linear256':
            tables=[[(interpolate(ch,row['start_frame']+(row['end_frame']-row['start_frame'])*i/256)-row['channel_offsets'][c])/row['signature_rms_scale'] for i in range(256)] for c,ch in enumerate(original_channels)]
            models[family['family']]={'tables':tables}
        elif mode=='harmonic':models[family['family']]=fit_harmonics(original_channels,row['start_frame'],row['end_frame'],row['channel_offsets'],row['signature_rms_scale'])
        else:raise ValueError('Unknown A mode')
    def sample(shape,channel,phase,scale,offset,duration):
        model=models[by_shape[id(shape)]]
        if mode=='harmonic':
            # Target-period Nyquist cap, independent of note labels or scale.
            value,slope=harmonic_value(model['coefficients'][channel],phase,min(model['maximum_harmonic'],max(0,math.floor((duration-1e-7)/2))))
        else:value,slope=(cubic_table if mode=='cubic64' else linear_table)(model['tables'][channel],phase)
        return value*scale+offset,slope*scale/duration
    return sample,models


def related_pairs(families,cycles,assignments):
    candidates={};details=[]
    for row in assignments:
        if row['status']!='ambiguous':continue
        ids=[v['family'] for v in row['candidates']]
        for i,left in enumerate(ids):
            for right in ids[i+1:]:
                pair=tuple(sorted([left,right]));candidates[pair]=candidates.get(pair,0)+1
    lookup={f['family']:f for f in families};allowed=set()
    for pair,count in candidates.items():
        f,g=[lookup[i] for i in pair];x,y=[cycles[v['prototype_cycle']] for v in [f,g]]
        score=cosine(x['shape'],y['shape']);harm=cosine(x['harmonics'],y['harmonics']);phase=phase_distance(x['shape'],y['shape'])
        qualifies=(count>=RELATION_POLICY['shared_ambiguities_min'] and f['status']==g['status']=='recurring' and
                   score>=RELATION_POLICY['pair_geometry_min'] and harm>=RELATION_POLICY['pair_harmonics_min'] and phase<=RELATION_POLICY['pair_phase_cycles_max'])
        if qualifies:allowed.add(pair)
        details.append({'families':list(pair),'shared_ambiguities':count,'geometry':score,'harmonics':harm,'phase_cycles':phase,
                        'relationship_supported':qualifies,'interpretation':'Possible phase-consistent geometric variants, not merged identities.'})
    return allowed,details


def choose_related(row,assignment,cycles,families,allowed):
    """Return a render family only when local evidence passes; identity stays ambiguous."""
    reasons=[]
    if assignment['status']!='ambiguous' or not row['reliable']:return None,['not a reliable originally ambiguous cycle']
    scores=sorted(assignment['candidates'],key=lambda v:v['similarity'],reverse=True)
    if len(scores)!=2 or tuple(sorted(v['family'] for v in scores)) not in allowed:reasons.append('unsupported competing-family relationship')
    if scores[0]['similarity']<RELATION_POLICY['target_geometry_min']:reasons.append('target shape similarity too low')
    if row['periodicity']<RELATION_POLICY['target_periodicity_min'] or row['period_error_fraction']>RELATION_POLICY['target_period_error_max']:reasons.append('period confidence insufficient')
    target_family=scores[0]['family'];prototype=cycles[families[target_family]['prototype_cycle']]
    if cosine(row['harmonics'],prototype['harmonics'])<RELATION_POLICY['target_harmonics_min']:reasons.append('target harmonics mismatch')
    if phase_distance(row['shape'],prototype['shape'])>RELATION_POLICY['target_phase_cycles_max']:reasons.append('target phase mismatch')
    duration=row['end_frame']-row['start_frame']
    for offset in [-1,1]:
        neighbor=cycles.get(row['cycle']+offset)
        if neighbor is None or not neighbor['reliable']:
            reasons.append('unreliable immediate neighbor');continue
        gap=abs(row['start_frame']-neighbor['end_frame']) if offset<0 else abs(neighbor['start_frame']-row['end_frame'])
        other_duration=neighbor['end_frame']-neighbor['start_frame']
        if gap>1e-8 or abs(other_duration/duration-1)>RELATION_POLICY['neighbor_period_change_max']:
            reasons.append('neighbor period/continuity mismatch')
        if cosine(row['shape'],neighbor['shape'])<RELATION_POLICY['neighbor_geometry_min']:reasons.append('neighbor geometry unstable')
    return (None,reasons) if reasons else (target_family,[])
