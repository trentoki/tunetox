"""H4 actual served-page tests. Synthetic native touch dispatch is not physical Safari evidence."""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP']
endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;metrics=[]
root=pathlib.Path('development/design-mode/portrait-preview/review')
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
def advance(dt):ev('TuneToxDesign.h5Test.advance('+str(dt)+')')
def contacts(kind,points):
 c.call('Input.dispatchTouchEvent',dict(type=kind,touchPoints=[dict(x=x,y=y,id=id,radiusX=2,radiusY=2,force=1) for id,x,y in points]));time.sleep(.03)
def centerPoint(s):
 r=rect(s);return r['x']+r['width']/2,r['y']+r['height']/2
def shiftPad(index):
 sx,sy=centerPoint(sel(1,'[data-modifier=shift]'));px,py=centerPoint(sel(1,'[data-cue="'+str(index)+'"]'))
 contacts('touchStart',[(1,sx,sy)]);contacts('touchStart',[(1,sx,sy),(2,px,py)]);return (px,py)
def releaseShiftFirst(point):
 sx,sy=centerPoint(sel(1,'[data-modifier=shift]'));contacts('touchEnd',[(1,sx,sy)]);contacts('touchEnd',[])
def popoverVisible():return ev('!document.querySelector(".h53-popover").hidden')
def choosePopup(text):click('.h53-popover button:nth-child('+str(ev('Array.from(document.querySelectorAll(".h53-popover button")).findIndex(b=>b.textContent==='+json.dumps(text)+')')+1)+')')
def holdOpen(s):
 x,y=centerPoint(s);touch('touchStart',x,y);time.sleep(.25);return x,y
def assertPopup(label):
 r=rect('.h53-popover');check(popoverVisible() and r['x']>=0 and r['right']<=ev('innerWidth')+1 and r['y']>=0 and r['bottom']<=ev('innerHeight')+1,label)
try:
 c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5));c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.H5_TEST_CLOCK=true;window.audioCreates=0;window.storageOpens=0;window.scriptErrors=[];addEventListener('error',e=>scriptErrors.push(e.message));for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('Unexpected audio')}};indexedDB.open=()=>{storageOpens++;throw Error('Unexpected storage')};"})
 size(1194,834);c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/portrait-preview/?build=h53'});time.sleep(.7)
 check(ev('!!TuneToxDesign.h1&&!window.h1BootError&&document.title.includes("H5.3")'),'H5.3 boot')
 mode(1,'controls');pane=sel(1,'.h3-controls');fx=sel(1,'.h3-controls .h52-fx-type');r=rect(fx);click(fx)
 assertPopup('Themed FX tap opens unclipped popover');check(ev('document.querySelector(".h53-popover").getAttribute("aria-label").includes("Deck 1")'),'FX popup identifies its deck for keyboard users');check(rect(fx)==r,'FX popover leaves underlying layout fixed')
 check(ev('document.querySelector(".h53-popover").parentElement===document.body'),'Popover portal outside locked Controls')
 choosePopup('Reverb');check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Reverb' and not popoverVisible(),'Tap option selects FX and closes')
 before=snap()['decks'][0]['performance']['effects'][0]['value'];holdOpen(fx);assertPopup('Hold reveals FX options');capture('h53-fx-popover-ipad.png');choice='.h53-popover button:nth-child(4)';x,y=centerPoint(choice);touch('touchMove',x,y)
 check(ev('document.querySelector('+json.dumps(choice)+').getAttribute("aria-selected")')=='true' and snap()['decks'][0]['performance']['effects'][0]['assignment']=='Reverb','Held vertical slide highlights before commit')
 touch('touchEnd');check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Chorus' and snap()['decks'][0]['performance']['effects'][0]['value']==before,'Release selects effect without changing its amount')
 ev('document.querySelector('+json.dumps(fx)+').focus()');c.call('Input.dispatchKeyEvent',dict(type='rawKeyDown',key='ArrowDown',code='ArrowDown'));check(popoverVisible(),'Keyboard opens FX popover');c.call('Input.dispatchKeyEvent',dict(type='rawKeyDown',key='ArrowDown',code='ArrowDown'));c.call('Input.dispatchKeyEvent',dict(type='rawKeyDown',key='Enter',code='Enter'));check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Flanger','Keyboard chooses FX')
 click(fx);c.call('Input.dispatchKeyEvent',dict(type='rawKeyDown',key='Escape',code='Escape'));check(not popoverVisible() and snap()['decks'][0]['performance']['effects'][0]['assignment']=='Flanger','Escape dismisses without changing selected FX');drag(sel(1,'.h3-controls .effect-control .knob-dial'),-20);check(snap()['decks'][0]['performance']['effects'][0]['value']>0,'FX amount independent drag retained')
 click(fx);mode(1,'wave');check(not popoverVisible(),'Popover closes when its view hides');mode(1,'controls')
 for w,h in [(1194,834),(1024,768),(834,1194),(768,1024)]:
  size(w,h);mode(1,'controls');box=rect(pane);check(ev('getComputedStyle(document.querySelector('+json.dumps(pane)+')).overflow')=='clip','Tablet Controls locked '+str((w,h)))
  ev('document.querySelector('+json.dumps(pane)+').scrollTop=100');check(ev('document.querySelector('+json.dumps(pane)+').scrollTop')==0,'Controls cannot scroll programmatically '+str((w,h)))
  knobs=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h3-controls .knob-dial'))+')).map(n=>n.getBoundingClientRect().toJSON())')
  check(all(k['y']>=box['y']-.5 and k['bottom']<=box['bottom']+.5 for k in knobs),'Locked Controls keeps knobs visible '+str((w,h)))
  x=box['x']+box['width']/2;y=box['y']+box['height']/2;touch('touchStart',x,y);touch('touchMove',x,y-45);touch('touchEnd');check(ev('document.querySelector('+json.dumps(pane)+').scrollTop')==0 and ev('scrollY')==0,'Touch drag does not move Controls/page '+str((w,h)))
  c.call('Input.dispatchMouseEvent',dict(type='mouseWheel',x=x,y=y,deltaX=0,deltaY=80));check(ev('document.querySelector('+json.dumps(pane)+').scrollTop')==0,'Wheel cannot move Controls '+str((w,h)))
  before=snap()['decks'][0]['performance']['filter'];drag(sel(1,'.h3-controls [data-control=filter] .knob-dial'),-12);check(snap()['decks'][0]['performance']['filter']>before,'Locked-panel knob still adjusts '+str((w,h)))
  metrics.append(dict(width=w,height=h,controls=box))
  if w==1194:capture('h53-ipad-landscape.png')
  if w==834:capture('h53-ipad-portrait.png')
 # Library is a sibling of Controls and must retain its own scroll.
 click(sel(1,'.h3-open-library'));lib(1,'songs');listing=sel(1,'.h4-library-list');ev('document.querySelector('+json.dumps(listing)+').scrollTop=100');check(ev('document.querySelector('+json.dumps(listing)+').scrollTop')>0,'Library retains independent scrolling')
 ev('document.querySelector('+json.dumps(listing)+').scrollTop=0');r=rect(listing);x=r['x']+r['width']/2;touch('touchStart',x,r['y']+r['height']*.75);touch('touchMove',x,r['y']+r['height']*.25);touch('touchEnd');time.sleep(.1);check(ev('document.querySelector('+json.dumps(listing)+').scrollTop')>0,'Library still scrolls with real touch gestures')
 click(sel(1,'.h3-library-top>button'))
 size(390,844);mode(1,'controls');check(rect('#h1-main-1')['height']>0 and rect(sel(1,'.h1-transport'))['height']==36,'Phone Controls retains compact Main transport');click(fx);assertPopup('Phone Controls FX popover fits');capture('h53-fx-popover-phone.png');choosePopup('Echo');holdOpen(fx);x,y=centerPoint('.h53-popover button:nth-child(4)');touch('touchMove',x,y);touch('touchEnd');check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Chorus','Phone FX hold-slide commits without browser panning');mode(1,'transition');check(rect('#h1-main-1')['height']==0,'Phone Transition hides only redundant transport Main');check(rect(sel(1,'.h1-play'))['height']>=36 and rect(sel(1,'.h5-queue'))['height']>=36,'Transition Play and Queue remain directly accessible')
 check(ev('document.querySelectorAll(".h52-transition-overview>.h52-choice").length===0'),'Partner header row removed')
 overview=sel(1,'.h52-transition-overview:last-child');partner=overview+' .h53-partner-touch';positions=[d['position'] for d in snap()['decks']];click(partner)
 check(snap()['decks'][0]['transitionPartner']==3 and [d['position'] for d in snap()['decks']]==positions,'Central waveform tap cycles partner without seek')
 ev("window.partnerEvents=[];for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>partnerEvents.push({type,target:e.target.className,id:e.pointerId}),true);const originalPartner=TuneToxDesign.h5.setPartner;TuneToxDesign.h5.setPartner=function(s,id,value){partnerEvents.push({call:true,id,value});return originalPartner(s,id,value)}");check(ev('getComputedStyle(document.querySelector('+json.dumps(partner)+')).touchAction')=='none','Partner source explicitly owns vertical touch');holdOpen(partner);assertPopup('Partner hold opens themed choices');capture('h53-partner-popover.png');check(ev('document.querySelector(".h53-popover").textContent.includes("D1")') is False,'Partner excludes primary deck')
 x,y=centerPoint('.h53-popover button:last-child');touch('touchMove',x,y);touch('touchEnd');root.joinpath('partner-gesture-trace.json').write_text(json.dumps(ev('partnerEvents'),indent=2)+'\n');check(not any(e.get('type')=='pointercancel' for e in ev('partnerEvents')),'Partner gesture cannot become browser panning');check(snap()['decks'][0]['transitionPartner']==4 and [d['position'] for d in snap()['decks']]==positions,'Waveform vertical slide commits partner without seek')
 check(all(d['wave']['nudge']==0 for d in snap()['decks']),'Partner selection never activates nudges')
 mode(1,'controls');mode(1,'transition');check(snap()['decks'][0]['transitionPartner']==4,'Partner selection persists')
 # Both playing decks, independent opposite nudge gestures.
 mode(1,'wave');click(sel(1,'.h1-play'));click('.h5-phone-deck[data-deck="4"]');mode(4,'wave');click(sel(4,'.h1-play'));click('.h5-phone-deck[data-deck="1"]');mode(1,'transition')
 left=sel(1,'.h52-transition-overview:first-child .h53-overview-nudges button:last-child');right=sel(1,'.h52-transition-overview:last-child .h53-overview-nudges button:first-child');lx,ly=centerPoint(left);rx,ry=centerPoint(right);before=snap()['decks'];tempo=[d['tempo'] for d in before]
 contacts('touchStart',[(1,lx,ly)]);contacts('touchStart',[(1,lx,ly),(2,rx,ry)]);check(snap()['decks'][0]['wave']['nudge']==1 and snap()['decks'][3]['wave']['nudge']==-1,'Both overview edges nudge independently')
 check(rect(left)['width']>=32 and rect(right)['height']>=44,'Overview nudge zones retain useful touch area');capture('h53-nudges-active.png')
 advance(1);after=snap()['decks'];check(abs(after[0]['position']-before[0]['position']-1.05)<1e-6 and abs(after[3]['position']-before[3]['position']-.95)<1e-6,'Independent opposite nudge rates')
 contacts('touchEnd',[]);check(snap()['decks'][0]['wave']['nudge']==0 and snap()['decks'][3]['wave']['nudge']==0 and [d['tempo'] for d in snap()['decks']]==tempo,'Nudge release/cancel restores both original tempos')
 check(snap()['decks'][0]['transitionPartner']==4,'Edge zones never change partner')
 # BeatMatch-on uses the established preview scheduler, not a new grid.
 mode(1,'wave');click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'));click(sel(1,'.h3-deck-id'));mode(1,'transition');p=snap()['decks'][0]['position'];click(left);deck=snap()['decks'][0];check(deck['wave']['pending'] is not None and deck['position']==p,'Overview BeatMatch schedules pending beat skip')
 dt=(deck['wave']['pending']['boundary']-deck['wave']['clock'])*60/deck['tempo'];advance(dt);check(abs(snap()['decks'][0]['position']-(p+dt+60/deck['tempo']))<1e-6,'Overview beat skip keeps original boundary behavior')
 # FX in Transition retains the exact layout and correct Main endpoints.
 transitionFx=sel(1,'.h52-mixer-strip:last-child .h52-fx-type');click(transitionFx);assertPopup('Transition FX popover fits without clipping');check(ev('document.querySelector(".h53-popover").getAttribute("aria-label").includes("Deck 4")'),'Partner FX popup identifies current partner rather than initial deck');capture('h53-fx-popover-transition.png');choosePopup('Delay');check(snap()['decks'][3]['performance']['effects'][0]['assignment']=='Delay','Transition FX targets partner')
 for w,h in [(390,844),(375,667),(320,568),(320,480)]:
  size(w,h);mode(1,'transition');t=sel(1,'.h52-transition');box=rect(t)
  dims=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h52-transition,.h52-transition-mixers,.h52-mixer-strip,.h52-eq-column,.h52-filter-fx-column'))+')).map(n=>({h:n.clientHeight,sh:n.scrollHeight,w:n.clientWidth,sw:n.scrollWidth}))')
  check(all(d['sh']<=d['h']+1 and d['sw']<=d['w']+1 for d in dims),'Transition no scroll/clipping '+str((w,h)))
  knobs=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h52-transition .knob-dial'))+')).map(n=>n.getBoundingClientRect().toJSON())');check(all(k['width']>=44 and k['y']>=box['y'] and k['bottom']<=box['bottom']+.5 for k in knobs),'Both strips/44px knobs fully visible '+str((w,h)))
  for side in ['first-child','last-child']:
   strip=sel(1,'.h52-mixer-strip:'+side);a=rect(strip+' .h52-main-column');b=rect(strip+' .h52-eq-column');z=rect(strip+' .h52-filter-fx-column');check(a['x']<b['x']<z['x'],'Three columns preserved '+str(w)+side)
   for value in [0,1]:
    ranges(strip+' input',value);handle=rect(strip+' .h51-fader-handle');rail=rect(strip+' .h51-fader-rail');check(abs(handle['y']+12-(rail['bottom'] if value==0 else rail['top']))<.5,'Main exact endpoint '+str(w)+side+str(value))
  click(transitionFx);assertPopup('Short-phone FX portal stays within viewport '+str((w,h)));choosePopup('Chorus')
  metrics.append(dict(width=w,height=h,transition=box,dimensions=dims))
  if w==390:capture('h53-transition-phone.png')
  if w==320 and h==568:capture('h53-transition-small.png')
  if w==320 and h==480:capture('h53-transition-reduced-height.png')
 # Preserve Wave+Cue and actual queue isolation.
 size(390,844);mode(1,'wave');check(rect('#h1-main-1')['height']>0 and rect(sel(1,'.h1-transport'))['height']==36,'Wave+Cue restores unchanged compact transport');loadSong(1,'blue',1);queued=snap()['decks'][0]['queuedSongId'];click(sel(1,'[data-cue="0"]'));point=shiftPad(0);releaseShiftFirst(point)
 check(snap()['decks'][0]['compact']['cues'][0] is None and snap()['decks'][0]['queuedSongId']==queued,'Cue Shift deletion still cannot modify queue')
 mode(1,'transition');before=snap()['decks'][0];click(sel(1,'.h1-play'));paused=not snap()['decks'][0]['playing'];click(sel(1,'.h1-play'));check(paused and snap()['decks'][0]['playing'],'Transition stack Play remains independently usable')
 click(sel(1,'.h5-queue'));after=snap()['decks'][0];check(after['songId']=='blue' and after['playing'] and not after['queuedSongId'] and after['stems']==before['stems'] and after['volume']==before['volume'],'Reclaimed transport Queue/Swap preserves source levels')
 check(rect('#h1-main-1')['height']>0 and ev('document.querySelector("#h1-main-1").valueAsNumber')==after['volume'],'Returning Wave transport Main reflects the same deck state')
 check(ev('document.querySelectorAll(".h3-controls select,.h52-transition select").length===0'),'No native FX dropdowns')
 size(844,390);mode(1,'controls');check(ev('getComputedStyle(document.querySelector('+json.dumps(pane)+')).overflow')=='auto','Phone landscape Controls behavior remains unchanged')
 check(ev('audioCreates===0&&storageOpens===0&&scriptErrors.length===0&&!window.h1BootError'),'No production audio/storage or script errors')
 root.joinpath('measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');root.joinpath('verification.json').write_text(json.dumps({'stateChecks':90,'browserChecks':checks,'physicalSafari':'pending'},indent=2)+'\n');print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
