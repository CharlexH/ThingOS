import subprocess
import unittest
from unittest.mock import patch

import server.device_setup as device_setup
from server.device_setup import (
    WEBAPP_DIR,
    clear_chromium_cache,
    ensure_bind_mount,
    needs_bind_mount,
    restart_chromium,
)


def _completed(args: list[str], stdout: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=args, returncode=0, stdout=stdout, stderr="")


class NeedsBindMountTests(unittest.TestCase):
    def test_returns_true_when_target_is_not_mounted(self) -> None:
        self.assertTrue(needs_bind_mount("/dev/root on / type ext4 (ro,relatime)\n"))

    def test_returns_true_when_target_is_still_on_read_only_root(self) -> None:
        mount_output = "/dev/root on {0} type ext4 (ro,relatime)\n".format(WEBAPP_DIR)
        self.assertTrue(needs_bind_mount(mount_output))

    def test_returns_false_when_target_is_bind_mounted_rw(self) -> None:
        mount_output = "/dev/settings on {0} type ext4 (rw,relatime,data=ordered)\n".format(WEBAPP_DIR)
        self.assertFalse(needs_bind_mount(mount_output))


class EnsureBindMountTests(unittest.TestCase):
    def test_mounts_when_target_is_not_ready(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            if command == ["mount"]:
                return _completed(command, "/dev/root on / type ext4 (ro,relatime)\n")
            return _completed(command)

        ensure_bind_mount(run=runner)

        self.assertEqual(
            commands,
            [
                ["mount"],
                ["mount", "-o", "bind", "/var/lib/thingplayer", "/usr/share/qt-superbird-app/webapp"],
            ],
        )

    def test_skips_mount_when_target_is_already_bound(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            return _completed(
                command,
                "/dev/settings on {0} type ext4 (rw,relatime,data=ordered)\n".format(WEBAPP_DIR),
            )

        ensure_bind_mount(run=runner)

        self.assertEqual(commands, [["mount"]])


class RestartChromiumTests(unittest.TestCase):
    def test_restarts_chromium_via_supervisor(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            return _completed(command)

        restart_chromium(run=runner)

        self.assertEqual(commands, [["supervisorctl", "restart", "chromium"]])

    def test_starts_chromium_when_restart_reports_not_running(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            if command == ["supervisorctl", "restart", "chromium"]:
                raise subprocess.CalledProcessError(returncode=7, cmd=command, output="", stderr="")
            return _completed(command)

        restart_chromium(run=runner)

        self.assertEqual(
            commands,
            [
                ["supervisorctl", "restart", "chromium"],
                ["supervisorctl", "start", "chromium"],
            ],
        )


class ClearChromiumCacheTests(unittest.TestCase):
    def test_removes_cached_chromium_assets_before_restart(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            return _completed(command)

        clear_chromium_cache(run=runner)

        self.assertEqual(
            commands,
            [[
                "rm",
                "-rf",
                "/var/cache/chrome_storage/Default/Cache",
                "/var/cache/chrome_storage/Default/Code Cache",
                "/var/cache/chrome_storage/Default/GPUCache",
                "/var/cache/chrome_storage/ShaderCache/GPUCache",
                "/var/cache/cache/chrome_storage/Default/Cache",
                "/var/cache/cache/chrome_storage/Default/Code Cache",
            ]],
        )


class MainTests(unittest.TestCase):
    def test_main_clears_cache_before_restarting_chromium(self) -> None:
        steps: list[str] = []

        with patch.object(device_setup, "ensure_bind_mount", side_effect=lambda: steps.append("mount")), patch.object(
            device_setup,
            "clear_chromium_cache",
            side_effect=lambda: steps.append("cache"),
        ), patch.object(device_setup, "restart_chromium", side_effect=lambda: steps.append("restart")):
            self.assertEqual(device_setup.main(), 0)

        self.assertEqual(steps, ["mount", "cache", "restart"])


if __name__ == "__main__":
    unittest.main()
