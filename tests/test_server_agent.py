import json
import tempfile
import unittest
from pathlib import Path

from server.agent import _build_pomodoro_menu_item, _status_text
from server.preferences import PreferencesService


class StatusTextTests(unittest.TestCase):
    def test_reports_waiting_when_bridge_is_not_connected(self) -> None:
        self.assertEqual(_status_text(True, False, "idle"), "Waiting for Car Thing")

    def test_reports_playing_when_connected_and_ok(self) -> None:
        self.assertEqual(_status_text(True, True, "ok"), "Connected - Playing")


class PomodoroMenuItemTests(unittest.TestCase):
    def test_builds_menu_item_from_saved_preference(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            config = Path(d) / "config.json"
            config.write_text(json.dumps({"pomodoro.enabled": True}), encoding="utf-8")
            prefs = PreferencesService(config_path=config)

            item = _build_pomodoro_menu_item(prefs, lambda enabled: None)

            self.assertEqual(item.title, "Pomodoro Timer")
            self.assertTrue(item.state)

    def test_clicking_menu_item_toggles_state_and_calls_callback(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            prefs = PreferencesService(config_path=Path(d) / "config.json")
            seen: list[bool] = []

            item = _build_pomodoro_menu_item(prefs, seen.append)

            item.callback(item)
            self.assertTrue(item.state)
            self.assertEqual(seen, [True])

            item.callback(item)
            self.assertFalse(item.state)
            self.assertEqual(seen, [True, False])


if __name__ == "__main__":
    unittest.main()
