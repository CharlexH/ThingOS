import json
import tempfile
import unittest
from pathlib import Path

from server.agent import _build_pomodoro_menu_item
from server.preferences import PreferencesService


class PomodoroMenuDefaultTests(unittest.TestCase):
    def test_defaults_to_off(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            prefs = PreferencesService(config_path=Path(d) / "config.json")

            item = _build_pomodoro_menu_item(prefs, lambda enabled: None)

            self.assertFalse(item.state)

    def test_reads_saved_enabled_state(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            config = Path(d) / "config.json"
            config.write_text(json.dumps({"pomodoro.enabled": True}), encoding="utf-8")
            prefs = PreferencesService(config_path=config)

            item = _build_pomodoro_menu_item(prefs, lambda enabled: None)

            self.assertTrue(item.state)


class PomodoroMenuCallbackTests(unittest.TestCase):
    def test_callback_toggles_between_on_and_off(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            prefs = PreferencesService(config_path=Path(d) / "config.json")
            toggled: list[bool] = []

            item = _build_pomodoro_menu_item(prefs, toggled.append)

            item.callback(item)
            item.callback(item)

            self.assertEqual(toggled, [True, False])
            self.assertFalse(item.state)


if __name__ == "__main__":
    unittest.main()
