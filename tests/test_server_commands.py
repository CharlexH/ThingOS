import unittest

from unittest.mock import patch

from server.spotify import SpotifyController, build_command_script, build_repeat_toggle_script


class BuildCommandScriptTests(unittest.TestCase):
    def test_builds_volume_command(self) -> None:
        script = build_command_script("volume", 55)

        self.assertIn("set sound volume to 55", script)

    def test_builds_repeat_toggle_command(self) -> None:
        script = build_repeat_toggle_script(enable_single_repeat=True)

        self.assertEqual(script.count('keystroke "r" using command down'), 2)
        self.assertIn('tell application "Spotify" to activate', script)

    def test_builds_repeat_disable_command(self) -> None:
        script = build_repeat_toggle_script(enable_single_repeat=False)

        self.assertEqual(script.count('keystroke "r" using command down'), 1)

    def test_repeat_command_toggles_local_single_repeat_mode(self) -> None:
        controller = SpotifyController()

        with patch("server.spotify._run_osascript") as run_osascript:
            controller.execute_command("repeat")
            first_script = run_osascript.call_args_list[0].args[0]
            self.assertTrue(controller._single_repeat_enabled)
            self.assertEqual(first_script.count('keystroke "r" using command down'), 2)

            controller.execute_command("repeat")
            second_script = run_osascript.call_args_list[1].args[0]
            self.assertFalse(controller._single_repeat_enabled)
            self.assertEqual(second_script.count('keystroke "r" using command down'), 1)


if __name__ == "__main__":
    unittest.main()
