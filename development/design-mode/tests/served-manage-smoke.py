#!/usr/bin/env python3
"""Direct served-page smoke check via a disposable Chrome debugging port (stdlib only).
Start Chrome with --headless --remote-debugging-port=9229 and a disposable profile.
No iframe fixtures or application test hooks are used for navigation/assertions.
"""
import argparse
import base64
import json
import os
import socket
import struct
import time
import urllib.request
from urllib.parse import urlsplit

class CDP:
    def __init__(self, url):
        parsed = urlsplit(url)
        self.sock = socket.create_connection((parsed.hostname, parsed.port), timeout=10)
        self.buffer = b''
        key = base64.b64encode(os.urandom(16)).decode()
        request = f'GET {parsed.path} HTTP/1.1\r\nHost: {parsed.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
        self.sock.sendall(request.encode())
        while b'\r\n\r\n' not in self.buffer:
            chunk = self.sock.recv(4096)
            if not chunk: raise ConnectionError('Chrome closed during handshake')
            self.buffer += chunk
        header, self.buffer = self.buffer.split(b'\r\n\r\n', 1)
        assert header.startswith(b'HTTP/1.1 101 '), header
        self.sequence = 0

    def read(self, length):
        while len(self.buffer) < length:
            chunk = self.sock.recv(max(4096, length - len(self.buffer)))
            if not chunk: raise ConnectionError('Chrome closed the debugging connection')
            self.buffer += chunk
        result, self.buffer = self.buffer[:length], self.buffer[length:]
        return result

    def receive(self):
        first, second = self.read(2)
        length = second & 127
        if length == 126: length = struct.unpack('!H', self.read(2))[0]
        elif length == 127: length = struct.unpack('!Q', self.read(8))[0]
        mask = self.read(4) if second & 128 else None
        body = self.read(length)
        if mask: body = bytes(value ^ mask[index % 4] for index, value in enumerate(body))
        assert first & 15 == 1, 'Expected local CDP text frame'
        return json.loads(body)

    def call(self, method, params=None):
        self.sequence += 1
        body = json.dumps({'id': self.sequence, 'method': method, 'params': params or {}}).encode()
        mask = os.urandom(4)
        length = len(body)
        header = bytes([129, 128 | length]) if length < 126 else bytes([129, 254]) + struct.pack('!H', length)
        self.sock.sendall(header + mask + bytes(value ^ mask[index % 4] for index, value in enumerate(body)))
        while True:
            message = self.receive()
            if message.get('id') == self.sequence:
                if 'error' in message: raise RuntimeError(message['error'])
                return message.get('result', {})

    def evaluate(self, expression):
        result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in result: raise RuntimeError(result['exceptionDetails'])
        return result['result'].get('value')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://192.168.50.24:8765/development/design-mode/?build=DM-20261114-M1')
    parser.add_argument('--debug-port', type=int, default=9229)
    args = parser.parse_args()
    endpoint = f'http://127.0.0.1:{args.debug_port}'
    tab = json.load(urllib.request.urlopen(urllib.request.Request(endpoint + '/json/new?about:blank', method='PUT')))
    browser = CDP(tab['webSocketDebuggerUrl'])
    results = []
    for name, width, height in [('phone',390,844), ('ipad-column',1194,834), ('ipad-sidebar',1194,834)]:
        browser.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': name == 'phone'})
        browser.call('Page.navigate', {'url': args.url})
        for _ in range(100):
            if browser.evaluate("document.readyState === 'complete' && !!window.TuneToxDesign?.preview"): break
            time.sleep(.05)
        else: raise RuntimeError('Served application did not load')
        if name == 'phone':
            browser.evaluate("document.querySelector('.phone-tab[data-tab=\"library\"]').click(); document.querySelector('.design-deck[data-phone-visible=\"true\"] .song-manage').click()")
            scope = '.design-deck[data-phone-visible="true"] .library-context'
        elif name == 'ipad-column':
            browser.evaluate("document.querySelector('.design-deck [data-mode=\"library\"]').click(); document.querySelector('.design-deck .song-manage').click()")
            scope = '.design-deck .library-context'
        else:
            browser.evaluate("for (const [id,value] of [['preview-layout','sidebar'],['preview-arrangement','quadrants']]) { const input=document.getElementById(id); input.value=value; input.dispatchEvent(new Event('change')); } document.querySelector('.library .song-manage').click()")
            scope = '.library .library-context'
        expression = """(() => {
          const panel = document.querySelector(SCOPE);
          return {url: location.href, build: document.getElementById('design-build').textContent,
            manageBuild: panel.dataset.manageBuild, rows: panel.querySelectorAll('.manage-playlist-row').length,
            oldHeading: /playlist memberships/i.test(panel.innerText), oldBrowseButtons: [...panel.querySelectorAll('button')].filter(b => /^Browse /.test(b.innerText)).length,
            versionedAssets: [...document.querySelectorAll('script[src],link[rel=stylesheet]')].every(n => (n.src || n.href).includes('DM-20261114-M1'))};
        })()""".replace('SCOPE', json.dumps(scope))
        result = browser.evaluate(expression)
        assert result['build'] == 'DEV M1-1114' and result['manageBuild'] == 'M1', result
        assert result['rows'] == 4 and not result['oldHeading'] and result['oldBrowseButtons'] == 0 and result['versionedAssets'], result
        # Exercise membership and playlist-name navigation from the served screen itself.
        membership = json.dumps(scope + ' [data-playlist-id="slow"] input')
        playlist = json.dumps(scope + ' [data-playlist-id="slow"] .manage-playlist-name')
        candidates = json.dumps(scope + ' .manage-link-candidate')
        back = json.dumps(scope + ' .context-back')
        rows = json.dumps(scope + ' .manage-playlist-row')
        browser.evaluate(f"document.querySelector({membership}).click()")
        assert browser.evaluate(f"document.querySelector({membership}).checked")
        browser.evaluate(f"document.querySelector({playlist}).click()")
        assert browser.evaluate(f"!!document.querySelector({candidates})")
        browser.evaluate(f"document.querySelector({back}).click()")
        assert browser.evaluate(f"document.querySelectorAll({rows}).length") == 4
        result['route'] = name; result['membershipAndBack'] = 'passed'; results.append(result)
    browser.call('Page.close')
    print(json.dumps(results, indent=2))
