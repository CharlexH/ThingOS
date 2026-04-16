import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from server.ws_server import ThingOSServer


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


class _FakePreferences:
    def __init__(self, enabled: bool = False) -> None:
        self.enabled = enabled

    def get_pomodoro_enabled(self) -> bool:
        return self.enabled

    def set_pomodoro_enabled(self, enabled: bool) -> None:
        self.enabled = enabled

    def to_client_payload(self):
        return {"pomodoroEnabled": self.enabled}


class ThingOSServerButtonTests(unittest.IsolatedAsyncioTestCase):
    async def test_preset_buttons_only_broadcast_events(self) -> None:
        server = ThingOSServer(_FakeSpotify())
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

    async def test_knob_press_only_broadcasts_the_button_event(self) -> None:
        server = ThingOSServer(_FakeSpotify())
        server._broadcast = AsyncMock()  # type: ignore[method-assign]
        server._handle_command = AsyncMock()  # type: ignore[method-assign]

        with patch(
            "server.ws_server.asyncio.ensure_future",
            side_effect=lambda coro: asyncio.create_task(coro),
        ):
            server._on_hardware_button("knob_press", True)
            await asyncio.sleep(0)

        server._broadcast.assert_awaited_once_with({"type": "button", "data": {"button": "knob_press"}})
        server._handle_command.assert_not_awaited()


class ThingOSServerSettingsTests(unittest.IsolatedAsyncioTestCase):
    async def test_settings_get_sends_current_settings_state(self) -> None:
        server = ThingOSServer(_FakeSpotify(), settings=_FakeSettings())

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
        server = ThingOSServer(_FakeSpotify(), settings=_FakeSettings())

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


class ThingOSServerPreferencesTests(unittest.IsolatedAsyncioTestCase):
    async def test_handle_client_sends_preferences_after_state(self) -> None:
        server = ThingOSServer(_FakeSpotify(), settings=_FakeSettings(), preferences=_FakePreferences(True))

        class _FakeWebSocket:
            def __init__(self):
                self.messages = []

            async def send(self, message: str) -> None:
                self.messages.append(json.loads(message))

            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        websocket = _FakeWebSocket()

        await server._handle_client(websocket)

        self.assertEqual([message["type"] for message in websocket.messages], ["state", "preferences_state"])
        self.assertEqual(websocket.messages[1]["data"], {"pomodoroEnabled": True})

    async def test_set_pomodoro_enabled_persists_and_broadcasts(self) -> None:
        preferences = _FakePreferences(False)
        server = ThingOSServer(_FakeSpotify(), settings=_FakeSettings(), preferences=preferences)
        server._broadcast = AsyncMock()  # type: ignore[method-assign]
        server._loop = asyncio.get_running_loop()  # type: ignore[attr-defined]

        server.set_pomodoro_enabled(True)
        await asyncio.sleep(0)

        self.assertTrue(preferences.enabled)
        server._broadcast.assert_awaited_once_with(
            {"type": "preferences_state", "data": {"pomodoroEnabled": True}}
        )


if __name__ == "__main__":
    unittest.main()
