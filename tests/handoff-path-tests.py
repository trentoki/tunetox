"""Filesystem and LAN route regressions for organized Handoff modules; no audio."""
import importlib.util
from pathlib import Path
import re
import subprocess
import threading
import urllib.request
from http.server import ThreadingHTTPServer
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
NAMES = {'stem-state.js', 'two-deck-stem-handoff.js', 'four-deck-stem-allocation.js',
         'native-stem-handoff.js', 'stem-handoff-audio-bridge.js'}
spec = importlib.util.spec_from_file_location('handoff_server_paths', ROOT / 'development/playable/serve-hypnotic.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def tracked_files():
    return subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().strip('\0').split('\0')


def public_route(name):
    return '/handoff-deps/' + ('experimental/' if name == 'stem-handoff-audio-bridge.js' else '') + name


class HandoffPaths(unittest.TestCase):
    def test_public_routes_keep_resolving_to_exact_sources(self):
        for name in NAMES:
            route = public_route(name)
            with self.subTest(route=route):
                path, mime = server.ASSETS[route]
                self.assertEqual(path, ROOT / 'development/audio/handoff' / name)
                self.assertTrue(path.is_file())
                self.assertEqual(mime, 'text/javascript')

    def test_http_serves_exact_relocated_bytes(self):
        http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        try:
            for name in NAMES:
                route = public_route(name)
                with self.subTest(route=route):
                    url = 'http://127.0.0.1:' + str(http.server_port) + route
                    with urllib.request.urlopen(url) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.read(), (ROOT / 'development/audio/handoff' / name).read_bytes())
        finally:
            http.shutdown()
            http.server_close()
            thread.join()

    def test_all_executable_references_exist(self):
        checked = 0
        for relative in tracked_files():
            if relative.startswith('research/') or '/baselines/' in relative or '/review/' in relative:
                continue
            file = ROOT / relative
            if not file.is_file() or file.suffix not in ('.js', '.html'):
                continue
            source = file.read_text()
            references = (re.findall(r'<script\b[^>]*\bsrc=["\']([^"\']+)', source)
                          if file.suffix == '.html' else re.findall(r'["\']([^"\'\n]+)["\']', source))
            for reference in references:
                path = urlsplit(reference).path
                if Path(path).name not in NAMES:
                    continue
                with self.subTest(file=relative, reference=reference):
                    if path.startswith('/handoff-deps/'):
                        self.assertIn(path, server.ASSETS)
                        target = server.ASSETS[path][0]
                    else:
                        target = (file.parent if file.suffix == '.html' else ROOT) / path
                    self.assertTrue(target.is_file(), str(target))
                checked += 1
        self.assertGreater(checked, 20, 'Expected application, prototype and runner coverage')


if __name__ == '__main__':
    unittest.main()
