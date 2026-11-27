import { assertScrollingAligned } from './scrolling-waveform-tests.js';
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
  const name = 'waveform-zoom-' + crypto.randomUUID();
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
    await seekAll(10.25); decks.forEach(d => d.querySelector('.cue-pad').click());
    await delay(40); await seekAll(10);

    // Standalone bounded renderer uses the same Settings module as the live decks.
    const surface = doc.createElement('div');
    surface.style.cssText = 'position:fixed;left:-10000px;width:400px;height:160px;--accent:#ff5500';
    const canvas = doc.createElement('canvas'); surface.append(canvas); doc.body.append(surface);
    let rectangles = [];
    canvas.getContext = () => ({ save(){}, restore(){}, transform(){}, setTransform(){}, clearRect(){rectangles=[];}, beginPath(){}, rect(...args){rectangles.push(args);}, fill(){} });
    const module = await win.eval("import('/app/visual/waveform/scrolling-waveform.js')");
    renderer = module.createScrollingRenderer(surface, canvas, () => {});
    const summary = { minimum:new Float32Array(720000), maximum:new Float32Array(720000), rms:new Float32Array(720000), groupSeconds:.005 };
    for (const mode of ['horizontal','vertical']) {
      orientation.value = mode; orientation.dispatchEvent(new win.Event('change'));
      for (const seconds of [1,4,8]) {
        await seekAll(10); zoom(seconds);
        renderer.draw(summary,500);
        assert(rectangles.length >= seconds*400 && rectangles.length <= seconds*400+4, 'Visible-only group count '+seconds);
        assert(Math.abs(rectangles[0][2] - .005 * (mode==='vertical'?160:400)/seconds) < .00001, 'Drawing scale');
        assertScrollingAligned(doc);
        for (const [i,wave] of waves.entries()) {
          const marker = wave.querySelector('.scrolling-cue-marker');
          const expected = 50 + .25/seconds*100;
          assert(Math.abs(parseFloat(marker.style[mode==='vertical'?'top':'left'])-expected)<.01,'Cue zoom scale');
          pointer(wave,'pointerdown',.5,mode==='vertical',i%2===0);
          pointer(wave,'pointermove',.25,mode==='vertical',i%2===0);
          pointer(wave,'pointerup',.25,mode==='vertical',i%2===0);
        }
        await until(() => players.every(p => Math.abs(p.currentTime-(10+seconds/4))<.01), 'Seek zoom scale '+seconds+mode);
      }
    }
    await seekAll(10);
    pointer(waves[0],'pointerdown',.5,true);
    pointer(waves[0],'pointermove',.25,true);
    zoom(1);
    pointer(waves[0],'pointerup',.25,true);
    assert(players[0].currentTime===10,'Changing zoom committed a stale drag');
    zoom(1); assert(zoomIn.disabled && !zoomOut.disabled,'Minimum button limit');
    zoom(8); assert(zoomOut.disabled && !zoomIn.disabled,'Maximum button limit');
    zoom(4);
    assert(players.every((p,i)=>p.scrollingWaveform===analysis[i][0] && p.frequencyEnergy===analysis[i][1]),'Zoom repeated analysis');
    assert(decks.every((d,i)=>d.querySelector('.waveform-overview svg')===overviewCanvases[i]),'Overview replaced');
    pass('global 1/4/8-second drawing, cue and mouse/touch seek scales in both orientations; bounds and existing analysis/overview retained');

    await seekAll(10);
    decks.forEach(d => d.querySelector('.play-pause-button').click());
    await until(() => players.every(p=>!p.paused && p.currentTime>10.15),'Four-deck playback');
    for (const theme of ['default','glass-hardware','futuristic']) {
      const themeSelect=doc.querySelector('[aria-label="Visual theme"]'); themeSelect.value=theme; themeSelect.dispatchEvent(new win.Event('change'));
      await viewport(768,1024);
      assert(settings.getWaveformOrientation()==='horizontal' && doc.documentElement.dataset.waveformOrientation==='horizontal' && orientation.value==='vertical','Portrait override changed preference');
      const boxes=waves.map(w=>[w.clientWidth,w.clientHeight]);
      orientation.value='horizontal';orientation.dispatchEvent(new win.Event('change'));
      orientation.value='vertical';orientation.dispatchEvent(new win.Event('change'));
      assert(JSON.stringify(boxes)===JSON.stringify(waves.map(w=>[w.clientWidth,w.clientHeight])),'Portrait orientation changed box');
      const before=players.map(p=>p.currentTime);
      zoom(1); zoom(8); zoom(4);
      assert(players.every((p,i)=>p.currentTime-before[i]<.15),'Zoom jumped source position');
      await viewport(1114,768);
      assert(settings.getWaveformOrientation()==='vertical' && doc.documentElement.dataset.waveformOrientation==='vertical','Landscape preference not restored');
      assert(players.every((p,i)=>!p.paused&&p.currentTime>before[i]&&p.src===sources[i]),'Rotation interrupted playback');
    }
    assert(win.nodes.length===identities.length && identities.every((node,i)=>node===win.nodes[i]),'Rotation recreated Audio nodes');
    pass('three-theme portrait/landscape rotation restores preference with four sources/nodes/clocks retained; zoom never seeks');
    renderer.disconnect(); renderer=null;
    const audio=await win.eval("import('/app/audio/deck-audio.js')");await Promise.all(players.map(p=>audio.ejectAudio(p)));
    zoom(1); await mount(); doc=win.document;
    assert(doc.querySelector('[aria-label="Visible waveform duration"]').textContent==='1.0 s','Saved zoom missing after reload');
    assert(doc.querySelector('[aria-label="Scrolling waveform orientation"]').value==='vertical' && doc.querySelector('[aria-label="Visual theme"]').value==='futuristic','Zoom overwrote appearance/orientation');
    assert(doc.querySelector('[aria-label="Waveform coloring"]').value==='hues','Color mode preference did not persist');
    for (const invalid of [0,8.5,3.3,'4',null]) {
      localStorage.setItem(name,JSON.stringify({version:1,waveformWindowSeconds:invalid}));await mount();
      assert(win.document.querySelector('[aria-label="Visible waveform duration"]').textContent==='4.0 s','Invalid zoom not rejected');
    }
    pass('old preferences preserved, saved zoom restored, invalid/out-of-range/non-half-step values default safely');
    output.dataset.result='pass';
  } catch(error) { output.textContent+='FAIL '+error.stack;output.dataset.result='fail'; }
  finally {
    renderer?.disconnect();
    if(win){const audio=await win.eval("import('/app/audio/deck-audio.js')");await Promise.all(players.map(p=>audio.ejectAudio(p)));}
    frame.src='about:blank';frame.removeAttribute('srcdoc');localStorage.removeItem(name);indexedDB.deleteDatabase(name);
  }
};
