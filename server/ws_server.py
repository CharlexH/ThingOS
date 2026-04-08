from __future__ import annotations

import asyncio
import json
import time
from dataclasses import replace
from typing import Callable, Optional, Set

import websockets
from websockets.server import WebSocketServerProtocol

from .input_bridge import InputBridge
from .settings import ThingPlayerSettingsService
from .spotify import SpotifyController, compute_delta, serialize_state_message
from .types import EMPTY_STATE, PlaybackState


class ThingPlayerServer:
    def __init__(
        self,
        spotify: SpotifyController,
        settings: ThingPlayerSettingsService | None = None,
        artwork_base_url: str = "http://127.0.0.1:8766",
        poll_interval: float = 0.5,
        on_bridge_connected: Optional[Callable[[], None]] = None,
    ) -> None:
        self._spotify = spotify
        self._settings = settings or ThingPlayerSettingsService()
        self._artwork_base_url = artwork_base_url
        self._poll_interval = poll_interval
        self._clients: Set[WebSocketServerProtocol] = set()
        self._state: PlaybackState = EMPTY_STATE
        self._poll_task: Optional[asyncio.Task[None]] = None
        self._input_bridge = InputBridge(self._on_hardware_button, on_connected=on_bridge_connected)

    def _on_hardware_button(self, button: str, pressed: bool) -> None:
        if not pressed:
            return
        payload = {"type": "button", "data": {"button": button}}
        asyncio.ensure_future(self._broadcast(payload))

    async def start(self, host: str = "127.0.0.1", port: int = 8765) -> None:
        await self._input_bridge.start()
        async with websockets.serve(self._handle_client, host, port):
            self._poll_task = asyncio.create_task(self._poll_loop())
            await asyncio.Future()

    async def _handle_client(self, websocket: WebSocketServerProtocol) -> None:
        self._clients.add(websocket)
        await websocket.send(json.dumps(serialize_state_message(self._state, self._artwork_base_url)))
        try:
            async for raw_message in websocket:
                message = json.loads(raw_message)
                if message.get("type") == "cmd":
                    await self._handle_command(message)
                elif str(message.get("type", "")).startswith("settings_"):
                    await self._handle_settings_message(websocket, message)
        finally:
            self._clients.discard(websocket)

    async def _handle_command(self, message: dict) -> None:
        action = message.get("action")
        value = message.get("value")
        await asyncio.to_thread(self._spotify.execute_command, action, value)
        if action == "volume" and value is not None:
            self._state = replace(self._state, volume=int(value), ts=int(time.time() * 1000))
            await self._broadcast(serialize_state_message(self._state, self._artwork_base_url))
        else:
            await self._refresh_state(force_full=True)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.to_thread(self._settings.poll)
            await self._refresh_state(force_full=False)
            await asyncio.sleep(self._poll_interval)

    async def _handle_settings_message(self, websocket: WebSocketServerProtocol, message: dict) -> None:
        message_type = message.get("type")
        if message_type == "settings_get":
            await websocket.send(
                json.dumps({"type": "settings_state", "data": await asyncio.to_thread(self._settings.get_state, True)})
            )
            return
        if message_type == "settings_set":
            result = await asyncio.to_thread(
                self._settings.set_value,
                str(message.get("section", "")),
                str(message.get("key", "")),
                message.get("value"),
            )
            await websocket.send(json.dumps({"type": "settings_result", "data": result}))
            await websocket.send(
                json.dumps({"type": "settings_state", "data": await asyncio.to_thread(self._settings.get_state, True)})
            )
            return
        if message_type == "settings_action":
            result = await asyncio.to_thread(
                self._settings.run_action,
                str(message.get("action", "")),
                message.get("params"),
            )
            await websocket.send(json.dumps({"type": "settings_result", "data": result}))
            await websocket.send(
                json.dumps({"type": "settings_state", "data": await asyncio.to_thread(self._settings.get_state, True)})
            )

    async def _refresh_state(self, force_full: bool) -> None:
        new_state = await asyncio.to_thread(self._spotify.get_state)
        if force_full:
            self._state = new_state
            await self._broadcast(serialize_state_message(new_state, self._artwork_base_url))
            return

        delta = compute_delta(self._state, new_state)
        self._state = new_state
        if delta is not None:
            await self._broadcast({"type": "delta", "data": delta})
            return

        await self._broadcast(serialize_state_message(new_state, self._artwork_base_url))

    async def _broadcast(self, payload: dict) -> None:
        if not self._clients:
            return
        message = json.dumps(payload)
        await asyncio.gather(
            *[client.send(message) for client in tuple(self._clients)],
            return_exceptions=True,
        )
