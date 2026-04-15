import subprocess
import unittest

from server.settings import ALS_PATH, BACKLIGHT_MAX_PATH, BACKLIGHT_PATH, ThingOSSettingsService


def _completed(command: list[str], stdout: str = "", returncode: int = 0) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=command, returncode=returncode, stdout=stdout, stderr="")


class ThingOSSettingsServiceTests(unittest.TestCase):
    def test_reads_display_and_developer_state(self) -> None:
        commands = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            commands.append(command)
            joined = " ".join(command)
            if BACKLIGHT_PATH in joined:
                return _completed(command, "131\n")
            if BACKLIGHT_MAX_PATH in joined:
                return _completed(command, "255\n")
            if ALS_PATH in joined:
                return _completed(command, "4\n")
            if "cat /proc/device-tree/model" in joined:
                return _completed(command, "Car Thing\n")
            if "cat /etc/os-release" in joined:
                return _completed(command, 'PRETTY_NAME="Buildroot 2019.02.1"\n')
            if command == ["adb", "get-serialno"]:
                return _completed(command, "ABC123\n")
            if "ip -o -4 addr show scope global" in joined:
                return _completed(command, "192.168.1.2\n")
            if command == ["adb", "reverse", "--list"]:
                return _completed(command, "device tcp:8765 tcp:8765\ndevice tcp:8766 tcp:8766\n")
            if "ps | grep bluetoothd" in joined:
                return _completed(command, "1791 root 0:00 /usr/libexec/bluetooth/bluetoothd\n")
            if "bluetoothctl show" in joined:
                return _completed(command, "Powered: yes\nDiscovering: no\n")
            if "paired-devices" in joined or "devices" in joined:
                return _completed(command, "")
            return _completed(command, "")

        service = ThingOSSettingsService(
          run=runner,
          list_devices_fn=lambda: ["8550RS88QQ19"],
          ensure_reverse_fn=lambda _ports: None,
        )

        state = service.get_state(ws_connected=True)

        self.assertEqual(state["display"]["brightness"], 131)
        self.assertEqual(state["display"]["maxBrightness"], 255)
        self.assertEqual(state["display"]["ambientLux"], 4)
        self.assertEqual(state["device"]["serial"], "ABC123")
        self.assertEqual(state["developer"]["reversePorts"], ["8765", "8766"])
        self.assertTrue(state["device"]["wsConnected"])

    def test_toggles_auto_brightness_in_memory(self) -> None:
        writes = []

        def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
            joined = " ".join(command)
            if BACKLIGHT_PATH in joined and "echo" not in joined:
                return _completed(command, "120\n")
            if BACKLIGHT_MAX_PATH in joined:
                return _completed(command, "255\n")
            if ALS_PATH in joined:
                return _completed(command, "4\n")
            if "echo" in joined and BACKLIGHT_PATH in joined:
                writes.append(command)
            if "bluetoothctl show" in joined:
                return _completed(command, "Powered: yes\nDiscovering: no\n")
            if "paired-devices" in joined or "devices" in joined:
                return _completed(command, "")
            if "cat /proc/device-tree/model" in joined:
                return _completed(command, "Car Thing\n")
            if "cat /etc/os-release" in joined:
                return _completed(command, 'PRETTY_NAME="Buildroot 2019.02.1"\n')
            if command == ["adb", "get-serialno"]:
                return _completed(command, "ABC123\n")
            if "ip -o -4 addr show scope global" in joined:
                return _completed(command, "192.168.1.2\n")
            if command == ["adb", "reverse", "--list"]:
                return _completed(command, "")
            if "ps | grep bluetoothd" in joined:
                return _completed(command, "")
            return _completed(command, "")

        service = ThingOSSettingsService(
          run=runner,
          list_devices_fn=lambda: ["8550RS88QQ19"],
          ensure_reverse_fn=lambda _ports: None,
        )

        result = service.set_value("display", "autoBrightness", True)

        self.assertTrue(result["ok"])
        self.assertTrue(writes)

    def test_recreates_reverse_ports_through_injected_helper(self) -> None:
        refreshed = []
        service = ThingOSSettingsService(
          run=lambda command: _completed(command, ""),
          list_devices_fn=lambda: ["8550RS88QQ19"],
          ensure_reverse_fn=lambda ports: refreshed.append(tuple(ports)),
        )

        result = service.run_action("recreate_reverse_ports")

        self.assertTrue(result["ok"])
        self.assertEqual(refreshed, [("8765", "8766")])


if __name__ == "__main__":
    unittest.main()
