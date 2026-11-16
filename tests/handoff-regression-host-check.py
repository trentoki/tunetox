"""Acceptance checks for the repaired Phase 1D UI.
Runs against existing LAN server and isolated Chrome CDP 9230. Real song buffers and existing production actions.
"""
import json, runpy, time, urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helpers')['CDP']
tab=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9230/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl'])
results=[]
def click(selector):
    r=json.loads(c.evaluate(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
    for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
def button(id,action):click(f'#deck-{id} [data-action={action}]');time.sleep(.12)
def gain(id,value):
    c.evaluate(f"(()=>{{const x=document.querySelector('#deck-{id} [data-gain=flow]');x.value={value};x.dispatchEvent(new Event('input'));}})()");time.sleep(.08)
def state():return c.evaluate("({levels:appState.decks.slice(0,2).map(d=>d.stems.allocatedLevels.flow),requests:appState.decks.slice(0,2).map(d=>d.stems.requestedLevels.flow),participation:[1,2,3,4].map(id=>appState.participation.byDeck[id].stemHandoff),playing:decks.map(d=>player(d).getState().isPlaying),messages:decks.map(d=>d.message),failure:mixer.getLastSchedulingFailure()})")
def record(name):
    value=state();results.append(dict(name=name,**value));return value
try:
    c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/handoff'});time.sleep(1)
    for id in [1,2]:
        button(id,'load')
        for _ in range(240):
            time.sleep(.25)
            if c.evaluate('loadingDeck===null'):break
        assert c.evaluate(f'player(decks[{id-1}]).getState().loaded')
        for name in ['transients','tune','voice']:
            c.evaluate(f"(()=>{{const x=document.querySelector('#deck-{id} [data-gain={name}]');x.value=0;x.dispatchEvent(new Event('input'));}})()")
        c.evaluate(f"(()=>{{const x=document.querySelector('#deck-{id} [data-gain=main]');x.value=1;x.dispatchEvent(new Event('input'));}})()")
        button(id,'handoff');gain(id,.5)
    button(1,'play');button(2,'play');record('initial 50/50, both ON')
    c.evaluate("decks[0].message='Previous action failed';refresh();")
    gain(1,.51);assert state()['messages'][0]=='Playing'
    gain(1,.5);record('Stale error cleared after accepted gesture')
    button(2,'handoff');gain(1,.8)
    r=record('D1 ON/D2 OFF, raise D1 to .8');assert abs(r['levels'][0]-.8)<1e-8 and abs(r['levels'][1]-.5)<1e-8 and 'capacity' not in r['messages'][0]
    gain(2,.8);r=record('OFF D2 raises to .8');assert r['levels']==[.8,.8]
    button(1,'handoff');gain(1,.8);r=record('Both OFF, raise D1 .8');assert r['levels']==[.8,.8] and r['participation']==[False]*4
    # Restore both participants, then verify direct priority in the supported cohort.
    before=state()['levels'];button(1,'handoff');button(2,'handoff');assert state()['levels']==before
    record('Re-enable preserves independent .8/.8 without normalization')
    gain(1,.5);gain(1,.8)
    r=record('Both ON, D1 .8');assert abs(r['levels'][0]-.8)<1e-8 and abs(r['levels'][1]-.2)<1e-8
    gain(2,.8);r=record('Both ON, D2 .8 reversal');assert abs(r['levels'][0]-.2)<1e-8 and abs(r['levels'][1]-.8)<1e-8
    c.evaluate("(()=>{for(let i=0;i<100;i++){const x=document.querySelector('#deck-'+(i%2+1)+' [data-gain=flow]');x.value=i%2?.8:.2;x.dispatchEvent(new Event('input'));}})()")
    r=record('100 rapid DOM input gestures');assert all(r['playing']) and r['failure'] is None
    assert c.evaluate("document.querySelector('#deck-1 [data-gain=main]').disabled")
    assert c.evaluate('decks.every(d=>prototypeStemNames.every(name=>player(d).getState().levels[name]===appState.decks[d.id-1].stems.allocatedLevels[name]))')
    # Sample actual AudioParam values after the ramps settle, not only target state.
    time.sleep(.1)
    assert c.evaluate('decks.every(d=>prototypeStemNames.every(name=>Math.abs(player(d).getDiagnostics().stems[name].reportedAudioParamValue-appState.decks[d.id-1].stems.allocatedLevels[name])<1e-6))')
    for id in [1,2]:
        if c.evaluate(f'player(decks[{id-1}]).getState().isPlaying'):button(id,'play')
    c.evaluate('actions.setEnabled(false);actions.setParticipation(1,false);actions.setParticipation(2,false)')
    gain(1,1);gain(2,1);button(1,'play');button(2,'play')
    r=record('Both OFF: start D2 at 1 against D1 at 1');assert r['playing']==[True,True] and r['failure'] is None
    assert r['participation'][2:]==[False,False]
    for primary in [1,2]:
        c.evaluate(f'actions.setParticipation(1,{str(primary==1).lower()});actions.setParticipation(2,{str(primary==2).lower()});actions.setEnabled(true)')
        # Stop/restart second deck while the other remains at full independent gain.
        button(2,'stop');button(2,'play')
        r=record(f'Full independent playback: only D{primary} ON');assert r['playing']==[True,True] and r['levels']==[1,1]
    print('RESERVATION:',c.evaluate('JSON.stringify(mixer.getDiagnostics().lastRetargetReservation)'),flush=True)
    print(json.dumps(results,indent=2),flush=True)
finally:c.call('Browser.close')
