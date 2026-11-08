async function runBoundedStartupMeasurements() {
  const audio=new AudioContext({sampleRate:48000});
  const player=createBoundedWavPlayer({createContext:()=>audio});
  try {
    const files=Object.fromEntries(streamingStemNames.map(name=>{
      const fixture=makeBoundedWavFixture({frames:480000,sample:()=>0});
      return[name,new File([fixture.raw],name+'.wav')];
    }));
    await player.loadFiles(files);
    await player.play();const unprepared=player.getState().lastStartup;
    const ready=[];
    for(let i=0;i<8;i++){
      player.stop();await player.whenReady();await player.play();
      const timing=player.getState().lastStartup;
      if(!timing.readyAtCommand||timing.payloadReads!==0||timing.readMs!==0||timing.conversionMs!==0)
        throw new Error('Ready startup performed unnecessary payload preparation.');
      if(timing.schedulingLeadMs!==10||timing.actualAudibleLatencyMs!==null)
        throw new Error('Ready startup timing diagnostics changed meaning.');
      ready.push(timing);
    }
    player.stop();await player.whenReady();player.setSchedulingLead(.05);await player.play();
    if(player.getState().lastStartup.schedulingLeadMs!==50)throw new Error('50 ms scheduling fallback unavailable.');
    return {unprepared,ready,fallback:player.getState().lastStartup};
  } finally {await player.close();}
}
