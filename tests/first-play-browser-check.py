"""F2 first-Play reproduction / F3 real-song regression via existing CDP helper.
Pass --fixed for opt-in F3. Chrome evidence does not verify physical Safari audio.
"""
import base64,json,runpy,subprocess,time,urllib.request,sys
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

fixed='--fixed' in sys.argv
observed=[]
def load(id):
 mode(id,'library');song='hypnotic' if id%2 else 'cut-me-loose'
 click(f'.design-deck[data-deck="{id}"] [data-song-id="{song}"] .song-select')
 click(f'.design-deck[data-deck="{id}"] .column-load-button:nth-of-type({id})')
 for i in range(240):
  time.sleep(.1)
  if ev('TuneToxDesign.playable.controller.busy().loadingId===null'):break
 check(ev(f'{native(id)}.getState().loaded'),'Real stems loaded D'+str(id))
 mode(id,'waveform')
def play(id):
 mode(id,'controls');click(f'.design-deck[data-deck="{id}"] .performance-play');time.sleep(.1);mode(id,'waveform')
try:
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
 for manual,prepared,participating,fourth in [(False,0,True,False),(False,.3,True,False),(True,0,True,True),(True,.3,True,True),(False,.3,False,True),(False,0,True,True),(False,0,True,'participating'),(False,.3,True,'participating')]:
  url='performance-first-play?build=1f-f3' if fixed else 'performance-incremental?build=1f-f2'
  c.call('Page.navigate',{'url':'http://192.168.50.24:8766/'+url});time.sleep(.6)
  for id in [1,2]:
   load(id)
   for index in range(4):gain(id,index,0)
   mode(id,'controls');gain(id,None,1);mode(id,'waveform')
   click(f'.design-deck[data-deck="{id}"] .waveform-matching [data-control=handoff]');play(id)
  gain(1,2,1);gain(2,2,1)
  if manual:gain(1,2,0)
  if fourth:
   load(4);gain(4,2,.4);mode(4,'controls');gain(4,None,.1);mode(4,'waveform');play(4)
   if fourth=='participating':
    click('.design-deck[data-deck="4"] .waveform-matching [data-control=handoff]');gain(4,2,0);gain(4,2,.4);gain(2,2,1)
  before=ev('JSON.stringify(appState.decks.slice(0,2).map(d=>d.stems))')
  load(3)
  check(ev('JSON.stringify(appState.decks.slice(0,2).map(d=>d.stems))')==before,'Loading preserves peers')
  for index in range(4):gain(3,index,prepared if index==2 else 0)
  mode(3,'controls');gain(3,None,1);mode(3,'waveform')
  if participating:click('.design-deck[data-deck="3"] .waveform-matching [data-control=handoff]')
  history=ev('JSON.stringify(appState.stemSession.nativeHandoff.touchOrder)')
  play(3)
  levels=ev('appState.decks.map(d=>d.stems.allocatedLevels.tune)')
  desired=[0,1-prepared if participating else 1,prepared]
  matches=all(abs(a-b)<1e-9 for a,b in zip(levels,desired))
  observed.append(dict(manual=manual,prepared=prepared,participating=participating,fourth=fourth,levels=levels,matches=matches))
  print('OBSERVED',json.dumps(observed[-1]),flush=True)
  if fixed:check(matches,'First Play only necessary donor transfer')
  check(ev('JSON.stringify(appState.stemSession.nativeHandoff.touchOrder)')==history,'Play leaves history unchanged')
  check(ev('appState.decks.every(d=>Math.abs(TuneToxDesign.playable.controller.mixer.getDeck(d.id).getDiagnostics().stems.tune.reportedAudioParamValue-d.stems.allocatedLevels.tune)<1e-6)'),'Native/UI agreement after first start')
  before=ev('JSON.stringify(appState.decks.map(d=>d.stems))');play(3);play(3)
  check(ev('JSON.stringify(appState.decks.map(d=>d.stems))')==before,'Pause/resume no reallocation')
  ev('TuneToxDesign.playable.controller.stop(3)');play(3)
  check(ev('JSON.stringify(appState.decks.map(d=>d.stems))')==before,'Stop/restart retains ownership')
  check(ev('[1,2,3].every(id=>'+native('id')+'.getState().isPlaying)'),'All three continue')
  if fourth:check(ev(native(4)+'.getState().isPlaying'),'Independent fourth continues')
 if not fixed:check(any(not row['matches'] for row in observed),'F2 defect reproduced with real songs')
 print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except Exception:pass
