from __future__ import annotations

from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


class ArtworkCache:
    def __init__(self, limit: int = 10) -> None:
        self._limit = limit
        self._items: "OrderedDict[str, Tuple[bytes, str]]" = OrderedDict()

    def get(self, url: str) -> Optional[Tuple[bytes, str]]:
        cached = self._items.get(url)
        if cached is None:
            return None
        self._items.move_to_end(url)
        return cached

    def set(self, url: str, payload: bytes, content_type: str) -> None:
        self._items[url] = (payload, content_type)
        self._items.move_to_end(url)
        while len(self._items) > self._limit:
            self._items.popitem(last=False)


class ArtworkProxyServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8766) -> None:
        self._cache = ArtworkCache(limit=10)
        self._server = ThreadingHTTPServer((host, port), self._build_handler())
        self._thread = Thread(target=self._server.serve_forever, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()

    def _build_handler(self):
        cache = self._cache

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                parsed = urlparse(self.path)
                if parsed.path != "/artwork":
                    self.send_error(404)
                    return

                values = parse_qs(parsed.query).get("url", [])
                if not values:
                    self.send_error(400, "Missing artwork URL")
                    return

                url = values[0]
                if not url.startswith("https://i.scdn.co/"):
                    self.send_error(403, "Artwork host not allowed")
                    return

                cached = cache.get(url)
                if cached is None:
                    request = Request(url, headers={"User-Agent": "ThingPlayer/0.1"})
                    with urlopen(request, timeout=5) as response:
                        payload = response.read()
                        content_type = response.headers.get_content_type()
                    cache.set(url, payload, content_type)
                    cached = (payload, content_type)

                payload, content_type = cached
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", content_type)
                self.send_header("Cache-Control", "public, max-age=3600")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, format: str, *args: object) -> None:
                return

        return Handler
