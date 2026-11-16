"""H3 served-page checks with real touch-event sliding on an isolated CDP browser.
No audio/storage and no mutation of H1/H2 comparison outputs.
"""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP'];endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;metrics=[];root=pathlib.Path('development/design-mode/fixed/review')
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
def snapshot():return ev('TuneToxDesign.h1.getSnapshot()')
def mode(id,name):click(sel(id,'.h3-selector [data-mode='+name+']'))
def ranges(s,value):ev('(()=>{const x=document.querySelector('+json.dumps(s)+');x.value='+str(value)+';x.dispatchEvent(new Event("input",{bubbles:true}));})()')
def drag(s,dy):
 r=rect(s);x=r['x']+r['width']/2;y=r['y']+r['height']/2
 for kind,offset in [('pointerdown',0),('pointermove',dy),('pointerup',dy)]:ev('document.querySelector('+json.dumps(s)+').dispatchEvent(new PointerEvent('+json.dumps(kind)+',{bubbles:true,cancelable:true,pointerId:22,button:0,clientX:'+str(x)+',clientY:'+str(y+offset)+'}))')
def capture(name):root.joinpath(name).write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['data']))
def fixed(id):return [rect(sel(id,s)) for s in ['.h3-top','.h3-overview','.h3-stems','.h1-transport']]
def touch(kind,x=None,y=None):
 points=[] if kind=='touchEnd' else [dict(x=x,y=y,id=1,radiusX=2,radiusY=2,force=1)]
 c.call('Input.dispatchTouchEvent',dict(type=kind,touchPoints=points));time.sleep(.025)
try:
 c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5))
 c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.audioCreates=0;window.storageOpens=0;for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('No audio in H3')}};indexedDB.open=()=>{storageOpens++;throw Error('No storage in H3')};"})
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=1,mobile=True));c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/fixed/?build=h3'});time.sleep(.8)
 check(ev('!!TuneToxDesign.h1&&!window.h1BootError'),'H3 boot')
 check(ev('document.title.includes("H3")&&document.querySelector("h1").textContent.includes("DESIGN MODE")'),'Clear H3 identity')
 check(ev('document.querySelectorAll(".h3-selector").length===4&&document.querySelector(".h1-page-nav")===null'),'Old navigation strip removed; one selector per deck')
 check(ev('document.querySelectorAll(".h3-stems").length===4&&document.querySelector(".h3-controls .h1-stems")===null'),'Exactly one permanently mounted stem group')
 baseline=fixed(1);center=rect(sel(1,'.h3-center'))
 for name in ['cue','controls','wave']:
  mode(1,name);check(snapshot()['decks'][0]['compact']['mode']==name,'Ordinary tap '+name)
  check(fixed(1)==baseline and rect(sel(1,'.h3-center'))==center,'Fixed center/stems/overview/transport across '+name)
 # Real browser touch events, querying state before lifting the finger.
 ev('window.slideEvents=[];for(const type of ["pointerdown","pointermove","lostpointercapture","pointercancel"])document.querySelector('+json.dumps(sel(1,'.h3-selector'))+').addEventListener(type,e=>slideEvents.push({type,x:e.clientX,id:e.pointerId,mode:TuneToxDesign.h1.getSnapshot().decks[0].compact.mode}));')
 r=rect(sel(1,'.h3-selector'));y=r['y']+r['height']/2;touch('touchStart',r['x']+r['width']/6,y)
 touch('touchMove',r['x']+r['width']/2,y);check(snapshot()['decks'][0]['compact']['mode']=='cue','Touch crosses into Cue before release')
 touch('touchMove',r['x']+r['width']*5/6,y);check(snapshot()['decks'][0]['compact']['mode']=='controls','Same held touch crosses into Controls')
 touch('touchMove',r['right']+35,y);check(snapshot()['decks'][0]['compact']['mode']=='controls','No wrap at right end')
 touch('touchMove',r['x']+r['width']/6,y);check(snapshot()['decks'][0]['compact']['mode']=='wave','Same finger reverses to Wave')
 touch('touchMove',r['x']-35,y);touch('touchEnd');check(snapshot()['decks'][0]['compact']['mode']=='wave','No wrap at left; release keeps current mode')
 root.joinpath('slide-trace.json').write_text(json.dumps(ev('slideEvents'),indent=2)+'\n')
 check(fixed(1)==baseline and snapshot()['decks'][0]['volume']==.7,'Sliding does not move stems or activate Main')
 check(ev('document.querySelectorAll(".h3-hot-cues button").length===32'),'Eight cues per deck')
 mode(1,'cue');cues=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h3-hot-cues button'))+')).map(b=>b.getBoundingClientRect().toJSON())')
 check(len({r['y'] for r in cues})==2 and len({r['x'] for r in cues})==4,'Cue layout is two rows of four')
 before=snapshot()['decks'][0]['compact']['cues'];shift=sel(1,'[data-modifier=shift]');r=rect(shift)
 ev('document.querySelector('+json.dumps(shift)+').dispatchEvent(new PointerEvent("pointerdown",{pointerId:99,button:0,bubbles:true,cancelable:true}))')
 click(sel(1,'.h3-hot-cues button:nth-child(3)'))
 check(snapshot()['decks'][0]['compact']['cues'][2] is None and snapshot()['decks'][0]['compact']['cues'][1]==before[1],'Shift + Cue deletes only selected preview cue')
 ev('document.querySelector('+json.dumps(shift)+').dispatchEvent(new PointerEvent("pointerup",{pointerId:99,button:0,bubbles:true,cancelable:true}))')
 click(sel(1,'.h3-hot-cues button:nth-child(3)'));check(snapshot()['decks'][0]['compact']['cues'][2] is not None,'Empty cue can be set again')
 check(ev('document.querySelector('+json.dumps(sel(1,'.h3-cue'))+').textContent.includes("Quantize")===false'),'No prominent Quantize control in Cue')
 click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'))
 check(snapshot()['decks'][0]['beatMatch'],'Matching popover preserved')
 q=sel(1,'.h3-timing input');check(ev('document.querySelector('+json.dumps(q)+').checked'),'BeatMatch enables default cue timing preview')
 click(q);check(snapshot()['decks'][0]['compact']['quantizeOverride'] is False,'Preview quantization can be disabled independently')
 click(sel(1,'.h3-song-row strong'))
 drag(sel(1,'.h1-value-pad[data-control=tempo]'),-20);check(snapshot()['decks'][0]['tempo']==125,'Per-deck Tempo vertical drag preserved')
 track=rect('#h1-main-1');ranges('#h1-main-1',.09);ranges('#h1-main-1',1);check(rect('#h1-main-1')==track,'Main percentage changes preserve track geometry')
 ranges('#h1-stem-1-2',.37);mode(1,'controls');check(snapshot()['decks'][0]['stems'][2]==.37 and fixed(1)==baseline,'Stem value and geometry persist in Controls')
 click(sel(1,'.h1-play'));time.sleep(.2);beforePos=snapshot()['decks'][0]['position']
 click(sel(1,'.h3-open-library'));check(snapshot()['decks'][0]['playing'],'Library entry does not pause playback')
 check(rect(sel(1,'.h3-top'))['height']>0 and ev('getComputedStyle(document.querySelector('+json.dumps(sel(1,'.h3-top'))+')).visibility==="hidden"'),'Library replaces Tempo/Pitch and performance frame')
 panel=rect(sel(1,''));library=rect(sel(1,'.column-library'));top=rect(sel(1,'.h3-library-top'))
 check(abs(top['y']-panel['y']-2)<3 and abs(library['y']-top['bottom'])<2 and library['bottom']>=panel['bottom']-2,'Library uses entire panel workspace')
 click(sel(1,'.column-playlists-tab'));click(sel(1,'[data-playlist-id=afterhours]'))
 ev('(()=>{const x=document.querySelector('+json.dumps(sel(1,'.column-search'))+');x.value="Night";x.dispatchEvent(new Event("input"));})()');time.sleep(.2)
 check(snapshot()['decks'][0]['position']>beforePos,'Playback cursor advances behind Library')
 click(sel(1,'.h3-library-top button'));check(snapshot()['decks'][0]['compact']['mode']=='controls' and snapshot()['decks'][0]['stems'][2]==.37 and fixed(1)==baseline,'Return restores exact fixed frame and controls')
 click(sel(1,'.h1-play'));click(sel(1,'.h3-open-library'));check(snapshot()['columnLibraries'][0]['songQuery']=='Night','Full-panel library retains independent search/context')
 click(sel(1,'.h3-library-top button'))
 before=snapshot();click('#h1-tools-open');ranges('[data-parameter=centralHeight]',220);click('#h1-tools-close')
 r=fixed(1)
 for name in ['wave','cue','controls']:mode(1,name);check(fixed(1)==r,'Adjusted stems still fixed across '+name)
 click('#h1-tools-open');click('#h1-layout-reset');click('#h1-tools-close');check(snapshot()['decks'][0]['stems'][2]==before['decks'][0]['stems'][2],'Reset H3 defaults preserves values')
 # Mix modes and full Library for the tablet review image.
 mode(1,'wave');mode(2,'cue');mode(3,'controls');click(sel(4,'.h3-open-library'));capture('h3-mixed-ipad.png')
 c.call('Page.reload');time.sleep(.6)
 for w,h in [(1194,834),(1024,768),(390,844),(375,667),(320,568)]:
  c.call('Emulation.setDeviceMetricsOverride',dict(width=w,height=h,deviceScaleFactor=1,mobile=True));time.sleep(.2)
  boxes=[rect(sel(id,'')) for id in [1,2,3,4]];visible=[r for r in boxes if r['width']>0 and r['height']>0]
  check(len(visible)==(1 if w<700 else 4),'Phone one deck / tablet four '+str((w,h)))
  check(ev('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),'Fixed document '+str((w,h)))
  a=fixed(1)
  for name in ['cue','controls','wave']:mode(1,name);check(fixed(1)==a,'All fixed rows exact '+str((w,h))+name)
  check(rect(sel(1,'.h3-stems'))['bottom']<=h and rect('#h1-stem-1-3')['height']>=36,'All four fixed faders remain reachable '+str(w))
  metrics.append(dict(width=w,height=h,deckWidth=visible[0]['width'],deckHeight=visible[0]['height'],visibleDecks=len(visible),centerHeight=rect(sel(1,'.h3-center'))['height'],overviewHeight=rect(sel(1,'.h3-overview'))['height'],stemHeight=rect(sel(1,'.h3-stems'))['height']))
  if w==1194:capture('h3-ipad.png')
  if w==390:capture('h3-phone.png')
 # Held touch on the shortest phone, without lifting between modes.
 r=rect(sel(1,'.h3-selector'));x=r['x'];y=r['y']+r['height']/2;w=r['width'];a=fixed(1)
 touch('touchStart',x+w/6,y);touch('touchMove',x+w/2,y)
 check(snapshot()['decks'][0]['compact']['mode']=='cue','Phone held touch reaches Cue before release')
 touch('touchMove',x+w*5/6,y)
 check(snapshot()['decks'][0]['compact']['mode']=='controls' and fixed(1)==a,'Phone held touch reaches Controls with fixed stems')
 touch('touchEnd');mode(1,'wave');capture('h3-phone-small.png')
 # Phone switching preserves hidden-deck playback and Library context.
 c.call('Emulation.setDeviceMetricsOverride',dict(width=390,height=844,deviceScaleFactor=1,mobile=True));time.sleep(.2)
 click(sel(1,'.h1-play'));p=snapshot()['decks'][0]['position'];click('.h3-phone-decks [data-deck="2"]');time.sleep(.2)
 check(snapshot()['decks'][0]['playing'] and snapshot()['decks'][0]['position']>p,'Hidden phone deck keeps simulated playback')
 click(sel(2,'.h3-open-library'));click('.h3-phone-decks [data-deck="1"]');click('.h3-phone-decks [data-deck="2"]')
 check(snapshot()['decks'][1]['compact']['workspace']=='library','Phone deck switching retains Library workspace')
 click(sel(2,'.h3-library-top button'));check(snapshot()['decks'][1]['compact']['mode']=='wave','Return retains that deck mode')
 check(ev('audioCreates===0&&storageOpens===0&&typeof appState==="undefined"'),'No audio/storage/production state through all interactions')
 check(ev('!window.h1BootError'),'No browser script errors')
 root.joinpath('measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
