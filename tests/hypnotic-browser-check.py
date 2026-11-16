"""Existing CDP helper; real Hypnotic decode, no physical audibility assertions."""
import json, runpy, time, urllib.request
C = runpy.run_path('development/design-mode/tests/served-manage-smoke.py',run_name='helpers')['CDP']
tab=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9230/json/new?about:blank',method='PUT')))
c=C(tab['webSocketDebuggerUrl'])
def check(value, label):
    assert value,label
    print('PASS:',label,flush=True)
def click(selector):
    r=json.loads(c.evaluate(f'JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())'))
    for kind in ['mousePressed','mouseReleased']:
        c.call('Input.dispatchMouseEvent',dict(type=kind,x=r['x']+r['width']/2,y=r['y']+r['height']/2,button='left',clickCount=1))
try:
    c.call('Emulation.setDeviceMetricsOverride',dict(width=1194,height=834,deviceScaleFactor=2,mobile=True))
    c.call('Page.navigate',{'url':'http://192.168.50.24:8766/'});time.sleep(1)
    check(c.evaluate("typeof audio==='undefined'"),'Lazy audio context')
    click('#load')
    for _ in range(180):
        time.sleep(.5)
        if c.evaluate('!loading'):break
    print(c.evaluate("element('status').textContent"),flush=True)
    check(c.evaluate('!!player?.getState().loaded'),'All four real stems decoded and validated')
    check(c.evaluate('!player.getState().isPlaying'),'Loading does not autoplay')
    print(c.evaluate("element('memory').textContent"),flush=True)
    click('#play');time.sleep(1)
    check(c.evaluate('player.getState().isPlaying && player.getDiagnostics().sourceStartCalls===4'),'Four stems playing on one native start')
    check(c.evaluate('outputSeen'),'Nonzero destination signal')
    click('#play');time.sleep(.2)
    before=c.evaluate('player.getState().position')
    time.sleep(.2)
    check(abs(c.evaluate('player.getState().position')-before)<.01,'Pause retains position')
    click('#play');time.sleep(.5)
    check(c.evaluate('player.getState().position')>before,'Resume advances retained timeline')
    for index in range(4):
        c.evaluate(f"(()=>{{const input=document.querySelectorAll('#gains input')[{index+1}];input.value=.2;input.dispatchEvent(new Event('input'));}})()")
        check(c.evaluate(f"player.getState().levels[prototypeStemNames[{index}]]===.2"),'Independent stem '+str(index+1))
    c.evaluate("(()=>{const input=document.querySelector('#gains input');input.value=.1;input.dispatchEvent(new Event('input'));})()")
    check(c.evaluate('player.getState().mainVolume===.1'),'Live main gain')
    click('#stop');time.sleep(.2)
    check(c.evaluate('!player.getState().isPlaying && player.getState().position===0'),'Stop resets timeline')
    check(c.evaluate('document.documentElement.scrollWidth<=innerWidth'),'No iPad horizontal clipping')
finally:
    c.call('Browser.close')
