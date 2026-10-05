"""Ephemeral localhost server for external PDF fixtures; never copies documents.

python3 tests/ponto-test-server.py --pdf-a /path/to/card-a.pdf --pdf-b /path/to/card-b.pdf
Stop the server after tests. It is not part of the application or deployment.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--pdf-a', required=True, type=Path)
parser.add_argument('--pdf-b', required=True, type=Path)
args = parser.parse_args()
sources = {'/__test_pdf_dayane': args.pdf_a, '/__test_pdf_michele': args.pdf_b}
for source in sources.values():
    if not source.is_file() or source.suffix.lower() != '.pdf':
        parser.error('Informe dois arquivos PDF locais existentes.')

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass  # No document content, personal data or paths in logs.

    def do_GET(self):
        path = sources.get(urlsplit(self.path).path)
        if path is None:
            super().do_GET()
            return
        self.send_response(200)
        self.send_header('Content-Type', 'application/pdf')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(path.stat().st_size))
        self.end_headers()
        try:
            with path.open('rb') as source:
                while chunk := source.read(65536):
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(Path(__file__).resolve().parents[1])))
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
