"""Actual CDP multi-contact checks. Chrome is not physical Safari validation."""
import pathlib
exec(pathlib.Path('development/design-mode/touch-preview/browser-check.py').read_text().split('\ntry:\n')[0])
def control(key,deck=1):return sel(deck,'.h3-controls [data-control='+key+'] .knob-dial')
def value(key,deck=1):
 p=snap()['decks'][deck-1]['performance'];return p['eq'][key] if key in ['high','mid','low'] else p[key]
def pair(a,b,readA,readB):
 ax,ay=centerPoint(a);bx,by=centerPoint(b);before=(readA(),readB())
 contacts('touchStart',[(1,ax,ay)]);contacts('touchMove',[(1,ax,ay-10)]);first=readA()
 contacts('touchStart',[(1,ax,ay-10),(2,bx,by)]);check(readA()==first,'Second touch leaves first value stable')
 contacts('touchMove',[(1,ax,ay-25),(2,bx,by-20)])
 check(readA()!=before[0] and readB()!=before[1],'Both controls change independently: '+a+' / '+b)
 contacts('touchEnd',[(2,bx,by-20)]);check(ev('TuneToxDesign.h531Pointers.count()')==1,'Releasing one preserves other pointer owner')
 contacts('touchMove',[(1,ax,ay-35)]);check(readA()!=first,'First control continues after second releases');contacts('touchEnd',[])
 check(ev('TuneToxDesign.h531Pointers.count()')==0,'No stale pointer owners after release')
try:
 c.call('Page.enable');c.call('Emulation.setTouchEmulationEnabled',dict(enabled=True,maxTouchPoints=5));c.call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.H5_TEST_CLOCK=true;window.errors=[];addEventListener("error",e=>errors.push(e.message));'})
 size(1194,834);c.call('Page.navigate',{'url':'http://192.168.50.24:8765/development/design-mode/touch-preview/?build=h531'});time.sleep(.8)
 mode(1,'controls');mode(2,'controls')
 pair(control('high'),control('mid'),lambda:value('high'),lambda:value('mid'))
 pair(control('low'),control('high',2),lambda:value('low'),lambda:value('high',2))
 # A second finger on background must not steal a dial's captured pointer.
 a=control('filter');ax,ay=centerPoint(a);contacts('touchStart',[(1,ax,ay)]);contacts('touchMove',[(1,ax,ay-10)]);old=value('filter')
 contacts('touchStart',[(1,ax,ay-10),(2,5,5)]);contacts('touchMove',[(1,ax,ay-25),(2,25,5)]);check(value('filter')>old,'Background second finger does not disrupt first control');contacts('touchEnd',[])
 # Pinch against inactive application surface; controls retain fixed page scale.
 scale=ev('visualViewport.scale');contacts('touchStart',[(1,5,5)]);contacts('touchStart',[(1,5,5),(2,40,5)]);contacts('touchMove',[(1,1,5),(2,160,5)]);contacts('touchEnd',[])
 check(ev('visualViewport.scale')==scale and ev('scrollY===0&&scrollX===0'),'Background pinch leaves scale and page position unchanged in Chrome')
 check(ev("(()=>{const e=new Event('gesturestart',{bubbles:true,cancelable:true});document.querySelector('.h531-app').dispatchEvent(e);return e.defaultPrevented})()"),'Safari gesture event guard cancels noneditable page scaling')
 check(ev("getComputedStyle(document.querySelector('.knob-dial')).userSelect==='none'"),'Noneditable control labels suppress selection')
 size(390,844);mode(1,'transition')
 left=sel(1,'.h52-mixer-strip:first-child');right=sel(1,'.h52-mixer-strip:last-child');partnerId=snap()['decks'][0]['transitionPartner']
 # Prepare midpoint with the existing input action, then exercise real two-touch drags.
 ranges(left+' input',.5);ranges(right+' input',.5)
 pair(left+' .h51-fader',right+' .h51-fader',lambda:snap()['decks'][0]['volume'],lambda:snap()['decks'][partnerId-1]['volume'])
 pair(left+' .h51-fader',left+' [data-control=mid] .knob-dial',lambda:snap()['decks'][0]['volume'],lambda:value('mid'))
 capture('h531-transition-phone.png')
 # Exact functional endpoints acquired from the track, then dragged to both ends.
 f=left+' .h51-fader';r=rect(f);x=r['x']+r['width']/2
 contacts('touchStart',[(1,x,r['y']+r['height']/2)]);contacts('touchMove',[(1,x,r['bottom']+25)]);check(snap()['decks'][0]['volume']==0,'Main track drag reaches exact 0%');contacts('touchMove',[(1,x,r['y']-25)]);check(snap()['decks'][0]['volume']==1,'Main track drag reaches exact 100%');contacts('touchEnd',[])
 # Two independent overview nudge contacts, even when focus moves elsewhere.
 ln=sel(1,'.h52-transition-overview:first-child .h53-overview-nudges button:last-child');rn=sel(1,'.h52-transition-overview:last-child .h53-overview-nudges button:first-child')
 lx,ly=centerPoint(ln);rx,ry=centerPoint(rn);contacts('touchStart',[(1,lx,ly)]);contacts('touchStart',[(1,lx,ly),(2,rx,ry)])
 check(snap()['decks'][0]['wave']['nudge']==1 and snap()['decks'][partnerId-1]['wave']['nudge']==-1,'Both Transition nudge zones remain held independently')
 ev('document.querySelector('+json.dumps(left+' [data-control=high] .knob-dial')+').focus()');check(snap()['decks'][0]['wave']['nudge']==1,'Focus movement does not release another finger nudge');contacts('touchEnd',[])
 check(all(d['wave']['nudge']==0 for d in snap()['decks']),'Both nudges restore on release')
 # Same control cannot be stolen; cancellation releases ownership without another change.
 a=left+' [data-control=low] .knob-dial';ax,ay=centerPoint(a);contacts('touchStart',[(1,ax,ay)]);contacts('touchStart',[(1,ax,ay),(2,ax+3,ay+3)]);check(ev('TuneToxDesign.h531Pointers.count()')==1,'Second pointer cannot steal the same knob');contacts('touchCancel',[]);check(ev('TuneToxDesign.h531Pointers.count()')==0,'Pointer cancellation clears owners safely')
 # Double taps reset to the internal neutral without changing viewport scale.
 scale=ev('visualViewport.scale');ax,ay=centerPoint(a)
 for _ in range(2):contacts('touchStart',[(1,ax,ay)]);contacts('touchEnd',[])
 check(value('low')==0 and ev('visualViewport.scale')==scale,'Double tap resets EQ neutral without page zoom')
 # Lost capture terminates only that pointer and leaves another control alive.
 b=left+' [data-control=high] .knob-dial';bx,by=centerPoint(b)
 contacts('touchStart',[(1,ax,ay)]);contacts('touchStart',[(1,ax,ay),(2,bx,by)])
 contacts('touchMove',[(1,ax,ay-2),(2,bx,by-2)])
 ev('(()=>{const n=document.querySelector('+json.dumps(a)+');n.releasePointerCapture(TuneToxDesign.h531Pointers.owner(n))})()')
 contacts('touchMove',[(1,ax,ay-10),(2,bx,by-10)]);check(ev('TuneToxDesign.h531Pointers.count()')==1,'Lost capture releases only affected control');contacts('touchEnd',[])
 # Two stem faders plus a transport Main use independent pointer surfaces.
 mode(1,'controls');sf=sel(1,'#h1-stem-1-0');sg=sel(1,'#h1-stem-1-1')
 ranges(sf,.5);ranges(sg,.5)
 pair(sf+' + .h51-fader-rail',sg+' + .h51-fader-rail',lambda:snap()['decks'][0]['stems'][0],lambda:snap()['decks'][0]['stems'][1])
 capture('h531-controls-phone.png')
 # Actual touch FX taps cycle once; only a deliberate hold opens the picker.
 fx=sel(1,'.h3-controls .h52-fx-type');x,y=centerPoint(fx);effects=['Echo','Reverb','Delay','Chorus','Flanger','None'];old=snap()['decks'][0]['performance']['effects'][0]['assignment']
 contacts('touchStart',[(1,x,y)]);contacts('touchEnd',[]);time.sleep(.1)
 check(snap()['decks'][0]['performance']['effects'][0]['assignment']==effects[(effects.index(old)+1)%len(effects)] and not popoverVisible(),'Touch FX quick tap cycles exactly once without a popup')
 old=snap()['decks'][0]['performance']['effects'][0]['assignment'];contacts('touchStart',[(1,x,y)]);time.sleep(.34);check(popoverVisible(),'Deliberate touch hold opens themed FX picker')
 # A separate held control may take focus without dismissing this held picker.
 a=control('filter');ax,ay=centerPoint(a);contacts('touchStart',[(1,x,y),(2,ax,ay)]);contacts('touchMove',[(1,x,y),(2,ax,ay-10)]);check(popoverVisible(),'Other finger can adjust a knob while FX picker remains held');contacts('touchEnd',[(2,ax,ay-10)])
 cx,cy=centerPoint('.h53-popover button:last-child');contacts('touchMove',[(1,cx,cy)]);contacts('touchEnd',[]);time.sleep(.1)
 check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='None' and not popoverVisible(),'Held FX release commits once without an extra tap-cycle')
 x,y=centerPoint(fx);contacts('touchStart',[(1,x,y)]);time.sleep(.34);contacts('touchCancel',[]);check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='None' and not popoverVisible(),'Cancelled FX hold leaves assignment unchanged')
 ev('document.querySelector('+json.dumps(fx)+').focus()')
 for kind in ['rawKeyDown','keyUp']:c.call('Input.dispatchKeyEvent',dict(type=kind,key='Enter',code='Enter',windowsVirtualKeyCode=13))
 check(snap()['decks'][0]['performance']['effects'][0]['assignment']=='Echo' and not popoverVisible(),'Keyboard Enter cycles the same FX choices')
 # Search editing and true finger scrolling remain native in Library.
 mode(1,'controls');click(sel(1,'.h3-open-library'));lib(1,'songs');search=sel(1,'.column-search')
 ev('document.querySelector('+json.dumps(search)+').focus()');c.call('Input.insertText',{'text':'a'});check(ev('document.querySelector('+json.dumps(search)+').value')=='a','Library search accepts keyboard input')
 ev('document.querySelector('+json.dumps(search)+').setSelectionRange(0,1)');check(ev('document.querySelector('+json.dumps(search)+').selectionEnd')==1,'Library search text remains selectable');query(1,'')
 listing=sel(1,'.h4-library-list');r=rect(listing);x=r['x']+r['width']/2;contacts('touchStart',[(1,x,r['y']+r['height']*.8)]);contacts('touchMove',[(1,x,r['y']+r['height']*.2)]);contacts('touchEnd',[]);time.sleep(.15)
 check(ev('document.querySelector('+json.dumps(listing)+').scrollTop')>0 and ev('scrollY')==0,'Library finger scroll remains independent of fixed page')
 check(ev('errors.length===0&&!window.h1BootError'),'No script errors during multi-touch checks')
 root.joinpath('touch-verification.json').write_text(json.dumps({'checks':checks,'browser':'Chrome CDP real multi-contact dispatch','physicalSafari':'pending'},indent=2)+'\n');print('TOTAL',checks)
finally:
 try:browser.call('Browser.close')
 except:pass
