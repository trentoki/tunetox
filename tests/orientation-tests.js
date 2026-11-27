import { libraryTestStorageScript, createLibraryLoadingFixtures } from './library-loading-fixture.js';
const assert=(v,m)=>{if(!v)throw Error(m);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function tone(win, name, frequency) {
  const rate=8000,count=rate*90,bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
  const text=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,count*2,true);
  for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.sin(i/rate*2*Math.PI*frequency)*4000,true);
  return new win.File([bytes],name,{type:'audio/wav'});
}

document.querySelector('#run').onclick=async()=>{
 const out=document.querySelector('#results'),frame=document.querySelector('#application'),name='orientation-'+crypto.randomUUID();
 out.dataset.result='running';out.textContent='';let win;
 try {
 const source=await(await fetch('../tunetox.html')).text();
 const prefs='<script>const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){return get.call(this,k==="tunetox-settings-v1"?"'+name+'":k)};Storage.prototype.setItem=function(k,v){return set.call(this,k==="tunetox-settings-v1"?"'+name+'":k,v)};<\/script>';
 const html=source.replace('<head>','<head><base href="'+new URL('../',location.href).href+'">'+libraryTestStorageScript(name, false)+prefs);
 async function mount(){frame.srcdoc=html;await new Promise(r=>frame.onload=r);win=frame.contentWindow;await delay(150);}
 await mount();let doc=frame.contentDocument;
 assert(doc.title==='TuneTox D2'&&doc.documentElement.dataset.waveformOrientation==='horizontal','D2/default');
 assert(doc.querySelector('.application-settings').hidden&&doc.querySelector('.global-library-import').getClientRects().length,'Global actions');
 doc.querySelector('.settings-button').click();assert(!doc.querySelector('.application-settings').hidden,'Settings open');
 const fixtures=createLibraryLoadingFixtures(win,doc);
 for(let i=0;i<4;i++){const d=new win.DataTransfer();d.items.add(tone(win,'Orientation '+i+'.wav',220));fixtures[i].files=d.files;fixtures[i].dispatchEvent(new win.Event('change'));await fixtures[i].fixtureCompletion;}
 const cards=[...doc.querySelectorAll('.deck')];
 cards.forEach(c=>c.querySelector('.cue-pad').click());
 const waves=cards.map(c=>c.querySelector('.scrolling-waveform')), boxes=waves.map(w=>[w.clientWidth,w.clientHeight]);
 const orientation=doc.querySelector('[aria-label="Scrolling waveform orientation"]');
 orientation.value='vertical';orientation.dispatchEvent(new win.Event('change'));doc.querySelector('.settings-button').click();
 await delay(60);
 waves.forEach((w,i)=>{
 assert(w.clientWidth===boxes[i][0]&&w.clientHeight===boxes[i][1],'Box changed');
 const play=w.querySelector('.playhead').getBoundingClientRect(),box=w.getBoundingClientRect();assert(Math.abs(play.y-box.y-box.height/2)<2&&play.width>play.height,'Playhead');
 const marker=w.querySelector('.scrolling-cue-marker');assert(marker.style.top==='50%'&&!marker.hidden,'Cue alignment');
 const r=w.getBoundingClientRect();let captured=false;w.setPointerCapture=()=>captured=true;w.hasPointerCapture=()=>captured;w.releasePointerCapture=()=>captured=false;
 const pointer=(type,y)=>w.dispatchEvent(new win.PointerEvent(type,{pointerId:1,isPrimary:true,button:0,pointerType:i%2?'touch':'mouse',clientX:r.x+r.width/2,clientY:y,bubbles:true}));
 pointer('pointerdown',r.y+r.height*.7);pointer('pointermove',r.y+r.height*.45);pointer('pointerup',r.y+r.height*.45);
 });
 await delay(300);
 waves.forEach(w=>{assert(Math.abs(Number(w.getAttribute('aria-valuenow'))-1)<.1,'Upward seek');assert(Math.abs(parseFloat(w.querySelector('.scrolling-cue-marker').style.top)-25)<1,'Cue did not move with source');});
 for(const [i,w]of waves.entries()){
  const r=w.getBoundingClientRect(),pointer=(type,y)=>w.dispatchEvent(new win.PointerEvent(type,{pointerId:2,isPrimary:true,button:0,pointerType:i%2?'mouse':'touch',clientX:r.x+r.width/2,clientY:y,bubbles:true}));
  pointer('pointerdown',r.y+r.height*.3);pointer('pointermove',r.y+r.height*.425);pointer('pointerup',r.y+r.height*.425);
 }
 await delay(250);waves.forEach(w=>assert(Math.abs(Number(w.getAttribute('aria-valuenow'))-.5)<.1,'Downward seek'));

 cards.forEach(c=>c.querySelector('.play-pause-button').click());await delay(700);
 const before=waves.map(w=>Number(w.getAttribute('aria-valuenow')));
 orientation.value='horizontal';orientation.dispatchEvent(new win.Event('change'));await delay(250);
 waves.forEach((w,i)=>assert(Number(w.getAttribute('aria-valuenow'))>before[i],'Orientation interrupted deck'));
 orientation.value='vertical';orientation.dispatchEvent(new win.Event('change'));await mount();doc=frame.contentDocument;
 assert(doc.documentElement.dataset.waveformOrientation==='vertical','Saved orientation');
 out.textContent='PASS D2/Settings, default/persisted orientation, unchanged four-deck geometry, horizontal playhead/cues, mouse/touch upward/downward seek and uninterrupted orientation switches';out.dataset.result='pass';
 }catch(e){out.textContent+='FAIL '+e.stack;out.dataset.result='fail';}
 finally{frame.src='about:blank';frame.removeAttribute('srcdoc');localStorage.removeItem(name);indexedDB.deleteDatabase(name);}
};
