"""H4 actual served-page tests. Synthetic native touch dispatch is not physical Safari evidence."""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP']
endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;metrics=[]
root=pathlib.Path('development/design-mode/corrections-preview/review')
def ev(code):return c.evaluate(code)
def check(x,label):
 global checks
 assert x,label
 checks+=1;print('PASS',label,flush=True)
def sel(id,s):return f'.h3-deck[data-deck="{id}"] '+s
def rect(s):return ev('document.querySelector('+json.dumps(s)+').getBoundingClientRect().toJSON()')
def click(s):
 ev('document.querySelector('+json.dumps(s)+').scrollIntoView({block:"nearest"})');r=rect(s);assert r['width']>0 and r['height']>0,s
 for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
 time.sleep(.04)
def snap():return ev('TuneToxDesign.h1.getSnapshot()')
def mode(id,name):
 if ev('matchMedia("(max-width:700px) and (orientation:portrait)").matches'):
  if snap()['editingDeckId']!=id:click('.h5-phone-deck[data-deck="'+str(id)+'"]')
  for _ in range(4):
   if snap()['decks'][id-1]['compact']['mode']==name:return
   click('.h5-phone-deck[data-deck="'+str(id)+'"]')
  raise AssertionError('Unable to cycle mode')
 else:click(sel(id,'.h3-song-row [data-mode='+name+']'))
def lib(id,name):click(sel(id,'.h4-library-selector [data-mode='+name+']'))
def drag(s,dy):
 r=rect(s);x=r['x']+r['width']/2;y=r['y']+r['height']/2
 c.call('Input.dispatchMouseEvent',dict(type='mousePressed',x=x,y=y,button='left',clickCount=1));c.call('Input.dispatchMouseEvent',dict(type='mouseMoved',x=x,y=y+dy,button='left',buttons=1));c.call('Input.dispatchMouseEvent',dict(type='mouseReleased',x=x,y=y+dy,button='left',clickCount=1));time.sleep(.04)
def ranges(s,value):ev('(()=>{const x=document.querySelector('+json.dumps(s)+');x.value='+str(value)+';x.dispatchEvent(new Event("input",{bubbles:true}));})()')
def query(id,text):ev('(()=>{const x=document.querySelector('+json.dumps(sel(id,'.column-search'))+');x.value='+json.dumps(text)+';x.dispatchEvent(new Event("input"));})()')
def fixed(id):return [rect(sel(id,s)) for s in ['.h3-overview','.h3-stems','.h1-transport']]
def touch(kind,x=None,y=None):
 c.call('Input.dispatchTouchEvent',dict(type=kind,touchPoints=[] if kind=='touchEnd' else [dict(x=x,y=y,id=1,radiusX=2,radiusY=2,force=1)]));time.sleep(.03)
def slide(s,read,middle,last):
 r=rect(s);y=r['y']+r['height']/2
 touch('touchStart',r['x']+r['width']/6,y);touch('touchMove',r['x']+r['width']/2,y);check(ev(read)==middle,'Held slide middle '+s)
 touch('touchMove',r['x']+r['width']*5/6,y);check(ev(read)==last,'Held slide last before release '+s)
 touch('touchMove',r['right']+20,y);check(ev(read)==last,'Slide clamps '+s);touch('touchEnd')
def capture(name):root.joinpath(name).write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['data']))
def size(w,h):c.call('Emulation.setDeviceMetricsOverride',dict(width=w,height=h,deviceScaleFactor=1,mobile=True));time.sleep(.2)
def loadSong(id,song,target):
 click(sel(id,'.h3-open-library'));lib(id,'songs');query(id,'');click(sel(id,'[data-song-id='+song+'] .song-select'));click(sel(id,'.column-load-button:nth-of-type('+str(target)+')'))
def advance(dt):ev('TuneToxDesign.h5Test.advance('+str(dt)+')')
def pointer(kind,s,dx=0,dy=0):
 r=rect(s);x=r['x']+r['width']/2+dx;y=r['y']+r['height']/2+dy
 c.call('Input.dispatchMouseEvent',dict(type=kind,x=x,y=y,button='left',buttons=1 if kind=='mouseMoved' else 0,clickCount=1));time.sleep(.03)
try:
 c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5))
 c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.H5_TEST_CLOCK=location.search.includes('deterministic');window.audioCreates=0;window.storageOpens=0;window.scriptErrors=[];addEventListener('error',e=>scriptErrors.push(e.message));for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('Unexpected audio')}};indexedDB.open=()=>{storageOpens++;throw Error('Unexpected storage')};"})
 size(390,844);c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/corrections-preview/?build=h51&deterministic=1'});time.sleep(.7)
 check(ev('!!TuneToxDesign.h1&&!window.h1BootError&&document.title.includes("H5.1")'),'Served H5.1 identity and boot')
 check(ev('document.querySelectorAll(".h5-view-open,.h5-controls-head").length===0'),'No permanent phone mode badge or Controls/Transition strip')
 # Compact transport, same row including Main in every performance mode.
 for name in ['wave','cue','controls','transition']:
  mode(1,name);row=rect(sel(1,'.h1-transport'));main=rect('#h1-main-1');queue=rect(sel(1,'.h5-queue'));play=rect(sel(1,'.h1-play'))
  check(row['height']==36 and queue['width']==44 and play['y']==queue['y'] and main['y']>=row['y'] and main['bottom']<=row['bottom'],'Compact Play/Queue/Main row '+name)
  check(rect(sel(1,'.h1-transport'))==row and ev('document.querySelector('+json.dumps(sel(1,'.h5-queue'))+').textContent')=='EMPTY','Queue is only an empty compact button '+name)
 mode(1,'wave');ranges('#h1-main-1',.63);check(snap()['decks'][0]['volume']==.63,'Main directly adjustable in Wave')
 r=rect('#h1-main-1');touch('touchStart',r['x']+r['width']/2,r['y']+r['height']/2);touch('touchEnd');check(abs(snap()['decks'][0]['volume']-.5)<.03,'Restored native Main responds to direct track touch')
 # Selected deck cycles, another deck selects only; long stationary hold does not cycle.
 button='.h5-phone-deck[data-deck="1"]';click(button);check(snap()['decks'][0]['compact']['mode']=='cue','Tap selected deck cycles one mode')
 time.sleep(.15);ev('document.querySelector('+json.dumps(button)+').dispatchEvent(new MouseEvent("click",{detail:1,bubbles:true}))');check(snap()['decks'][0]['compact']['mode']=='cue','Delayed pointer click cannot double-cycle')
 click('.h5-phone-deck[data-deck="2"]');check(snap()['editingDeckId']==2 and snap()['decks'][1]['compact']['mode']=='wave','Tap another deck selects without cycling')
 click(button);check(snap()['decks'][0]['compact']['mode']=='cue','Returning deck retains its mode')
 r=rect(button);x=r['x']+r['width']/2;y=r['y']+r['height']/2;touch('touchStart',x,y);time.sleep(.5);touch('touchEnd');check(snap()['decks'][0]['compact']['mode']=='cue','Stationary hold does not accidentally cycle')
 touch('touchStart',x,y);touch('touchMove',x,y+6);check(ev('document.querySelector(".h5-view-menu").hidden'),'Small movement does not open slide menu')
 touch('touchMove',x,y+22);menu=rect('.h5-view-menu');touch('touchMove',x,menu['y']+menu['height']*7/8);check(snap()['decks'][0]['compact']['mode']=='cue','Slide highlight waits for release');touch('touchEnd')
 check(snap()['decks'][0]['compact']['mode']=='transition' and ev('document.querySelector(".h5-view-menu").hidden'),'Downward slide commits phone Transition')
 mode(1,'wave')
 # Overlay controls do not consume a layout row or start scrub.
 check(ev('document.querySelector('+json.dumps(sel(1,'.h5-wave-tools'))+').parentElement.classList.contains("h1-zoom")'),'Adaptive controls live inside waveform')
 check(ev('getComputedStyle(document.querySelector('+json.dumps(sel(1,'.h5-wave-tools'))+')).position')=='absolute','No dedicated adaptive-control layout row')
 click(sel(1,'.h1-play'));plus=sel(1,'.h5-wave-tools button:last-child');r=rect(plus);x=r['x']+r['width']/2;y=r['y']+r['height']/2;p=snap()['decks'][0]['position'];tempo=snap()['decks'][0]['tempo']
 touch('touchStart',x,y);check(ev('document.querySelector('+json.dumps(plus)+').dataset.pressed')=='true','Touched zone lights up')
 ev('TuneToxDesign.h5Test.advance(1)');check(abs(snap()['decks'][0]['position']-p-1.05)<1e-6,'Overlay nudge changes temporary preview rate')
 touch('touchMove',x-20,y+15);touch('touchEnd');p=snap()['decks'][0]['position'];ev('TuneToxDesign.h5Test.advance(1)');check(abs(snap()['decks'][0]['position']-p-1)<1e-6 and snap()['decks'][0]['tempo']==tempo,'Nudge release restores rate and is not scrub')
 # Both scrub directions; captured lower gesture cannot activate overlay zones.
 z=sel(1,'.h1-zoom');r=rect(z);x=r['x']+r['width']/2;y=r['y']+r['height']*.7;p=snap()['decks'][0]['position'];touch('touchStart',x,y);touch('touchMove',x-r['width']/4,y);touch('touchEnd')
 check(abs(snap()['decks'][0]['position']-p-3)<.1,'Drag LEFT moves FORWARD')
 p=snap()['decks'][0]['position'];touch('touchStart',x,y);touch('touchMove',x+r['width']/4,y);touch('touchEnd');check(abs(snap()['decks'][0]['position']-p+3)<.1,'Drag RIGHT moves BACKWARD')
 touch('touchStart',x,y);touch('touchMove',r['right']-10,r['y']+10);check(snap()['decks'][0]['wave']['nudge']==0 and snap()['decks'][0]['wave']['pending'] is None,'Scrub stays owned when crossing a zone');touch('touchEnd')
 click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'));click(sel(1,'.h3-deck-id'))
 ev('(()=>{const s=document.querySelector('+json.dumps(sel(1,'.h5-wave-tools select'))+');s.value="4";s.dispatchEvent(new Event("change"));})()')
 p=snap()['decks'][0]['position'];ev('document.querySelector('+json.dumps(sel(1,'.h5-wave-tools select'))+').dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');check(snap()['decks'][0]['position']==p,'Step-size keyboard navigation does not scrub');click(plus);deck=snap()['decks'][0];check(deck['position']==p and deck['wave']['pending'] is not None,'Overlay beat skip waits for boundary')
 dt=(deck['wave']['pending']['boundary']-deck['wave']['clock'])*60/tempo;ev('TuneToxDesign.h5Test.advance('+str(dt-.001)+')');check(snap()['decks'][0]['wave']['pending'] is not None,'No premature skip');ev('TuneToxDesign.h5Test.advance(.001)')
 check(abs(snap()['decks'][0]['position']-(p+dt+4*60/tempo))<1e-6,'Skip executes from boundary with unchanged tempo')
 p=snap()['decks'][0]['position'];ev('document.querySelector('+json.dumps(plus)+').dispatchEvent(new MouseEvent("click",{detail:1,bubbles:true}))');check(snap()['decks'][0]['wave']['pending'] is None and snap()['decks'][0]['position']==p,'Delayed zone click cannot schedule a second jump')
 r=rect(z);p=snap()['decks'][0]['position'];touch('touchStart',r['x']+r['width']/2,r['y']+r['height']*.7);touch('touchMove',r['x']+r['width']/4,r['y']+r['height']*.7);touch('touchEnd');check(abs(snap()['decks'][0]['position']-p-3)<.1,'Reversed scrub also works with BeatMatch ON')
 # Endpoint geometry: visible handle CENTER equals rail endpoint; full 24px remains inside.
 for w,h in [(390,844),(1194,834)]:
  size(w,h);vertical=w<700
  for value in [0,1]:
   ranges('#h1-stem-1-0',value);frame=rect(sel(1,'.h51-fader'));rail=rect(sel(1,'.h51-fader-rail'));handle=rect(sel(1,'.h51-fader-handle'))
   center=handle['y']+12 if vertical else handle['x']+12;endpoint=(rail['bottom'] if value==0 else rail['top']) if vertical else (rail['left'] if value==0 else rail['right'])
   check(abs(center-endpoint)<.6,'Exact visual endpoint '+str((w,value)))
   check(handle['left']>=frame['left']-.5 and handle['right']<=frame['right']+.5 and handle['top']>=frame['top']-.5 and handle['bottom']<=frame['bottom']+.5,'Full endpoint handle visible '+str((w,value)))
   f='#h1-stem-1-0';x=frame['x']+frame['width']/2 if vertical else endpoint;y=endpoint if vertical else frame['y']+frame['height']/2
   touch('touchStart',x,y);touch('touchEnd');check(snap()['decks'][0]['stems'][0]==value,'Touch and numeric endpoints agree '+str((w,value)))
  frame=rect(sel(1,'.h51-fader'));before=snap()['decks'][0]['stems'];x=frame['x']+frame['width']/2;y=frame['y']+frame['height']/2
  touch('touchStart',x,y);check(abs(snap()['decks'][0]['stems'][0]-.5)<.02,'Track touch immediately sets midpoint '+str(w))
  touch('touchMove',x+35 if vertical else frame['right']-12,frame['top']+12 if vertical else y+18);touch('touchEnd')
  check(snap()['decks'][0]['stems'][0]==1 and snap()['decks'][0]['stems'][1:]==before[1:],'Captured stem drift does not adjust neighbors '+str(w))
  if not vertical:
   check(rect(sel(1,'.h3-song-row .h3-selector'))['width']>0 and ev('document.querySelectorAll(".h5-controls-head,.h5-view-open").length===0'),'Tablet keeps only H4 Wave/Cue/Controls navigation')
   for name in ['wave','cue','controls']:
    mode(1,name);check(ev('getComputedStyle(document.querySelector('+json.dumps(sel(1,'.h5-transition'))+')).display')=='none','No tablet Transition access '+name)
  else:capture('h51-endpoints-phone.png')
 # Tablet defaults and mode geometry / phone adaptation.
 for w,h in [(1194,834),(1024,768),(834,1194),(768,1024),(390,844),(390,724),(375,667),(320,568)]:
  size(w,h);mode(1,'wave');a=fixed(1);center=rect(sel(1,'.h3-center'))
  check(ev('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),'Fixed viewport '+str((w,h)))
  for name in ['cue','controls']+(['transition'] if w<700 else [])+['wave']:
   mode(1,name);check(fixed(1)==a and rect(sel(1,'.h3-center'))==center,'Fixed stems and center '+str((w,h))+name)
   check(rect('#h1-main-1')['height']>0 and rect('#h1-main-1')['bottom']<=rect(sel(1,'.h1-transport'))['bottom'],'Main visible '+str((w,h))+name)
  check(rect(sel(1,'.h3-stems'))['bottom']<=h,'Stems within screen '+str((w,h)))
  metrics.append(dict(width=w,height=h,center=center,stems=rect(sel(1,'.h3-stems')),transport=rect(sel(1,'.h1-transport'))))
  if w==1194:mode(2,'cue');mode(3,'controls');capture('h51-ipad-landscape.png')
  if w==834:capture('h51-ipad-portrait.png')
  if w==390 and h==844:capture('h51-phone.png')
  if w==320:capture('h51-phone-small.png')
 # Exact physical-reported queue sequence through the served page with its REAL preview clock.
 size(390,844)
 for folder,build in [('corrections-preview','h51'),('performance-preview','h5')]:
  c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/'+folder+'/?build='+build});time.sleep(.5)
  check(ev('!window.H5_TEST_CLOCK&&typeof TuneToxDesign.h5Test==="undefined"'),'Real preview clock '+build)
  loadSong(1,'amber',1);check(snap()['decks'][0]['songId']=='amber' and not snap()['decks'][0]['playing'],'First song load stays stopped '+build)
  click(sel(1,'.h1-play'));time.sleep(.15);before=snap()['decks'][0]
  ev('window.playSamples=[];window.sampleTimer=setInterval(()=>playSamples.push(TuneToxDesign.h1.getSnapshot().decks[0].playing),10)')
  loadSong(1,'blue',1);after=snap()['decks'][0];ev('clearInterval(sampleTimer)')
  check(after['songId']=='amber' and after['playing'] and after['queuedSongId']=='blue','Second song queues without replacing playing first '+build)
  check(ev('document.querySelector('+json.dumps(sel(1,'.h1-song-title'))+').textContent')=='Amber Hour','Rendered current song remains the first song '+build)
  check(after['position']>=before['position'] and after['stems']==before['stems'] and after['volume']==before['volume'],'Position/stems/Main preserved during load '+build)
  check(ev('playSamples.length>0&&playSamples.every(Boolean)'),'No sampled false pause during live load '+build)
  if build=='h51':
   check(ev('document.querySelector('+json.dumps(sel(1,'.h5-queue'))+').textContent')=='READY','Compact READY indicator after live load')
   loadSong(1,'home',1);check(snap()['decks'][0]['queuedSongId']=='blue' and snap()['decks'][0]['songId']=='amber' and snap()['decks'][0]['playing'],'Occupied queue not overwritten')
   click(sel(1,'.h3-library-top>button'));capture('h51-queue-ready.png');stems=snap()['decks'][0]['stems'];click(sel(1,'.h5-queue'));after=snap()['decks'][0]
   check(after['songId']=='blue' and after['playing'] and after['position']<.3 and not after['queuedSongId'] and after['stems']==stems,'Live Swap starts queued song with inherited stems')
  check(ev('audioCreates===0&&storageOpens===0&&scriptErrors.length===0'),'No production audio/storage/errors '+build)
 root.joinpath('measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');root.joinpath('verification.json').write_text(json.dumps({'browserChecks':checks,'stateChecks':178,'h5QueueReproduction':'Not reproduced in explicit real-clock served-page sequence; H5.1 route verified too','physicalSafari':'pending'},indent=2)+'\n');print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
