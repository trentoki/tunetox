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
    function box(node) { const r=node.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }
    const head=waves[0].querySelector('.playhead'), wr=waves[0].getBoundingClientRect(), hr=head.getBoundingClientRect();
    assert(Math.abs(hr.left-(wr.left+wr.width*.28))<1 && Math.abs(hr.right-(wr.right-wr.width*.28))<1,'Playhead side boundaries');
    assert(hr.height===1 && win.getComputedStyle(head).boxShadow==='none','Playhead not thin/clean');
    const marker=waves[0].querySelector('.scrolling-cue-marker'), mr=marker.getBoundingClientRect();
    assert(Math.abs(mr.left-hr.left)<1 && Math.abs(mr.right-hr.right)<1,'Cue side boundaries');
    assert(marker.firstChild.getBoundingClientRect().left>=hr.left,'Cue label overlaps side');
    const loop=decks[0].querySelector('.loop-controls');
    assert([...loop.children].filter(n=>win.getComputedStyle(n).display!=='none').length===1 && !loop.querySelector('.glass-preview-shift').hidden,'Only Shift should remain');
    const shift=loop.querySelector('.glass-preview-shift');
    shift.click();assert(shift.getAttribute('aria-pressed')==='true','Relocated Shift did not latch');
    pad.click();await delay(25);assert(waves[0].querySelector('.scrolling-cue-marker').hidden,'Relocated Shift did not clear cue');
    shift.click();pad.click();await delay(25);
    const pitch=decks[0].querySelector('.pitch-slider input'), tempo=decks[0].querySelector('.tempo-slider input');
    assert(!pitch.disabled && win.getComputedStyle(decks[0].querySelector('.pitch-slider')).cursor==='ns-resize','Shared pitch preview wheel unavailable');
    const oldTempo=tempo.value;
    pitch.value='750';pitch.dispatchEvent(new win.Event('input'));
    assert(decks[0].querySelector('.pitch-slider output').textContent==='75%' && tempo.value===oldTempo,'Pitch preview changed Tempo');
    for(const config of ['Cues','Stems','Controls']) {
      assert(buttons[0].textContent===config,'Configuration before seek');
      const selectors='.performance-header,.waveform-overview,.performance-selector,.cue-pad,.stem-faders input,.controls button,.nudge-controls button';
      const elements=[...decks[0].querySelectorAll(selectors)].filter(n=>n.getClientRects().length);
      const before=JSON.stringify(elements.map(box));
      const position=players[0].currentTime;
      pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.4,true);
      assert(!doc.querySelector('.waveform-comparison-expanded'),'Waveform theme expanded');
      assert(JSON.stringify(elements.map(box))===before && elements.every(n=>win.getComputedStyle(n).visibility==='visible'),'Controls moved/concealed during seek '+config);
      assert(!decks[0].querySelector('.performance-header').inert,'Header disabled during seek');
      pointer(waves[0],'pointerup',.4,true);
      await until(()=>Math.abs(players[0].currentTime-position-.4)<.02,'Central seek '+config);
      buttons[0].click();
    }
    const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    buttons[0].click();buttons[0].click(); // Controls
    const controls=[...decks[0].querySelectorAll('.controls > div:first-child > label,.effects-controls > div')].filter(n=>n.getClientRects().length);
    const nudges=[...decks[0].querySelectorAll('.nudge-controls button')].map(n=>n.getBoundingClientRect());
    controls.forEach(n=>{const r=n.getBoundingClientRect();assert((r.right<=hr.left||r.left>=hr.right)&&nudges.every(b=>!overlaps(r,b)),'Control overlaps central waveform/nudge');});
    const order=[...decks[0].querySelectorAll('.controls > div:first-child > label')].sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top).map(n=>n.querySelector('span').textContent);
    assert(order.join(',')==='Filter,High,Mid,Low','Filter/EQ order');
    assert(decks[0].querySelectorAll('.effects-controls > div').length===3 && [...decks[0].querySelectorAll('.effects-controls > div')].filter(n=>n.getClientRects().length).length===3,'Three effect slots');
    buttons[0].click();
    decks.forEach(d=>d.querySelectorAll('.cue-pad')[7].click());await delay(30);
    // Both portrait preferences are usable; the three original themes retain H.
    for(const size of [[1114,768],[768,1024]]) {
      await viewport(...size);
      for(const mode of ['horizontal','vertical']) {
        orientation.value=mode;orientation.dispatchEvent(new win.Event('change'));
        assert(doc.documentElement.dataset.waveformOrientation===mode,'Waveform saved portrait direction');
        for(const [i,d] of decks.entries()) {
          const b=buttons[i], wave=waves[i];
          for(const config of ['Cues','Stems','Controls']) {
            assert(b.textContent===config,'Viewport configuration order');
            const r=wave.getBoundingClientRect();
            const paint=wave.querySelector('.playhead').getBoundingClientRect();
            const edge=mode==='vertical'?paint.top:paint.left;
            const length=mode==='vertical'?paint.height:paint.width;
            const center=mode==='vertical'?r.top+r.height/2:r.left+r.width/2;
            assert(Math.abs(edge*win.devicePixelRatio-Math.round(edge*win.devicePixelRatio))<.01,'Playhead fractional paint edge');
            assert(Math.abs(edge+length/2-center)<=.5/win.devicePixelRatio+.01,'Playhead not centered to nearest device pixel');
            const sideNodes=[...d.querySelectorAll('.cue-pad,.glass-preview-shift,.stem-faders label,.controls > div:first-child > label,.effects-controls > div,.nudge-controls button')].filter(n=>n.getClientRects().length);
            const boxes=sideNodes.map(n=>n.getBoundingClientRect());
            for(let a=0;a<boxes.length;a++) {
              const box=boxes[a];
              assert(box.left>=r.left-1 && box.right<=r.right+1 && box.top>=r.top-1 && box.bottom<=r.bottom+1,'Side control outside deck '+size+config);
              assert(box.right<=r.left+r.width*.28+1 || box.left>=r.right-r.width*.28-1,'Side control obstructs center');
              assert(boxes.slice(a+1).every(other=>!overlaps(box,other)),'Side controls overlap '+size+config);
            }
            const nudge=d.querySelector('.nudge-controls').getBoundingClientRect();
            assert(nudge.bottom<=r.bottom && nudge.bottom>=r.bottom-6,'Nudges not at bottom');
            if(config==='Controls') {
              const nudge=d.querySelectorAll('.nudge-controls button')[1].getBoundingClientRect();
              const slots=[...d.querySelectorAll('.effects-controls > div')];
              assert(slots.length===3 && slots.every(n=>n.getClientRects().length),'All three effects visible');
              for(const slot of slots) {
                const selector=slot.querySelector('.effect-selector').getBoundingClientRect();
                const knob=slot.querySelector('.effect-knob').getBoundingClientRect();
                assert(Math.abs(selector.width-nudge.width)<.1 && Math.abs(selector.left-nudge.left)<.1,'Effect selector/nudge width and edges');
                assert(selector.height>=30 && selector.bottom<=knob.top,'Tall selector above its amount knob');
              }
            }
            if(config==='Cues') {
              const pads=[...d.querySelectorAll('.cue-pad')].map(n=>n.getBoundingClientRect());
              assert(pads.every(p=>p.height>44),'Pads not larger than original');
              assert(pads.slice(0,4).every((p,j)=>!j||p.top>pads[j-1].top),'Cue numbering order');
              assert(win.getComputedStyle(d.querySelectorAll('.cue-pad')[6]).backgroundColor==='rgba(8, 20, 29, 0.333)','Dark translucent unassigned pad face');
              const nudges=[...d.querySelectorAll('.nudge-controls button')].map(n=>n.getBoundingClientRect());
              pads.forEach((p,j)=>{const n=nudges[j<4?0:1];assert(Math.abs(p.width-n.width)<.1 && Math.abs(p.left-n.left)<.1,'Cue/nudge edges aligned');});
              assert(win.getComputedStyle(wave,'::before').content==='none','Invisible seek boundaries');
              assert([...d.querySelectorAll('.stem-faders span')].map(n=>n.firstChild.textContent).join(',')==='Beat,Bass,Tune,Voice','Visible stem names');
            }
            const position=players[i].currentTime;
            pointer(wave,'pointerdown',.5,mode==='vertical');pointer(wave,'pointermove',.4,mode==='vertical');pointer(wave,'pointerup',.4,mode==='vertical');
            await until(()=>Math.abs(players[i].currentTime-position-.4)<.02,'Portrait/landscape seek '+mode);
            b.click();
          }
        }
      }
    }
    for(const themeName of ['default','glass-hardware','futuristic']) {
      await theme(themeName);assert(doc.documentElement.dataset.waveformOrientation==='horizontal','Original portrait restriction changed');
    }
    await theme('waveform');assert(doc.documentElement.dataset.waveformOrientation==='vertical','Waveform portrait preference not restored');
    await viewport(1114,768);
    pass('larger dark cue rows, bottom nudges, exact control order/three slots, four-deck portrait H/V geometry and seeking');
    pass('Futuristic wheel preview, clean bounded playhead/cues, Shift-only row, side Controls and stationary all-configuration seeking');
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
