"""Real-song browser checks. Chrome CDP 9230; no physical audibility assertions."""
import json, runpy, time, urllib.request
C=runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helpers')['CDP']
tab=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9230/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl'])
def check(value,label):
    assert value,label
    print('PASS:',label,flush=True)
def click(selector):
    r=json.loads(c.evaluate(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
    for kind in ['mousePressed','mouseReleased']:
        c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
def button(id,action): click(f'#deck-{id} [data-action="{action}"]')
def wait_load():
    for _ in range(240):
        time.sleep(.25)
        if c.evaluate('loadingDeck===null'):return
    raise AssertionError('Loading deadline')
try:
    c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/two-deck'});time.sleep(1)
    check(c.evaluate("typeof audio==='undefined'"),'No audio before gesture')
    button(1,'load');wait_load()
    check(c.evaluate('player(decks[0]).getState().loaded && !player(decks[1]).getState().loaded'),'Independent Deck 1 load; no autoplay')
    button(1,'play');time.sleep(.5)
    before=c.evaluate('player(decks[0]).getState().position')
    button(2,'load');wait_load()
    check(c.evaluate('player(decks[0]).getState().isPlaying && player(decks[0]).getState().position')>before,'Deck 1 continues during Deck 2 loading')
    check(c.evaluate('player(decks[1]).getState().loaded && !player(decks[1]).getState().isPlaying'),'Deck 2 loaded without autoplay')
    button(2,'play');time.sleep(1)
    check(c.evaluate('decks.every(d=>player(d).getState().isPlaying && player(d).getDiagnostics().sourceStartCalls===4)'),'Eight native sources playing; four aligned per song')
    check(c.evaluate('outputSeen'),'Destination signal measured')
    for deck_id in [1,2]:
        other=2 if deck_id==1 else 1
        for name in ['main','transients','flow','tune','voice']:
            prior=c.evaluate(f'JSON.stringify(player(decks[{other-1}]).getState().levels)')
            c.evaluate(f"(()=>{{const x=document.querySelector('#deck-{deck_id} [data-gain={name}]');x.value=.05;x.dispatchEvent(new Event('input'));}})()")
            check(c.evaluate(f'player(decks[{deck_id-1}]).getState().'+('mainVolume' if name=='main' else f'levels.{name}')+'===.05'),f'Deck {deck_id} {name} gain')
            check(c.evaluate(f'JSON.stringify(player(decks[{other-1}]).getState().levels)')==prior,'Other deck stem state preserved')
        button(deck_id,'play');time.sleep(.2)
        paused=c.evaluate(f'player(decks[{deck_id-1}]).getState().position')
        before=c.evaluate(f'player(decks[{other-1}]).getState().position');time.sleep(.3)
        check(c.evaluate(f'player(decks[{deck_id-1}]).getState().position')==paused,'Pause holds own timeline')
        check(c.evaluate(f'player(decks[{other-1}]).getState().position')>before,'Other deck continues')
        button(deck_id,'play');time.sleep(.2)
        button(deck_id,'stop');time.sleep(.1)
        check(c.evaluate(f'player(decks[{deck_id-1}]).getState().position===0'),'Stop resets own position')
        button(deck_id,'play');time.sleep(.2)
    print(c.evaluate("element('memory').textContent"),flush=True)
    print('Browser heap:',c.evaluate('performance.memory ? JSON.stringify({usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}) : "unavailable"'),flush=True)
    button(1,'release');time.sleep(.2)
    check(c.evaluate('!player(decks[0]).getState().loaded && player(decks[1]).getState().isPlaying'),'Release clears Deck 1 without interrupting Deck 2')
    button(1,'load');wait_load();button(1,'play');time.sleep(.3)
    check(c.evaluate('decks.every(d=>player(d).getState().isPlaying)'),'Reload and repeated playback')
    check(c.evaluate('document.documentElement.scrollWidth<=innerWidth'),'iPad horizontal fit')
    c.evaluate('mixer.close()')
    check(c.evaluate('audio.state==="closed" && decks.every(d=>player(d).getState().closed)'),'Owner cleanup closes context and players')
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/'});time.sleep(.4)
    check(c.evaluate("!!document.querySelector('#load')"),'Phase 1B fallback still served')
finally:c.call('Browser.close')
