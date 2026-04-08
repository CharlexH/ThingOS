"""Read hardware button events from Car Thing via ADB and forward them."""
from __future__ import annotations

import asyncio
import struct
from typing import Callable, Dict, Optional

EVENT_SIZE = 16
EVENT_FORMAT = "IIHHi"

EV_KEY = 0x01

KEY_MAP: Dict[int, str] = {
    1: "back",
    2: "preset1",
    3: "preset2",
    4: "preset3",
    5: "preset4",
    28: "knob_press",
}


RECONNECT_DELAY = 5.0


class InputBridge:
    def __init__(
        self,
        on_button: Callable[[str, bool], None],
        on_connected: Optional[Callable[[], None]] = None,
    ) -> None:
        self._on_button = on_button
        self._on_connected = on_connected
        self._process: Optional[asyncio.subprocess.Process] = None
        self._running = False
        self.connected = False

    async def start(self) -> None:
        self._running = True
        asyncio.create_task(self._connect_loop())

    async def stop(self) -> None:
        self._running = False
        if self._process is not None:
            self._process.kill()
            await self._process.wait()

    async def _connect_loop(self) -> None:
        while self._running:
            try:
                self._process = await asyncio.create_subprocess_exec(
                    "adb", "shell", "cat", "/dev/input/event0",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                self.connected = True
                if self._on_connected is not None:
                    self._on_connected()
                await self._read_loop()
            except Exception:
                pass
            self.connected = False
            if self._running:
                await asyncio.sleep(RECONNECT_DELAY)

    async def _read_loop(self) -> None:
        assert self._process is not None
        assert self._process.stdout is not None
        buf = b""
        while True:
            chunk = await self._process.stdout.read(EVENT_SIZE * 4)
            if not chunk:
                break
            buf += chunk
            while len(buf) >= EVENT_SIZE:
                raw = buf[:EVENT_SIZE]
                buf = buf[EVENT_SIZE:]
                _tv_sec, _tv_usec, ev_type, ev_code, ev_value = struct.unpack(
                    EVENT_FORMAT, raw
                )
                if ev_type != EV_KEY:
                    continue
                action = KEY_MAP.get(ev_code)
                if action is None:
                    continue
                self._on_button(action, ev_value == 1)
