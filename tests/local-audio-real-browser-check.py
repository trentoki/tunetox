"""Reuse the storage-test browser profile after a full Chrome restart.
Import the two actual allowlisted songs once, reload, and play four local deck slots
with media requests blocked. Does not verify physical Safari speaker output.
"""
import json,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP'];endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0

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
def idle():
 for _ in range(600):
  if ev('document.querySelector("#storage-content").getAttribute("aria-busy")==="false"'):return
  time.sleep(.1)
 raise AssertionError('Import not complete')
def ready():
 for _ in range(100):
  if ev('!!TuneToxDesign.localAudio'):return
  time.sleep(.05)
 raise AssertionError('App not ready')
try:
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True));c.call('Page.navigate',{'url':'http://192.168.50.24:8766/performance-storage?build=1g-g1'});time.sleep(.5);ready()
 check(ev('TuneToxDesign.localAudio.store.list().then(x=>x.length)')==4,'Four songs persist after full browser restart')
 check(ev('TuneToxDesign.localAudio.store.assignments().then(x=>Object.keys(x).length)')==4,'Four previous assignments persist across restart')
 check(ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==="uncreated"'),'Restart lists without decoding or auto transport')
 click('#storage-open')
 ev("Array.from(document.querySelectorAll('#storage-content button')).find(b=>b.textContent==='Import a prepared LAN test song').click()")
 idle()
 for title in ['Tase T - Hypnotic','Michael Todd & Tase T - Cut Me Loose']:
  ev('Array.from(document.querySelectorAll("#storage-content button")).find(b=>b.textContent==='+json.dumps('Store '+title)+').click()');idle()
  check(ev('document.querySelector("#storage-content p[role=status]").textContent').startswith('Stored '),'Real-song atomic import '+title)
 check(ev('TuneToxDesign.localAudio.store.list().then(x=>x.length)')==6,'Two real songs and four fixture songs stored')
 check(ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==="uncreated"'),'Real-song imports do not decode')
 c.call('Page.reload');time.sleep(.5);ready();c.call('Network.enable');c.call('Network.setBlockedURLs',{'urls':['*/media/*','*/two-deck-manifest.json']})
 click('#storage-open')
 records=ev('TuneToxDesign.localAudio.store.list()');ids=[s['id'] for s in records if s['title'] in ['Tase T - Hypnotic','Michael Todd & Tase T - Cut Me Loose']]
 # Click visible local Load controls, preserving real Safari-style user activation.
 for deck,id in [(1,ids[0]),(2,ids[1]),(3,ids[0]),(4,ids[1])]:
  index=next(i for i,s in enumerate(records) if s['id']==id)+1
  c.evaluate(f'document.querySelector(".stored-song:nth-child({index})").scrollIntoView()')
  click(f'.stored-song:nth-child({index}) button:nth-of-type({deck})')
  for _ in range(200):
   if ev('TuneToxDesign.playable.controller.busy().loadingId===null'):break
   time.sleep(.1)
  check(ev(f'TuneToxDesign.playable.controller.mixer.getDeck({deck}).getState().loaded'),'Real local song loaded D'+str(deck))
 check(ev('performance.getEntriesByType("resource").every(e=>!e.name.includes("/media/"))'),'No retransfers after reload; media endpoints blocked')
 print('LOCAL_LOADS',json.dumps(ev('TuneToxDesign.playable.controller.diagnostics().loads')),flush=True)
 print('MEMORY',json.dumps(ev('TuneToxDesign.playable.controller.diagnostics().sharedPCM')),flush=True)
 click('#storage-close')
 for id in [1,2,3,4]:
  c.evaluate(f'document.querySelector(".design-deck[data-deck=\\"{id}\\"] .column-mode-button[data-mode=controls]").click()')
  ev(f'(()=>{{const x=document.querySelector("#overlay-main-{id}");x.value=.05;x.dispatchEvent(new Event("input"));}})()')
  click(f'.design-deck[data-deck="{id}"] .performance-play')
 check(ev('[1,2,3,4].every(id=>TuneToxDesign.playable.controller.mixer.getDeck(id).getState().isPlaying)'),'Four real locally stored decks play independently')
 time.sleep(.2)
 check(ev('TuneToxDesign.playable.controller.mixer.getDiagnostics().outputMeter.peak>0'),'Shared destination signal (not physical audibility)')
 check(ev('!TuneToxDesign.playable.controller.mixer.getLastSchedulingFailure()'),'No scheduling failure')
 print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
