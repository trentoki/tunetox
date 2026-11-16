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
 c.call('Page.navigate',{'url':'http://192.168.50.24:8766/performance-incremental?build=1f-f2'});time.sleep(1)
 check(ev("document.querySelector('#design-build').textContent==='1F F2'"),'F1 unmistakable build')
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
 # Preserve a stale positive request on D2, automatically reduced to zero.
 click('.design-deck[data-deck="4"] .waveform-matching [data-control=handoff]')
 gain(1,1,1)
 check(ev('appState.decks[1].stems.requestedLevels.flow>0 && appState.decks[1].stems.allocatedLevels.flow===0'),'Stale positive request setup')
 gain(3,1,.01)
 check(ev('Math.abs(appState.decks[0].stems.allocatedLevels.flow-.99)<1e-9 && appState.decks[1].stems.allocatedLevels.flow===0 && appState.decks[2].stems.allocatedLevels.flow===.01'),'Physical-path 100/0/0 -> 99/0/1')
 gain(3,1,0);gain(1,1,1);gain(2,1,1);gain(2,1,.6)
 check(ev('Math.abs(appState.decks[0].stems.allocatedLevels.flow-.4)<1e-9 && appState.decks[1].stems.allocatedLevels.flow===.6'),'Reverse restoration to prior touched owner')
 gain(1,1,0);gain(2,1,.5)
 check(ev('appState.decks[0].stems.allocatedLevels.flow===0'),'Explicit zero excluded')
 gain(1,1,.5)
 before=ev('JSON.stringify(appState.decks.map(d=>d.stems.allocatedLevels))')
 # Synthetic pointer events exercise the capture guard on actual rendered controls.
 ev("document.querySelector('#demo-deck-1-stem-1').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:101,cancelable:true}))")
 ev("document.querySelector('#demo-deck-2-stem-1').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:102,cancelable:true}))")
 gain(2,1,.8)
 check(ev('JSON.stringify(appState.decks.map(d=>d.stems.allocatedLevels))')==before,'Second same-category held touch cannot steal priority')
 gain(1,1,.7)
 check(ev('appState.decks[0].stems.allocatedLevels.flow===.7'),'First held touch still acts')
 ev("document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:101}))")
 gain(2,1,.8)
 check(ev('appState.decks[1].stems.allocatedLevels.flow===.8'),'After release other control may act')
 ev("document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:102}))")
 # Fixed geometry across percentage transitions.
 geometry=ev("JSON.stringify(Array.from(document.querySelectorAll('.stem-controls input')).map(x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}))")
 for i in range(80):gain(i%3+1,1,(i*17%101)/100)
 check(ev("JSON.stringify(Array.from(document.querySelectorAll('.stem-controls input')).map(x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}))")==geometry,'Geometry stable through alternating gestures')
 check(ev('[1,2,3,4].every(id=>'+native('id')+'.getState().isPlaying) && !TuneToxDesign.playable.controller.mixer.getLastSchedulingFailure()'),'No transport interruption under alternating gestures')
 time.sleep(.15)
 check(ev("appState.decks.every(d=>Math.abs(TuneToxDesign.playable.controller.mixer.getDeck(d.id).getDiagnostics().stems.flow.reportedAudioParamValue-d.stems.allocatedLevels.flow)<1e-6)"),'Real AudioParam values agree with allocations')
 check(ev('appState.stemSession.nativeHandoff.touchOrder.flow.length===4 && !!appState.stemSession.nativeHandoff.transfers.flow'),'History and transfer diagnostics available')
 for width,height in [(1194,834),(1024,768),(390,844),(320,568)]:
  c.call('Emulation.setDeviceMetricsOverride',dict(width=width,height=height,deviceScaleFactor=2,mobile=True));time.sleep(.2)
  check(ev('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'),'Fixed viewport '+str((width,height)))
 check(ev('document.querySelector("#design-build").textContent==="1F F2"'),'Build remains F2')
 print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except Exception:pass
