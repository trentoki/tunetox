"""Independent pitch-relationship diagnostics. Standard library, no 1C imports."""
import argparse
import cmath
import hashlib
import json
import math
from pathlib import Path
import statistics
import struct
import time

def decode_aifc(path):
    raw = Path(path).read_bytes()
    if raw[:4] != b'FORM' or raw[8:12] != b'AIFC':
        raise ValueError('Expected AIFC')
    position, comm, sound = 12, None, None
    while position + 8 <= len(raw):
        tag, size = struct.unpack_from('>4sI', raw, position)
        chunk = raw[position + 8:position + 8 + size]
        if len(chunk) != size:
            raise ValueError('Truncated chunk')
        if tag == b'COMM':
            comm = chunk
        if tag == b'SSND':
            sound = chunk
        position += 8 + size + size % 2
    channels, frames, bits = struct.unpack_from('>hIh', comm)
    exponent, mantissa = struct.unpack_from('>HQ', comm, 8)
    rate = math.ldexp(mantissa, (exponent & 0x7fff) - 16383 - 63)
    if exponent & 0x8000 or rate != int(rate) or rate <= 0:
        raise ValueError('Invalid rate')
    if comm[18:22] != b'fl32' or bits != 32 or channels not in (1, 2):
        raise ValueError('Expected mono/stereo big-endian float32')
    offset, block = struct.unpack_from('>II', sound)
    payload = sound[8 + offset:]
    if block != 0 or len(payload) != frames * channels * 4 or frames * channels > 4_000_000:
        raise ValueError('Unexpected sound data layout/size')
    values = list(struct.unpack('>' + 'f' * (frames * channels), payload))
    if not all(map(math.isfinite, values)):
        raise ValueError('Nonfinite input')
    return int(rate), channels, values


def fft(values, inverse=False):
    """Radix-2 FFT, diagnostic only."""
    n=len(values)
    if n==0 or n & (n-1): raise ValueError('FFT size must be power of two')
    out=[complex(v) for v in values];j=0
    for i in range(1,n):
        bit=n>>1
        while j & bit: j^=bit;bit>>=1
        j^=bit
        if i<j: out[i],out[j]=out[j],out[i]
    width=2
    while width<=n:
        root=cmath.exp((2j if inverse else -2j)*math.pi/width)
        for start in range(0,n,width):
            phase=1+0j
            for k in range(width//2):
                u=out[start+k];v=phase*out[start+k+width//2]
                out[start+k]=u+v;out[start+k+width//2]=u-v;phase*=root
        width*=2
    return [v/n for v in out] if inverse else out


def energy(x): return sum(v*v for v in x)

def cosine(x,y,center=False):
    if center:
        ax=sum(x)/len(x);ay=sum(y)/len(y);x=[v-ax for v in x];y=[v-ay for v in y]
    norm=math.sqrt(energy(x)*energy(y))
    return sum(a*b for a,b in zip(x,y))/norm if norm>1e-30 else None


def pitch(values,rate):
    # Four-sample box low-pass before decimation; not a strong anti-alias filter.
    x=[sum(values[i:i+4])/4 for i in range(0,len(values)-3,4)]
    mean=sum(x)/len(x);x=[v-mean for v in x]
    size=1
    while size<2*len(x):size*=2
    transform=fft(x+[0.]*(size-len(x)))
    ac=fft([v*v.conjugate() for v in transform],True)
    lo=max(2,int(rate/4/2000));hi=min(len(x)//2,int(rate/4/60))
    prefix=[0.]
    for v in x:prefix.append(prefix[-1]+v*v)
    corr={lag:ac[lag].real/math.sqrt(max((prefix[-1]-prefix[lag])*prefix[-lag-1],1e-30))
          for lag in range(lo-1,hi+2)}
    peaks=[k for k in range(lo,hi+1) if corr[k]>corr[k-1] and corr[k]>=corr[k+1]]
    if not peaks:return None,0.
    maximum=max(corr[k] for k in peaks)
    eligible=[k for k in peaks if corr[k]>=max(.6,.9*maximum)]
    if not eligible:return None,maximum
    k=eligible[0];den=corr[k-1]-2*corr[k]+corr[k+1]
    delta=.5*(corr[k-1]-corr[k+1])/den if den else 0
    return rate/4/(k+max(-.5,min(.5,delta))),corr[k]


def spectrum(values,size=4096):
    n=len(values);window=[v*(.5-.5*math.cos(2*math.pi*i/(n-1))) for i,v in enumerate(values)]
    return [abs(v)**2 for v in fft(window+[0.]*(size-n))[:size//2+1]]


def spectral_features(power,f0,rate):
    hz=rate/(2*(len(power)-1));harm=[]
    for h in range(1,13):
        k=round(h*f0/hz);radius=max(1,round(.04*f0/hz))
        harm.append(math.sqrt(sum(power[max(0,k-radius):min(len(power),k+radius+1)])))
    # Smooth log power over a width derived from f0, then sample absolute-Hz bands.
    logs=[math.log(max(v,1e-20)) for v in power];prefix=[0.]
    for v in logs:prefix.append(prefix[-1]+v)
    radius=max(1,round(f0/hz));envelope=[]
    for i in range(24):
        frequency=100*(100**(i/23));k=round(frequency/hz)
        a=max(0,k-radius);b=min(len(power),k+radius+1)
        envelope.append((prefix[b]-prefix[a])/(b-a))
    return harm,envelope


def regions_from_frames(frames,rate,hop):
    groups=[];current=[]
    for frame in frames:
        if frame['f0'] is None:
            if current:groups.append(current);current=[]
            continue
        if current and (frame['frame']-current[-1]['frame']>hop*1.5 or
                abs(1200*math.log2(frame['f0']/statistics.median(v['f0'] for v in current)))>70):
            groups.append(current);current=[]
        current.append(frame)
    if current:groups.append(current)
    return [g for g in groups if len(g)>=6]


def interpolate(values,position):
    i=math.floor(position);fraction=position-i
    if i<0 or i+1>=len(values):return 0.
    return values[i]*(1-fraction)+values[i+1]*fraction


def waveform_compare(channels,left,right,rate,scaled):
    n=512;cycles=8
    duration=cycles/left['f0']
    start_left=left['center']-duration*rate/2
    x=[interpolate(ch,start_left+i*duration*rate/n) for i in range(n) for ch in channels]
    target_duration=cycles/right['f0'] if scaled else duration
    start_right=right['center']-target_duration*rate/2
    best=None
    for phase in range(64):
        offset=phase/64*rate/right['f0']
        y=[interpolate(ch,start_right+offset+i*target_duration*rate/n)
           for i in range(n) for ch in channels]
        score=cosine(x,y,True)
        if score is not None and (best is None or abs(score)>abs(best['signed_correlation'])):
            best={'signed_correlation':score,'phase_cycles':phase/64,
                  'gain':sum(a*b for a,b in zip(x,y))/max(energy(x),1e-30)}
    return best


def run(input_path,output):
    begin=time.perf_counter();input_path=Path(input_path);output=Path(output)
    expected='5c2ca6a14081b7fed47f295f1f737f2c8b6e1138e6f31fec98b8277013c90134'
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    if sha(input_path)!=expected:raise ValueError('Input hash mismatch')
    root=Path(__file__).resolve().parents[1]
    prior={str(p.resolve()):sha(p) for p in root.rglob('*') if p.is_file()}
    output.mkdir(parents=True,exist_ok=False)
    rate,count,values=decode_aifc(input_path);channels=[values[c::count] for c in range(count)]
    times={'decode_seconds':time.perf_counter()-begin};t=time.perf_counter()
    width=2048;hop=round(rate*.01);frames=[]
    strongest=max(channels,key=energy)
    peak=max(math.sqrt(sum(energy(ch[i:i+width]) for ch in channels)/(width*count))
             for i in range(0,len(strongest)-width+1,hop))
    for start in range(0,len(strongest)-width+1,hop):
        rms=math.sqrt(sum(energy(ch[start:start+width]) for ch in channels)/(width*count))
        f0,confidence=pitch(strongest[start:start+width],rate) if rms>peak*.04 else (None,0.)
        frames.append({'frame':start+width//2,'rms':rms,'f0':f0,'periodicity':confidence})
    times['pitch_frames_seconds']=time.perf_counter()-t;t=time.perf_counter()
    groups=regions_from_frames(frames,rate,hop);regions=[]
    for index,g in enumerate(groups):
        center=g[len(g)//2]['frame'];f0=statistics.median(v['f0'] for v in g)
        # Region boundaries approximate changes; they are not precise note onsets.
        start=max(0,g[0]['frame']-width//2);end=min(len(strongest),g[-1]['frame']+width//2)
        power=[0.]*2049
        for frame in [g[len(g)//4],g[len(g)//2],g[3*len(g)//4]]:
            for ch in channels:
                spec=spectrum(ch[frame['frame']-width//2:frame['frame']+width//2])
                power=[a+b/(3*count) for a,b in zip(power,spec)]
        harm,env=spectral_features(power,f0,rate)
        step=round(rate*.005)
        amplitudes=[math.sqrt(sum(energy(ch[k:k+step]) for ch in channels)/(step*count))
                    for k in range(start,min(end,start+round(rate*.15)),step)]
        amplitudes=(amplitudes+[0.]*30)[:30]
        top=max(amplitudes,default=0);indices=[i for i,v in enumerate(amplitudes) if v>=.9*top]
        low=next((i for i,v in enumerate(amplitudes) if v>=.1*top),0)
        attack=(indices[0]-low)*.005 if indices and top else None
        regions.append({'region':index+1,'start_seconds':start/rate,'end_seconds':end/rate,
                        'center':center,'f0':f0,'f0_spread_cents':1200*math.log2(max(v['f0'] for v in g)/min(v['f0'] for v in g)),
                        'median_periodicity':statistics.median(v['periodicity'] for v in g),
                        'harmonic_amplitudes':harm,'absolute_hz_log_spectral_envelope':env,
                        'onset_150ms_rms':amplitudes,'attack_10_90_seconds':attack})
    times['region_and_spectral_features_seconds']=time.perf_counter()-t;t=time.perf_counter();pairs=[]
    for i,left in enumerate(regions):
        for right in regions[i+1:]:
            pairs.append({'left':left['region'],'right':right['region'],
                          'pitch_distance_cents':abs(1200*math.log2(left['f0']/right['f0'])),
                          'harmonic_cosine':cosine(left['harmonic_amplitudes'],right['harmonic_amplitudes']),
                          'spectral_envelope_correlation':cosine(left['absolute_hz_log_spectral_envelope'],right['absolute_hz_log_spectral_envelope'],True),
                          'amplitude_envelope_cosine':cosine(left['onset_150ms_rms'],right['onset_150ms_rms']),
                          'raw_waveform':waveform_compare(channels,left,right,rate,False),
                          'pitch_scaled_waveform':waveform_compare(channels,left,right,rate,True)})
    times['pair_comparisons_seconds']=time.perf_counter()-t
    assert sha(input_path)==expected
    assert all(sha(Path(p))==h for p,h in prior.items())
    times['total_before_report_seconds']=time.perf_counter()-begin
    report={'input_path':str(input_path.resolve()),'input_sha256':expected,
            'source_sha256':sha(Path(__file__)),'sample_rate':rate,'channels':count,
            'timings':times,'prior_files_verified_unchanged':len(prior),'frames':frames,'regions':regions,'pairs':pairs,
            'parameters':{'frame_samples':width,'hop_samples':hop,'f0_hz_range':[60,2000],
                          'active_rms_fraction':.04,'region_pitch_tolerance_cents':70,'minimum_region_frames':6,
                          'harmonics':12,'waveform_cycles':8,'phase_steps':64},
            'limits':['No source count inferred. Candidate regions are periodic plateaus, not certified notes.',
                      'Pitch octave errors, aliasing, short windows, transitions and segmentation bias affect features.',
                      'Time scaling is diagnostic resampling; it changes envelopes and cannot prove source identity.',
                      'Only this combined recording is analyzed; no general identity classification validated.']}
    with (output/'report.json').open('x') as f:json.dump(report,f,indent=2,allow_nan=False);f.write('\n')
    with (output/'preservation.json').open('x') as f:json.dump(prior,f,indent=2);f.write('\n')
    print(json.dumps({'regions':len(regions),'pairs':len(pairs),'timings':times},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input');parser.add_argument('--output',required=True)
    args=parser.parse_args();run(args.input,args.output)
