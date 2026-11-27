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
  const name = 'waveform-comparison-' + crypto.randomUUID();
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
    await seekAll(13); decks.forEach(d=>d.querySelector('.cue-pad').click());
    await seekAll(10);
    const module=await win.eval("import('/app/visual/waveform/scrolling-waveform.js')");
    const boxes=()=>waves.map(w=>[w.offsetLeft,w.offsetTop,w.clientWidth,w.clientHeight]);
    const originalBoxes=JSON.stringify(boxes());
    const overviewBoxes=()=>decks.map(d=>{const r=d.querySelector('.waveform-overview').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
    const originalOverviews=JSON.stringify(overviewBoxes());
    const expanded=()=>waves.filter(w=>w.classList.contains('waveform-comparison-expanded'));
    function restored() {
      assert(!expanded().length,'Expansion remained');
      assert(JSON.stringify(boxes())===originalBoxes,'Normal geometry not restored');
      assert(decks.every(d=>!d.querySelector('.performance-lower-section').inert),'Lower controls remained inert');
    }
    for(const seconds of [1,4,8]) {
      zoom(seconds); await seekAll(10);
      const before=module.getScrollingGeometry(waves[0]);
      pointer(waves[1],'pointerdown',.5,true);
      pointer(waves[0],'pointerdown',.5,true);
      assert(!expanded().length,'Tap expanded');
      pointer(waves[0],'pointermove',.25,true,true);
      assert(expanded().length===4,'Four waveforms did not expand');
      assert(waves[0].hasPointerCapture(1),'Capture lost');
      assert(!waves[1].hasPointerCapture(1),'Existing passive seek was not cancelled');
      const playheads=waves.map(w=>w.querySelector('.playhead').getBoundingClientRect().top);
      assert(Math.max(...playheads)-Math.min(...playheads)<1,'Playheads not aligned');
      for(const [i,w] of waves.entries()) {
        const geometry=module.getScrollingGeometry(w);
        assert(geometry.pixelsPerSecond===before.pixelsPerSecond,'Time scale changed');
        assert(geometry.visibleAxis>before.visibleAxis,'No additional source time');
        assert(decks[i].querySelector('.performance-lower-section').inert,'Covered controls active');
        assert(win.getComputedStyle(w.querySelector('[data-waveform-control]')).visibility==='hidden','Nudge remained visible');
      }
      assert(JSON.stringify(overviewBoxes())===originalOverviews,'Overview moved');
      const passive=players[1].currentTime;
      waves[1].dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      pointer(waves[1],'pointerdown',.5,true);pointer(waves[1],'pointerup',.1,true);
      assert(players[1].currentTime===passive,'Passive waveform sought');
      pointer(waves[0],'pointerup',.25,true,true);
      await until(()=>Math.abs(players[0].currentTime-(10+seconds/4))<.02,'Expanded seek scale');
      restored();
    }
    pass('1/4/8-second four-deck expansion preserves scale, capture, playheads, overview and owner-only seek');
    zoom(4);await seekAll(10);
    // Cue beyond the normal window appears only in the revealed continuation.
    assert(waves[0].querySelector('.scrolling-cue-marker').hidden,'Distant cue initially visible');
    pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.47,true);
    assert(!waves[0].querySelector('.scrolling-cue-marker').hidden,'Continuation cue missing');
    pointer(waves[0],'pointercancel',.47,true);restored();
    assert(players[0].currentTime===10,'Cancel sought');
    for(const event of ['blur','resize']) {
      pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.25,true);
      win.dispatchEvent(new win.Event(event));restored();
      pointer(waves[0],'pointerup',.25,true);assert(players[0].currentTime===10,'Stale release sought');
    }
    for(const cancel of [
      ()=>pointer(waves[0],'lostpointercapture',.25,true),
      ()=>doc.dispatchEvent(new win.Event('tunetox-theme-change')),
      ()=>{decks[0].querySelector('.library-button').click();decks[0].querySelector('.back-to-performance-button').click();},
      ()=>zoom(1)
    ]) {
      pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.25,true);
      cancel();restored();pointer(waves[0],'pointerup',.25,true);
      assert(players[0].currentTime===10,'Cancellation committed stale preview');zoom(4);
    }
    // Other sections do not participate, and their presentation remains unchanged.
    decks[2].querySelector('.performance-upper-toggle').click();
    decks[3].querySelector('.library-button').click();
    pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.25,true);
    assert(expanded().length===2,'Stems/Library participated');
    pointer(waves[0],'pointercancel',.25,true);
    decks[2].querySelector('.performance-upper-toggle').click();
    decks[3].querySelector('.back-to-performance-button').click();
    restored();
    pass('continuation cues, cancellation, resize/blur/zoom cleanup and Stems/Library exclusion');
    for(const mode of ['horizontal','vertical']) {
      orientation.value=mode;orientation.dispatchEvent(new win.Event('change'));
      if(mode==='vertical') await viewport(768,1024);
      pointer(waves[0],'pointerdown',.5);pointer(waves[0],'pointermove',.25);
      assert(!expanded().length,'Horizontal/portrait expanded');pointer(waves[0],'pointercancel',.25);
    }
    await viewport(1114,768);
    // Passive deck transport continues untouched during owner preview.
    decks[1].querySelector('.play-pause-button').click();await until(()=>!players[1].paused,'Passive playback');
    const before=players[1].currentTime;
    pointer(waves[0],'pointerdown',.5,true);pointer(waves[0],'pointermove',.25,true);
    await delay(150);
    assert(!players[1].paused&&players[1].currentTime>before,'Passive playback interrupted');
    assert(players[2].paused,'Paused passive started');
    pointer(waves[0],'pointercancel',.25,true);
    assert(win.nodes.length===identities.length && identities.every((n,i)=>n===win.nodes[i]),'Audio recreated');
    assert(players.every((p,i)=>p.src===sources[i]&&p.scrollingWaveform===analysis[i][0]&&p.frequencyEnergy===analysis[i][1]),'Sources/analysis replaced');
    pass('horizontal/portrait unaffected; passive playback/paused state, Audio identities and analysis retained');
    output.dataset.result='pass';
  } catch(error) { output.textContent+='FAIL '+error.stack;output.dataset.result='fail'; }
  finally {
    renderer?.disconnect();
    if(win){const audio=await win.eval("import('/app/audio/deck-audio.js')");await Promise.all(players.map(p=>audio.ejectAudio(p)));}
    frame.src='about:blank';frame.removeAttribute('srcdoc');localStorage.removeItem(name);indexedDB.deleteDatabase(name);
  }
};
