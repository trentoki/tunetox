"""Production allocator/native bridge + actual song buffers; no hardware-output claim."""
import json, runpy, time, urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helpers')['CDP']
tab=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9230/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl'])
def check(value,label):
    assert value,label
    print('PASS:',label,flush=True)
def click(selector):
    r=json.loads(c.evaluate(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
    for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
def button(id,action):click(f'#deck-{id} [data-action="{action}"]');time.sleep(.15)
def gain(id,name,value):
    c.evaluate(f"(()=>{{const x=document.querySelector('#deck-{id} [data-gain={name}]');x.value={value};x.dispatchEvent(new Event('input'));}})()");time.sleep(.08)
def allocated(id):return c.evaluate(f'appState.decks[{id-1}].stems.allocatedLevels.voice')
def near(a,b):return abs(a-b)<1e-8
try:
    c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/handoff'});time.sleep(1)
    check(c.evaluate("typeof audio==='undefined'"),'Lazy audio')
    for id in [1,2]:
        button(id,'load')
        for _ in range(240):
            time.sleep(.25)
            if c.evaluate('loadingDeck===null'):break
        check(c.evaluate(f'player(decks[{id-1}]).getState().loaded'),f'Deck {id} loaded')
        check(c.evaluate(f'!appState.participation.byDeck[{id}].stemHandoff && appState.decks[{id-1}].volume===0'),'Handoff OFF and main zero at initialization')
        for name in ['transients','flow','tune']:gain(id,name,0)
        gain(id,'main',1);button(id,'handoff');gain(id,'voice',.2)
    button(1,'play');button(2,'play')
    check(c.evaluate('decks.every(d=>player(d).getState().isPlaying)'),'Two real songs through production coordinated start')
    check(c.evaluate("document.querySelector('#deck-1 [data-gain=main]').disabled"),'Live main locked')
    check(not c.evaluate('appState.stemSession.nativeHandoff.sharing.voice'),'Unestablished sharing')
    gain(2,'voice',.1);check(near(allocated(1),.2),'Before sharing, lowering does not raise receiver')
    gain(1,'voice',1);gain(2,'voice',.6)
    check(near(allocated(1),.4) and near(allocated(2),.6),'Established handoff allocation 0.4/0.6')
    check(c.evaluate('appState.stemSession.nativeHandoff.sharing.voice'),'Sharing established')
    check(near(c.evaluate("Number(document.querySelector('#deck-1 [data-gain=voice]').value)"),.4),'Automatic fader follows real allocation')
    gain(2,'voice',.3);check(near(allocated(1),.7),'Established lowering restores authorized receiver')
    check(c.evaluate('appState.stemSession.authorization.ceilingsByStem.voice===1'),'High-water authorization retained')
    gain(1,'voice',0);gain(2,'voice',.1)
    check(allocated(1)==0,'Explicit zero is not automatically reintroduced')
    gain(1,'voice',.4);gain(2,'voice',.6)
    before=c.evaluate('JSON.stringify(appState.decks.map(d=>d.stems.allocatedLevels))')
    button(1,'play');button(1,'stop')
    check(c.evaluate('JSON.stringify(appState.decks.map(d=>d.stems.allocatedLevels))')==before,'Pause/Stop preserve retained allocations')
    check(c.evaluate('player(decks[1]).getState().isPlaying'),'Other transport continues')
    button(1,'play')
    check(c.evaluate('player(decks[0]).getState().isPlaying'),'Resume/restart retains allocator ownership')
    print('MAIN PREFLIGHT:',c.evaluate("(()=>{try{actions.setMainVolume(1,-.5,'test-reject');return 'unexpected accept';}catch(e){return e.message;}})()"),flush=True)
    check(c.evaluate('appState.decks[0].volume===1 && decks.every(d=>player(d).getState().isPlaying)'),'Rejected live main leaves state/playback intact')
    before=c.evaluate('JSON.stringify(appState.decks.map(d=>d.stems.allocatedLevels))')
    click('#freeze');time.sleep(.2)
    check(c.evaluate('JSON.stringify(appState.decks.map(d=>d.stems.allocatedLevels))')==before,'Global disable preserves all allocations')
    check(not c.evaluate('appState.stemSession.automaticHandoffEnabled'),'Disable reflected in production state')
    button(1,'handoff');time.sleep(.1)
    # Exercise per-deck leaving and verify that the leaving deck retains its coefficients.
    old=allocated(1);button(1,'handoff')
    check(near(allocated(1),old),'Leaving participant retains own allocation')
    check(c.evaluate('prototypeStemNames.every(name=>decks.reduce((sum,d)=>sum+appState.decks[d.id-1].volume*appState.decks[d.id-1].stems.allocatedLevels[name],0)<=1+1e-8)'),'Audible per-category combined caps')
    check(c.evaluate('mixer.getLastSchedulingFailure()===null'),'No native scheduling failure')
    print('OUTPUT:',c.evaluate('JSON.stringify(mixer.getDiagnostics().outputMeter)'),flush=True)
    check(c.evaluate('outputSeen'),'Destination signal observed')
    button(1,'play');button(2,'play')
    check(c.evaluate("!document.querySelector('#deck-1 [data-gain=main]').disabled"),'Main unlocks when both paused')
    gain(1,'main',.5);check(c.evaluate('appState.decks[0].volume===.5'),'Paused main change accepted')
    c.evaluate('actions.dispose();mixer.close()');check(c.evaluate("audio.state==='closed'"),'Shared engine cleanup')
    check(c.evaluate('document.documentElement.scrollWidth<=innerWidth'),'iPad horizontal fit')
finally:c.call('Browser.close')
