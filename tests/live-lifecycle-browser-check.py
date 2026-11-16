"""Reuse the storage-test browser profile after a full Chrome restart.
Import the two actual allowlisted songs once, reload, and play four local deck slots
with media requests blocked. Does not verify physical Safari speaker output.
"""
import json,runpy,time,urllib.request,sys
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

fixed='--fixed' in sys.argv
controller='TuneToxDesign.playable.controller'
def mode(id,name):click(f'.design-deck[data-deck="{id}"] .column-mode-button[data-mode={name}]')
def level(id,index,value):
 selector=f'#demo-deck-{id}-stem-{index}' if index is not None else f'#overlay-main-{id}'
 ev(f'(()=>{{const x=document.querySelector("{selector}");x.value={value};x.dispatchEvent(new Event("input"));}})()');time.sleep(.08)
def play(id):
 mode(id,'controls');click(f'.design-deck[data-deck="{id}"] .performance-play');mode(id,'waveform')
def levels(index):return ev(f'appState.decks.map(d=>d.stems.allocatedLevels[prototypeStemNames[{index}]])')
def audio_agrees():
 time.sleep(.1)
 return ev('appState.decks.filter(d=>'+controller+'.mixer.getDeck(d.id).getState().isPlaying).every(d=>prototypeStemNames.every(name=>Math.abs('+controller+'.mixer.getDeck(d.id).getDiagnostics().stems[name].reportedAudioParamValue-d.stems.allocatedLevels[name])<1e-6))')
def release(id):
 click('#audio-open');click(f'#audio-actions button[aria-label="Release deck {id}"]');click('#audio-close')
def load(id,song):
 click('#storage-open');records=ev('TuneToxDesign.localAudio.store.list()');index=next(i for i,s in enumerate(records) if s['id']==song)+1
 click(f'.stored-song:nth-child({index}) button:nth-of-type({id})')
 for _ in range(300):
  if ev(controller+'.busy().loadingId===null'):break
  time.sleep(.1)
 click('#storage-close');mode(id,'waveform')
 check(ev(controller+f'.mixer.getDeck({id}).getState().loaded'),'Loaded locally D'+str(id))
try:
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
 page='performance-lifecycle?build=1g-g2' if fixed else 'performance-storage?build=1g-g1'
 c.call('Page.navigate',{'url':'http://192.168.50.24:8766/'+page});time.sleep(.6);ready()
 records=ev('TuneToxDesign.localAudio.store.list()');songs=[s for s in records if s['title'] in ['Tase T - Hypnotic','Michael Todd & Tase T - Cut Me Loose']]
 check(len(songs)==2,'Existing actual cached songs available unchanged')
 c.call('Network.enable');c.call('Network.setBlockedURLs',{'urls':['*/media/*','*/two-deck-manifest.json']})
 for id in [1,2,3,4]:
  load(id,songs[(id-1)%2]['id'])
  for index in range(4):level(id,index,0)
  mode(id,'controls');level(id,None,1);mode(id,'waveform')
  click(f'.design-deck[data-deck="{id}"] .waveform-matching [data-control=handoff]');play(id)
 for index in range(4):
  level(1,index,1);level(2,index,1);level(3,index,.3)
 before=levels(2);play(3)
 check(levels(2)==before,'Pause retains all faders without restoration')
 level(3,2,1);after=levels(2);print('PAUSED',after,flush=True)
 if fixed:check(abs(after[1]-.7)<1e-9 and after[0]==0 and after[2]==1,'Paused fader isolates live playing peers')
 else:check(abs(after[1]-.7)>1e-9,'G1 paused-gesture defect reproduced')
 play(3);check(levels(2)==[0,0,1,0],'Resume gives prepared Tune priority')
 if fixed:check(audio_agrees(),'Committed native gains match all playing deck allocations after Resume')
 if fixed:
  for index in [0,1,3]:
   before=levels(index);play(3);check(levels(index)==before,'Pause retains category '+str(index))
   level(3,index,1);check(abs(levels(index)[1]-.7)<1e-9,'Paused isolated category '+str(index))
   play(3);check(levels(index)==[0,0,1,0],'Prepared Resume priority category '+str(index));check(audio_agrees(),'Native gain agreement category '+str(index))
 # Exercise Release from both transport states and silent/nonzero prepared levels.
 for paused,amount in [(False,0),(True,0),(False,.3),(True,.3)]:
  for index in range(4):
   level(3,index,0);level(1,index,1);level(2,index,1)
  if amount:level(3,2,amount)
  if paused:play(3)
  before=levels(2);allPeers=ev('JSON.stringify(appState.decks.filter(d=>d.id!==3).map(d=>d.stems))');release(3);after=levels(2)
  print('RELEASE',json.dumps(dict(paused=paused,amount=amount,before=before,after=after)),flush=True)
  if fixed:
   check(all(abs(after[i]-before[i])<1e-9 for i in [0,1,3]),'Release preserves peers '+str((paused,amount)))
   check(ev('JSON.stringify(appState.decks.filter(d=>d.id!==3).map(d=>d.stems))')==allPeers,'All category requests/allocations unchanged on Release')
   check(audio_agrees(),'Native peer gains unchanged after Release')
  elif amount==0:check(abs(after[0]-.5)<1e-9,'G1 silent Release 50/50 reproduced '+str(paused))
  check(ev('[1,2,4].every(id=>'+controller+'.mixer.getDeck(id).getState().isPlaying)'),'Other transports continue')
  load(3,songs[0]['id'])
  for index in range(4):level(3,index,0)
  play(3)
 check(ev('performance.getEntriesByType("resource").every(e=>!e.name.includes("/media/"))'),'No music retransfers')
 check(ev('!'+controller+'.mixer.getLastSchedulingFailure()'),'No native scheduling failure')
 print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
