from __future__ import annotations

import asyncio
import os
import subprocess
import threading
from pathlib import Path
from typing import Optional

try:
    import rumps
except ImportError:  # pragma: no cover
    rumps = None

from .adb import ensure_reverse_ports
from .artwork_proxy import ArtworkProxyServer
from .spotify import SpotifyController
from .ws_server import ThingPlayerServer

ICON_PATH = str(Path(__file__).resolve().parents[1] / "resources" / "icon.png")
REVERSE_PORTS = ("8765", "8766")


def _status_text(server_running: bool, bridge_connected: bool, spotify_status: str) -> str:
    if not server_running:
        return "Server starting..."
    if not bridge_connected:
        return "Waiting for Car Thing"
    if spotify_status == "ok":
        return "Connected - Playing"
    if spotify_status == "idle":
        return "Connected - Idle"
    if spotify_status == "spotify_not_running":
        return "Spotify not running"
    return "Connected"


def _setup_reverse_ports_async(delay: float = 2.0) -> None:
    """Set up reverse ports in a background thread to avoid blocking the event loop."""
    def _do() -> None:
        import time
        time.sleep(delay)
        for port in REVERSE_PORTS:
            try:
                subprocess.run(
                    ["adb", "reverse", "tcp:{}".format(port), "tcp:{}".format(port)],
                    capture_output=True, timeout=5,
                )
            except Exception:
                pass
            time.sleep(1)
    threading.Thread(target=_do, daemon=True).start()


class ThingPlayerMenubarApp:
    def __init__(self) -> None:
        self._server_running = False
        self._spotify_status = "unknown"
        self._bridge_connected = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._server: Optional[ThingPlayerServer] = None
        self._artwork_server: Optional[ArtworkProxyServer] = None
        self._spotify = SpotifyController()

    def run(self) -> None:
        if rumps is None:
            self._run_headless()
            return

        # Hide from Dock, menubar-only
        try:
            from AppKit import NSApplication, NSApplicationActivationPolicyAccessory
            NSApplication.sharedApplication().setActivationPolicy_(NSApplicationActivationPolicyAccessory)
        except ImportError:
            pass

        icon = ICON_PATH if os.path.exists(ICON_PATH) else None
        app = rumps.App("ThingPlayer", icon=icon, template=True)

        self._status_item = rumps.MenuItem("Starting...")
        self._status_item.set_callback(None)

        app.menu = [
            self._status_item,
            None,
            rumps.MenuItem("Restart Server", callback=lambda _: self._restart_server()),
            rumps.MenuItem("Reconnect ADB", callback=lambda _: self._reconnect_adb()),
        ]

        self._rumps_app = app
        self._start_server_thread()

        timer = rumps.Timer(self._on_tick, 5)
        timer.start()

        app.run()

    def _run_headless(self) -> None:
        import sys
        import time

        self._start_server_thread()
        try:
            while True:
                self._update_status()
                text = _status_text(self._server_running, self._bridge_connected, self._spotify_status)
                print(text)
                sys.stdout.flush()
                time.sleep(5)
        except KeyboardInterrupt:
            self._stop_server()

    def _start_server_thread(self) -> None:
        thread = threading.Thread(target=self._server_main, daemon=True)
        thread.start()

    def _on_bridge_connected(self) -> None:
        """Called by InputBridge when adb shell pipe connects successfully."""
        self._bridge_connected = True
        _setup_reverse_ports_async()

    def _server_main(self) -> None:
        import time
        # Ensure adb is on PATH (py2app strips environment)
        path = os.environ.get("PATH", "")
        for p in ("/opt/homebrew/bin", "/usr/local/bin"):
            if p not in path:
                os.environ["PATH"] = p + ":" + path
                path = os.environ["PATH"]
        time.sleep(1)

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        try:
            self._artwork_server = ArtworkProxyServer()
            self._artwork_server.start()
        except Exception:
            pass

        self._server = ThingPlayerServer(
            self._spotify,
            on_bridge_connected=self._on_bridge_connected,
        )
        self._server_running = True

        # Initial reverse port setup
        _setup_reverse_ports_async()

        try:
            self._loop.run_until_complete(self._server.start())
        except Exception:
            self._server_running = False

    def _stop_server(self) -> None:
        if self._loop is not None and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._artwork_server is not None:
            self._artwork_server.stop()
        self._server_running = False

    def _restart_server(self) -> None:
        self._stop_server()
        self._start_server_thread()

    def _reconnect_adb(self) -> None:
        _setup_reverse_ports_async()

    def _update_status(self) -> None:
        if self._server is not None:
            self._spotify_status = self._server._state.status
            bridge = self._server._input_bridge
            self._bridge_connected = bridge.connected

    def _on_tick(self, _sender: object) -> None:
        self._update_status()
        text = _status_text(self._server_running, self._bridge_connected, self._spotify_status)
        self._status_item.title = text


def main() -> None:
    ThingPlayerMenubarApp().run()


if __name__ == "__main__":
    main()
