// V40 original mathematical detector, versioned for comparison. Only decoding
// is supplied separately so analysis never touches the playback AudioContext.
// The body below is byte-for-byte the original post-decode algorithm. The full
// unchanged archive functions and provenance are retained in tests/reference/.
export const V40_DETECTOR_ID = 'v40-original-1';
export function estimateV40Bpm(buffer) {
 const sr=buffer.sampleRate, hop=Math.max(1,Math.round(sr*.01)), frames=Math.floor(buffer.length/hop);
 if(frames<300) return null;
 const channels=buffer.numberOfChannels, data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
 const env=new Float32Array(frames); let prev=0;
 // RMS in 10 ms windows, then emphasize increases in energy (onsets).
 for(let i=0;i<frames;i++){
   let start=i*hop,end=Math.min(buffer.length,start+hop),sum=0,count=0;
   for(let c=0;c<channels;c++)for(let j=start;j<end;j+=2){let v=data[c][j];sum+=v*v;count++}
   let rms=Math.sqrt(sum/Math.max(1,count));env[i]=Math.max(0,rms-prev);prev=rms*.92+prev*.08;
 }
 // Remove the average and normalize the onset envelope.
 let mean=0;for(let v of env)mean+=v;mean/=frames;
 let variance=0;for(let i=0;i<frames;i++){env[i]=Math.max(0,env[i]-mean*.35);variance+=env[i]*env[i]}
 if(variance<1e-8)return null;
 // Analyze several sections to reduce the influence of intros/outros.
 const start=Math.floor(frames*.08), end=Math.min(frames,Math.floor(frames*.88)), n=end-start;
 const minLag=30,maxLag=Math.min(100,Math.floor(n/3));let bestLag=0,best=-Infinity;
 for(let lag=minLag;lag<=maxLag;lag++){
   let score=0,normA=0,normB=0;
   for(let i=start+lag;i<end;i++){let a=env[i],b=env[i-lag];score+=a*b;normA+=a*a;normB+=b*b}
   score=score/Math.sqrt(Math.max(1e-12,normA*normB));
   // Slightly favor tempo range around common dance music without forcing it.
   if(score>best){best=score;bestLag=lag}
 }
 if(!bestLag||best<.035)return null;
 let bpm=6000/bestLag;
 // Resolve common octave ambiguity by preferring a strong related autocorrelation peak.
 const candidates=[bpm,bpm/2,bpm*2].filter(v=>v>=60&&v<=200);
 let chosen=bpm;
 for(const candidate of candidates){const lag=Math.round(6000/candidate);let score=0,norm=0;for(let i=start+lag;i<end;i++){score+=env[i]*env[i-lag];norm+=env[i]*env[i]}score/=Math.max(1e-9,norm);if(score>best*.92){chosen=candidate;best=score}}
 // Normalize common halftime readings: tracks detected from 60–69 BPM are displayed at double-time.
 if(chosen>=60&&chosen<70)chosen*=2;
 return Math.round(chosen);
}
