import { libraryTestStorageScript, createLibraryLoadingFixtures } from './library-loading-fixture.js';
import { buildDeck, setTempo } from '../app/behavior/mixer/deck.js';
import { setNudgeDirection, setNudgePercent } from '../app/behavior/mixer/nudging.js';
const assert = (value, message) => { if (!value) throw Error(message); };
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(test, message) { for(let i=0;i<600;i++){if(await test())return;await delay(15);}throw Error(message); }
function tone(win, name, frequency) {
  const rate=8000,count=rate*90,bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
  const text=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,count*2,true);
  for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.sin(i/rate*2*Math.PI*frequency)*4000,true);
  return new win.File([bytes],name,{type:'audio/wav'});
}
document.querySelector('#run').onclick=async()=>{
  const output=document.querySelector('#results'),frame=document.querySelector('#application');
  output.textContent='';output.dataset.result='running';const pass=text=>output.textContent+='PASS '+text+'\n';
  const name='tunetox-nudge-test-'+crypto.randomUUID();let win,players=[];
  try {
    const one=buildDeck(),two=buildDeck();
    assert(one.nudgePercent===2 && one.nudgeDirection===0,'Nudge defaults');
    for(const value of [NaN,1,51,'10']) {let bad=false;try{await setNudgePercent(one,value);}catch{bad=true;}assert(bad && one.nudgePercent===2,'Invalid percentage accepted');}
    await setNudgePercent(one,50);await setTempo(one,.5);await setNudgeDirection(one,-1);await setTempo(one,2);await setNudgeDirection(one,0);
    assert(one.tempoRatio===2 && one.nudgeDirection===0 && two.tempoRatio===1 && two.nudgePercent===2,'State ownership/restoration');
    pass('Behavior percentage bounds, established/temporary separation and independent defaults');
    const source=await(await fetch('../tunetox.html')).text();
    const probe='<base href="'+new URL('../',location.href).href+'">'+libraryTestStorageScript(name)+'<script>window.__players=[];window.__contexts=[];window.__gains=[];window.__nodes=[];const T=EventTarget;window.EventTarget=class extends T{constructor(){super();queueMicrotask(()=>{if("currentTime" in this)__players.push(this);});}};const C=AudioContext;window.AudioContext=class extends C{constructor(...a){super(...a);__contexts.push(this);}createGain(){const g=super.createGain(),connect=g.connect.bind(g);g.connect=(...a)=>{if(a[0]===this.destination)__gains.push(g);return connect(...a);};return g;}};const N=AudioWorkletNode;window.AudioWorkletNode=class extends N{constructor(...a){super(...a);__nodes.push(this);}};<\/script>';
    frame.srcdoc=source.replace('<head>','<head>'+probe);await new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
    win=frame.contentWindow;const doc=frame.contentDocument;await until(()=>win.__players.length===4,'App mount');players=win.__players;
    const cards=[...doc.querySelectorAll('.deck')],loaders=createLibraryLoadingFixtures(win,doc);
    for(let i=0;i<4;i++){const transfer=new win.DataTransfer();transfer.items.add(tone(win,'Nudge '+i+'.wav',220+i*110));loaders[i].files=transfer.files;loaders[i].dispatchEvent(new win.Event('change'));await loaders[i].fixtureCompletion;}
    cards.forEach(card=>{const input=card.querySelector('.main-volume-fader input');input.value='100';input.dispatchEvent(new win.Event('input'));card.querySelector('.play-pause-button').click();});
    await until(()=>players.every(p=>!p.paused&&p.currentTime>.15),'Four decks play');
    const context=win.__contexts[0],identities=[...win.__nodes],sources=players.map(p=>p.src);
    const meters=win.__gains.map(g=>{const a=context.createAnalyser();a.fftSize=8192;g.connect(a);return {a,samples:new Float32Array(8192)};});
    function pitch(i){const m=meters[i];m.a.getFloatTimeDomainData(m.samples);let first,last,count=0;for(let j=1;j<m.samples.length;j++)if(m.samples[j-1]<=0&&m.samples[j]>0){const x=j-1-m.samples[j-1]/(m.samples[j]-m.samples[j-1]);first??=x;last=x;count++;}return (count-1)*context.sampleRate/(last-first);}
    function tempo(i,ratio){const input=cards[i].querySelector('.tempo-slider input');input.value=String((Math.log2(ratio)+1)*500);input.dispatchEvent(new win.Event('input'));}
    const pct=i=>cards[i].querySelector('.nudge-controls [role=spinbutton]');
    const direction=(i,d)=>cards[i].querySelectorAll('.nudge-controls button')[d<0?0:2];
    const restore=[];
    for(const button of doc.querySelectorAll('.nudge-controls button')){const methods=['setPointerCapture','hasPointerCapture','releasePointerCapture'],old=methods.map(m=>button[m]);let capture=false;button.setPointerCapture=()=>capture=true;button.hasPointerCapture=()=>capture;button.releasePointerCapture=()=>capture=false;restore.push(()=>methods.forEach((m,i)=>button[m]=old[i]));}
    const pointer=(button,type,id=21,extra={})=>button.dispatchEvent(new win.PointerEvent(type,{pointerId:id,isPrimary:true,pointerType:'touch',button:0,clientX:100,clientY:200,bubbles:true,cancelable:true,...extra}));
    async function slope(i){const at=context.currentTime,position=players[i].currentTime;await delay(320);return (players[i].currentTime-position)/(context.currentTime-at);}
    try {
      pct(0).dispatchEvent(new win.KeyboardEvent('keydown',{key:'End',bubbles:true}));
      for(const [base,d,expected] of [[.5,-1,.25],[1,-1,.5],[1,1,1.5],[2,1,3]]){
        tempo(0,base);await delay(60);const before=players[0].currentTime;
        pointer(direction(0,d),'pointerdown');
        assert(Math.abs(players[0].currentTime-before)<.12,'Nudge onset jumped position');
        assert(Math.abs(await slope(0)-expected)<.06,'Effective nudge speed '+expected);
        await delay(150);assert(Math.abs(pitch(0)-220)<12,'Nudge changed musical pitch at '+expected);
        assert(cards[0].querySelector('.tempo-slider output').textContent===base.toFixed(2)+'×','Nudge changed established Tempo display');
        const releasing=players[0].currentTime;pointer(direction(0,d),'pointerup');
        assert(Math.abs(players[0].currentTime-releasing)<.12 && Math.abs(await slope(0)-base)<.06,'Release failed continuity/base restoration');
      }
      pass('real .25/.5/1.5/3× held rates, unchanged measured pitch and continuous restoration on the same node');
      tempo(0,1);pointer(pct(0),'pointerdown',31);pointer(pct(0),'pointermove',31,{clientY:400});pointer(pct(0),'pointerup',31);
      assert(pct(0).textContent==='2%','Downward percent bound');
      const position=players[0].currentTime;pointer(pct(0),'pointerdown',32);pointer(pct(0),'pointermove',32,{clientY:8});pointer(pct(0),'pointerup',32);
      assert(pct(0).textContent==='50%'&&players[0].currentTime-position<.15,'Percentage drag sought or failed upper bound');
      for(const type of ['pointercancel','lostpointercapture']){pointer(direction(0,1),'pointerdown');pointer(direction(0,1),type);assert(direction(0,1).getAttribute('aria-pressed')==='false'&&Math.abs(await slope(0)-1)<.06,'Cancellation '+type);}
      pointer(direction(0,-1),'pointerdown',40,{pointerType:'mouse'});tempo(0,1.5);pointer(direction(0,-1),'pointerup',40,{pointerType:'mouse'});assert(Math.abs(await slope(0)-1.5)<.06,'Established change during hold restored stale base');
      pointer(direction(0,1),'pointerdown');win.dispatchEvent(new win.Event('blur'));assert(Math.abs(await slope(0)-1.5)<.06,'Blur cancellation');
      pointer(direction(0,-1),'pointerdown');cards[0].querySelector('.performance-upper-toggle').click();await delay(30);assert(direction(0,-1).getAttribute('aria-pressed')==='false','Hidden waveform held nudge');cards[0].querySelector('.performance-upper-toggle').click();
      pointer(direction(0,-1),'pointerdown');cards[0].querySelector('.play-pause-button').click();await until(()=>players[0].paused,'Pause');assert(direction(0,-1).getAttribute('aria-pressed')==='false','Pause retained nudge');cards[0].querySelector('.play-pause-button').click();await until(()=>!players[0].paused,'Resume');
      direction(0,-1).dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',bubbles:true}));direction(0,-1).dispatchEvent(new win.KeyboardEvent('keyup',{key:' ',bubbles:true}));assert(direction(0,-1).getAttribute('aria-pressed')==='false','Keyboard release');
      assert(players.every((p,i)=>p.src===sources[i]&&!p.paused)&&win.__nodes.length===identities.length&&identities.every((n,i)=>n===win.__nodes[i]),'Nudge changed source/node/peer operation');
      pass('mouse/touch/keyboard holds, percentage dragging, bounds, cancel/lost capture/blur/view/pause and live-base restoration');
      const control=cards[0].querySelector('.tempo-slider');tempo(0,1.5);control.dispatchEvent(new win.MouseEvent('dblclick',{bubbles:true,cancelable:true}));assert(cards[0].querySelector('.tempo-slider output').textContent==='1.00×','Mouse Tempo reset');
      const tap=(type,id)=>control.dispatchEvent(new win.PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:true,button:0,clientX:40,clientY:40,bubbles:true}));
      tempo(0,1.5);tap('pointerdown',71);tap('pointerup',71);assert(cards[0].querySelector('.tempo-slider output').textContent==='1.50×','Single touch reset Tempo');tap('pointerdown',72);tap('pointerup',72);assert(cards[0].querySelector('.tempo-slider output').textContent==='1.00×','Double touch reset');
      tempo(0,1.5);tap('pointerdown',73);control.dispatchEvent(new win.PointerEvent('pointermove',{pointerId:73,pointerType:'touch',clientX:80,clientY:100,bubbles:true}));tap('pointerup',73);assert(cards[0].querySelector('.tempo-slider output').textContent==='1.50×','Drag interpreted as reset');
      pass('mouse double-click/touch double-tap reset; single touch and dragging preserved');
    } finally {restore.forEach(fn=>fn());}
    output.dataset.result='pass';
  }catch(error){output.textContent+='FAIL '+error.stack;output.dataset.result='fail';}
  finally{if(win){const audio=await win.eval("import('/app/audio/deck-audio.js')");await Promise.all(players.map(p=>audio.ejectAudio(p)));}frame.src='about:blank';frame.removeAttribute('srcdoc');await delay(20);indexedDB.deleteDatabase(name);}
};
