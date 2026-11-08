document.getElementById('run').addEventListener('click',async()=>{
  const result=document.getElementById('result');result.textContent='Running';
  const w=document.getElementById('application').contentWindow;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const wait=async condition=>{const end=performance.now()+5000;while(!condition()&&performance.now()<end)await new Promise(r=>setTimeout(r,20));check(condition(),'Browser operation timed out');};
  function makeFile(name){const count=48000,bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
    const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    text(0,'RIFF');v.setUint32(4,36+count*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,48000,true);v.setUint32(28,96000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,count*2,true);
    return new w.File([bytes],name,{type:'audio/wav',lastModified:10});}
  try{
    await wait(()=>w.eval('typeof mainStemIntegration !== "undefined"'));
    const d=w.document,router=w.eval('audioEngine'),player=w.eval('mainStemIntegration.mixer.getDeck(1)');
    for(const id of [1,2]){const mode=d.getElementById('deck.'+id+'.sourceMode');mode.value='stems';mode.dispatchEvent(new w.Event('change'));}
    const batch=d.getElementById('prototype.deck.1.stem.batch'),load=d.getElementById('prototype.deck.1.load');
    const selection=name=>d.getElementById('prototype.deck.1.stem.'+name+'.assignment');
    const names=['Track_DRUMS.wav','Track-bass.wav','Track (others).wav','Track vocal.wav'];
    const choose=filenames=>{const transfer=new w.DataTransfer();for(const name of filenames)transfer.items.add(makeFile(name));batch.files=transfer.files;batch.dispatchEvent(new w.Event('change'));};
    choose(names);
    check(!load.disabled&&player.getState().contextState==='uncreated'&&!player.getState().loaded,'Batch assignment does not decode or play before Load');
    for(const [index,name] of ['transients','flow','tune','voice'].entries())check(selection(name).selectedOptions[0].textContent===names[index],'Assignments visible before loading');
    const previous=selection('flow').value;batch.dispatchEvent(new w.Event('change'));
    check(selection('flow').value===previous&&!load.disabled,'Cancelled picker leaves prior selection intact');
    selection('voice').value=selection('transients').value;selection('voice').dispatchEvent(new w.Event('change'));
    check(selection('voice').selectedOptions[0].textContent===names[3],'Duplicate manual assignment does not overwrite existing selection');
    const component=batch.closest('section');
    const clear=[...component.querySelectorAll('button')].find(button=>button.textContent==='Clear selected files');
    clear.click();choose(['Track_drum_bass.wav','Unknown.wav','Track_other.wav','Track_vocals.wav']);
    check(load.disabled&&!selection('transients').value&&!selection('flow').value,'Ambiguous and missing categories block Load');
    for(const [category,filename] of [['transients','Track_drum_bass.wav'],['flow','Unknown.wav']]){
      const select=selection(category);select.value=[...select.options].find(option=>option.textContent===filename).value;select.dispatchEvent(new w.Event('change'));
    }
    check(!load.disabled,'Manual correction completes mapping');
    load.click();await wait(()=>player.getState().loaded);
    batch.dispatchEvent(new w.Event('change'));
    check(player.getState().loaded&&!player.getState().isPlaying,'Cancelled selection preserves loaded audio without starting it');
    const volume=d.getElementById('deck.1.volume');volume.value=0.7;volume.dispatchEvent(new w.Event('input'));
    await router.play(1);check(player.getState().isPlaying,'Assigned real WAV files decode and play');
    clear.click();choose(names);load.click();await wait(()=>!player.getState().loading);
    check(player.getState().mainVolume===0.7&&player.getState().levels.flow===1,'Batch replacement preserves musical levels');
    choose(['Replacement_drum.wav']);
    check(selection('transients').selectedOptions[0].textContent===names[0],'Conflicting new batch cannot overwrite existing assignment');
    check(d.getElementById('prototype.deck.2.load').disabled&&!router.getState(2).loaded,'Deck file-selection state is independent');
    await w.eval('mainStemIntegration.mixer.close()');
    result.textContent='Batch stem browser tests passed: four-file mapping, review, cancellation, duplicate/conflict protection, manual correction, deferred decoding, playback and retained levels.';
  }catch(error){result.textContent='FAIL: '+error.message;console.error(error);}
});
