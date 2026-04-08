import subprocess
import unittest

from server.adb import (
    ensure_reverse_ports,
    parse_adb_devices,
    should_refresh_reverse,
    wait_for_online_device,
)


def _completed(stdout: str) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=["adb", "devices"], returncode=0, stdout=stdout, stderr="")


class ParseAdbDevicesTests(unittest.TestCase):
    def test_extracts_online_devices(self) -> None:
        devices = parse_adb_devices(
            "\n".join(
                [
                    "List of devices attached",
                    "8550RS88QQ19\tdevice",
                    "localhost:8891\toffline",
                ]
            )
        )

        self.assertEqual(devices, ["8550RS88QQ19"])


class WaitForOnlineDeviceTests(unittest.TestCase):
    def test_retries_until_a_device_is_online(self) -> None:
        outputs = iter(
            [
                _completed("List of devices attached\n\n"),
                _completed("List of devices attached\n8550RS88QQ19\tdevice\n"),
            ]
        )
        sleeps = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            self.assertEqual(command, ["adb", "devices"])
            return next(outputs)

        serial = wait_for_online_device(run=runner, sleep=sleeps.append, attempts=3, interval=0.5)

        self.assertEqual(serial, "8550RS88QQ19")
        self.assertEqual(sleeps, [0.5])

    def test_raises_when_device_never_appears(self) -> None:
        def runner(_command: list[str]) -> subprocess.CompletedProcess[str]:
            return _completed("List of devices attached\n\n")

        with self.assertRaisesRegex(RuntimeError, "No online adb device detected"):
            wait_for_online_device(run=runner, sleep=lambda _seconds: None, attempts=2, interval=0.1)


class EnsureReversePortsTests(unittest.TestCase):
    def test_runs_reverse_for_each_requested_port(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            return subprocess.CompletedProcess(args=command, returncode=0, stdout="", stderr="")

        ensure_reverse_ports(["8765", "8766"], run=runner)

        self.assertEqual(
            commands,
            [
                ["adb", "reverse", "tcp:8765", "tcp:8765"],
                ["adb", "reverse", "tcp:8766", "tcp:8766"],
            ],
        )


class ShouldRefreshReverseTests(unittest.TestCase):
    def test_refreshes_when_device_reconnects(self) -> None:
        self.assertTrue(should_refresh_reverse([], ["8550RS88QQ19"]))

    def test_skips_refresh_when_same_device_stays_online(self) -> None:
        self.assertFalse(should_refresh_reverse(["8550RS88QQ19"], ["8550RS88QQ19"]))

    def test_skips_refresh_when_everything_is_offline(self) -> None:
        self.assertFalse(should_refresh_reverse(["8550RS88QQ19"], []))


if __name__ == "__main__":
    unittest.main()
