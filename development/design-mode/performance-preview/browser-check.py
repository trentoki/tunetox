"""H4 actual served-page tests. Synthetic native touch dispatch is not physical Safari evidence."""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP']
endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;metrics=[]
root=pathlib.Path('development/design-mode/performance-preview/review')
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
 if rect(sel(id,'.h5-view-open'))['width']>0:
  click(sel(id,'.h5-view-open'));click('.h5-view-menu [data-view='+name+']')
 elif name=='transition':
  mode(id,'controls');click(sel(id,'.h5-controls-head button'))
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
 c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.H5_TEST_CLOCK=true;window.audioCreates=0;window.storageOpens=0;window.scriptErrors=[];addEventListener('error',e=>scriptErrors.push(e.message));for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('Unexpected audio')}};indexedDB.open=()=>{storageOpens++;throw Error('Unexpected storage')};"})
 size(390,844);c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/performance-preview/?build=h5'});time.sleep(.7)
 check(ev('!!TuneToxDesign.h1&&!window.h1BootError&&document.title.includes("H5")'),'H5 served boot and build identity')
 check(ev('TuneToxDesign.h1.layout.centralHeight===440&&TuneToxDesign.h1.layout.stemSection===152'),'Independent phone defaults')
 check(rect(sel(1,'.h3-song-row .h3-selector'))['width']==0,'Phone horizontal mode selector removed')
 # Normal deck tap vs deliberate drag; commit only on release.
 click('.h5-phone-deck[data-deck="2"]');check(snap()['editingDeckId']==2,'Ordinary colored deck tap selects only deck')
 button='.h5-phone-deck[data-deck="1"]';r=rect(button);x=r['x']+r['width']/2;y=r['y']+r['height']/2
 touch('touchStart',x,y);touch('touchMove',x,y+6);check(ev('document.querySelector(".h5-view-menu").hidden'),'Small motion does not open view menu')
 touch('touchMove',x,y+22);check(ev('!document.querySelector(".h5-view-menu").hidden'),'Downward slide opens temporary menu')
 menu=rect('.h5-view-menu');touch('touchMove',x,menu['y']+menu['height']*7/8)
 check(snap()['decks'][0]['compact']['mode']=='wave' and ev('document.querySelector(".h5-view-menu [data-view=transition]").getAttribute("aria-checked")')=='true','Vertical slide highlights without premature mode change')
 touch('touchEnd');check(snap()['decks'][0]['compact']['mode']=='transition' and ev('document.querySelector(".h5-view-menu").hidden'),'Release commits Transition and closes menu')
 mode(1,'wave');check(snap()['decks'][0]['compact']['mode']=='wave','Accessible tap alternative selects Wave')
 # Position indicators: loaded duration, pause, selected/nonselected decks.
 track='.h5-phone-deck[data-deck="1"] .h5-deck-position i';p=ev('document.querySelector('+json.dumps(track)+').style.left');advance(1)
 check(ev('document.querySelector('+json.dumps(track)+').style.left')==p,'Paused indicator stationary')
 click(sel(1,'.h1-play'));advance(1);check(ev('document.querySelector('+json.dumps(track)+').style.left')!=p,'Indicator advances during simulated playback')
 click('.h5-phone-deck[data-deck="2"]');p=ev('document.querySelector('+json.dumps(track)+').style.left');advance(.5)
 check(ev('document.querySelector('+json.dumps(track)+').style.left')!=p,'Nonselected deck indicator remains live');click('.h5-phone-deck[data-deck="1"]')
 # Direct fader track + capture away from handle, no adjacent stem changes.
 before=snap()['decks'][0]['stems'];f='#h1-stem-1-0';r=rect(f);x=r['x']+r['width']/2;y=r['bottom']-22-(r['height']-44)*.25
 touch('touchStart',x,y);check(abs(snap()['decks'][0]['stems'][0]-.25)<.02,'Vertical fader responds immediately on track touch')
 touch('touchMove',x+35,r['y']+22+(r['height']-44)*.15);touch('touchEnd');after=snap()['decks'][0]['stems']
 check(abs(after[0]-.85)<.02 and after[1:]==before[1:],'Fader capture survives lateral movement without adjacent capture')
 check(ev('getComputedStyle(document.querySelector('+json.dumps(f)+'),"::-webkit-slider-thumb").width')=='44px','Invisible handle target is 44px')
 # Adaptive ± nudge; native tempo state stays constant.
 plus=sel(1,'.h5-wave-tools button:last-child');r=rect(plus);x=r['x']+r['width']/2;y=r['y']+r['height']/2;p=snap()['decks'][0]['position'];tempo=snap()['decks'][0]['tempo']
 touch('touchStart',x,y);advance(1);check(abs(snap()['decks'][0]['position']-p-1.05)<1e-6,'Hold plus temporarily speeds simulated playback')
 touch('touchEnd');p=snap()['decks'][0]['position'];advance(1);check(abs(snap()['decks'][0]['position']-p-1)<1e-6 and snap()['decks'][0]['tempo']==tempo,'Release restores rate without changing Tempo')
 # Beat skip at next boundary, from execution-boundary position.
 click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'));click(sel(1,'.h3-deck-id'));check(snap()['decks'][0]['beatMatch'],'BeatMatch on through original popover')
 ev('(()=>{const x=document.querySelector('+json.dumps(sel(1,'.h5-wave-tools select'))+');x.value="4";x.dispatchEvent(new Event("change"));})()')
 p=snap()['decks'][0]['position'];click(plus);deck=snap()['decks'][0];check(deck['position']==p and deck['wave']['pending'] is not None,'Beat skip pending without immediate seek')
 dt=(deck['wave']['pending']['boundary']-deck['wave']['clock'])*60/deck['tempo'];advance(dt-.001);check(snap()['decks'][0]['wave']['pending'] is not None,'No jump before boundary');advance(.001)
 check(abs(snap()['decks'][0]['position']-(p+dt+4*60/tempo))<1e-6 and snap()['decks'][0]['wave']['pending'] is None,'Jump measured from execution boundary')
 # Scrub works in matched/unmatched states, below separate button region.
 for matched in [True,False]:
  if snap()['decks'][0]['beatMatch']!=matched:click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'));click(sel(1,'.h3-deck-id'))
  z=sel(1,'.h1-zoom');r=rect(z);x=r['x']+r['width']/2;y=r['y']+r['height']*.65;p=snap()['decks'][0]['position'];touch('touchStart',x,y);touch('touchMove',x+r['width']/4,y);touch('touchEnd')
  check(abs(snap()['decks'][0]['position']-p-3)<.1,'Separate waveform scrub matched='+str(matched))
 # Transition views share existing deck values, not cloned mixer state.
 mode(1,'transition');transition=sel(1,'.h5-transition');click(sel(1,'.h5-transition-partners button:last-child'));check(snap()['decks'][0]['transitionPartner']==4,'One-tap partner selection excludes primary')
 f=sel(1,'.h5-transition-strip:first-child input');ranges(f,.36);other=sel(1,'.h5-transition-strip:last-child input');ranges(other,.64)
 check(snap()['decks'][0]['volume']==.36 and snap()['decks'][3]['volume']==.64,'Both Transition Main controls bind independent deck values')
 # Real Main pointer input, not just dispatching a range input event.
 r=rect(other);x=r['x']+r['width']/2;y=r['bottom']-22-(r['height']-44)*.8;touch('touchStart',x,y);touch('touchEnd')
 check(abs(snap()['decks'][3]['volume']-.8)<.03 and snap()['decks'][0]['volume']==.36,'Partner Main vertical pointer gesture preserves primary')
 # Real pointer input, including dynamic partner knob binding.
 knob=sel(1,'.h5-transition-strip:last-child [data-control=high] .knob-dial');drag(knob,-20)
 check(snap()['decks'][3]['performance']['eq']['high']>0 and snap()['decks'][0]['performance']['eq']['high']==0,'Partner EQ gesture changes only partner')
 check(ev('(()=>{let n=document.querySelector('+json.dumps(transition)+');return n.scrollWidth<=n.clientWidth+1})()'),'Transition has no horizontal clipping')
 side=dict(scrollHeight=ev('document.querySelector('+json.dumps(transition)+').scrollHeight'),dial=rect(knob),fader=rect(other))
 ev('document.querySelector('+json.dumps(transition)+').dataset.testArrangement="stacked"');stacked=dict(scrollHeight=ev('document.querySelector('+json.dumps(transition)+').scrollHeight'),dial=rect(knob));ev('delete document.querySelector('+json.dumps(transition)+').dataset.testArrangement')
 check(side['dial']['width']>=44 and side['scrollHeight']<stacked['scrollHeight'],'Side-by-side keeps touch targets with less scrolling than stacked')
 root.joinpath('transition-comparison.json').write_text(json.dumps({'sideBySide':side,'stacked':stacked},indent=2)+'\n');capture('h5-transition-phone.png')
 mode(1,'controls');check(snap()['decks'][0]['volume']==.36,'Controls retains Main value');mode(1,'transition');check(snap()['decks'][0]['transitionPartner']==4,'Partner selection survives leaving view');mode(1,'wave')
 # Queue control is distinct from Play; real Main available elsewhere.
 before=snap();loadSong(1,'blue',1);after=snap()
 check(after['decks'][0]['songId']==before['decks'][0]['songId'] and after['decks'][0]['playing'] and after['decks'][0]['stems']==before['decks'][0]['stems'],'Playing load queues, preserving current song and stems')
 check(after['decks'][0]['queuedSongId']=='blue' and after['decks'][0]['compact']['mode']=='wave','Queued load returns Wave')
 check('Swap' in ev('document.querySelector('+json.dumps(sel(1,'.h5-queue'))+').textContent'),'Queue visibly ready beside Play')
 indicator=ev('document.querySelector('+json.dumps(track)+').style.left');expected=after['decks'][0]['position']/258*100;check(abs(float(indicator.strip('%'))-expected)<.001,'Position indicator follows current, not queued song')
 capture('h5-queue-phone.png');stems=after['decks'][0]['stems'];click(sel(1,'.h5-queue'));after=snap()
 check(after['decks'][0]['songId']=='blue' and after['decks'][0]['playing'] and after['decks'][0]['position']==0 and not after['decks'][0]['queuedSongId'] and after['decks'][0]['stems']==stems,'Deliberate Swap starts immediately and inherits stems')
 check(ev('document.querySelector('+json.dumps(sel(1,'.h5-queue'))+').disabled'),'Empty queue state distinct and inert')
 # Library sort slider is four positions; preserve arrow and consistent Manage rows.
 click(sel(1,'.h3-open-library'));s=sel(1,'.h5-sort');r=rect(s);x=r['x'];y=r['y']+r['height']/2
 touch('touchStart',x+r['width']/8,y)
 for i,key in [(1,'bpm'),(2,'key'),(3,'artist')]:
  touch('touchMove',x+r['width']*(i+.5)/4,y);check(snap()['columnLibraries'][0]['sort']==key,'Continuous sorting '+key)
 touch('touchEnd');check(ev('document.querySelectorAll('+json.dumps(sel(1,'.h4-arrange select'))+').length')==0,'Sort dropdown removed')
 click(sel(1,'.h4-arrange>button'));check(snap()['columnLibraries'][0]['descending'],'Sort direction retained')
 click(sel(1,'[data-song-id=neon] .song-select'));check(ev('getComputedStyle(document.querySelector('+json.dumps(sel(1,'[data-song-id=neon]'))+')).boxShadow')=='none','Selection accent line removed, background remains')
 normal=rect(sel(1,'.song-row'))['height'];click(sel(1,'[data-song-id=neon] .song-manage'))
 check(rect(sel(1,'.song-row'))['height']==normal and ev('document.querySelectorAll('+json.dumps(sel(1,'.h4-choice-row input'))+').length')>0,'Manage checkboxes retain row geometry')
 check(ev('document.querySelector('+json.dumps(sel(1,'.h3-library-top>button svg'))+')!==null&&document.querySelector('+json.dumps(sel(1,'.h4-library-contextbar button svg'))+')!==null'),'Back controls use inline vectors')
 capture('h5-library-phone.png');click(sel(1,'.h3-library-top>button'));mode(1,'wave')
 # Preset isolation and all viewport sizes, including Safari-like reduced height.
 click('#h1-tools-open');ranges('[data-parameter=centralHeight]',400);click('#h1-tools-close');size(1194,834)
 check(ev('TuneToxDesign.h1.layout.centralHeight===360&&TuneToxDesign.h1.layout.stemSection===244'),'H4 landscape defaults preserved')
 mode(2,'cue');mode(3,'controls');capture('h5-ipad-landscape.png');size(834,1194)
 check(ev('TuneToxDesign.h1.layout.centralHeight===168&&TuneToxDesign.h1.layout.stemSection===144'),'H4 tablet portrait defaults preserved');capture('h5-ipad-portrait.png');size(390,844)
 check(ev('TuneToxDesign.h1.layout.centralHeight===400'),'Phone edits independent of tablet orientation presets')
 click('#h1-tools-open');click('#h1-layout-reset');click('#h1-tools-close')
 for w,h in [(1194,834),(1024,768),(834,1194),(768,1024),(390,844),(390,724),(375,667),(320,568)]:
  size(w,h);mode(1,'wave');a=fixed(1);center=rect(sel(1,'.h3-center'))
  check(ev('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),'Fixed visible viewport '+str((w,h)))
  for name in ['cue','controls','transition','wave']:
   mode(1,name);check(fixed(1)==a and rect(sel(1,'.h3-center'))==center,'Stationary stems and center '+str((w,h))+name)
  check(rect(sel(1,'.h3-stems'))['bottom']<=h,'Stems reachable '+str((w,h)))
  caption=rect(sel(1,'.h3-stems .control-caption'));control=rect(sel(1,'.h3-stems .mix-control'));check(caption['y']>=control['y']-.5 and caption['bottom']<=control['bottom']+.5,'Stem labels not clipped '+str((w,h)))
  metrics.append(dict(width=w,height=h,center=center,stems=rect(sel(1,'.h3-stems')),fader=rect('#h1-stem-1-0')))
  if w==390 and h==844:capture('h5-phone.png')
  if w==320:capture('h5-phone-small.png');mode(1,'transition');capture('h5-transition-small.png')
 check(ev('audioCreates===0&&storageOpens===0&&typeof appState==="undefined"'),'No audio/storage/production initialization')
 check(ev('scriptErrors.length===0&&!window.h1BootError'),'No browser script errors')
 root.joinpath('measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');root.joinpath('verification.json').write_text(json.dumps({'browserChecks':checks,'stateChecks':140,'physicalSafari':'pending'},indent=2)+'\n');print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
