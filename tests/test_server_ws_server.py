import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from server.ws_server import ThingPlayerServer


class _FakeSpotify:
    def get_state(self):
        raise AssertionError("get_state should not be called in button routing tests")

    def execute_command(self, action, value=None):
        raise AssertionError(
            "execute_command should not be called directly in button routing tests: {action} {value}".format(
                action=action, value=value
            )
        )


class _FakeSettings:
    def get_state(self, ws_connected: bool = False):
        return {
            "bluetooth": {
                "enabled": True,
                "discovering": False,
                "pairedDevices": [],
                "scannedDevices": [],
            },
            "display": {
                "brightness": 120,
                "maxBrightness": 255,
                "autoBrightness": False,
                "ambientLux": 4,
            },
            "device": {
                "model": "Car Thing",
                "systemVersion": "Buildroot",
                "serial": "ABC123",
                "ipAddress": "192.168.1.2",
                "adbConnected": True,
                "wsConnected": ws_connected,
            },
            "developer": {
                "adbConnected": True,
                "reversePorts": ["8765", "8766"],
                "bluetoothDaemonRunning": True,
            },
        }

    def set_value(self, section, key, value):
        return {"ok": True, "action": "{0}.{1}".format(section, key), "message": str(value)}

    def run_action(self, action, params=None):
        return {"ok": True, "action": action, "message": "done"}

    def poll(self):
        return None


class ThingPlayerServerButtonTests(unittest.IsolatedAsyncioTestCase):
    async def test_preset_buttons_only_broadcast_events(self) -> None:
        server = ThingPlayerServer(_FakeSpotify())
        server._broadcast = AsyncMock()  # type: ignore[method-assign]
        server._handle_command = AsyncMock()  # type: ignore[method-assign]

        with patch(
            "server.ws_server.asyncio.ensure_future",
            side_effect=lambda coro: asyncio.create_task(coro),
        ):
            server._on_hardware_button("preset2", True)
            await asyncio.sleep(0)

        server._broadcast.assert_awaited_once_with({"type": "button", "data": {"button": "preset2"}})
        server._handle_command.assert_not_awaited()

    async def test_knob_press_still_triggers_playpause(self) -> None:
        server = ThingPlayerServer(_FakeSpotify())
        server._broadcast = AsyncMock()  # type: ignore[method-assign]
        server._handle_command = AsyncMock()  # type: ignore[method-assign]

        with patch(
            "server.ws_server.asyncio.ensure_future",
            side_effect=lambda coro: asyncio.create_task(coro),
        ):
            server._on_hardware_button("knob_press", True)
            await asyncio.sleep(0)

        server._broadcast.assert_awaited_once_with({"type": "button", "data": {"button": "knob_press"}})
        server._handle_command.assert_awaited_once_with({"action": "playpause"})


class ThingPlayerServerSettingsTests(unittest.IsolatedAsyncioTestCase):
    async def test_settings_get_sends_current_settings_state(self) -> None:
        server = ThingPlayerServer(_FakeSpotify(), settings=_FakeSettings())

        class _FakeWebSocket:
            def __init__(self):
                self.messages = []

            async def send(self, message: str) -> None:
                self.messages.append(message)

        websocket = _FakeWebSocket()

        await server._handle_settings_message(websocket, {"type": "settings_get"})

        self.assertEqual(len(websocket.messages), 1)
        payload = json.loads(websocket.messages[0])
        self.assertEqual(payload["type"], "settings_state")
        self.assertEqual(payload["data"]["display"]["brightness"], 120)

    async def test_settings_action_returns_result_and_refreshed_state(self) -> None:
        server = ThingPlayerServer(_FakeSpotify(), settings=_FakeSettings())

        class _FakeWebSocket:
            def __init__(self):
                self.messages = []

            async def send(self, message: str) -> None:
                self.messages.append(message)

        websocket = _FakeWebSocket()

        await server._handle_settings_message(
            websocket, {"type": "settings_action", "action": "restart_chromium"}
        )

        self.assertEqual(len(websocket.messages), 2)
        result_payload = json.loads(websocket.messages[0])
        state_payload = json.loads(websocket.messages[1])
        self.assertEqual(result_payload["type"], "settings_result")
        self.assertEqual(result_payload["data"]["action"], "restart_chromium")
        self.assertEqual(state_payload["type"], "settings_state")


if __name__ == "__main__":
    unittest.main()
