"""H1 served-page interaction/geometry checks, no packages. Isolated Chrome CDP 9230.
Never loads or modifies native audio or local music. Captures lightweight review PNGs.
"""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP'];endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;measurements=[]
base='development/design-mode/compact/'
def ev(code):return c.evaluate(code)
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS',label,flush=True)
def rect(selector):return ev('document.querySelector('+json.dumps(selector)+').getBoundingClientRect().toJSON()')
def click(selector):
 r=rect(selector);assert r['width']>0 and r['height']>0,selector
 for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
 time.sleep(.04)
def page(id,name):click(f'.h1-deck[data-deck="{id}"] .h1-page-nav [data-page="{name}"]')
def snapshot():return ev('TuneToxDesign.h1.getSnapshot()')
def gesture(selector,dy):
 r=rect(selector);x=r['x']+r['width']/2;y=r['y']+r['height']/2
 for kind,delta in [('pointerdown',0),('pointermove',dy),('pointerup',dy)]:
  ev('document.querySelector('+json.dumps(selector)+').dispatchEvent(new PointerEvent('+json.dumps(kind)+',{bubbles:true,cancelable:true,pointerId:88,button:0,clientX:'+str(x)+',clientY:'+str(y+delta)+'}))')
def set_range(selector,value):ev('(()=>{const x=document.querySelector('+json.dumps(selector)+');x.value='+str(value)+';x.dispatchEvent(new Event("input"));})()')
def capture(filename):pathlib.Path(base+'review/'+filename).write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['data']))
try:
 c.call('Page.enable');c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.h1AudioCreates=0;window.h1StorageOpens=0;for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){h1AudioCreates++;throw Error('H1 must not initialize audio')}};indexedDB.open=()=>{h1StorageOpens++;throw Error('H1 must not open storage')};"})
 c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=1,mobile=True))
 c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/compact/?build=h1'});time.sleep(.8)
 check(ev('!!TuneToxDesign.h1 && !window.h1BootError'),'Served H1 boot')
 check(ev('document.querySelector("h1").textContent.includes("DESIGN MODE")'),'Clear Design Mode label')
 check(ev('typeof appState==="undefined" && typeof createNativeStemMixer==="undefined"'),'No production state or engine loaded')
 check(len(snapshot()['decks'])==4,'Four fixed state objects')
 geometry=[rect('.h1-deck[data-deck="1"] '+x) for x in ['.h1-matching','.h1-transport','.h1-page-nav']]
 for name in ['controls','library','performance','performance']:
  page(1,name)
  check(all(rect('.h1-deck[data-deck="1"] '+x)==r for x,r in zip(['.h1-matching','.h1-transport','.h1-page-nav'],geometry)),'Fixed matching Main and page positions '+name)
 check(snapshot()['decks'][0]['compact']['waveCue']=='cue','Same-position Waveform/Cue toggle')
 page(1,'performance');check(snapshot()['decks'][0]['compact']['waveCue']=='waveform','Toggle returns Waveform')
 check(all(snapshot()['decks'][i]['compact']['waveCue']=='waveform' for i in [1,2,3]),'Other deck views independent')
 check(rect('.h1-transport')['height']<=36,'Transport no taller than old 36px matching row')
 click('.h1-deck[data-deck="1"] [data-control=beatMatch]');click('.h1-deck[data-deck="2"] [data-control=beatMatch]')
 gesture('.h1-tuning-cell[data-deck="1"] [data-control=tempo]',-20)
 check(snapshot()['decks'][0]['tempo']==125 and snapshot()['decks'][1]['tempo']==125 and snapshot()['decks'][2]['tempo']==120,'Header touch tempo preserves existing matched delta')
 click('.h1-deck[data-deck="1"] [data-control=tuneMatch]');click('.h1-deck[data-deck="2"] [data-control=tuneMatch]')
 gesture('.h1-tuning-cell[data-deck="1"] [data-control=pitch]',-10)
 check(snapshot()['decks'][0]['pitch']==.5 and snapshot()['decks'][1]['pitch']==.5 and snapshot()['decks'][0]['tempo']==125,'Pitch adjusts semitones independently of tempo')
 track=rect('#h1-main-1');set_range('#h1-main-1',.09);set_range('#h1-main-1',1)
 check(rect('#h1-main-1')==track,'Main value changes do not shift track geometry')
 click('.h1-deck[data-deck="1"] .h1-play');time.sleep(.3)
 p=snapshot()['decks'][0]['position'];check(p>32,'Simulated playback position advances')
 check(ev('document.querySelector(".h1-stationary-playhead").getBoundingClientRect().x')==rect('.h1-zoom')['x']+rect('.h1-zoom')['width']/2,'Zoom playhead stays centered')
 click('.h1-deck[data-deck="1"] .h1-play');page(1,'performance')
 old=snapshot()['decks'][0]['position'];click('.h1-deck[data-deck="1"] .h1-hot-cues button');check(snapshot()['decks'][0]['position']==0,'Hot cue updates simulated position')
 click('.h1-deck[data-deck="1"] .h1-jumps button:nth-child(2)');check(snapshot()['decks'][0]['position']>0,'Quantized jump preview')
 click('.h1-deck[data-deck="1"] .loop-on');check(snapshot()['decks'][0]['performance']['loopEnabled'],'Loop prototype moved into Cue')
 repeat='.h1-deck[data-deck="1"] .h1-beat-repeat'
 ev('document.querySelector('+json.dumps(repeat)+').dispatchEvent(new PointerEvent("pointerdown",{pointerId:91,button:0,bubbles:true,cancelable:true}))')
 check(snapshot()['decks'][0]['compact']['repeat'],'Cue hold activates beat-repeat preview')
 ev('document.querySelector('+json.dumps(repeat)+').dispatchEvent(new PointerEvent("pointerup",{pointerId:91,button:0,bubbles:true,cancelable:true}))')
 check(not snapshot()['decks'][0]['compact']['repeat'],'Releasing Cue hold clears repeat preview')
 check(ev('document.querySelector(".h1-controls .performance-loop")===null'),'No looping controls remain in Controls')
 page(1,'controls');set_range('#h1-stem-1-2',.37);click('.h1-deck[data-deck="1"] [data-control=handoff]')
 check(snapshot()['decks'][0]['stems'][2]==.37 and snapshot()['decks'][0]['handoff'],'Matching remains accessible with stem faders')
 check(snapshot()['decks'][0]['compact']['page']=='controls','Fader movement cannot change deck page')
 gesture('.h1-deck[data-deck="1"] [data-control=high] .knob-dial',-20)
 check(snapshot()['decks'][0]['performance']['eq']['high']>0,'Existing EQ knob vertical drag')
 ev('document.querySelector(".h1-deck[data-deck=\\"1\\"] [data-control=high] .knob-dial").dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}))')
 check(snapshot()['decks'][0]['performance']['eq']['high']==0,'Existing double-tap neutral retained')
 dial='.h1-deck[data-deck="1"] .effect-control .knob-dial';ev('document.querySelector('+json.dumps(dial)+').dispatchEvent(new KeyboardEvent("keydown",{key:"F2",bubbles:true}))')
 check(ev('!document.querySelector(".h1-deck[data-deck=\\"1\\"] .effect-assignment-menu").hidden'),'Existing effect assignment interaction accessible')
 click('.h1-deck[data-deck="1"] .effect-assignment-option:nth-child(4)')
 check(snapshot()['decks'][0]['performance']['effects'][0]['assignment']=='Chorus','Effect assignment stored in shared simulated deck')
 before=snapshot();click('#h1-tools-open');set_range('[data-parameter=fader]',52);set_range('[data-parameter=header]',80)
 check(ev('getComputedStyle(document.documentElement).getPropertyValue("--h1-fader").trim()==="52px"'),'Design dimensions update immediately')
 click('#h1-layout-reset');click('#h1-tools-close');check(snapshot()==before,'Layout tweaks/reset preserve all deck/library state')
 page(1,'library');click('.h1-deck[data-deck="1"] .column-playlists-tab');click('.h1-deck[data-deck="1"] [data-playlist-id=afterhours]')
 ev('(()=>{const x=document.querySelector(".h1-deck[data-deck=\\"1\\"] .column-search");x.value="Night";x.dispatchEvent(new Event("input"));})()')
 check(snapshot()['columnLibraries'][0]['songQuery']=='Night' and snapshot()['columnLibraries'][1]['songQuery']=='','Independent library search')
 page(1,'controls');page(1,'library');check(snapshot()['columnLibraries'][0]['songQuery']=='Night','Library context retained across pages')
 click('.h1-deck[data-deck="1"] .song-manage');check(ev('document.querySelector(".h1-deck[data-deck=\\"1\\"] .library-context").hidden===false'),'Shared Manage opens')
 click('.h1-deck[data-deck="1"] .manage-playlist-row[data-playlist-id=afterhours] .manage-playlist-name')
 check(snapshot()['columnLibraries'][0]['context']['songId']=='night','Managed link source stays fixed during playlist browsing')
 click('.h1-deck[data-deck="1"] .manage-link-candidate');check(bool(snapshot()['userLinks'].get('night')),'Playlist browsing creates simulated user link')
 click('.h1-deck[data-deck="1"] .context-back');click('.h1-deck[data-deck="1"] .context-back')
 check(snapshot()['columnLibraries'][0]['songQuery']=='Night','Manage Back retains library search')
 page(2,'controls');page(3,'performance');capture('h1-mixed-ipad.png')
 # Reload pristine state for measurements and representative screenshots.
 c.call('Page.reload');time.sleep(.6)
 for w,h in [(1194,834),(1024,768),(390,844),(320,568)]:
  c.call('Emulation.setDeviceMetricsOverride',dict(width=w,height=h,deviceScaleFactor=1,mobile=True));time.sleep(.2)
  decks=[rect('.h1-deck[data-deck="'+str(id)+'"]') for id in [1,2,3,4]]
  check(all(r['width']>0 and r['height']>0 for r in decks),'All four visible '+str((w,h)))
  check(ev('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'),'No document scrolling '+str((w,h)))
  check(all(r['y']>=0 and r['y']+r['height']<=h for r in decks),'Decks fit viewport '+str((w,h)))
  if w<600:check(decks[0]['y']==decks[1]['y'] and decks[2]['y']==decks[3]['y'] and decks[2]['y']>decks[0]['y'],'Phone 2x2 identity order')
  else:check(all(r['y']==decks[0]['y'] for r in decks),'Tablet four columns')
  measurements.append(dict(width=w,height=h,decks=[dict(x=r['x'],y=r['y'],width=r['width'],height=r['height']) for r in decks]))
  if w==1194:capture('h1-ipad.png')
  if w==390:capture('h1-phone.png')
  page(1,'controls');check(rect('#h1-stem-1-0')['height']>=36,'Touch fader retained '+str(w))
  if w>=900:check(ev('(()=>{const x=document.querySelector('+json.dumps('.h1-deck[data-deck="1"] .h1-controls')+');return x.scrollHeight<=x.clientHeight;})()'),'Default tablet Controls fit without scrolling')
  if w<600:
   old=snapshot()['decks'][2]['tempo'];click('.h1-deck[data-deck="3"] .h1-deck-id')
   pad='.h1-tuning-cell[data-deck="3"] [data-control=tempo]';ev('document.querySelector('+json.dumps(pad)+').dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",bubbles:true,cancelable:true}))')
   check(snapshot()['decks'][2]['tempo']==old+.5 and snapshot()['editingDeckId']==3,'Phone header adjusts explicitly selected deck')
   ev('document.querySelector('+json.dumps('.h1-deck[data-deck="1"] .h1-controls')+').scrollTop=10000')
   last='.h1-deck[data-deck="1"] .effect-control:last-child .knob-dial';r=rect(last);area=rect('.h1-deck[data-deck="1"] .h1-controls')
   check(r['height']>=44 and r['y']>=area['y'] and r['y']+r['height']<=area['y']+area['height'],'Phone effects remain reachable by designated scrolling')
   click('.h1-deck[data-deck="1"] .h1-deck-id')
  page(1,'library');check(rect('.h1-deck[data-deck="1"] .column-library')['height']>0,'Library remains reachable '+str(w));page(1,'performance')
 check(ev('h1AudioCreates===0 && h1StorageOpens===0'),'No audio or IndexedDB initialization through all interactions')
 check(ev('performance.getEntriesByType("resource").every(e=>!e.name.includes("/media/")&&!e.name.includes("/playable/")&&!e.name.includes("handoff-deps"))'),'No production assets or media requested')
 check(ev('!window.h1BootError'),'No browser script errors')
 pathlib.Path(base+'review/measurements.json').write_text(json.dumps(measurements,indent=2)+'\n')
 print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
