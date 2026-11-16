#!/usr/bin/env python3
"""Allowlisted, read-only Phase 1B/1C LAN server. No directory or arbitrary-path serving."""
import array
import json
import math
import struct
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
MUSIC = Path('/Volumes/OWC Express 1M2/TuneTox Test Music/Tase T - Hypnotic')
NAMES = ('transients', 'flow', 'tune', 'voice')

def inspect_wav(path):
    with path.open('rb') as source:
        header = source.read(12)
        if len(header) != 12 or header[:4] != b'RIFF' or header[8:] != b'WAVE':
            raise ValueError('Expected RIFF WAV')
        if struct.unpack('<I', header[4:8])[0] + 8 != path.stat().st_size:
            raise ValueError('RIFF size mismatch')
        fmt = None
        data = None
        while source.tell() < path.stat().st_size:
            chunk = source.read(8)
            if len(chunk) != 8: raise ValueError('Truncated chunk')
            tag, length = struct.unpack('<4sI', chunk)
            offset = source.tell()
            if offset + length > path.stat().st_size: raise ValueError('Truncated data')
            if tag == b'fmt ':
                if length < 16 or fmt is not None: raise ValueError('Invalid fmt chunk')
                fmt = struct.unpack('<HHIIHH', source.read(16))
            if tag == b'data':
                if data is not None: raise ValueError('Duplicate data')
                data = (offset, length)
            source.seek(offset + length + length % 2)
        if not fmt or not data: raise ValueError('Missing fmt/data')
        code, channels, rate, byte_rate, alignment, bits = fmt
        if code != 3 or bits != 32 or channels not in (1, 2) or rate not in (44100, 48000):
            raise ValueError('Fixture requires float32 mono/stereo 44.1/48 kHz WAV')
        if alignment != channels * 4 or byte_rate != rate * alignment or data[1] % alignment or not data[1]:
            raise ValueError('Invalid frame layout')
        source.seek(data[0]); remaining = data[1]; peak = 0
        while remaining:
            block = source.read(min(1048576, remaining)); remaining -= len(block)
            values = array.array('f'); values.frombytes(block)
            if sys.byteorder != 'little': values.byteswap()
            if not all(math.isfinite(value) for value in values): raise ValueError('Nonfinite PCM')
            peak = max(peak, abs(min(values)), abs(max(values)))
        frames = data[1] // alignment
        return dict(format='IEEE float32', channels=channels, sampleRate=rate, frames=frames,
                    duration=frames / rate, encodedBytes=path.stat().st_size,
                    decodedBytes=frames * channels * 4, peak=peak)

def manifest(folder=MUSIC, song='Tase T - Hypnotic', prefix='/media/', budget=.8):
    stems = {name: dict(inspect_wav(folder / (name + '.wav')), url=prefix + name + '.wav') for name in NAMES}
    if len({(stem['frames'], stem['sampleRate']) for stem in stems.values()}) != 1:
        raise ValueError('Stems do not have identical timeline lengths and sample rates')
    peak_sum = sum(stem['peak'] for stem in stems.values())
    return dict(song=song, stems=stems,
                mainCeiling=min(.5, budget / peak_sum) if peak_sum else .5,
                alignment='Equal frames/rate verified; musical start alignment relies on the supplied aligned exports.')

ASSETS = {'/': (PROJECT / 'development/playable/hypnotic.html', 'text/html'),
          '/playable-namespace.js': (PROJECT / 'development/playable/playable-namespace.js', 'text/javascript'),
          '/performance-lifecycle': (PROJECT / 'development/playable/performance-lifecycle.html', 'text/html'),
          '/performance-storage': (PROJECT / 'development/playable/performance-storage.html', 'text/html'),
          '/storage-wav-reader.js': (PROJECT / 'experimental/bounded-wav-reader.js', 'text/javascript'),
          '/local-audio-store.js': (PROJECT / 'development/playable/local-audio-store.js', 'text/javascript'),
          '/local-audio-panel.js': (PROJECT / 'development/playable/local-audio-panel.js', 'text/javascript'),
          '/local-audio.css': (PROJECT / 'development/playable/local-audio.css', 'text/css'),
          '/performance-first-play': (PROJECT / 'development/playable/performance-first-play.html', 'text/html'),
          '/performance-incremental': (PROJECT / 'development/playable/performance-incremental.html', 'text/html'),
          '/performance-four': (PROJECT / 'development/playable/performance-four.html', 'text/html'),
          '/stem-touch-priority.js': (PROJECT / 'development/playable/stem-touch-priority.js', 'text/javascript'),
          '/shared-stem-pool.js': (PROJECT / 'development/playable/shared-stem-pool.js', 'text/javascript'),
          '/performance': (PROJECT / 'development/playable/performance.html', 'text/html'),
          '/playable-controller.js': (PROJECT / 'development/playable/playable-controller.js', 'text/javascript'),
          '/playable-app.js': (PROJECT / 'development/playable/playable-app.js', 'text/javascript'),
          '/playable-ui.css': (PROJECT / 'development/playable/playable-ui.css', 'text/css'),
          '/handoff-main': (PROJECT / 'development/playable/handoff-main.html', 'text/html'),
          '/handoff': (PROJECT / 'development/playable/handoff.html', 'text/html'),
          '/handoff.js': (PROJECT / 'development/playable/handoff.js', 'text/javascript'),
          '/two-deck': (PROJECT / 'development/playable/two-deck.html', 'text/html'),
          '/two-deck.js': (PROJECT / 'development/playable/two-deck.js', 'text/javascript'),
          '/hypnotic.js': (PROJECT / 'development/playable/hypnotic.js', 'text/javascript'),
          '/four-stem-player.js': (PROJECT / 'experimental/four-stem-player.js', 'text/javascript')}
# Exact production dependencies for the isolated handoff host.
for module in ('participation.js', 'stem-state.js', 'two-deck-stem-handoff.js', 'four-deck-stem-allocation.js', 'app.js', 'experimental/stem-handoff-audio-bridge.js', 'native-stem-handoff.js'):
    ASSETS['/handoff-deps/' + module] = (PROJECT / module, 'text/javascript')


UI_FILES = ('design-mode.css', 'landscape-variants.css', 'sampler.css', 'performance.css', 'phone.css', 'navigation-revision.css', 'mixer-strip.css', 'phone-compact.css', 'transition-single-fx.css', 'viewport.css', 'interaction-cleanup.css', 'sampler-state.js', 'state.js', 'components.js', 'drag-drop.js', 'library-context.js', 'layout-preview.js', 'column-library.js', 'sampler-view.js', 'vertical-fader.js', 'effect-assignment.js', 'knob-reset.js', 'performance-controls.js', 'phone-view.js', 'waveform-navigation.js', 'viewport.js')
for name in UI_FILES:
    ASSETS['/ui/' + name] = (PROJECT / 'development/design-mode' / name, 'text/css' if name.endswith('.css') else 'text/javascript')

MEDIA = {'/media/' + name + '.wav': MUSIC / (name + '.wav') for name in NAMES}

SECOND = MUSIC.parent / 'Michael Todd & Tase T - Cut Me Loose'
MEDIA.update({'/media/cut-me-loose/' + name + '.wav': SECOND / (name + '.wav') for name in NAMES})

class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self): self.respond(False)
    def do_GET(self): self.respond(True)
    def respond(self, body):
        route = self.path.split('?', 1)[0]
        if route in ('/manifest.json', '/two-deck-manifest.json'):
            data = json.dumps(self.server.song_manifest if route == '/manifest.json' else self.server.two_deck_manifest).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data))); self.send_header('Cache-Control', 'no-store'); self.end_headers()
            if body: self.wfile.write(data)
            return
        resource = ASSETS.get(route) or ((MEDIA[route], 'audio/wav') if route in MEDIA else None)
        if resource is None:
            self.send_error(404); return
        path, mime = resource
        # Exact file allowlist; refuse symlinks rather than traversing external paths.
        if path.is_symlink() or path.parent.is_symlink(): self.send_error(403); return
        try:
            with path.open('rb') as source:
                self.send_response(200); self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(path.stat().st_size))
                self.send_header('Cache-Control', 'no-store'); self.send_header('X-Content-Type-Options', 'nosniff'); self.end_headers()
                if body:
                    while True:
                        block = source.read(262144)
                        if not block: break
                        self.wfile.write(block)
        except FileNotFoundError: self.send_error(404)
        except PermissionError: self.send_error(403)
        except (BrokenPipeError, ConnectionResetError): pass

if __name__ == '__main__':
    song_manifest = manifest()
    second = manifest(SECOND, 'Michael Todd & Tase T - Cut Me Loose', '/media/cut-me-loose/', .4)
    first = dict(song_manifest, mainCeiling=song_manifest['mainCeiling'] / 2)
    server = ThreadingHTTPServer(('0.0.0.0', 8766), Handler)
    server.song_manifest = song_manifest
    server.two_deck_manifest = {"decks": {"1": first, "2": second}}
    print(json.dumps(song_manifest), flush=True)
    print('Phase 1B: http://192.168.50.24:8766/ (trusted LAN only; no authentication/TLS)', flush=True)
    server.serve_forever()
