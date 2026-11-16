"""Focused validation and allowlist tests; temporary synthetic WAVs only."""
import importlib.util
import struct
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('hypnotic', 'development/playable/serve-hypnotic.py')
server_module = importlib.util.module_from_spec(spec); spec.loader.exec_module(server_module)

class ValidationTests(unittest.TestCase):
    def test_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.wav'
            def write(samples=(0., .2, -.3, 0.), rate=44100):
                pcm = struct.pack('<' + 'f' * len(samples), *samples)
                fmt = struct.pack('<HHIIHH', 3, 2, rate, rate * 8, 8, 32)
                body = b'WAVEfmt ' + struct.pack('<I',16) + fmt + b'data' + struct.pack('<I',len(pcm)) + pcm
                path.write_bytes(b'RIFF' + struct.pack('<I',len(body)) + body)
            write(); data = server_module.inspect_wav(path)
            self.assertEqual(data['frames'],2); self.assertAlmostEqual(data['peak'], .3)
            write((0., float('nan')))
            with self.assertRaises(ValueError): server_module.inspect_wav(path)
            write(rate=123)
            with self.assertRaises(ValueError): server_module.inspect_wav(path)
            path.write_bytes(b'bad')
            with self.assertRaises(ValueError): server_module.inspect_wav(path)
    def test_alignment_and_peak_bound(self):
        baseline = dict(frames=100, sampleRate=44100, peak=1.)
        with patch.object(server_module, 'inspect_wav', return_value=baseline):
            self.assertEqual(server_module.manifest()['mainCeiling'], .2)
            self.assertEqual(server_module.manifest(budget=.4)['mainCeiling'], .1)
        mismatch = [dict(baseline), dict(baseline, frames=99), dict(baseline), dict(baseline)]
        with patch.object(server_module, 'inspect_wav', side_effect=mismatch):
            with self.assertRaises(ValueError): server_module.manifest()
    def test_allowlist(self):
        server = ThreadingHTTPServer(('127.0.0.1',0), server_module.Handler)
        server.song_manifest = {'test':True}
        server.two_deck_manifest = {'decks':{}}
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        try:
            self.assertEqual(urllib.request.urlopen(base + '/manifest.json').status,200)
            self.assertEqual(urllib.request.urlopen(base + '/two-deck-manifest.json').status,200)
            self.assertEqual(len(server_module.MEDIA),8)
            self.assertEqual(urllib.request.urlopen(base + '/two-deck').status,200)
            self.assertEqual(urllib.request.urlopen(base + '/handoff').status,200)
            self.assertIn(b'LIVE MAIN M1',urllib.request.urlopen(base + '/handoff-main').read())
            self.assertIn(b'P1 AUDIO',urllib.request.urlopen(base + '/performance').read())
            self.assertIn(b'F1 AUDIO',urllib.request.urlopen(base + '/performance-four').read())
            self.assertIn(b'F2 AUDIO',urllib.request.urlopen(base + '/performance-incremental').read())
            self.assertIn(b'F3 AUDIO',urllib.request.urlopen(base + '/performance-first-play').read())
            self.assertIn(b'G1 STORAGE',urllib.request.urlopen(base + '/performance-storage').read())
            self.assertIn(b'G2 AUDIO',urllib.request.urlopen(base + '/performance-lifecycle').read())
            for asset in ['/local-audio-store.js','/local-audio-panel.js','/local-audio.css','/storage-wav-reader.js']:
                self.assertEqual(urllib.request.urlopen(base+asset).status,200)
            self.assertEqual(urllib.request.urlopen(base+'/stem-touch-priority.js').status,200)
            self.assertEqual(urllib.request.urlopen(base+'/shared-stem-pool.js').status,200)
            for route in ['/playable-controller.js','/playable-app.js','/playable-namespace.js','/playable-ui.css','/ui/components.js','/ui/design-mode.css']:
                self.assertEqual(urllib.request.urlopen(base+route).status,200)
            self.assertEqual(urllib.request.urlopen(base + '/handoff-deps/native-stem-handoff.js').status,200)
            for route in ['/ui/app.js','/ui/index.html','/ui/../AGENTS.md','/baselines/phase1d2-live-main-m1.tar.gz','/../AGENTS.md', '/media/original.aif', '/media/cut-me-loose/original.aif', '/media/cut-me-loose/../../original.aif', '/media/flow.wav/../original.aif', '/media/%2e%2e/original.aif', '/?path=/etc/passwd']:
                if route.startswith('/?'):
                    self.assertIn(b'TuneTox',urllib.request.urlopen(base + route).read()); continue
                with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(base + route)
                self.assertEqual(error.exception.code,404)
        finally: server.shutdown();server.server_close()

if __name__ == '__main__': unittest.main()
