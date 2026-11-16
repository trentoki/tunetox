#!/usr/bin/env python3
"""Local Design Mode preview with no cached development assets.
Default: preview folder at /. --project-root preserves the existing LAN repository root;
Design Mode then lives at /development/design-mode/.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BUILD = 'DM-20261114-M1'
PREVIEW = Path(__file__).resolve().parent
PROJECT = PREVIEW.parent.parent

class PreviewHandler(SimpleHTTPRequestHandler):
    def is_preview(self):
        path = Path(self.translate_path(self.path)).resolve()
        return path == PREVIEW or PREVIEW in path.parents

    def do_GET(self):
        if self.is_preview():
            # Old browser caches must not turn development responses into 304s.
            for name in ('If-Modified-Since', 'If-None-Match'):
                if name in self.headers:
                    del self.headers[name]
        super().do_GET()

    def do_HEAD(self):
        if self.is_preview():
            for name in ('If-Modified-Since', 'If-None-Match'):
                if name in self.headers:
                    del self.headers[name]
        super().do_HEAD()

    def end_headers(self):
        if self.is_preview():
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('X-TuneTox-Design-Build', BUILD)
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--project-root', action='store_true')
    args = parser.parse_args()
    directory = PROJECT if args.project_root else PREVIEW
    server = ThreadingHTTPServer((args.bind, args.port), partial(PreviewHandler, directory=str(directory)))
    print(f'{BUILD}: serving {directory} on {args.bind}:{args.port}', flush=True)
    server.serve_forever()
