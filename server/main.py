from __future__ import annotations

import asyncio

from .artwork_proxy import ArtworkProxyServer
from .spotify import SpotifyController
from .ws_server import ThingPlayerServer


async def _run() -> None:
    artwork_server = ArtworkProxyServer()
    artwork_server.start()

    ws_server = ThingPlayerServer(SpotifyController())
    await ws_server.start()


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
