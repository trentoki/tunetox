document.getElementById('run').addEventListener('click',async()=>{
  const result=document.getElementById('result');result.textContent='Running';
  const w=document.getElementById('application').contentWindow;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const wait=async condition=>{const end=performance.now()+5000;while(!condition()&&performance.now()<end)await new Promise(r=>setTimeout(r,20));check(condition(),'Browser operation timed out');};
  let originalSource;
  try{
    await wait(()=>w.eval('typeof mainStemIntegration !== "undefined"'));
    const d=w.document,router=w.eval('audioEngine'),state=w.eval('appState'),mixer=w.eval('mainStemIntegration.mixer');
    const sources=[];originalSource=w.AudioContext.prototype.createBufferSource;
    w.AudioContext.prototype.createBufferSource=function(){const source=originalSource.call(this);sources.push(source);return source;};
    function file(name){const frames=192000,bytes=new ArrayBuffer(44+frames*2),v=new DataView(bytes);
      const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
      text(0,'RIFF');v.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
      v.setUint32(24,48000,true);v.setUint32(28,96000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,frames*2,true);
      return new w.File([bytes],name,{type:'audio/wav'});}
    const slide=(id,value)=>{const input=d.getElementById(id);input.value=value;input.dispatchEvent(new w.Event('input'));};
    for(const id of [1,2,3,4]){
      check(state.participation.byDeck[id].stemHandoff,'All participation defaults ON');
      const select=d.getElementById('deck.'+id+'.sourceMode');select.value='stems';select.dispatchEvent(new w.Event('change'));
      const transfer=new w.DataTransfer();for(const name of ['drums','bass','other','vocals'])transfer.items.add(file('Deck'+id+'_'+name+'.wav'));
      const batch=d.getElementById('prototype.deck.'+id+'.stem.batch');batch.files=transfer.files;batch.dispatchEvent(new w.Event('change'));
      d.getElementById('prototype.deck.'+id+'.load').click();
    }
    await wait(()=>[1,2,3,4].every(id=>router.getState(id).loaded));
    for(const id of [1,2,3,4])await router.play(id);
    check(sources.length===16&&new Set(sources.map(source=>source.context)).size===1,'Sixteen native stem sources share one actual context');
    check([1,2,3,4].every(id=>router.getState(id).isPlaying),'All four decks play simultaneously');
    slide('deck.3.volume',1);slide('deck.4.volume',1);slide('deck.3.stem.flow.level',1);slide('deck.4.stem.flow.level',0.5);
    check(state.decks[2].stems.allocatedLevels.flow===1,'Four participants retain direct-only behavior');
    for(const id of [1,2]){const input=d.getElementById('deck.'+id+'.participation.stemHandoff');input.checked=false;input.dispatchEvent(new w.Event('change'));}
    slide('deck.4.stem.flow.level',0);slide('deck.4.stem.flow.level',0.5);
    check(state.decks[2].stems.allocatedLevels.flow===0.5&&Number(d.getElementById('deck.3.stem.flow.level').value)===0.5&&router.getState(3).levels.flow===0.5,
      'Pair 3/4 handoff updates state, audio and fader immediately');
    slide('deck.4.stem.flow.level',1);check(router.getState(3).levels.flow===0,'Pair 3/4 completes complementary handoff');
    await router.pause(3);const position=router.getState(3).position;await router.play(3);
    check(router.getState(3).position>=position&&router.getState(4).isPlaying,'Deck 3 resumes independently');
    await router.stop(2);await router.eject(3);
    check(router.getState(1).isPlaying&&router.getState(4).isPlaying,'Stop/Eject one deck preserves others');
    const files=Object.fromEntries(['transients','flow','tune','voice'].map(name=>[name,file('Replacement_'+name+'.wav')]));
    await router.loadStems(4,files);
    check(router.getState(4).levels.flow===1&&router.getState(4).mainVolume===1&&router.getState(1).isPlaying,'Replacement retains Deck 4 controls without interrupting Deck 1');
    check(router.setSourceMode(3,'complete'),'Ejected Deck 3 can change source independently');
    await router.loadFile(3,file('Complete.wav'));await router.play(3);
    check(router.getState(3).isPlaying&&router.getState(1).isPlaying,'Complete-song Deck 3 coexists with native stem Deck 1');
    await router.eject(3);await mixer.close();
    check([1,2,3,4].every(id=>mixer.getDeck(id).getState().closed),'All native decks shut down');
    result.textContent='Four-deck native browser tests passed: sixteen actual sources/one context, batch loads, pair 3/4 handoff, independent transports, replacement, source switching and cleanup.';
  }catch(error){result.textContent='FAIL: '+error.message;console.error(error);}
  finally{if(originalSource)w.AudioContext.prototype.createBufferSource=originalSource;}
});
