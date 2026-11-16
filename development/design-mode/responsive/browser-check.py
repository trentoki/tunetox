"""H4 actual served-page tests. Synthetic native touch dispatch is not physical Safari evidence."""
import base64,json,pathlib,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helper')['CDP']
endpoint='http://127.0.0.1:9230';tab=json.load(urllib.request.urlopen(urllib.request.Request(endpoint+'/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl']);browser=C(json.load(urllib.request.urlopen(endpoint+'/json/version'))['webSocketDebuggerUrl']);checks=0;metrics=[]
root=pathlib.Path('development/design-mode/responsive/review')
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
def mode(id,name):click(sel(id,'.h3-song-row [data-mode='+name+']'))
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
try:
 c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5))
 c.call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.audioCreates=0;window.storageOpens=0;window.scriptErrors=[];addEventListener('error',e=>scriptErrors.push(e.message));for(const key of ['AudioContext','webkitAudioContext'])window[key]=class{constructor(){audioCreates++;throw Error('Unexpected audio')}};indexedDB.open=()=>{storageOpens++;throw Error('Unexpected storage')};"})
 size(1194,834);c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/responsive/?build=h4'});time.sleep(.7)
 check(ev('!!TuneToxDesign.h1&&!window.h1BootError'),'H4 boots')
 check(ev('document.title.includes("H4")'),'Clear H4 identity')
 check(ev('TuneToxDesign.h1.layout.centralHeight===360&&TuneToxDesign.h1.layout.stemSection===244&&TuneToxDesign.h1.layout.selectorWidth===156'),'Landscape preferred defaults')
 baseline=fixed(1);center=rect(sel(1,'.h3-center'))
 for name in ['cue','controls','wave']:
  mode(1,name);check(fixed(1)==baseline and rect(sel(1,'.h3-center'))==center,'Fixed frame '+name)
 mode(1,'cue');pads=ev('Array.from(document.querySelectorAll('+json.dumps(sel(1,'.h3-hot-cues button'))+')).map(b=>b.getBoundingClientRect().toJSON())')
 check(len(pads)==8 and len({b['y'] for b in pads})==2 and len({b['x'] for b in pads})==4,'Eight cues in two rows of four')
 check(pads[0]['height']>60,'Cue pads expand into central area')
 mode(1,'controls');eq=rect(sel(1,'.vertical-mixer-strip'));fx=rect(sel(1,'.performance-effects'))
 check(fx['bottom']-eq['top']>center['height']*.7,'Controls distributed through center')
 check(rect(sel(1,'.knob-dial'))['width']>=44,'Knob touch targets preserved')
 drag(sel(1,'[data-control=filter] .knob-dial'),-16);check(snap()['decks'][0]['performance']['filter']>.1,'Filter vertical-drag gesture preserved')
 fxDial=sel(1,'.effect-control .knob-dial');drag(fxDial,-16);check(snap()['decks'][0]['performance']['effects'][0]['value']>.05,'FX vertical-drag gesture preserved')
 r=rect(fxDial);x=r['x']+r['width']/2;y=r['y']+r['height']/2;c.call('Input.dispatchMouseEvent',dict(type='mousePressed',x=x,y=y,button='left',clickCount=1));time.sleep(.65);c.call('Input.dispatchMouseEvent',dict(type='mouseReleased',x=x,y=y,button='left',clickCount=1))
 check(ev('document.querySelector('+json.dumps(sel(1,'.effect-assignment-menu'))+').hidden===false'),'FX long-press assignment preserved')
 click(sel(1,'.effect-assignment-option:nth-child(4)'));check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Chorus','FX assignment commits existing deck state')
 mode(1,'wave');slide(sel(1,'.h3-song-row .h3-selector'),'TuneToxDesign.h1.getSnapshot().decks[0].compact.mode','cue','controls');check(fixed(1)==baseline,'Sliding leaves stems fixed')
 click(sel(1,'.h3-deck-id'));click(sel(1,'.h2-menu button'));check(snap()['decks'][0]['beatMatch'],'Matching popover works');click(sel(1,'.h3-song-row strong'))
 # Orientation-specific edits and reset; no deck state changes on rotation.
 click('#h1-tools-open');ranges('[data-parameter=centralHeight]',300);click('#h1-tools-close');before=snap()['decks']
 size(834,1194);check(ev('TuneToxDesign.h1.layout.stemSection===144&&TuneToxDesign.h1.layout.centralHeight===168'),'Portrait independent compact defaults')
 click('#h1-tools-open');ranges('[data-parameter=centralHeight]',200);click('#h1-tools-close');size(1194,834)
 check(ev('TuneToxDesign.h1.layout.centralHeight===300'),'Landscape edit retained across rotation');size(834,1194)
 check(ev('TuneToxDesign.h1.layout.centralHeight===200'),'Portrait edit retained independently');check(snap()['decks']==before,'Rotation does not reset any deck')
 click('#h1-tools-open');click('#h1-layout-reset');click('#h1-tools-close');check(ev('TuneToxDesign.h1.layout.centralHeight===168'),'Portrait reset only')
 size(1194,834);check(ev('TuneToxDesign.h1.layout.centralHeight===300'),'Portrait reset preserves landscape edit')
 click('#h1-tools-open');click('#h1-layout-reset');click('#h1-tools-close')
 # Full-panel Library, continuous navigation and sorting.
 click(sel(1,'.h3-open-library'));p=rect(sel(1,''));lt=rect(sel(1,'.h3-library-top'));lr=rect(sel(1,'.h4-library'))
 check(abs(lr['y']-lt['bottom'])<2 and lr['bottom']>=p['bottom']-2,'Library full-panel takeover')
 slide(sel(1,'.h4-library-selector'),'TuneToxDesign.h1.getSnapshot().columnLibraries[0].libraryView','playlists','links')
 lib(1,'songs');ev('(()=>{const s=document.querySelector('+json.dumps(sel(1,'.h4-arrange select'))+');s.value="bpm";s.dispatchEvent(new Event("change"));})()')
 check(ev('document.querySelector('+json.dumps(sel(1,'.song-row'))+').dataset.songId')=='home','Numeric BPM ascending served rows')
 click(sel(1,'.h4-arrange button'));check(ev('document.querySelector('+json.dumps(sel(1,'.song-row'))+').dataset.songId')=='blue','Numeric BPM descending served rows')
 normalHeight=rect(sel(1,'.song-row'))['height'];
 ev('document.querySelector('+json.dumps(sel(1,'[data-song-id=neon] .song-manage'))+').scrollIntoView({block:"nearest"})');normalScroll=ev('document.querySelector('+json.dumps(sel(1,'.h4-library-list'))+').scrollTop');click(sel(1,'[data-song-id=neon] .song-manage'))
 check(snap()['columnLibraries'][0]['context']['songId']=='neon','Icon Manage retains original source')
 check(ev('document.querySelectorAll('+json.dumps(sel(1,'.h4-choice-row'))+').length')>7,'Manage expanded links and playlist checkboxes')
 check(rect(sel(1,'.song-row'))['height']==normalHeight,'Manage preserves normal song row height')
 ev('document.querySelector('+json.dumps(sel(1,'.h4-library-list'))+').scrollTop=100');time.sleep(.05);scroll=ev('document.querySelector('+json.dumps(sel(1,'.h4-library-list'))+').scrollTop')
 click(sel(1,'[data-song-id=after] .song-select')) # selection does not change managed source
 checkbox=sel(1,'.h4-choice-row:has([data-song-id=after])>input');click(checkbox)
 check('after' in snap()['userLinks']['neon'],'Manage link checkbox changes links')
 selected=snap()['columnLibraries'][0]['songId'];click(sel(1,'.h4-arrange button'));check(snap()['columnLibraries'][0]['songId']==selected and 'after' in snap()['userLinks']['neon'],'Sorting preserves selected song and link checkboxes')
 check(snap()['columnLibraries'][0]['context']['songId']=='neon','Link source retained after selecting another song')
 member=sel(1,'.h4-choice-row:has([data-playlist-id=slow])>input');click(member)
 check('neon' in next(p for p in snap()['playlists'] if p['id']=='slow')['songIds'],'Membership checkbox works')
 check(rect(sel(1,'.playlist-row'))['height']==56,'Manage normal playlist geometry')
 click(sel(1,'[data-playlist-id=slow]'));check(snap()['columnLibraries'][0]['context']['screen']=='songs','Manage opens playlist songs in same panel')
 check(snap()['columnLibraries'][0]['context']['songId']=='neon','Playlist browsing retains linking source')
 click(sel(1,'.h4-choice-row:has([data-song-id=amber])>input'));check('amber' in snap()['userLinks']['neon'],'Link from playlist song')
 click(sel(1,'.h4-library-contextbar button:first-child'));check(snap()['columnLibraries'][0]['context']['screen']=='summary','Manage Back restores expanded summary')
 capture('h4-manage.png');click(sel(1,'.h4-library-contextbar button:last-child'));check(snap()['columnLibraries'][0]['context'] is None,'Done returns original library')
 check(ev('document.querySelector('+json.dumps(sel(1,'.h4-library-list'))+').scrollTop')==normalScroll,'Manage return restores browsing scroll')
 lib(1,'playlists');click(sel(1,'.h4-source-group[data-source=apple]'));check('no connection' in ev('document.querySelector('+json.dumps(sel(1,'.h4-library-list'))+').textContent'),'External source group clearly simulated')
 capture('h4-library.png');lib(1,'songs');query(1,'Night');lib(1,'playlists');click(sel(1,'[data-playlist-id=afterhours]'));query(1,'Blue');lib(1,'songs')
 check(snap()['columnLibraries'][0]['songQuery']=='Night','All-songs search restored independently of playlist search')
 lib(1,'playlists');click(sel(1,'[data-playlist-id=afterhours]'));check(snap()['columnLibraries'][0]['songQuery']=='Blue','Playlist-specific search restored')
 check(snap()['columnLibraries'][1]['songQuery']=='','Other deck Library search remains independent')
 click(sel(1,'.h3-library-top>button'))
 # Real UI load while playing queues, keeps transport/stems, returns Wave.
 mode(1,'cue');click(sel(1,'.h1-play'));before=snap();loadSong(1,'blue',1);after=snap()
 check(after['decks'][0]['songId']==before['decks'][0]['songId'] and after['decks'][0]['playing'],'Playing load queues without replacing current song')
 check(after['decks'][0]['stems']==before['decks'][0]['stems'] and after['decks'][0]['position']>=before['decks'][0]['position'],'Queued load preserves stems and playback cursor')
 check(after['decks'][0]['queuedSongId']=='blue' and after['decks'][0]['compact']['mode']=='wave' and after['decks'][0]['compact']['workspace']=='performance','Queued load returns destination to Wave')
 click(sel(1,'.h4-queue'));check('Parallel Cities' in ev('document.querySelector('+json.dumps(sel(1,'.h4-queue-info'))+').textContent'),'Queue title and artist inspectable');click(sel(1,'.h4-queue'))
 capture('h4-queue.png');mainBefore=rect('#h1-main-1');ranges('#h1-main-1',.09);ranges('#h1-main-1',1);check(rect('#h1-main-1')==mainBefore,'Main geometry stable beside Swap')
 others=snap()['decks'][1:];stems=snap()['decks'][0]['stems'];click(sel(1,'.h4-swap'));after=snap()
 check(after['decks'][0]['songId']=='blue' and not after['decks'][0]['queuedSongId'] and after['decks'][0]['playing'],'Swap starts consumed song')
 check(after['decks'][0]['stems']==stems and after['decks'][1:]==others,'Swap preserves stems and other decks')
 click(sel(1,'.h1-play'));loadSong(1,'home',1);check(snap()['decks'][0]['songId']=='home' and not snap()['decks'][0]['playing'],'Paused load replaces but does not autoplay')
 check(snap()['decks'][0]['compact']['mode']=='wave','Paused load selects Wave')
 # Capture clean independent portrait/landscape defaults and mixed central modes.
 c.call('Page.reload');time.sleep(.5);mode(2,'cue');mode(3,'controls');capture('h4-landscape.png')
 for w,h in [(1194,834),(1024,768),(834,1194),(768,1024),(390,844),(375,667),(320,568)]:
  size(w,h);a=fixed(1);center=rect(sel(1,'.h3-center'))
  check(ev('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),'Fixed viewport '+str((w,h)))
  visible=ev('Array.from(document.querySelectorAll(".h3-deck")).filter(n=>n.getBoundingClientRect().width>0).length')
  check(visible==(1 if w<700 else 4),'Deck visibility '+str((w,h)))
  for name in ['wave','cue','controls']:mode(1,name);check(fixed(1)==a and rect(sel(1,'.h3-center'))==center,'Stem geometry invariant '+str((w,h))+name)
  check(rect(sel(1,'.h3-stems'))['bottom']<=h and rect('#h1-stem-1-3')['height']>=36,'All fixed faders reachable '+str((w,h)))
  metrics.append(dict(width=w,height=h,deck=rect(sel(1,'')),center=center,stems=rect(sel(1,'.h3-stems')),layout=ev('TuneToxDesign.h1.layout')))
  if w==834:mode(1,'wave');capture('h4-portrait.png')
  if w==390:mode(1,'wave');capture('h4-phone.png')
  if w==320:mode(1,'wave');capture('h4-phone-small.png')
 # Continuous phone slide also stays within fixed region.
 slide(sel(1,'.h3-song-row .h3-selector'),'TuneToxDesign.h1.getSnapshot().decks[0].compact.mode','cue','controls')
 click('.h3-phone-decks [data-deck="2"]');check(snap()['editingDeckId']==2,'Phone deck switching retained')
 check(ev('audioCreates===0&&storageOpens===0&&typeof appState==="undefined"'),'No real audio/storage/production state')
 check(ev('scriptErrors.length===0&&!window.h1BootError'),'No browser errors')
 root.joinpath('measurements.json').write_text(json.dumps(metrics,indent=2)+'\n');root.joinpath('verification.json').write_text(json.dumps({'browserChecks':checks,'stateChecks':77,'physicalSafari':'pending'},indent=2)+'\n');print('TOTAL',checks,flush=True)
finally:
 try:browser.call('Browser.close')
 except:pass
