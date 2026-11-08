const boundedWavPlayer=createBoundedWavPlayer(),boundedFiles={};let boundedError='';
for(const name of streamingStemNames){
  const row=document.createElement('p'),label=document.createElement('label');label.textContent=name+' audio ';
  // No accept filter: Safari may grey out valid WAVs based on native type mappings.
  // Selection is unrestricted; Header detection validates actual bytes on Load headers.
  const file=document.createElement('input');file.type='file';
  file.addEventListener('change',()=>{if(file.files.length)boundedFiles[name]=file.files[0];});label.append(file);row.append(label);
  const gainLabel=document.createElement('label');gainLabel.textContent=' Gain ';const gain=document.createElement('input');gain.type='range';gain.min=0;gain.max=1;gain.step=.01;gain.value=1;
  gain.addEventListener('input',()=>boundedWavPlayer.setLevel(name,Number(gain.value)));gainLabel.append(gain);row.append(gainLabel);
  const activeLabel=document.createElement('label');activeLabel.textContent=' Render (unchecked = dormant) ';const active=document.createElement('input');active.type='checkbox';active.checked=name!=='voice';
  active.addEventListener('change',()=>boundedWavPlayer.setEnabled(name,active.checked));activeLabel.append(active);row.append(activeLabel);document.getElementById('files').append(row);
}
for(const [id,action] of Object.entries({load:()=>boundedWavPlayer.loadFiles({...boundedFiles}),play:()=>boundedWavPlayer.play(),pause:()=>boundedWavPlayer.pause(),stop:()=>boundedWavPlayer.stop(),
  seek:()=>boundedWavPlayer.seek(Number(document.getElementById('position').value)),close:()=>boundedWavPlayer.close()})){
  document.getElementById(id).addEventListener('click',async()=>{try{boundedError='';await action();}catch(error){boundedError=error.message;}refreshBounded();});
}
document.getElementById('window').addEventListener('change',()=>{try{boundedWavPlayer.setWindow(Number(document.getElementById('window').value));boundedError='';}catch(error){boundedError=error.message;}refreshBounded();});
document.getElementById('lead').addEventListener('change',()=>{try{boundedWavPlayer.setSchedulingLead(Number(document.getElementById('lead').value)/1000);boundedError='';}catch(error){boundedError=error.message;}refreshBounded();});
function refreshBounded(){const state=boundedWavPlayer.getState();document.getElementById('status').textContent=(boundedError?'Error: '+boundedError+'\n':'')+'Transport: '+state.transport+' | Audio: '+(state.ready?'Ready':state.preparing?'Preparing':state.playing?'Streaming':'Unprepared')+'\n'+JSON.stringify(state,null,2);
  for(const id of ['load','play','pause','stop','seek','window','lead'])document.getElementById(id).disabled=state.closed;
  document.getElementById('play').disabled=state.closed||state.loading||state.playing||state.starting||!state.loaded;
  document.getElementById('window').value=state.windowSeconds;
  document.getElementById('play').textContent=state.ready?'Play / Resume — Ready':'Play / Resume (prepare first)';
  for(const id of ['window','lead'])document.getElementById(id).disabled=state.closed||state.playing||state.starting||state.loading;
  document.getElementById('lead').value=state.schedulingLeadMs;
  for(const input of document.getElementById('files').querySelectorAll('input'))input.disabled=state.closed;}
refreshBounded();const boundedUiTimer=setInterval(refreshBounded,100);
window.addEventListener('pagehide',()=>{clearInterval(boundedUiTimer);void boundedWavPlayer.close().catch(console.error);});
