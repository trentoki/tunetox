// Real Web Audio measurement. Generated PCM only; no original files are touched.
document.getElementById('run').addEventListener('click', async () => {
  const result=document.getElementById('result'); let mixer;
  const check=(value,message)=>{if(!value)throw new Error(message);};
  const wait=()=>new Promise(resolve=>setTimeout(resolve,150));
  try {
    const audio=new AudioContext(); await audio.resume();
    mixer=createNativeStemMixer(()=>audio);
    const frames=audio.sampleRate*3,bytes=new ArrayBuffer(44+frames*2),view=new DataView(bytes);
    const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,audio.sampleRate,true);view.setUint32(28,audio.sampleRate*2,true);
    view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*2,true);
    for(let i=0;i<frames;i++)view.setInt16(44+i*2,Math.round(0.05*32767*Math.sin(2*Math.PI*440*i/audio.sampleRate)),true);
    const files=Object.fromEntries(prototypeStemNames.map(name=>[name,new File([bytes],name+'.wav')]));
    await mixer.getDeck(1).loadFiles(files);
    const targets=Object.fromEntries([1,2,3,4].map(id=>[id,{mainVolume:1,
      levels:Object.fromEntries(prototypeStemNames.map(name=>[name,id===1?1:0]))}]));
    await mixer.startCoordinated(1,targets);await wait();
    const snapshot=mixer.getDiagnostics();
    check(snapshot.outputMeter.peak>0.01,'Final destination input must contain a live signal');
    for(const [name,value] of Object.entries(snapshot.decks[1].liveMeters))
      check(value.peak>0.01,'Nonzero live graph stage: '+name);
    mixer.getDeck(1).pause();await wait();
    check(mixer.getDiagnostics().outputMeter.peak<0.00001,'Pause must silence final input');
    await mixer.startCoordinated(1,targets);await wait();
    check(mixer.getDiagnostics().outputMeter.peak>0.01,'Resume must restore final input');
    mixer.getDeck(1).pause();
    await mixer.playDiagnosticTone();await wait();
    check(mixer.getDiagnostics().diagnosticToneActive&&mixer.getDiagnostics().outputMeter.peak>0.01,
      'Idle diagnostic tone reaches the same shared output');
    await new Promise(resolve=>setTimeout(resolve,850));
    await mixer.playFreshDiagnosticTone();await wait();
    check(mixer.getDiagnostics().freshOutputMeter.peak>0.01,'Fresh temporary comparison produces live output');
    check(mixer.getDeck(1).getState().loaded&&!mixer.getDeck(1).getState().isPlaying,
      'Fresh comparison preserves loaded paused production deck');
    await new Promise(resolve=>setTimeout(resolve,850));
    const freshResult=mixer.getDiagnostics().lastFreshDiagnosticTone;
    check(freshResult.temporaryContextClosed&&freshResult.observations.some(value=>value.outputMeter?.peak>0.01),
      'Fresh probe retains measured nonzero output after its temporary context closes');
    result.textContent='PASS: real source/stem/main/transport/final signal, Pause and Resume. Listening is a separate check.\n'+JSON.stringify({playback:snapshot,freshProbe:freshResult},null,2);
  } catch(error) { result.textContent='FAIL: '+error.message; }
  finally { if(mixer)await mixer.close(); }
});
