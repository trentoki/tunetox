"""Phase 1F: four actual native voices, cache identity, UI gains, lifecycle and a bounded soak.
Chrome CDP 9230; desktop evidence only, not physical Safari or long-run stability.
"""
import base64,json,runpy,subprocess,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP']
endpoint='http://127.0.0.1:9230'
tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl'])
browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl'])
checks=0;rss=[];timings=[]
def check(v,label):
 global checks
 assert v,label
 checks+=1;print('PASS:',label,flush=True)
def ev(code):return c.evaluate(code)
def click(selector):
 r=json.loads(ev(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
 assert r['width']>0 and r['height']>0,selector
 for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
 time.sleep(.08)
def mode(id,name):click(f'.design-deck[data-deck="{id}"] .column-mode-button[data-mode={name}]')
def gain(id,index,value):
 selector=f'#overlay-main-{id}' if index is None else f'#demo-deck-{id}-stem-{index}'
 ev(f"(()=>{{const x=document.querySelector('{selector}');x.value={value};x.dispatchEvent(new Event('input'));}})()");time.sleep(.07)
def native(id):return f'TuneToxDesign.playable.controller.mixer.getDeck({id})'
def state():return ev('JSON.stringify(TuneToxDesign.playable.getSnapshot())')
def sample_memory():
 try:
  ids=[str(p['id']) for p in browser.call('SystemInfo.getProcessInfo')['processInfo'] if p['type']=='renderer']
  vals=subprocess.check_output(['ps','-o','rss=','-p',','.join(ids)],text=True).split()
  rss.append(sum(int(v) for v in vals)*1024)
 except Exception as e:print('RSS unavailable',str(e),flush=True)
try:
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
 c.call('Page.navigate',{'url':'http://192.168.50.24:8766/performance-four?build=1f-f1'});time.sleep(1)
 check(ev("document.querySelector('#design-build').textContent==='1F F1'"),'F1 unmistakable build')
 check(ev("TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==='uncreated'"),'No context until gesture')
 for id in [1,2,3,4]:
  mode(id,'library');song='hypnotic' if id%2 else 'cut-me-loose'
  click(f'.design-deck[data-deck="{id}"] [data-song-id="{song}"] .song-select')
  start=time.monotonic();click(f'.design-deck[data-deck="{id}"] .column-load-button:nth-of-type({id})')
  for i in range(240):
   time.sleep(.2)
   sample_memory()
   if ev('TuneToxDesign.playable.controller.busy().loadingId===null'):break
  timings.append(time.monotonic()-start)
  check(ev(f'{native(id)}.getState().loaded && !{native(id)}.getState().isPlaying'),f'Loaded D{id}, no autoplay')
  check(ev(f'appState.decks[{id-1}].volume===0'),f'D{id} loading preserves zero Main')
  if id>1:check(ev(f'{native(1)}.getState().isPlaying'),'Earlier source continues during other loads')
  mode(id,'waveform')
  for index in [0,2,3]:gain(id,index,0)
  click(f'.design-deck[data-deck="{id}"] .waveform-matching [data-control=handoff]')
  gain(id,1,1 if id==1 else .25);mode(id,'controls');gain(id,None,1)
  click(f'.design-deck[data-deck="{id}"] .performance-play');mode(id,'waveform')
  check(ev(f'{native(id)}.getDiagnostics().sourceStartCalls===4'),f'Four source starts in deck {id}')
  if id==2:
   gain(1,1,.5);gain(2,1,.5)
   check(ev('appState.decks.slice(0,2).every(d=>Math.abs(d.stems.allocatedLevels.flow-.5)<1e-6)'),'Two-way sharing')
  if id==3:
   gain(3,1,.8)
   check(ev('Math.abs(appState.decks[0].stems.allocatedLevels.flow-.1)<1e-6 && Math.abs(appState.decks[1].stems.allocatedLevels.flow-.1)<1e-6'),'Three-way proportional sharing')
  sample_memory()
 check(ev('[1,2,3,4].every(id=>'+native('id')+'.getState().isPlaying)'),'All four real decks simultaneously playing')
 check(ev(native(1)+'.getDecodedBuffers().flow==='+native(3)+'.getDecodedBuffers().flow && '+native(2)+'.getDecodedBuffers().flow==='+native(4)+'.getDecodedBuffers().flow'),'Actual AudioBuffer identity shared across repeated songs')
 check(ev('TuneToxDesign.playable.controller.diagnostics().loads.map(x=>x.reused).join()===\"false,false,true,true\"'),'Only first two songs decoded; repeats reuse')
 for id in [1,2,3,4]:gain(id,1,.25)
 check(ev('appState.decks.every(d=>Math.abs(d.stems.allocatedLevels.flow-.25)<1e-6)'),'Four-way 25/25/25/25')
 gain(4,1,.8)
 check(ev('appState.decks.slice(0,3).every(d=>Math.abs(d.stems.allocatedLevels.flow-.2/3)<1e-6)'),'Direct 80% leaves three proportional 6.67% peers')
 # Fractional display never changes the fixed-width readout or precise native allocation.
 check(ev("appState.decks.every(d=>{const x=document.querySelector('#demo-deck-'+d.id+'-stem-1');const n=TuneToxDesign.playable.controller.mixer.getDeck(d.id).getDiagnostics();return Math.abs(n.stems.flow.reportedAudioParamValue-d.stems.allocatedLevels.flow)<1e-6 && Math.abs(Number(x.value)-d.stems.allocatedLevels.flow)<1e-9 && x.previousElementSibling.querySelector('output').value===(Math.round(d.stems.allocatedLevels.flow*1000)/10)+'%';})"),'Native gains match precise allocations and fractional readouts and exact thumb positions')
 geometry=ev("JSON.stringify(Array.from(document.querySelectorAll('.stem-controls input')).map(x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}))")
 gain(4,1,.99)
 check(ev("document.querySelector('#demo-deck-1-stem-1').previousElementSibling.querySelector('output').value==='0.3%'"),'Small positive automatic allocation is visibly nonzero')
 check(ev("JSON.stringify(Array.from(document.querySelectorAll('.stem-controls input')).map(x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}))")==geometry,'Fractional percentage changes preserve all stem track geometry')
 gain(1,1,1)
 check(ev('appState.decks.slice(1).every(d=>d.stems.allocatedLevels.flow===0 && d.stems.requestedLevels.flow>0)'),'Automatically suppressed zeros retain positive requests')
 gain(1,1,.5)
 check(ev('appState.decks.slice(1).every(d=>d.stems.allocatedLevels.flow>0)'),'Eligible automatically suppressed stems restore')
 # Lower Main headroom before independent tests; no all-stem summing assumption.
 for id in [1,2,3,4]:mode(id,'controls');gain(id,None,.2);mode(id,'waveform')
 before=ev('JSON.stringify({stem:appState.decks[3].stems,elig:appState.stemSession.eligibilityByDeck[4],auth:appState.stemSession.authorization})')
 mode(4,'controls');gain(4,None,0)
 check(ev('JSON.stringify({stem:appState.decks[3].stems,elig:appState.stemSession.eligibilityByDeck[4],auth:appState.stemSession.authorization})')==before,'Main zero preserves coefficients, requests, historical eligibility and high-water')
 check(ev(native(4)+'.getDiagnostics().reportedMainAudioParamValue===0 && appState.stemSession.nativeHandoff.members[4] && '+native(4)+'.getState().isPlaying'),'Main zero physically mutes without departure or pause')
 gain(4,None,.2);mode(4,'waveform')
 gain(2,1,0);gain(1,1,.2)
 check(ev('appState.decks[1].stems.allocatedLevels.flow===0 && appState.decks[1].stems.requestedLevels.flow===0'),'Explicit zero protected in four-deck interaction')
 before=ev('JSON.stringify(appState.decks.map(d=>d.stems))');click('.design-deck[data-deck="4"] .waveform-matching [data-control=handoff]')
 check(ev('JSON.stringify(appState.decks.map(d=>d.stems))')==before,'OFF preserves all allocations')
 before=ev('JSON.stringify(appState.decks.slice(0,3).map(d=>d.stems))');gain(4,1,1)
 check(ev('JSON.stringify(appState.decks.slice(0,3).map(d=>d.stems))')==before,'Fourth independent source does not consume participating capacity')
 for index in [0,2,3]:
  for id in [1,2,3,4]:gain(id,index,.15)
  check(ev(f'appState.decks.every(d=>Math.abs(TuneToxDesign.playable.controller.mixer.getDeck(d.id).getDiagnostics().stems[prototypeStemNames[{index}]].reportedAudioParamValue-.15)<1e-6)'),f'Real native category {index} gain on every deck')
  for id in [1,2,3,4]:gain(id,index,0)
 for pattern_index,pattern in enumerate([[],[1,3],[2,4],[1,2,3,4]]):
  before=ev('JSON.stringify(appState.decks.map(d=>d.stems))')
  for id in [1,2,3,4]:
   actual=ev(f'appState.participation.byDeck[{id}].stemHandoff')
   if actual!=(id in pattern):click(f'.design-deck[data-deck="{id}"] .waveform-matching [data-control=handoff]')
  check(ev('JSON.stringify(appState.decks.map(d=>d.stems))')==before,'Participation pattern preserves allocations '+str(pattern))
  for id in [1,2,3,4]:gain(id,1,.15+pattern_index*.01+id*.01)
  check(ev('[1,2,3,4].every(id=>'+native('id')+'.getState().isPlaying) && !TuneToxDesign.playable.controller.mixer.getLastSchedulingFailure()'),'Four real transports continue for '+str(pattern))
  check(ev('appState.decks.filter(d=>appState.participation.byDeck[d.id].stemHandoff).reduce((sum,d)=>sum+d.volume*d.stems.allocatedLevels.flow,0)<=1+1e-6'),'Pattern participating cap enforced')
 # Rapid bounded stress through the real mounted UI callbacks.
 ev("(()=>{for(let i=0;i<100;i++){const id=i%4+1;const x=document.querySelector('#demo-deck-'+id+'-stem-1');x.value=[.2,.4,.6,.8][i%4];x.dispatchEvent(new Event('input'));}})()")
 time.sleep(.1)
 check(ev('[1,2,3,4].every(id=>'+native('id')+'.getState().isPlaying) && !TuneToxDesign.playable.controller.mixer.getLastSchedulingFailure()'),'Rapid four-deck gestures do not interrupt transport')
 # 30-second desktop soak. A zero output passage is not automatically a failure.
 soak_start=time.monotonic();last=ev('[1,2,3,4].map(id=>'+native('id')+'.getState().position)');output_seen=False
 for i in range(30):
  time.sleep(1);positions=ev('[1,2,3,4].map(id=>'+native('id')+'.getState().position)')
  check(all(a>b for a,b in zip(positions,last)),'Four independent clocks advance, soak '+str(i+1));last=positions
  check(ev('[1,2,3,4].every(id=>'+native('id')+'.getState().isPlaying) && !TuneToxDesign.playable.controller.mixer.getLastSchedulingFailure()'),'No stop/scheduling failure during bounded soak')
  if ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().outputMeter.peak')>.0001:output_seen=True
  sample_memory()
 check(output_seen,'Nonzero shared destination observed (not hardware audibility)')
 print('LOAD_SECONDS_INCLUDING_TEST_POLLING',timings,flush=True)
 print('NATIVE_LOAD_METRICS',ev('JSON.stringify(TuneToxDesign.playable.controller.diagnostics().loads)'),flush=True)
 print('MEMORY',ev('JSON.stringify(TuneToxDesign.playable.controller.diagnostics().sharedPCM)'),flush=True)
 print('CHROME_RENDERERS_MAX_SAMPLED_RSS_MIB',max(rss)/1048576 if rss else None,flush=True)
 print('SOAK_SECONDS',time.monotonic()-soak_start,flush=True)
 # Pause, Stop and explicit replacement; unaffected decks continue.
 before=ev('JSON.stringify(appState.decks.map(d=>d.stems))');mode(2,'controls');click('.design-deck[data-deck="2"] .performance-play')
 check(ev('JSON.stringify(appState.decks.map(d=>d.stems))')==before,'Pause retains allocations')
 click('#audio-open');click('#audio-actions button:nth-child(1)');click('#audio-close')
 check(ev(native(1)+'.getState().position===0 && appState.stemSession.nativeHandoff.members[1]'),'Stop resets position and retains ownership')
 check(ev(native(3)+'.getState().isPlaying && '+native(4)+'.getState().isPlaying'),'Other voices continue')
 mode(3,'library');click('.design-deck[data-deck="3"] [data-song-id="cut-me-loose"] .song-select');click('.design-deck[data-deck="3"] .column-load-button:nth-of-type(3)')
 check(ev('appState.decks[2].song.id===\"hypnotic\" && '+native(3)+'.getState().isPlaying'),'Replacement requires explicit Release and does not silently stop old source')
 click('#audio-open');click('#audio-actions button:nth-child(6)');click('#audio-close')
 check(ev('!appState.stemSession.nativeHandoff.members[3]'),'Release departs ownership')
 click('.design-deck[data-deck="3"] .column-load-button:nth-of-type(3)')
 for i in range(100):
  time.sleep(.1)
  if ev('TuneToxDesign.playable.controller.busy().loadingId===null'):break
 check(ev('appState.decks[2].song.id===\"cut-me-loose\" && !'+native(3)+'.getState().isPlaying && '+native(3)+'.getState().position===0'),'Replacement identity/timeline truthful with no autoplay')
 check(ev(native(3)+'.getDecodedBuffers().flow==='+native(4)+'.getDecodedBuffers().flow'),'Replacement shares surviving song PCM safely')
 # UI geometry/source ordering remain the approved layout.
 check(ev('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth'),'iPad fixed viewport')
 open('/tmp/phase1f-ipad.png','wb').write(base64.b64decode(c.call('Page.captureScreenshot')['data']))
 ev('TuneToxDesign.playable.controller.close()');check(ev('TuneToxDesign.playable.controller.diagnostics().sharedPCM.uniqueDecodedBytes===0'),'Cache released on close')
 print('TOTAL',checks,flush=True)
finally:c.call('Browser.close')
