#!/usr/bin/env python3
"""Focused served-page check. Start isolated Chrome with --headless --remote-debugging-port=9230.
Uses existing stdlib CDP helper; never asserts physical speaker audibility.
"""
import json
import runpy
import time
import urllib.request
from pathlib import Path

helper = Path(__file__).parent.parent / 'development/design-mode/tests/served-manage-smoke.py'
CDP = runpy.run_path(str(helper), run_name='helpers')['CDP']
endpoint = 'http://127.0.0.1:9230'
tab = json.load(urllib.request.urlopen(urllib.request.Request(endpoint + '/json/new?about:blank', method='PUT')))
client = CDP(tab['webSocketDebuggerUrl'])

def click(selector):
    rect = client.evaluate(f"JSON.stringify(document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON())")
    rect = json.loads(rect)
    for kind in ['mousePressed', 'mouseReleased']:
        client.call('Input.dispatchMouseEvent', {'type':kind, 'x':rect['x']+rect['width']/2, 'y':rect['y']+rect['height']/2, 'button':'left', 'clickCount':1})

def check(condition, message):
    if not condition: raise AssertionError(message)
    print('PASS:', message)

try:
    client.call('Emulation.setDeviceMetricsOverride', {'width':1194,'height':834,'deviceScaleFactor':2,'mobile':True})
    client.call('Page.navigate', {'url':'http://192.168.50.24:8765/tests/ipad-audio-verification.html'})
    time.sleep(1)
    check(client.evaluate("typeof audio === 'undefined'"), 'No AudioContext before explicit tap')
    check(client.evaluate("(()=>{const v=new DataView(createVerificationWav(44100));return v.byteLength===352844 && v.getUint32(24,true)===44100 && v.getInt16(44,true)===0;})()"), 'Generated four-second WAV header and fade-in')
    click('#play'); time.sleep(1.5)
    print(client.evaluate("ui.status.textContent"))
    print(client.evaluate("ui.checks.textContent"))
    check(client.evaluate("audio.state === 'running' && mixer.getDeck(1).getState().isPlaying"), 'Real mixer transport and context running')
    # Measurement is deliberately separate from transport/physical checks.
    print('MEASURED STAGES:', client.evaluate('JSON.stringify(observed)'))
    check(client.evaluate('stageNames.every(name => observed[name])'), 'Every source/gain/transport/destination stage measured nonzero')
    check(client.evaluate("ui.physical.textContent.includes('NOT CONFIRMED')"), 'Meters never confirm physical audibility')
    click('#stop'); time.sleep(.2)
    check(client.evaluate('!mixer.getDeck(1).getState().isPlaying'), 'Stop retires transport')
    click('#replay'); time.sleep(.4)
    check(client.evaluate('mixer.getDeck(1).getState().isPlaying'), 'Replay starts retained buffers')
    client.evaluate('audio.suspend()'); time.sleep(.2)
    check(client.evaluate("ui.status.textContent.includes('suspended')"), 'Suspended state visible')
    click('#replay'); time.sleep(.5)
    check(client.evaluate("audio.state === 'running'"), 'Explicit replay resumes suspended context')
    click('#stop'); time.sleep(.15)
    check(client.evaluate("!Object.values(observed).some(v=>v!==true)"), 'Observation map retains positive evidence only')
    check(client.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'iPad-width page has no horizontal clipping')
    client.call('Page.navigate', {'url':'http://192.168.50.24:8765/tests/native-output-browser-tests.html'});time.sleep(.5)
    click('#run');time.sleep(4)
    print('EXISTING FIXTURE:', client.evaluate("document.querySelector('#result').textContent.slice(0,200)"))
finally:
    client.call('Browser.close')
