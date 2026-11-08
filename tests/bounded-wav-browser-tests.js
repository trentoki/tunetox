document.getElementById('run').addEventListener('click',async()=>{
  const result=document.getElementById('result');result.textContent='Running';let player;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  try{
    await runBoundedReadyTests();
    const startupMeasurements=await runBoundedStartupMeasurements();
    window.boundedStartupMeasurements=startupMeasurements;
    await runBoundedAiffTests();
    await runBoundedWavTests();
    const pickerFrame=document.getElementById('picker-prototype'),pickerWindow=pickerFrame.contentWindow;
    const waitPicker=async condition=>{const deadline=performance.now()+5000;while(!condition()&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));check(condition(),'Picker prototype operation timed out: '+(pickerWindow.document.getElementById('status')?.textContent||pickerWindow.document.readyState));};
    await waitPicker(()=>pickerWindow.eval('typeof boundedWavPlayer !== "undefined"'));
    const pickerDocument=pickerWindow.document,inputs=[...pickerDocument.querySelectorAll('input[type=file]')];
    check(inputs.length===4&&inputs.every(input=>!input.hasAttribute('accept')),'All standalone pickers must avoid native extension/MIME filtering');
    const rateProbe=new pickerWindow.AudioContext(),pickerRate=rateProbe.sampleRate;await rateProbe.close();
    const metadata=[['drums.wav','audio/wav'],['bass.WAV','audio/x-wav'],['other.wave','application/octet-stream'],['vocals.WAVE','']];
    for(let i=0;i<4;i++){
      const fixture=makeBoundedWavFixture({rate:pickerRate,frames:pickerRate});
      const transfer=new pickerWindow.DataTransfer();transfer.items.add(new pickerWindow.File([fixture.raw],metadata[i][0],{type:metadata[i][1]}));
      inputs[i].files=transfer.files;inputs[i].dispatchEvent(new pickerWindow.Event('change'));
    }
    check(!pickerWindow.eval('boundedWavPlayer.getState().loaded'),'Selection alone must not load WAV data');
    pickerDocument.getElementById('load').click();
    await waitPicker(()=>pickerWindow.eval('boundedWavPlayer.getState().loaded'));
    // A compressed WAV is selectable, but format validation rejects its encoding explicitly.
    const unsupported=makeBoundedWavFixture({rate:pickerRate,frames:pickerRate});new DataView(unsupported.raw).setUint16(20,6,true);
    const transfer=new pickerWindow.DataTransfer();transfer.items.add(new pickerWindow.File([unsupported.raw],'unsupported.wav',{type:'audio/wav'}));
    inputs[0].files=transfer.files;inputs[0].dispatchEvent(new pickerWindow.Event('change'));pickerDocument.getElementById('load').click();
    await waitPicker(()=>pickerDocument.getElementById('status').textContent.includes('WAV_COMPRESSION_UNSUPPORTED'));
    check(!pickerWindow.eval('boundedWavPlayer.getState().playing'),'Unsupported files cannot start playback');
    for(let i=0;i<4;i++){
      const fixture=makeBoundedAiffFixture({form:i===0?'AIFF':'AIFC',compression:i===2?'sowt':i===3?'fl32':'NONE',bits:i===3?32:16,rate:pickerRate,frames:pickerRate});
      const transfer=new pickerWindow.DataTransfer();transfer.items.add(new pickerWindow.File([fixture.raw],'misleading-'+i+'.wav',{type:'audio/wav'}));
      inputs[i].files=transfer.files;inputs[i].dispatchEvent(new pickerWindow.Event('change'));
    }
    pickerDocument.getElementById('load').click();
    await waitPicker(()=>pickerWindow.eval('boundedWavPlayer.getState().formats?.flow.container === "AIFF-C"'));
    check(pickerWindow.eval('boundedWavPlayer.getState().formats.transients.container')==='AIFF','Actual headers override WAV filename/MIME');
    await pickerWindow.eval('boundedWavPlayer.close()');
    for(const useAiff of [false,true]) {
    const offline=new OfflineAudioContext(4,144000,48000),merger=offline.createChannelMerger(4);merger.connect(offline.destination);let gains=0;
    const adapter={get currentTime(){return offline.currentTime;},sampleRate:48000,state:'running',destination:offline.destination,resume:async()=>{},close:async()=>{},
      createBuffer:(...args)=>offline.createBuffer(...args),createBufferSource:()=>offline.createBufferSource(),
      createGain(){const gain=offline.createGain(),connect=gain.connect.bind(gain),index=gains++;gain.connect=()=>connect(merger,0,index);return gain;}};
    player=createBoundedWavPlayer({createContext:()=>adapter,setTimer:()=>1,clearTimer:()=>{}});
    const signal=frame=>Math.sin(frame*.031)*0.05;
    const files={
      transients:makeWavEncodingFixture({encoding:3,frames:384000,channels:1,sample:signal}),
      flow:useAiff?makeBoundedAiffFixture({form:'AIFF',bits:24,frames:384000,channels:1,sample:signal}):makeWavEncodingFixture({extensible:true,encoding:1,bits:32,validBits:24,frames:384000,channels:1,sample:signal}),
      tune:useAiff?makeBoundedAiffFixture({compression:'sowt',bits:32,frames:384000,channels:1,sample:signal}):makeWavEncodingFixture({extensible:true,encoding:3,frames:384000,channels:1,sample:signal}),
      voice:useAiff?makeBoundedAiffFixture({compression:'fl32',bits:32,frames:384000,channels:1,sample:signal}):makeBoundedWavFixture({frames:384000,channels:1,sample:signal})
    };
    await player.loadFiles(files);await player.play();
    await player.tick();
    const onset=player.getState().lastStartup.scheduledContextTime;
    const tasks=[];let seekAnchor=0;
    for(const time of [.5,.7,1,1.25,1.5,1.75,2,2.25,2.5,2.75]){
      tasks.push(offline.suspend(time).then(async()=>{
        if(time===.7){player.setEnabled('voice',true);}
        if(time===1.5){await player.seek(4);seekAnchor=offline.currentTime+player.getState().schedulingLeadMs/1000;}
        await player.tick();
        // Activation may already own the refill promise; wait for its bounded reads to finish.
        for(let i=0;i<200;i++)await Promise.resolve();
        check(player.getState().applicationPcmBytes<=player.getState().capacityPcmBytes,'Rendered playback exceeds PCM window capacity');
        await offline.resume();
      }));
    }
    const audio=await offline.startRendering();await Promise.all(tasks);
    for(const time of [.10,.30,.55,.80,1.05,1.30,1.60,1.85,2.10,2.35,2.60]){
      const output=Math.round(time*48000),source=Math.round((time<1.5?time-onset:4+time-seekAnchor)*48000);
      const expected=Math.round(signal(source)*32767)/32768;
      for(const channel of [0,1,2])check(Math.abs(audio.getChannelData(channel)[output]-expected)<0.0002,'Chunk/seek sample mismatch at '+time+' channel '+channel);
      if(time>=.8)check(Math.abs(audio.getChannelData(3)[output]-expected)<0.0002,'Dormant activation must join at the correct current source sample');
    }
    // Compare every sample across multiple refill boundaries, not only clock progress.
    for(const [begin,end,anchor,sourceStart] of [[.07,1.45,onset,0],[seekAnchor+.02,2.9,seekAnchor,192000]]){
      for(let output=Math.ceil(begin*48000);output<Math.floor(end*48000);output++){
        const source=sourceStart+output-Math.round(anchor*48000),expected=Math.round(signal(source)*32767)/32768;
        for(const channel of [0,1,2])check(Math.abs(audio.getChannelData(channel)[output]-expected)<0.0002,'Continuous rendered sample mismatch at frame '+output);
        if(output>=.8*48000)check(Math.abs(audio.getChannelData(3)[output]-expected)<0.0002,'Activated stem drift at frame '+output);
      }
    }
    check(audio.getChannelData(3).slice(0,Math.round(.7*48000)).every(value=>value===0),'Dormant stem must not render early');
    check(player.getState().underruns===0,'Controlled continuous playback must not underrun');
    check(Object.values(files).every(file=>file.reads.every(([a,b])=>b-a<=12000*4)),'No payload read may exceed a quarter-second chunk');
    await player.close();
    }
    // Real-time file-backed slicing smoke test. Silent fixture avoids unexpected speaker output.
    for(const useAiff of [false,true]) {
    const live=new AudioContext();player=createBoundedWavPlayer({createContext:()=>live});
    const set=Object.fromEntries(streamingStemNames.map(name=>[name,useAiff?makeBoundedAiffFixture({compression:'sowt',rate:live.sampleRate,frames:live.sampleRate*4,channels:1,sample:()=>0}):makeBoundedWavFixture({rate:live.sampleRate,frames:live.sampleRate*4,channels:1,sample:()=>0})]));
    await player.loadFiles(set);await player.play();
    const deadline=performance.now()+5000;
    while(player.getState().position<2.2&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    check(player.getState().position>=2.2,'Real-time playback failed to progress beyond initial two-second window');
    check(player.getState().underruns===0,'Real-time chunk refill underrun: '+JSON.stringify(player.getState()));
    player.pause();const position=player.getState().position;await player.play();
    check(player.getState().position===position,'Real pause/resume preserves deck timeline');
    await player.seek(1);player.stop();await player.close();
    }
    result.textContent='Bounded Ready/timeline and WAV/AIFF/AIFF-C tests passed: sliced PCM, bounded windows, rendered chunk continuity/alignment, dormant activation, seeking, real-time refill and cleanup. No listening performed.';
  }catch(error){result.textContent='FAIL: '+error.message;console.error(error);}
  finally{if(player)await player.close().catch(console.error);}
});
