"""Static file server for the Controller Game Hub (used by start.bat).

Python's plain `http.server` sends no caching rules, so browsers may keep
running old copies of the game scripts after they change. This one tells the
browser to check for a newer file every time. Standard library only.

    python scripts/serve.py [port]      (default 8765, localhost only)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Game Hub running at http://localhost:{port}/  (close this window or run stop.bat to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
