import json
import unittest
from email.message import Message
from urllib.request import urlopen
from unittest.mock import patch

from server.artwork_proxy import ArtworkProxyServer


class _FakeArtworkResponse:
    def __init__(self, payload: bytes, content_type: str) -> None:
        self._payload = payload
        self.headers = Message()
        self.headers["Content-Type"] = content_type

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return None

    def read(self) -> bytes:
        return self._payload


class ArtworkProxyServerTests(unittest.TestCase):
    def test_allows_canvas_sampling_from_the_device_ui(self) -> None:
        server = ArtworkProxyServer(port=0)
        port = server._server.server_port

        with patch(
            "server.artwork_proxy.urlopen",
            return_value=_FakeArtworkResponse(b"artwork-bytes", "image/jpeg"),
        ):
            server.start()
            try:
                with urlopen(
                    "http://127.0.0.1:{port}/artwork?url=https://i.scdn.co/image/example".format(port=port),
                    timeout=3,
                ) as response:
                    payload = response.read()
                    allow_origin = response.headers.get("Access-Control-Allow-Origin")
            finally:
                server.stop()

        self.assertEqual(payload, b"artwork-bytes")
        self.assertEqual(allow_origin, "*")


if __name__ == "__main__":
    unittest.main()
