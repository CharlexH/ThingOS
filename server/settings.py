from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import subprocess
from typing import Callable, Dict, List, Optional, Sequence

from .adb import ensure_reverse_ports, list_devices


CommandRunner = Callable[[List[str]], subprocess.CompletedProcess[str]]

BACKLIGHT_PATH = "/sys/class/backlight/aml-bl/brightness"
BACKLIGHT_MAX_PATH = "/sys/class/backlight/aml-bl/max_brightness"
ALS_PATH = "/sys/bus/iio/devices/iio:device0/in_illuminance0_input"
DEVICE_MODEL_PATH = "/proc/device-tree/model"
OS_RELEASE_PATH = "/etc/os-release"


@dataclass
class SettingsActionResult:
    ok: bool
    action: str
    message: str

    def to_payload(self) -> Dict[str, object]:
        return {"ok": self.ok, "action": self.action, "message": self.message}


class ThingOSSettingsService:
    def __init__(
        self,
        run: CommandRunner | None = None,
        list_devices_fn: Callable[[], List[str]] = list_devices,
        ensure_reverse_fn: Callable[[Sequence[str]], None] = ensure_reverse_ports,
    ) -> None:
        self._run = run or _run
        self._list_devices = list_devices_fn
        self._ensure_reverse = ensure_reverse_fn
        self._auto_brightness_enabled = False
        self._last_auto_brightness: Optional[int] = None

    def get_state(self, ws_connected: bool = False) -> Dict[str, object]:
        bluetooth = self._read_bluetooth_state()
        display = self._read_display_state()
        return {
            "bluetooth": bluetooth,
            "display": display,
            "device": self._read_device_state(ws_connected),
            "developer": self._read_developer_state(),
        }

    def set_value(self, section: str, key: str, value: object) -> Dict[str, object]:
        if section == "display" and key == "brightness":
            self._write_int(BACKLIGHT_PATH, int(value))
            self._last_auto_brightness = None
            return SettingsActionResult(True, "display.brightness", "Brightness updated").to_payload()
        if section == "display" and key == "autoBrightness":
            self._auto_brightness_enabled = bool(value)
            if self._auto_brightness_enabled:
                self._apply_auto_brightness()
            return SettingsActionResult(True, "display.autoBrightness", "Auto brightness updated").to_payload()
        if section == "bluetooth" and key == "enabled":
            self._run_bluetooth_commands(["power on" if bool(value) else "power off"])
            return SettingsActionResult(True, "bluetooth.enabled", "Bluetooth power updated").to_payload()
        return SettingsActionResult(False, "{0}.{1}".format(section, key), "Unsupported setting").to_payload()

    def run_action(self, action: str, params: Optional[Dict[str, str]] = None) -> Dict[str, object]:
        parameters = params or {}
        if action == "bluetooth_scan":
            self._run_bluetooth_commands(["scan on"], timeout=4)
            return SettingsActionResult(True, action, "Scan complete").to_payload()
        if action == "bluetooth_pair_connect":
            device_id = parameters.get("id", "")
            self._run_bluetooth_commands(
                ["pair {0}".format(device_id), "trust {0}".format(device_id), "connect {0}".format(device_id)],
                timeout=20,
            )
            return SettingsActionResult(True, action, "Device paired").to_payload()
        if action == "bluetooth_connect":
            device_id = parameters.get("id", "")
            self._run_bluetooth_commands(["connect {0}".format(device_id)], timeout=15)
            return SettingsActionResult(True, action, "Device connected").to_payload()
        if action == "bluetooth_disconnect":
            device_id = parameters.get("id", "")
            self._run_bluetooth_commands(["disconnect {0}".format(device_id)], timeout=15)
            return SettingsActionResult(True, action, "Device disconnected").to_payload()
        if action == "bluetooth_forget":
            device_id = parameters.get("id", "")
            self._run_bluetooth_commands(["remove {0}".format(device_id)], timeout=15)
            return SettingsActionResult(True, action, "Device forgotten").to_payload()
        if action == "recreate_reverse_ports":
            self._ensure_reverse(("8765", "8766"))
            return SettingsActionResult(True, action, "Reverse ports recreated").to_payload()
        if action == "restart_chromium":
            self._restart_chromium()
            return SettingsActionResult(True, action, "Chromium restarted").to_payload()
        if action == "reload_frontend":
            self._reload_frontend()
            return SettingsActionResult(True, action, "Frontend reloaded").to_payload()
        return SettingsActionResult(False, action, "Unsupported action").to_payload()

    def poll(self) -> None:
        if self._auto_brightness_enabled:
            self._apply_auto_brightness()

    def _read_bluetooth_state(self) -> Dict[str, object]:
        show_output = self._run(["adb", "shell", "bluetoothctl", "show"]).stdout
        enabled = "Powered: yes" in show_output
        discovering = "Discovering: yes" in show_output
        paired = self._parse_device_list(
            self._run_bluetooth_commands(["paired-devices"], timeout=5, capture_only=True)
        )
        scanned = self._parse_device_list(
            self._run_bluetooth_commands(["devices"], timeout=5, capture_only=True)
        )
        paired_lookup = {device["id"]: device for device in paired}
        merged_scanned = []
        for device in scanned:
            details = self._read_bluetooth_device_details(device["id"])
            merged_scanned.append({**device, **details, "paired": device["id"] in paired_lookup})
        merged_paired = []
        for device in paired:
            details = self._read_bluetooth_device_details(device["id"])
            merged_paired.append({**device, **details, "paired": True})
        return {
            "enabled": enabled,
            "discovering": discovering,
            "pairedDevices": merged_paired,
            "scannedDevices": merged_scanned,
        }

    def _read_display_state(self) -> Dict[str, object]:
        brightness = self._read_int(BACKLIGHT_PATH, 0)
        max_brightness = self._read_int(BACKLIGHT_MAX_PATH, 255)
        ambient_lux = self._read_int(ALS_PATH, None)
        return {
            "brightness": brightness,
            "maxBrightness": max_brightness,
            "autoBrightness": self._auto_brightness_enabled,
            "ambientLux": ambient_lux,
        }

    def _read_device_state(self, ws_connected: bool) -> Dict[str, object]:
        model = self._read_file(DEVICE_MODEL_PATH).strip() or "Car Thing"
        system_version = self._read_os_release_pretty_name()
        serial = self._run(["adb", "get-serialno"]).stdout.strip()
        ip_address = self._read_ip_address()
        adb_connected = bool(self._list_devices())
        return {
            "model": model,
            "systemVersion": system_version,
            "serial": serial,
            "ipAddress": ip_address,
            "adbConnected": adb_connected,
            "wsConnected": ws_connected,
        }

    def _read_developer_state(self) -> Dict[str, object]:
        adb_connected = bool(self._list_devices())
        reverse_ports = self._read_reverse_ports()
        bluetooth_ps = self._run(["adb", "shell", "sh", "-lc", "ps | grep bluetoothd || true"]).stdout
        return {
            "adbConnected": adb_connected,
            "reversePorts": reverse_ports,
            "bluetoothDaemonRunning": "bluetoothd" in bluetooth_ps,
        }

    def _read_reverse_ports(self) -> List[str]:
        output = self._run(["adb", "reverse", "--list"]).stdout
        ports: List[str] = []
        for line in output.splitlines():
            match = re.search(r"tcp:(\d+)\s+tcp:(\d+)", line)
            if match and match.group(1) == match.group(2):
                ports.append(match.group(1))
        return ports

    def _read_bluetooth_device_details(self, device_id: str) -> Dict[str, object]:
        output = self._run_bluetooth_commands(["info {0}".format(device_id)], timeout=5, capture_only=True)
        return {
            "connected": "Connected: yes" in output,
            "trusted": "Trusted: yes" in output,
        }

    def _parse_device_list(self, output: str) -> List[Dict[str, object]]:
        devices: List[Dict[str, object]] = []
        for line in output.splitlines():
            if not line.startswith("Device "):
                continue
            parts = line.split(" ", 2)
            if len(parts) < 3:
                continue
            devices.append(
                {
                    "id": parts[1],
                    "name": parts[2],
                    "paired": False,
                    "connected": False,
                    "trusted": False,
                }
            )
        return devices

    def _run_bluetooth_commands(
        self, commands: List[str], timeout: int = 8, capture_only: bool = False
    ) -> str:
        escaped = "\\n".join(commands + ["quit"]).replace("'", "'\"'\"'")
        completed = self._run(
            [
                "adb",
                "shell",
                "sh",
                "-lc",
                "printf '{0}\\n' | bluetoothctl --timeout {1}".format(escaped, timeout),
            ]
        )
        return completed.stdout if capture_only else completed.stdout

    def _write_int(self, path: str, value: int) -> None:
        self._run(["adb", "shell", "sh", "-lc", "echo {0} > {1}".format(max(0, value), path)])

    def _read_int(self, path: str, default: Optional[int]) -> Optional[int]:
        raw = self._read_file(path).strip()
        if not raw:
            return default
        try:
            return int(raw)
        except ValueError:
            return default

    def _read_file(self, path: str) -> str:
        return self._run(["adb", "shell", "cat", path]).stdout

    def _read_os_release_pretty_name(self) -> str:
        output = self._read_file(OS_RELEASE_PATH)
        for line in output.splitlines():
            if line.startswith("PRETTY_NAME="):
                return line.split("=", 1)[1].strip().strip('"')
        return "Unknown"

    def _read_ip_address(self) -> str:
        output = self._run(
            [
                "adb",
                "shell",
                "sh",
                "-lc",
                "ip -o -4 addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1",
            ]
        ).stdout.strip()
        return output

    def _apply_auto_brightness(self) -> None:
        display = self._read_display_state()
        ambient = display["ambientLux"]
        max_brightness = int(display["maxBrightness"])
        if ambient is None:
            return
        target = self._brightness_for_lux(int(ambient), max_brightness)
        if self._last_auto_brightness == target:
            return
        self._write_int(BACKLIGHT_PATH, target)
        self._last_auto_brightness = target

    def _brightness_for_lux(self, lux: int, max_brightness: int) -> int:
        if lux <= 1:
            return max(20, int(max_brightness * 0.12))
        if lux <= 5:
            return max(28, int(max_brightness * 0.2))
        if lux <= 20:
            return int(max_brightness * 0.38)
        if lux <= 80:
            return int(max_brightness * 0.58)
        if lux <= 200:
            return int(max_brightness * 0.78)
        return max_brightness

    def _restart_chromium(self) -> None:
        completed = self._run(["adb", "shell", "supervisorctl", "restart", "chromium"])
        if completed.returncode == 0:
            return
        self._run(["adb", "shell", "supervisorctl", "start", "chromium"])

    def _reload_frontend(self) -> None:
        script_path = Path(__file__).resolve().parents[1] / "scripts" / "setup-device.sh"
        subprocess.run(["bash", str(script_path)], check=True, capture_output=True, text=True)


def _run(command: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=False, capture_output=True, text=True)
