async function estimateBPM(blob){
 if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
 const bytes=await blob.arrayBuffer();
 const buffer=await audioContext.decodeAudioData(bytes.slice(0));
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
function adjustBpmOctave(direction){
 const field=$('editSongBpm');if(!field)return;
 const current=Number(field.value);if(!Number.isFinite(current)||current<=0){const note=$('bpmDetectStatus');if(note)note.textContent='Enter or detect a BPM first.';return}
 const next=Math.max(1,Math.min(400,Math.round(direction==='double'?current*2:current/2)));
 field.value=String(next);
 const note=$('bpmDetectStatus');if(note)note.textContent=`BPM label changed to ${next}. Audio playback speed is unchanged.`;
}
async function detectSongBpm(id){
 const song=getSong(id);if(!song)return;const field=$('editSongBpm'),note=$('bpmDetectStatus');
 if(note)note.textContent='Analyzing audio…';
 try{const blob=await getAudio(id);if(!blob)throw new Error('Audio file is unavailable in this browser.');const bpm=await estimateBPM(blob);if(!bpm)throw new Error('Could not find a reliable beat pattern. You can enter BPM manually.');if(field)field.value=String(Math.round(bpm));if(note)note.textContent=`Estimated ${Math.round(bpm)} BPM. If the beat count feels doubled or halved, use ×2 or ÷2; playback speed will not change.`;status(`Estimated ${bpm} BPM for ${song.name}.`)}catch(e){if(note)note.textContent=e.message||'BPM analysis failed.';status('BPM detection could not determine a reliable tempo.');}
}
async function detectAllSongBpms(){
 if(window.flowBpmScanRunning)return;if(!songs.length){status('Your library is empty.');return}
 window.flowBpmScanRunning=true;const all=[...songs],total=all.length;let detected=0,failed=0,missing=0;
 try{
  for(let i=0;i<all.length;i++){const song=all[i];status(`BPM ALL · ${i+1}/${total} · ${song.name}`);
   try{const blob=await getAudio(song.id);if(!blob){missing++;continue}const bpm=await estimateBPM(blob);if(!bpm){failed++;continue}song.bpm=String(Math.round(bpm));detected++;saveMeta();}
   catch(e){failed++}
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }finally{window.flowBpmScanRunning=false;renderSongs();renderDeck('A');renderDeck('B');}
 status(`BPM scan complete: ${detected} updated · ${failed} couldn't be detected · ${missing} audio files unavailable. Existing BPM values were replaced only when detection succeeded.`);
}
