"""Phase 1D.2 real-song UI/native Main checks; isolated Chrome CDP port 9230."""
import json,runpy,time,urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helpers')['CDP']
tab=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9230/json/new?about:blank',method='PUT')));c=C(tab['webSocketDebuggerUrl'])
def check(value,label):
    assert value,label
    print('PASS:',label,flush=True)
def button(id,action):
    selector=f'#deck-{id} [data-action={action}]'
    r=json.loads(c.evaluate(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
    for kind in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
    time.sleep(.1)
def gain(id,name,value):
    c.evaluate(f"(()=>{{const x=document.querySelector('#deck-{id} [data-gain={name}]');x.value={value};x.dispatchEvent(new Event('input'));}})()");time.sleep(.06)
def load(id):
    button(id,'load')
    for _ in range(240):
        time.sleep(.25)
        if c.evaluate('loadingDeck===null'):break
    check(c.evaluate(f'player(decks[{id-1}]).getState().loaded'),f'Deck {id} loaded')
def near(expression,value):return abs(c.evaluate(expression)-value)<1e-6
try:
    c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/handoff-main?build=1d2-m1'});time.sleep(1)
    check(c.evaluate("document.querySelector('h1').textContent.includes('LIVE MAIN M1')"),'Unmistakable new build')
    load(1)
    for name in ['transients','tune','voice']:gain(1,name,0)
    button(1,'handoff');button(1,'play')
    check(c.evaluate("!document.querySelector('#deck-1 [data-gain=main]').disabled"),'Live Main touch control enabled')
    for value in [.5,.2,.8,0,.5]:
        before=c.evaluate('player(decks[0]).getState().position');gain(1,'main',value)
        check(near('player(decks[0]).getDiagnostics().reportedMainAudioParamValue',value),'Actual native Main follows live slider '+str(value))
        check(c.evaluate('player(decks[0]).getState().isPlaying && player(decks[0]).getState().position')>=before,'Main preserves transport and position')
    check(near('appState.stemSession.authorization.ceilingsByStem.flow',.8),'Main high-water retained on reductions')
    load(2)
    for name in ['transients','tune','voice']:gain(2,name,0)
    gain(2,'flow',.5);gain(2,'main',.5);button(2,'play');button(2,'handoff')
    gain(1,'flow',.5);gain(1,'main',1);gain(2,'main',1)
    gain(1,'main',.5)
    check(near('appState.decks[0].stems.allocatedLevels.flow',.5),'Main preserves own stem coefficient')
    check(near('appState.decks[1].stems.allocatedLevels.flow',.75),'Participating receiver restores effective-gain budget')
    check(near('player(decks[0]).getDiagnostics().reportedMainAudioParamValue',.5),'Native Main matches committed state')
    check(near("player(decks[1]).getDiagnostics().stems.flow.reportedAudioParamValue",.75),'Native receiver stem matches automatic fader')
    gain(1,'main',1);check(near('appState.decks[1].stems.allocatedLevels.flow',.5),'Main raise redistributes within cap')
    gain(2,'flow',0);gain(1,'main',.2)
    check(near('appState.decks[1].stems.allocatedLevels.flow',0),'Main cannot resurrect zero stem')
    gain(2,'flow',.5)
    # Pending native starts reject stale gestures, never pretend that the displayed Main committed.
    button(1,'play')
    result=c.evaluate("(async()=>{const p=actions.play(1);const x=document.querySelector('#deck-1 [data-gain=main]');const old=appState.decks[0].volume;x.value=.7;x.dispatchEvent(new Event('input'));const rejected=appState.decks[0].volume===old && Number(x.value)===old && decks[0].message.includes('pending');await p;return rejected;})()")
    check(result,'Rejected pending gesture restores Main display to committed value')
    gain(1,'main',.4);check(c.evaluate("!decks[0].message.includes('pending')"),'Successful Main clears prior error')
    for parts in [(True,False),(False,True),(False,False),(True,True)]:
        c.evaluate(f'actions.setParticipation(1,{str(parts[0]).lower()});actions.setParticipation(2,{str(parts[1]).lower()})')
        for id in [1,2]:gain(id,'main',.6 if id==1 else .7)
        check(c.evaluate('decks.every(d=>player(d).getState().isPlaying)'),f'Live Main preserves transport with participation {parts}')
        check(c.evaluate('decks.every(d=>Math.abs(player(d).getDiagnostics().reportedMainAudioParamValue-appState.decks[d.id-1].volume)<1e-6)'),f'Native Main values agree for {parts}')
    c.evaluate("(()=>{for(let i=0;i<100;i++){const id=i%2+1;for(const name of ['main','flow']){const x=document.querySelector('#deck-'+id+' [data-gain='+name+']');x.value=[0,.2,.8,1][i%4];x.dispatchEvent(new Event('input'));}}})()")
    time.sleep(.15)
    check(c.evaluate('decks.every(d=>player(d).getState().isPlaying) && mixer.getLastSchedulingFailure()===null'),'200 rapid mixed Main/stem inputs do not pause')
    check(c.evaluate('decks.every(d=>Math.abs(player(d).getDiagnostics().reportedMainAudioParamValue-appState.decks[d.id-1].volume)<1e-6 && prototypeStemNames.every(n=>Math.abs(player(d).getDiagnostics().stems[n].reportedAudioParamValue-appState.decks[d.id-1].stems.allocatedLevels[n])<1e-6))'),'Settled native Main/stems match UI state')
    check(c.evaluate('!appState.participation.byDeck[3].stemHandoff && !appState.participation.byDeck[4].stemHandoff'),'Decks 3/4 remain excluded')
    print('RESERVATION',c.evaluate('JSON.stringify(mixer.getDiagnostics().lastRetargetReservation)'),flush=True)
    c.evaluate('actions.dispose();mixer.close()');check(c.evaluate("audio.state==='closed'"),'Cleanup')
finally:c.call('Browser.close')
