"""G1 real IndexedDB + upload/navigation/reload checks; isolated Chrome CDP 9230.
Four small distinct generated WAV song sets, then real prepared files are tested separately.
"""
import json,runpy,time,urllib.request,pathlib,struct
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP'];endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl'])
checks=0
def ev(code):return c.evaluate(code)
def check(x,label):
 global checks
 assert x,label
 checks+=1;print('PASS',label,flush=True)
def click(selector):
 ev('document.querySelector('+json.dumps(selector)+').scrollIntoView({block:"nearest"})')
 r=ev('document.querySelector('+json.dumps(selector)+').getBoundingClientRect().toJSON()')
 assert r['width']>0 and r['height']>0,selector
 for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
 time.sleep(.1)
def ready():
 for _ in range(100):
  if ev('!!TuneToxDesign.localAudio'):return
  time.sleep(.05)
 raise AssertionError(ev('document.querySelector("#design-status").textContent'))
try:
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
 c.call('Page.navigate',{'url':'http://192.168.50.24:8766/performance-storage?build=1g-g1'});time.sleep(.5);ready()
 check(ev('document.querySelector("#design-build").textContent==="1G G1"'),'G1 explicit build')
 check(ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==="uncreated"'),'Stored catalog boot does not create audio context')
 ev(pathlib.Path('tests/local-audio-store-tests.js').read_text());result=ev('runLocalAudioStoreTests()');check(result['checks']>=19 and result['decodes']==0,'Real IDB deterministic checks '+str(result))
 click('#storage-open')
 doc=c.call('DOM.getDocument');node=c.call('DOM.querySelector',{'nodeId':doc['root']['nodeId'],'selector':'#storage-files'})['nodeId']
 for i in range(1,5):
  directory=pathlib.Path('/tmp/tunetox-storage-fixtures')/str(i);directory.mkdir(parents=True,exist_ok=True)
  files=[]
  for index,name in enumerate(['transients','flow','tune','voice']):
   frames=4410;data=b''.join(struct.pack('<f',(i+index)*.01) for _ in range(frames));p=directory/(name+'.wav');p.write_bytes(b'RIFF'+struct.pack('<I',36+len(data))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,3,1,44100,176400,4,32)+b'data'+struct.pack('<I',len(data))+data);files.append(str(p))
  c.call('DOM.setFileInputFiles',{'nodeId':node,'files':files})
  ev(f'document.getElementById("storage-song-title").value="Fixture {i}"')
  ev("Array.from(document.querySelectorAll('#storage-content button')).find(b=>b.textContent==='Import selected stems once').click()")
  for _ in range(100):
   if ev('document.querySelector("#storage-content").getAttribute("aria-busy")==="false"'):break
   time.sleep(.05)
  check(ev('TuneToxDesign.localAudio.store.list().then(x=>x.length)')==i,'UI imports distinct song '+str(i))
 check(ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==="uncreated"'),'Four imports do not decode or initialize audio')
 c.call('Page.reload');time.sleep(.5);ready()
 check(ev('TuneToxDesign.localAudio.store.list().then(x=>x.length)')==4,'Reload retains four songs')
 check(ev('performance.getEntriesByType("resource").every(e=>!e.name.includes("/media/")&&!e.name.includes("manifest.json"))'),'Reload catalog uses no media/catalog server request')
 # Explicit user gesture loads one stored song; no autoplay and no transfer.
 click('#storage-open');click('.stored-song button')
 for _ in range(100):
  if ev('TuneToxDesign.playable.controller.busy().loadingId===null'):break
  time.sleep(.05)
 check(ev('TuneToxDesign.playable.controller.mixer.getDeck(1).getState().loaded && !TuneToxDesign.playable.controller.mixer.getDeck(1).getState().isPlaying'),'Local explicit Load decodes, never autoplays')
 for id in [2,3,4]:
  click(f'.stored-song:nth-child({id}) button:nth-of-type({id})')
  for _ in range(100):
   if ev('TuneToxDesign.playable.controller.busy().loadingId===null'):break
   time.sleep(.05)
 check(ev('[1,2,3,4].every(id=>TuneToxDesign.playable.controller.mixer.getDeck(id).getState().loaded && !TuneToxDesign.playable.controller.mixer.getDeck(id).getState().isPlaying)'),'All four retained songs load without autoplay')
 check(ev('appState.decks[0].volume===0'),'Load retains safe Main zero')
 check(ev('performance.getEntriesByType("resource").every(e=>!e.name.includes("/media/"))'),'Local Load has zero media requests')
 check(ev('getComputedStyle(document.querySelector(".design-deck")).touchAction.includes("manipulation")'),'Targeted double-tap zoom protection')
 check(ev('document.querySelector("meta[name=viewport]").content.indexOf("user-scalable=no")===-1'),'Accessibility zoom not globally disabled')
 c.call('Page.reload');time.sleep(.5);ready()
 check(ev('TuneToxDesign.localAudio.store.assignments().then(x=>x[1]==="local-1")'),'Prior assignment retained')
 check(ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==="uncreated"'),'Assignment restore does not decode or autoplay on reload')
 for width,height in [(1194,834),(1024,768),(390,844),(320,568)]:
  c.call('Emulation.setDeviceMetricsOverride',dict(width=width,height=height,deviceScaleFactor=2,mobile=True));time.sleep(.2)
  check(ev('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'),'Fixed performance viewport '+str((width,height)))
 print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
