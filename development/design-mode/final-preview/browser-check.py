"""H4 actual served-page tests. Synthetic native touch dispatch is not physical Safari evidence."""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP']
endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;metrics=[]
root=pathlib.Path('development/design-mode/final-preview/review')
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
try:
 c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5))
 c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.H5_TEST_CLOCK=location.search.includes('deterministic');window.audioCreates=0;window.storageOpens=0;window.scriptErrors=[];addEventListener('error',e=>scriptErrors.push(e.message));for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('Unexpected audio')}};indexedDB.open=()=>{storageOpens++;throw Error('Unexpected storage')};"})
 size(390,844);c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/final-preview/?build=h52&deterministic=1'});time.sleep(.7)
 check(ev('!!TuneToxDesign.h1&&!window.h1BootError&&document.title.includes("H5.2")'),'H5.2 served boot and identifier')
 check(ev('document.querySelectorAll(".h5-view-menu button").length===3'),'Phone has exactly Wave+Cue / Controls / Transition')
 check(ev('document.querySelector(".h5-view-menu").textContent.includes("Wave + Cue")'),'Wave+Cue name shown in navigation')
 check(ev('document.querySelectorAll(".h3-song-row .h3-selector button").length===8'),'Exactly two primary positions per deck')
 check(ev('!document.body.textContent.includes("Quantize cue preview")&&!document.body.textContent.includes("Follow BeatMatch")'),'Quantize preview and Follow BeatMatch removed without gap')
 check(ev('document.querySelectorAll(".h3-controls select,.h52-transition select,.h5-wave-tools select").length===0'),'No native performance dropdowns')
 check(rect(sel(1,'.h3-wave'))['height']>0 and rect(sel(1,'.h52-cue'))['height']>0 and rect(sel(1,'.h3-stems'))['height']==0,'Wave and Cue together; stems not duplicated there')
 # Paused cue set/jump; exact state and visible pad/marker.
 p=snap()['decks'][0]['position'];click(sel(1,'[data-cue="0"]'))
 check(snap()['decks'][0]['compact']['cues'][0]==p and not snap()['decks'][0]['playing'],'Empty cue records paused playhead')
 check(ev('document.querySelector('+json.dumps(sel(1,'[data-cue="0"]'))+').textContent.includes(":")'),'Assigned pad displays position')
 check(ev('!document.querySelector('+json.dumps(sel(1,'.h52-cue-marker'))+').hidden'),'Cue marker visible on scrolling waveform')
 z=sel(1,'.h1-zoom');r=rect(z);x=r['x']+r['width']/2;y=r['y']+r['height']*.7;touch('touchStart',x,y);touch('touchMove',x-r['width']/4,y);touch('touchEnd')
 check(abs(snap()['decks'][0]['position']-p-3)<.1,'LEFT scrub advances under stationary playhead')
 click(sel(1,'[data-cue="0"]'));check(snap()['decks'][0]['position']==p and not snap()['decks'][0]['playing'],'Assigned cue jumps and stays paused')
 click(sel(1,'.h1-play'));advance(.275);p=snap()['decks'][0]['position'];click(sel(1,'[data-cue="1"]'));check(snap()['decks'][0]['compact']['cues'][1]==p and snap()['decks'][0]['playing'],'Empty cue records playing playhead without pause')
 advance(.5);click(sel(1,'[data-cue="1"]'));check(snap()['decks'][0]['position']==p and snap()['decks'][0]['playing'],'Assigned cue jump continues playback')
 # Queue before deleting, to prove independence using genuine simultaneous contacts.
 loadSong(1,'blue',1);check(snap()['decks'][0]['queuedSongId']=='blue' and snap()['decks'][0]['songId']=='neon','Playing load queues, keeps source and Wave+Cue')
 position=snap()['decks'][0]['position'];point=shiftPad(0)
 check(snap()['decks'][0]['compact']['shift'] and snap()['decks'][0]['compact']['cues'][0] is None,'Two-finger held Shift deletes assigned cue on contact')
 check(snap()['decks'][0]['queuedSongId']=='blue' and snap()['decks'][0]['position']==position and snap()['decks'][0]['playing'],'Cue deletion never alters queue, position or playback')
 releaseShiftFirst(point);check(not snap()['decks'][0]['compact']['shift'] and snap()['decks'][0]['compact']['cues'][0] is None,'Releasing Shift before cue finger cannot activate a cue')
 before=snap()['decks'][0];point=shiftPad(0);releaseShiftFirst(point);after=snap()['decks'][0]
 check(after['compact']['cues']==before['compact']['cues'] and after['position']==before['position'] and after['queuedSongId']==before['queuedSongId'],'Shift+empty does nothing and preserves queue')
 check(rect(sel(1,'.h3-wave'))['height']>0 and snap()['decks'][0]['compact']['mode']=='wave','Wave never hidden while setting/deleting cues')
 capture('h52-wave-cue-phone.png')
 # Centered phone edge zones and beat length direct slide/tap.
 left=rect(sel(1,'.h5-wave-tools button:first-child'));right=rect(sel(1,'.h5-wave-tools button:last-child'));zoom=rect(z)
 check(abs(left['left']-zoom['left'])<2 and abs(right['right']-zoom['right'])<2 and abs(left['y']+left['height']/2-(zoom['y']+zoom['height']/2))<2,'Phone zones at actual waveform edges and vertical center')
 plus=sel(1,'.h5-wave-tools button:last-child');x,y=centerPoint(plus);p=snap()['decks'][0]['position'];tempo=snap()['decks'][0]['tempo'];touch('touchStart',x,y);advance(1);touch('touchEnd')
 check(abs(snap()['decks'][0]['position']-p-1.05)<1e-6 and snap()['decks'][0]['tempo']==tempo,'Edge nudge temporary and tempo unchanged')
 p=snap()['decks'][0]['position'];advance(1);check(abs(snap()['decks'][0]['position']-p-1)<1e-6,'Edge nudge release restores rate')
 click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'));click(sel(1,'.h3-deck-id'))
 length=sel(1,'.h52-beat-length');click(length);check(snap()['decks'][0]['wave']['beats']==2,'Beat length tap cycles')
 drag(length,-18);check(snap()['decks'][0]['wave']['beats']==4,'Beat length vertical slide changes choice')
 p=snap()['decks'][0]['position'];click(plus);deck=snap()['decks'][0];check(deck['wave']['pending'] is not None and deck['position']==p,'Beat skip waits for next boundary')
 dt=(deck['wave']['pending']['boundary']-deck['wave']['clock'])*60/tempo;advance(dt-.001);check(snap()['decks'][0]['wave']['pending'] is not None,'No early boundary jump');advance(.001)
 check(abs(snap()['decks'][0]['position']-(p+dt+4*60/tempo))<1e-6,'Boundary-relative beat skip preserved')
 # Controls owns one stem group; existing knob values, effects and discrete FX type.
 mode(1,'controls');check(rect(sel(1,'.h3-stems'))['height']>0 and rect(sel(1,'.h52-cue'))['height']==0,'Controls shows original stems, without duplicated cue workspace')
 check(ev('document.querySelectorAll('+json.dumps(sel(1,'.h3-stems input'))+').length')==4,'Exactly four stem inputs per deck')
 ranges('#h1-stem-1-2',.41);mode(1,'wave');mode(1,'controls');check(snap()['decks'][0]['stems'][2]==.41,'Stem values survive primary view switches')
 effect=sel(1,'.h3-controls .h52-fx-type');click(effect);check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Reverb','FX type tap fallback')
 drag(effect,-36);check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Chorus','FX type vertical slide')
 drag(sel(1,'.h3-controls .effect-control .knob-dial'),-24);check(snap()['decks'][0]['performance']['effects'][0]['value']>0,'Existing FX amount knob still adjusts value')
 # iPhone Transition: full-song overviews, partner label, exact three-column controls.
 mode(1,'transition');t=sel(1,'.h52-transition');check(ev('document.querySelectorAll('+json.dumps(sel(1,'.h52-transition-overview'))+').length')==2,'Transition has exactly two full-song overview waveforms')
 check(ev('document.querySelectorAll(".h5-transition-partners").length===0'),'Separate partner button row removed')
 before=[deck['position'] for deck in snap()['decks']];overview=sel(1,'.h52-transition-overview:last-child .h52-overview-wave');x,y=centerPoint(overview);touch('touchStart',x,y);touch('touchMove',x-30,y);touch('touchEnd')
 check([deck['position'] for deck in snap()['decks']]==before and snap()['decks'][0]['wave']['nudge']==0,'Transition overviews cannot seek, scrub or nudge')
 partner=sel(1,'.h52-transition-overview:last-child .h52-choice');click(partner);check(snap()['decks'][0]['transitionPartner']==3,'Partner header tap cycles other decks')
 drag(partner,-18);check(snap()['decks'][0]['transitionPartner']==4 and [deck['position'] for deck in snap()['decks']]==before,'Partner vertical slide changes only partner selection')
 leftMarker=sel(1,'.h52-transition-overview:first-child .h52-overview-marker');rightMarker=sel(1,'.h52-transition-overview:last-child .h52-overview-marker')
 leftBefore=ev('document.querySelector('+json.dumps(leftMarker)+').style.left');rightBefore=ev('document.querySelector('+json.dumps(rightMarker)+').style.left');advance(.25)
 check(ev('document.querySelector('+json.dumps(leftMarker)+').style.left')!=leftBefore and ev('document.querySelector('+json.dumps(rightMarker)+').style.left')==rightBefore,'Overview indicators follow playing versus paused decks')
 click('.h5-phone-deck[data-deck="4"]');click(sel(4,'.h1-play'));click('.h5-phone-deck[data-deck="1"]');leftBefore=ev('document.querySelector('+json.dumps(leftMarker)+').style.left');rightBefore=ev('document.querySelector('+json.dumps(rightMarker)+').style.left');advance(.25)
 check(ev('document.querySelector('+json.dumps(leftMarker)+').style.left')!=leftBefore and ev('document.querySelector('+json.dumps(rightMarker)+').style.left')!=rightBefore,'Both full-song indicators move when both decks play')
 for side in ['first-child','last-child']:
  strip=sel(1,'.h52-mixer-strip:'+side);main=rect(strip+' .h52-main-column');eq=rect(strip+' .h52-eq-column');fx=rect(strip+' .h52-filter-fx-column')
  check(main['x']<eq['x']<fx['x'],'Exact Main / EQ / Filter-FX columns '+side)
  high=rect(strip+' [data-control=high]');mid=rect(strip+' [data-control=mid]');low=rect(strip+' [data-control=low]');filter=rect(strip+' [data-control=filter]');type=rect(strip+' .h52-fx-type');amount=rect(strip+' .h52-filter-fx-column>.performance-knob:last-child')
  check(high['y']<mid['y']<low['y'] and filter['y']<type['y']<amount['y'],'Exact vertical knob/type ordering '+side)
  for value in [0,1]:
   ranges(strip+' input',value);rail=rect(strip+' .h51-fader-rail');handle=rect(strip+' .h51-fader-handle');frame=rect(strip+' .h51-fader');expected=rail['bottom'] if value==0 else rail['top']
   check(abs(handle['y']+12-expected)<.6 and handle['y']>=frame['y']-.5 and handle['bottom']<=frame['bottom']+.5,'Transition Main exact visible endpoint '+side+str(value))
   x=frame['x']+frame['width']/2;touch('touchStart',x,expected);touch('touchEnd');target=0 if side=='first-child' else 3;check(snap()['decks'][target]['volume']==value,'Transition Main touch endpoint '+side+str(value))
 ev('document.querySelector('+json.dumps(sel(1,'.h52-mixer-strip:first-child input'))+').focus()')
 for key,value,vk in [('Home',0,36),('End',1,35)]:
  for kind in ['rawKeyDown','keyUp']:c.call('Input.dispatchKeyEvent',dict(type=kind,key=key,code=key,windowsVirtualKeyCode=vk))
  check(snap()['decks'][0]['volume']==value,'Transition Main keyboard endpoint '+key)
 ranges(sel(1,'.h52-mixer-strip:first-child input'),.32);ranges(sel(1,'.h52-mixer-strip:last-child input'),.76)
 check(snap()['decks'][0]['volume']==.32 and snap()['decks'][3]['volume']==.76,'Transition Main independently binds both deck values')
 drag(sel(1,'.h52-mixer-strip:last-child [data-control=filter] .knob-dial'),-24);check(snap()['decks'][3]['performance']['filter']>0 and snap()['decks'][0]['performance']['filter']==0,'Transition partner filter independent')
 capture('h52-transition-phone.png');mode(1,'controls');mode(1,'transition');check(snap()['decks'][0]['transitionPartner']==4,'Transition partner persists across views')
 # Every phone size must fit Transition, with unchanged 44px dial targets.
 for w,h in [(430,932),(390,844),(390,724),(375,667),(320,568),(320,480)]:
  size(w,h);mode(1,'transition')
  dimensions=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h52-transition,.h52-transition-mixers,.h52-mixer-strip,.h52-eq-column,.h52-filter-fx-column'))+')).map(n=>({class:n.className,h:n.clientHeight,sh:n.scrollHeight,w:n.clientWidth,sw:n.scrollWidth}))')
  check(all(x['sh']<=x['h']+1 and x['sw']<=x['w']+1 for x in dimensions),'No Transition internal scroll/clipping '+str((w,h)))
  knobs=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h52-transition .knob-dial'))+')).map(n=>n.getBoundingClientRect().toJSON())')
  check(all(k['width']>=44 and k['height']>=44 for k in knobs),'Transition 44px knob targets '+str((w,h)))
  pane=rect(t);check(all(k['y']>=pane['y'] and k['bottom']<=pane['bottom']+.5 for k in knobs),'Both decks controls within performance area '+str((w,h)))
  check(rect('#h1-main-1')['height']>0 and rect(sel(1,'.h5-queue'))['width']==44,'Compact Main and Swap remain visible '+str((w,h)))
  metrics.append(dict(width=w,height=h,transition=pane,dimensions=dimensions))
  if w==320 and h==568:capture('h52-transition-small.png')
  if w==320 and h==480:capture('h52-transition-reduced-height.png')
 # Tablet primary views and original layout defaults, plus cue markers and Library.
 for w,h in [(1194,834),(1024,768),(834,1194),(768,1024)]:
  size(w,h);mode(1,'wave');check(snap()['decks'][0]['compact']['mode']=='wave','Tablet returns to permitted primary view')
  check(ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h3-song-row .h3-selector button'))+')).map(n=>n.textContent).join("|")')=='Wave + Cue|Controls','Tablet exactly two-position sliding navigation')
  r=rect(sel(1,'.h3-song-row .h3-selector'));touch('touchStart',r['x']+r['width']/4,r['y']+r['height']/2);touch('touchMove',r['x']+r['width']*3/4,r['y']+r['height']/2)
  check(snap()['decks'][0]['compact']['mode']=='controls','Tablet slider changes view before lift');touch('touchEnd');mode(1,'wave')
  row=rect(sel(1,'.h1-transport'));check(row['height']==36 and rect('#h1-main-1')['height']>0,'Tablet compact transport preserved')
  check(rect(sel(1,'.h52-transition'))['height']==0,'No tablet Transition')
  if w==1194:mode(2,'controls');capture('h52-ipad-landscape.png')
  if w==834:mode(2,'controls');capture('h52-ipad-portrait.png')
 click(sel(1,'.h3-open-library'));lib(1,'songs');click(sel(1,'[data-song-id=amber] .song-manage'));check(ev('document.querySelectorAll('+json.dumps(sel(1,'.h4-choice-row input'))+').length')>0,'Library Manage checkboxes preserved');capture('h52-library.png');click(sel(1,'.h3-library-top>button'))
 # Never-started song and a queue Swap through actual Library/transport controls.
 size(390,844);click(sel(1,'.h1-play'));loadSong(1,'amber',1);check(not snap()['decks'][0]['playing'] and snap()['decks'][0]['position']==0,'Nonplaying load does not autoplay')
 click(sel(1,'[data-cue="0"]'));check(snap()['decks'][0]['compact']['cues'][0]==0 and not snap()['decks'][0]['playing'],'Never-started song cue creates at zero')
 click(sel(1,'.h1-play'));advance(.4);stems=snap()['decks'][0]['stems'];click(sel(1,'.h5-queue'));check(snap()['decks'][0]['songId']=='blue' and snap()['decks'][0]['playing'] and snap()['decks'][0]['stems']==stems and not snap()['decks'][0]['queuedSongId'],'Swap preserves inherited stems and starts queued source')
 check(ev('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),'No document scrolling')
 check(ev('audioCreates===0&&storageOpens===0&&scriptErrors.length===0&&!window.h1BootError'),'No native audio/storage or browser errors')
 # The real preview clock also retains queue/cue isolation through Library loads.
 # Fresh CDP page resets the emulated touch device after the viewport/keyboard matrix.
 fresh=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')));c=C(fresh['webSocketDebuggerUrl']);c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5));size(390,844)
 c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.audioCreates=0;window.storageOpens=0;window.scriptErrors=[];addEventListener('error',e=>scriptErrors.push(e.message));for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('Unexpected audio')}};indexedDB.open=()=>{storageOpens++;throw Error('Unexpected storage')};"})
 c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/final-preview/?build=h52'});time.sleep(.5)
 loadSong(1,'amber',1);click(sel(1,'[data-cue="0"]'));click(sel(1,'.h1-play'));time.sleep(.12);before=snap()['decks'][0];loadSong(1,'blue',1);after=snap()['decks'][0]
 check(before['position']>0,'Live preview clock genuinely advances without deterministic hook')
 check(after['songId']=='amber' and after['playing'] and after['queuedSongId']=='blue' and after['position']>=before['position'],'Real-clock second load queues while original keeps playing')
 ev("window.liveCueTrace=[];const originalLiveCue=TuneToxDesign.compact.cueAction;TuneToxDesign.compact.cueAction=function(s,id,k,v){const deck=s.decks[id-1];liveCueTrace.push({kind:k,value:v,shift:deck.compact.shift,cue:deck.compact.cues[0],position:deck.position,queue:deck.queuedSongId});return originalLiveCue(s,id,k,v)};for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,e=>liveCueTrace.push({event:type,cue:e.target.dataset?.cue,modifier:e.target.dataset?.modifier,detail:e.detail,pointerType:e.pointerType}),true)")
 point=shiftPad(0);releaseShiftFirst(point);after=snap()['decks'][0];root.joinpath('live-cue-trace.json').write_text(json.dumps(ev('liveCueTrace'),indent=2)+'\n');check(any(e.get('event')=='pointerdown' and e.get('modifier')=='shift' for e in ev('liveCueTrace')),'Live-clock test receives real emulated Shift pointer contact')
 check(after['compact']['cues'][0] is None and after['queuedSongId']=='blue' and after['songId']=='amber' and after['playing'],'Real-clock Shift deletion cannot alter queued song')
 ups=[e for e in ev('liveCueTrace') if e.get('event')=='pointerup'];check(len(ups)>=2 and ups[0].get('modifier')=='shift' and ups[1].get('cue')=='0','Trace verifies Shift was released before cue finger')
 check(ev('audioCreates===0&&storageOpens===0&&scriptErrors.length===0'),'Real-clock page stays isolated from audio/storage')
 root.joinpath('measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');root.joinpath('verification.json').write_text(json.dumps({'browserChecks':checks,'stateChecks':81,'physicalSafari':'pending'},indent=2)+'\n');print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
