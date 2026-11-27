import { libraryTestStorageScript, createLibraryLoadingFixtures } from './library-loading-fixture.js';
const assert = (value, message) => { if (!value) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message) {
  for (let i = 0; i < 500; i++) { if (await test()) return; await delay(20); }
  throw Error(message);
}
function tone(win, name, frequency) {
  const rate=8000,count=rate*90,bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
  const text=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,count*2,true);
  for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.sin(i/rate*2*Math.PI*frequency)*4000,true);
  return new win.File([bytes],name,{type:'audio/wav'});
}

document.querySelector('#run').onclick = async () => {
  const output = document.querySelector('#results');
  const frame = document.querySelector('#application');
  const name = 'waveform-theme-' + crypto.randomUUID();
  output.dataset.result = 'running';
  output.textContent = '';
  const pass = message => output.textContent += 'PASS ' + message + '\n';
  let win, players = [], renderer;
  try {
    const source = await (await fetch('../tunetox.html')).text();
    const probe = '<script>window.players=[];window.nodes=[];const T=EventTarget;window.EventTarget=class extends T{constructor(){super();queueMicrotask(()=>{if("currentTime" in this)players.push(this);});}};const N=AudioWorkletNode;window.AudioWorkletNode=class extends N{constructor(...a){super(...a);nodes.push(this);}};const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){return get.call(this,k==="tunetox-settings-v1"?' + JSON.stringify(name) + ':k)};Storage.prototype.setItem=function(k,v){return set.call(this,k==="tunetox-settings-v1"?' + JSON.stringify(name) + ':k,v)};<\/script>';
    const html = source.replace('<head>', '<head><base href="' + new URL('../',location.href).href + '">' + libraryTestStorageScript(name, false) + probe);
    async function mount() {
      frame.srcdoc = html;
      await new Promise(resolve => frame.onload = resolve);
      win = frame.contentWindow;
      await until(() => win.players.length === 4 && win.document.querySelector('.waveform-zoom'), 'Application mount');
      players = win.players;
    }
    async function viewport(width, height) {
      frame.style.width = width + 'px'; frame.style.height = height + 'px'; frame.style.maxWidth = 'none';
      await delay(100);
    }
    await viewport(1114, 768);
    // Old settings without zoom remain valid and keep their saved orientation.
    localStorage.setItem(name, JSON.stringify({version:1, orientation:'vertical'}));
    await mount();
    let doc = win.document;
    const orientation = doc.querySelector('[aria-label="Scrolling waveform orientation"]');
    const zoomIn = doc.querySelector('[aria-label="Zoom in waveform"]');
    const zoomOut = doc.querySelector('[aria-label="Zoom out waveform"]');
    const duration = doc.querySelector('[aria-label="Visible waveform duration"]');
    const settings = await win.eval("import('/app/behavior/settings.js')");
    assert(duration.textContent === '4.0 s' && !zoomIn.closest('.application-settings'), 'Default/global zoom');
    function zoom(seconds) {
      while (settings.getWaveformWindowSeconds() !== seconds) {
        (settings.getWaveformWindowSeconds() > seconds ? zoomIn : zoomOut).click();
      }
      assert(duration.textContent === seconds.toFixed(1) + ' s', 'Duration display');
    }
    const fixtures = createLibraryLoadingFixtures(win, doc);
    for (let i = 0; i < 4; i++) {
      const transfer = new win.DataTransfer(); transfer.items.add(tone(win, 'Zoom ' + i + '.wav', 220));
      fixtures[i].files = transfer.files; fixtures[i].dispatchEvent(new win.Event('change'));
      await fixtures[i].fixtureCompletion;
    }
    const colorSelect=doc.querySelector('[aria-label="Waveform coloring"]');
    assert(colorSelect.value==='shades','Experimental shades should default');
    const colorBefore=[...doc.querySelectorAll('.scrolling-waveform canvas')].map(c=>c.toDataURL());
    const overviewGeometry=()=>JSON.stringify([...doc.querySelectorAll('.waveform-overview rect')].map(r=>['x','y','width','height','opacity'].map(a=>r.getAttribute(a))));
    const geometryBefore=overviewGeometry();
    colorSelect.value='hues';colorSelect.dispatchEvent(new win.Event('change'));
    assert([...doc.querySelectorAll('.scrolling-waveform canvas')].every((c,i)=>c.toDataURL()!==colorBefore[i]),'Mode switch did not recolor each scrolling view');
    assert(overviewGeometry()===geometryBefore,'Mode switch altered overview geometry');
    colorSelect.value='shades';colorSelect.dispatchEvent(new win.Event('change'));
    assert([...doc.querySelectorAll('.scrolling-waveform canvas')].every((c,i)=>c.toDataURL()===colorBefore[i]),'Mode switch did not restore shaded canvas');
    colorSelect.value='hues';colorSelect.dispatchEvent(new win.Event('change'));
    pass('default deck shades and selectable hue alternative recolor all decks without changing geometry');
    const decks = [...doc.querySelectorAll('.deck')];
    const waves = decks.map(deck => deck.querySelector('.scrolling-waveform'));
    const overviewCanvases = decks.map(deck => deck.querySelector('.waveform-overview svg'));
    const identities = [...win.nodes], sources = players.map(player => player.src);
    const analysis = players.map(player => [player.scrollingWaveform, player.frequencyEnergy]);
    const pointerRects = new WeakMap();
    function pointer(surface, type, fraction, vertical = false, touch = false) {
      if(type==='pointerdown') pointerRects.set(surface,surface.getBoundingClientRect());
      const rect = pointerRects.get(surface) || surface.getBoundingClientRect();
      surface.dispatchEvent(new win.PointerEvent(type, {
        pointerId:1, isPrimary:true, pointerType:touch?'touch':'mouse', button:0, bubbles:true,
        clientX:rect.x + rect.width * (vertical ? .5 : fraction),
        clientY:rect.y + rect.height * (vertical ? fraction : .5)
      }));
    }
    for (const deck of decks) for (const surface of deck.querySelectorAll('[role=slider]')) {
      let capture = false;
      surface.setPointerCapture = () => capture = true;
      surface.hasPointerCapture = () => capture;
      surface.releasePointerCapture = () => capture = false;
    }
    async function seekAll(seconds) {
      decks.forEach((deck,i) => {
        const overview = deck.querySelector('.waveform-overview');
        pointer(overview,'pointerdown',seconds / players[i].duration);
        pointer(overview,'pointerup',seconds / players[i].duration);
      });
      await until(() => players.every(p => Math.abs(p.currentTime-seconds)<.01) && decks.every(d => !d.querySelector('.play-pause-button').disabled), 'Absolute seek');
    }
    async function theme(value) {
      const select=doc.querySelector('[aria-label="Visual theme"]');
      select.value=value;select.dispatchEvent(new win.Event('change'));
      await delay(180);
    }
    const dimensions=()=>JSON.stringify(decks.map(d=>[...d.querySelectorAll('.performance-header,.performance-selector,.waveform-overview,.scrolling-waveform,.cue-pads,.stem-faders')].map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];})));
    for(const original of ['default','glass-hardware','futuristic']) {
      await theme(original);const before=dimensions();
      await theme('waveform');await theme(original);
      assert(dimensions()===before,'Original layout changed after theme roundtrip '+original);
    }
    pass('Default, Glass Hardware and Futuristic exact geometry roundtrips');
    await theme('waveform');await seekAll(10);
    const canvases=waves.map(w=>w.querySelector('canvas'));
    const buttons=decks.map(d=>d.querySelector('.performance-upper-toggle'));
    for(const b of buttons) {let capture=false;b.setPointerCapture=()=>capture=true;b.hasPointerCapture=()=>capture;b.releasePointerCapture=()=>capture=false;}
    for(const [i,d] of decks.entries()) {
      const wave=waves[i], r=wave.getBoundingClientRect(), area=d.querySelector('.performance-content').getBoundingClientRect();
      assert(Math.abs(r.top-area.top)<1 && Math.abs(r.height-area.height)<1,'Waveform does not fill content');
      assert(Math.abs(wave.querySelector('.playhead').getBoundingClientRect().top-(r.top+r.height/2))<1,'Playhead not centered');
      assert(d.querySelector('.performance-lower-toggle').hidden && d.querySelector('.performance-selector').getBoundingClientRect().width<100,'Selector not compact');
      for(const config of ['Cues','Stems','Controls']) {
        assert(buttons[i].textContent===config,'Configuration order');
        assert(!d.querySelector('.wave-view').hidden,'Waveform concealed by '+config);
        assert([!d.querySelector('.cues-view').hidden,!d.querySelector('.stems-view').hidden,!d.querySelector('.controls').hidden].filter(Boolean).length===1,'Configurations not exclusive');
        assert(wave.querySelector('canvas')===canvases[i],'Waveform recreated');
        if(config==='Stems') {
          const f=d.querySelector('.stem-faders input');f.value='37';f.dispatchEvent(new win.Event('input'));
          assert(d.querySelector('.stem-faders output').textContent==='37%','Existing stem Behavior not connected');
          assert(win.getComputedStyle(f).writingMode==='vertical-lr','Stems not vertical');
        }
        buttons[i].click();
      }
    }
    pass('all decks: full-area centered waveform, compact cyclic selector, exclusive existing controls and canonical stems');
    const b=buttons[0], br=b.getBoundingClientRect();
    const selectPointer=(type,y)=>b.dispatchEvent(new win.PointerEvent(type,{pointerId:77,isPrimary:true,pointerType:'touch',button:0,bubbles:true,clientX:br.x+br.width/2,clientY:y}));
    selectPointer('pointerdown',br.y+10);selectPointer('pointermove',br.y-54);
    assert(b.textContent==='Controls','Continuous upward selector');
    selectPointer('pointermove',br.y-22);assert(b.textContent==='Stems','Continuous reverse selector');
    selectPointer('pointerup',br.y-22);b.dispatchEvent(new win.MouseEvent('click',{bubbles:true,detail:1}));
    assert(b.textContent==='Stems','Duplicate click after slide');
    b.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    assert(b.textContent==='Cues','Keyboard selector');
    // Side-zone gaps are protected, as are actual controls; central gestures seek.
    for(const x of [.1,.9]) {
      const r=waves[0].getBoundingClientRect();
      for(const type of ['pointerdown','pointermove','pointerup']) waves[0].dispatchEvent(new win.PointerEvent(type,{pointerId:1,isPrimary:true,button:0,bubbles:true,clientX:r.x+r.width*x,clientY:r.y+r.height*(type==='pointerdown'?.5:.25)}));
      assert(players[0].currentTime===10,'Side zone sought');
    }
    const pad=decks[0].querySelector('.cue-pad');pad.click();await delay(30);
    assert(!waves[0].querySelector('.scrolling-cue-marker').hidden,'Cue set/marker disconnected');
    const sourcePosition=players[0].currentTime;
    for(const element of [pad,decks[0].querySelector('.stem-faders input'),decks[0].querySelector('.filter-knob'),decks[0].querySelector('.nudge-controls button')]) {
      element.dispatchEvent(new win.PointerEvent('pointerdown',{pointerId:3,isPrimary:true,button:0,bubbles:true,clientX:20,clientY:200}));
      element.dispatchEvent(new win.PointerEvent('pointermove',{pointerId:3,bubbles:true,clientX:20,clientY:100}));
      element.dispatchEvent(new win.PointerEvent('pointercancel',{pointerId:3,bubbles:true}));
      assert(players[0].currentTime===sourcePosition,'Performance control sought');
    }
    const originalHead=waves[0].querySelector('.playhead').getBoundingClientRect().top;
    pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.4,true);
    assert(doc.querySelectorAll('.waveform-comparison-expanded').length===4,'Theme comparison not active');
    for(const [i,w] of waves.entries()) {
      assert(w.getBoundingClientRect().height===decks[i].clientHeight,'Comparison not full deck');
      assert(Math.abs(w.querySelector('.playhead').getBoundingClientRect().top-originalHead)<1,'Comparison shifted playhead');
    }
    pointer(waves[0],'pointerup',.4,true);await until(()=>Math.abs(players[0].currentTime-10.4)<.02,'Central seek');
    assert(!doc.querySelector('.waveform-comparison-expanded'),'Comparison did not restore');
    pass('continuous selector, protected side/control gestures, cues and canonical full-deck comparison/seek');
    decks.forEach(d=>d.querySelector('.play-pause-button').click());await until(()=>players.every(p=>!p.paused),'Four-deck playback');
    doc.querySelector('.global-nudge button').dispatchEvent(new win.KeyboardEvent('keydown',{key:'End',bubbles:true}));
    const held=decks[1].querySelectorAll('.nudge-controls button')[1];
    buttons[1].click();
    held.dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',bubbles:true}));
    assert(held.getAttribute('aria-pressed')==='true','Nudge unavailable over Stems');
    held.dispatchEvent(new win.KeyboardEvent('keyup',{key:' ',bubbles:true}));
    buttons[1].click();
    held.dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',bubbles:true}));
    assert(held.getAttribute('aria-pressed')==='true','Nudge unavailable over Controls');
    held.dispatchEvent(new win.KeyboardEvent('keyup',{key:' ',bubbles:true}));
    const positions=players.map(p=>p.currentTime);
    for(const value of ['default','waveform','glass-hardware','waveform','futuristic','waveform']) await theme(value);
    assert(players.every((p,i)=>!p.paused&&p.currentTime>positions[i]&&p.src===sources[i]),'Theme interrupted playback');
    assert(win.nodes.length===identities.length&&identities.every((n,i)=>n===win.nodes[i]),'Theme recreated Audio');
    decks[0].querySelector('.library-button').click();assert(!decks[0].querySelector('.library-view').hidden,'Library not connected');
    decks[0].querySelector('.back-to-performance-button').click();
    assert(!decks[0].querySelector('.wave-view').hidden,'Library return lost waveform');
    assert(waves.every((w,i)=>w.querySelector('canvas')===canvases[i]),'Configuration/theme recreated waveform');
    pass('playing theme switches preserve all source clocks/Audio/canvas identities; Library roundtrip');
    const audio=await win.eval("import('/app/audio/deck-audio.js')");
    await Promise.all(players.map(p=>audio.ejectAudio(p)));
    await mount();doc=win.document;await delay(180);
    assert(doc.documentElement.dataset.theme==='waveform','Experimental theme preference not retained');
    assert(doc.querySelector('.global-nudge button').textContent==='2%','Global nudge startup default');
    assert([...doc.querySelectorAll('.performance-upper-toggle')].every(b=>b.textContent==='Cues'),'Initial configuration after reload');
    pass('saved experimental theme reload and session-local global 2% default');
    output.dataset.result='pass';
  } catch(error) { output.textContent+='FAIL '+error.stack;output.dataset.result='fail'; }
  finally {
    renderer?.disconnect();
    if(win){const audio=await win.eval("import('/app/audio/deck-audio.js')");await Promise.all(players.map(p=>audio.ejectAudio(p)));}
    frame.src='about:blank';frame.removeAttribute('srcdoc');localStorage.removeItem(name);indexedDB.deleteDatabase(name);
  }
};
