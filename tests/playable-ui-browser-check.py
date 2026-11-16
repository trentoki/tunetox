"""Phase 1E served UI acceptance, actual native audio and range-coordinate checks.
Existing CDP helper; Chrome debug port 9230. No physical Safari audio claim.
"""
import base64,json,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helpers')['CDP']
tab=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9230/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl'])
checks=0

def check(value,label):
    global checks
    assert value,label
    checks+=1;print('PASS:',label,flush=True)
def evaluate(script):return c.evaluate(script)
def rect(selector):return json.loads(evaluate(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
def click(selector):
    r=rect(selector);check(r['width']>0 and r['height']>0,'Visible target '+selector)
    for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
    time.sleep(.1)
def mode(id,name):click(f'.design-deck[data-deck="{id}"] .column-mode-button[data-mode="{name}"]')
def gain(id,index,value):
    selector=f'#demo-deck-{id}-stem-{index}' if index is not None else f'#overlay-main-{id}'
    evaluate(f"(()=>{{const x=document.querySelector({json.dumps(selector)});x.value={value};x.dispatchEvent(new Event('input'));}})()");time.sleep(.06)
def wait_loaded(id):
    for _ in range(240):
        time.sleep(.25)
        if evaluate('TuneToxDesign.playable.controller.busy().loadingId===null'):break
    check(evaluate(f'TuneToxDesign.playable.controller.mixer.getDeck({id}).getState().loaded'),f'Real stems loaded D{id}')
def resize(w,h):
    c.call('Emulation.setDeviceMetricsOverride',dict(width=w,height=h,deviceScaleFactor=2,mobile=True));time.sleep(.35)
    evaluate('globalThis.TuneToxDesign?.viewport?.refresh()');time.sleep(.1)
def snapshot(path):open(path,'wb').write(base64.b64decode(c.call('Page.captureScreenshot')['data']))
try:
    resize(1194,834)
    # Existing M1 geometry, without creating/decoding audio. Exact legacy label format.
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/handoff-main'});time.sleep(.7)
    legacy=evaluate("(()=>{gainControls(decks[0]);const x=document.querySelector('#deck-1 [data-gain=flow]');return [0,9,10,99,100].map(v=>{x.nextElementSibling.textContent='req '+v.toFixed(1)+'% · alloc '+v.toFixed(1)+'% · gain '+(v/100).toFixed(3);const r=x.getBoundingClientRect();return {percent:v,x:r.x,width:r.width};});})()")
    print('LEGACY_GEOMETRY',json.dumps(legacy),flush=True)
    check(max(r['width'] for r in legacy)-min(r['width'] for r in legacy)>1,'Reproduced percentage-dependent legacy track dimensions')
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/performance?build=1e-p1'});time.sleep(1)
    check(evaluate('!!TuneToxDesign.playable'),'Playable host booted')
    check(evaluate("TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==='uncreated'"),'No audio context before loading gesture')
    check(evaluate("document.querySelectorAll('.design-deck').length===4"),'Four persistent deck presentations')
    check(evaluate("[...document.querySelectorAll('[data-control=beatMatch],[data-control=tuneMatch]')].every(b=>b.disabled)"),'Matching visibly inactive')
    check(evaluate("document.querySelector('.performance-knob').inert"),'Unsupported knobs inactive')
    for id,song in [(1,'hypnotic'),(2,'cut-me-loose')]:
        mode(id,'library')
        click(f'.design-deck[data-deck="{id}"] [data-song-id="{song}"] .song-select')
        authorization_before=evaluate('JSON.stringify(appState.stemSession.authorization)')
        click(f'.design-deck[data-deck="{id}"] .column-load-button:nth-of-type({id})')
        wait_loaded(id)
        check(evaluate('JSON.stringify(appState.stemSession.authorization)')==authorization_before,'Library loading does not authorize gains')
        check(evaluate(f'appState.decks[{id-1}].song.id==="{song}"'),'Correct real song identity')
        check(evaluate(f'appState.decks[{id-1}].volume===0'),'Load does not raise Main')
        if id==2:check(evaluate('TuneToxDesign.playable.controller.mixer.getDeck(1).getState().isPlaying'),'Library load preserves other deck playback')
        mode(id,'waveform')
        for index in [0,2,3]:gain(id,index,0)
        click(f'.design-deck[data-deck="{id}"] .waveform-matching [data-control=handoff]')
        gain(id,1,1 if id==1 else .5)
        mode(id,'controls');gain(id,None,1)
        click(f'.design-deck[data-deck="{id}"] .performance-play')
        mode(id,'waveform')
    check(evaluate('appState.decks[0].stems.allocatedLevels.flow===.5 && appState.decks[1].stems.allocatedLevels.flow===.5'),'Real UI establishes 50/50 handoff')
    check(evaluate('TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==="running"'),'Real native context running')
    check(evaluate('[1,2].every(id=>TuneToxDesign.playable.controller.mixer.getDeck(id).getDiagnostics().sourceStartCalls===4)'),'Exactly four aligned sources per loaded deck')
    # Explicit validation failure while a native start is pending: restore the UI
    # from committed state, never retain a speculative range value.
    result=evaluate("(async()=>{const controller=TuneToxDesign.playable.controller;await controller.play(1);const promise=controller.play(1);const old=appState.decks[0].stems.allocatedLevels.flow;const x=document.querySelector('#demo-deck-1-stem-1');x.value=.93;x.dispatchEvent(new Event('input'));const safe=appState.decks[0].stems.allocatedLevels.flow===old && Math.abs(Number(x.value)-old)<.006;await promise;return safe;})()")
    check(result,'Rejected pending action restores committed fader and state')

    check(evaluate('appState.stemSession.authorization.ceilingsByStem.flow===1'),'Qualifying UI Main/Flow gestures establish actual authorization high-water')
    # Native pointer drag, including held pointer at percentage digit transitions.
    selector='#demo-deck-1-stem-1';r=rect(selector);samples=[]
    y=r['y']+r['height']/2
    c.call('Input.dispatchMouseEvent',dict(type='mousePressed',x=r['x']+r['width']*.5,y=y,button='left',clickCount=1))
    for ratio in [.08,.09,.10,.11,.5,.8,.98,.99,1]:
        x=r['x']+12+(r['width']-24)*ratio
        c.call('Input.dispatchMouseEvent',dict(type='mouseMoved',x=x,y=y,button='left',buttons=1));time.sleep(.06)
        now=rect(selector);samples.append(now)
        state=evaluate("({input:Number(document.querySelector('#demo-deck-1-stem-1').value),actual:appState.decks[0].stems.allocatedLevels.flow,native:TuneToxDesign.playable.controller.mixer.getDeck(1).getDiagnostics().stems.flow.reportedAudioParamValue})")
        check(abs(state['input']-state['actual'])<.006 and abs(state['native']-state['actual'])<1e-5,'Drag display/committed/native gain agreement')
    c.call('Input.dispatchMouseEvent',dict(type='mouseReleased',x=x,y=y,button='left',clickCount=1))
    check(all(abs(a[k]-r[k])<.1 for a in samples for k in ['x','y','width','height']),'Percentage changes never alter track rectangle or pointer coordinates')
    print('NEW_GEOMETRY',json.dumps({k:r[k] for k in ['x','y','width','height']}),flush=True)
    gain(1,1,.8);check(evaluate('Math.abs(appState.decks[1].stems.allocatedLevels.flow-.2)<1e-6'),'Active gesture has priority, automatic peer follows')
    gain(2,1,.8);check(evaluate('Math.abs(appState.decks[0].stems.allocatedLevels.flow-.2)<1e-6'),'Reverse handoff')
    authorization_before=evaluate('JSON.stringify(appState.stemSession.authorization)')
    mode(1,'controls');gain(1,None,.5)
    check(evaluate('JSON.stringify(appState.stemSession.authorization)')==authorization_before,'Reducing Main preserves authorization high-water')
    check(evaluate('[1,2].reduce((sum,id)=>{const d=TuneToxDesign.playable.controller.mixer.getDeck(id).getDiagnostics();return sum+d.reportedMainAudioParamValue*d.stems.flow.reportedAudioParamValue;},0)<=1+1e-6'),'Actual settled participating Main/stem gains respect effective cap')
    check(evaluate('Math.abs(TuneToxDesign.playable.controller.mixer.getDeck(1).getDiagnostics().reportedMainAudioParamValue-.5)<1e-6'),'Controls Main adjusts actual native Main')
    mode(1,'waveform');gain(2,1,0);gain(1,1,.1)
    check(evaluate('appState.decks[1].stems.allocatedLevels.flow===0'),'Zero protection via approved UI')
    saved=evaluate('JSON.stringify(appState.decks.map(d=>d.stems))')
    click('.design-deck[data-deck="1"] .waveform-matching [data-control=handoff]')
    check(evaluate('JSON.stringify(appState.decks.map(d=>d.stems))')==saved,'OFF toggle preserves allocations')
    # Every approved layout uses the same mounted state, independent library scroll settings.
    for library in ['sidebar','full']:
        for arrangement in ['quadrants','slices']:
            evaluate(f"(()=>{{for(const [selector,value] of [['#preview-layout','{library}'],['#preview-arrangement','{arrangement}']]){{const x=document.querySelector(selector);x.value=value;x.dispatchEvent(new Event('change'));}}}})()")
            check(evaluate('TuneToxDesign.playable.controller.mixer.getDeck(1).getState().isPlaying'),'Layout switch preserves actual transport')
            check(evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'),'iPad viewport fit '+library+'/'+arrangement)
    snapshot('/tmp/phase1e-ipad.png')
    # Loading contexts remain independent and survive view switches.
    mode(1,'library');mode(2,'library')
    evaluate("(()=>{const x=document.querySelector('.design-deck[data-deck=\"1\"] .column-search');x.value='Hypnotic';x.dispatchEvent(new Event('input'));})()")
    check(evaluate("document.querySelectorAll('.design-deck[data-deck=\"1\"] .song-row').length===1 && document.querySelectorAll('.design-deck[data-deck=\"2\"] .song-row').length===2"),'Independent column search')
    for width,height in [(390,844),(320,568),(430,932),(1024,768)]:
        resize(width,height)
        check(evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'),'Locked viewport '+str((width,height)))
        if width<600:
            click('.phone-deck-select[data-deck="1"]');click('.phone-tab[data-tab="controls"]')
            fader='#overlay-main-1';fr=rect(fader)
            check(fr['height']>100 and fr['y']>=0 and fr['bottom']<=height,'Reachable tall Main fader '+str(width))
            c.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':fr['x']+fr['width']/2,'y':fr['y']+fr['height']*.5}]})
            c.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});time.sleep(.1)
            check(abs(evaluate('appState.decks[0].volume')-.5)<.02,'Phone vertical Main uses native action')
            click('.transition-controls-option')
            check(rect('#transition-0-main')['height']>80 and rect('#transition-1-main')['height']>80,'Two reachable Transition mains '+str(width))
            evaluate("(()=>{const x=document.querySelector('#transition-1-main');x.value=.3;x.dispatchEvent(new Event('input'));})()");time.sleep(.08)
            check(abs(evaluate('TuneToxDesign.playable.controller.mixer.getDeck(2).getDiagnostics().reportedMainAudioParamValue')-.3)<1e-6,'Transition partner Main controls correct native deck')
            click('.normal-controls-option')
            click('.phone-tab[data-tab="waveform"]')
            flow=rect('#demo-deck-1-stem-1');fy=flow['y']+flow['height']/2
            start=flow['x']+12+(flow['width']-24)*float(evaluate('Number(document.querySelector("#demo-deck-1-stem-1").value)'))
            end=flow['x']+flow['width']*.5
            c.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':start,'y':fy}]})
            c.call('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':end,'y':fy}]})
            c.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});time.sleep(.1)
            check(abs(evaluate('appState.decks[0].stems.allocatedLevels.flow')-.5)<.04,'Phone Flow touch gesture reaches native stem')
            check(all(abs(rect('#demo-deck-1-stem-1')[k]-flow[k])<.1 for k in ['x','y','width','height']),'Phone Flow geometry remains fixed')
            click('.phone-tab[data-tab="controls"]')
            snapshot('/tmp/phase1e-phone-'+str(width)+'.png')
    check(evaluate('[1,2].every(id=>TuneToxDesign.playable.controller.mixer.getDeck(id).getState().isPlaying)'),'Both real transports continue through responsive navigation')
    check(evaluate('TuneToxDesign.playable.controller.mixer.getLastSchedulingFailure()===null'),'No unexpected scheduling failure or pause')
    click('#audio-open');check(evaluate("document.querySelector('#audio-diagnostics').open"),'Diagnostics remain accessible')
    check(evaluate("document.querySelector('#audio-details').textContent.includes('authorization')"),'Actual authorization diagnostics')
    click('#audio-close')
    evaluate('TuneToxDesign.playable.controller.close()')
    check(evaluate("TuneToxDesign.playable.controller.mixer.getDiagnostics().contextState==='closed'"),'Shared native context cleanup')
    print('TOTAL',checks,flush=True)
finally:c.call('Browser.close')
