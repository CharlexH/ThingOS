import unittest

from server.agent import derive_status_label, parse_adb_devices


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


class DeriveStatusLabelTests(unittest.TestCase):
    def test_reports_waiting_when_no_device_is_connected(self) -> None:
        self.assertEqual(derive_status_label([], "idle"), "Waiting for device")

    def test_reports_ready_when_device_and_spotify_are_active(self) -> None:
        self.assertEqual(derive_status_label(["8550RS88QQ19"], "ok"), "Spotify ready")


if __name__ == "__main__":
    unittest.main()
