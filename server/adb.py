from __future__ import annotations

import argparse
import subprocess
import time
from typing import Callable, Iterable, List, Sequence


AdbRunner = Callable[[List[str]], subprocess.CompletedProcess[str]]
SleepFn = Callable[[float], None]


def parse_adb_devices(output: str) -> List[str]:
    devices = []
    for line in output.splitlines():
        if "\tdevice" in line:
            devices.append(line.split("\t", 1)[0])
    return devices


def list_devices(run: AdbRunner | None = None) -> List[str]:
    runner = run or _run_adb
    completed = runner(["adb", "devices"])
    return parse_adb_devices(completed.stdout)


def wait_for_online_device(
    run: AdbRunner | None = None,
    sleep: SleepFn = time.sleep,
    attempts: int = 30,
    interval: float = 1.0,
) -> str:
    runner = run or _run_adb
    for _ in range(attempts):
        devices = list_devices(run=runner)
        if devices:
            return devices[0]
        sleep(interval)
    raise RuntimeError("No online adb device detected")


def ensure_reverse_ports(ports: Sequence[str], run: AdbRunner | None = None) -> None:
    runner = run or _run_adb
    for port in ports:
        runner(["adb", "reverse", "tcp:{0}".format(port), "tcp:{0}".format(port)])


def should_refresh_reverse(previous_devices: Sequence[str], current_devices: Sequence[str]) -> bool:
    return bool(current_devices) and list(previous_devices) != list(current_devices)


def watch_reverse(ports: Sequence[str], poll_interval: float = 2.0) -> None:
    previous_devices: List[str] = []
    while True:
        current_devices = list_devices()
        if should_refresh_reverse(previous_devices, current_devices):
            ensure_reverse_ports(ports)
        previous_devices = current_devices
        time.sleep(poll_interval)


def _run_adb(command: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=False, capture_output=True, text=True)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ThingOS adb helpers")
    subparsers = parser.add_subparsers(dest="command", required=True)

    wait_parser = subparsers.add_parser("wait", help="Wait until an adb device is online")
    wait_parser.add_argument("--attempts", type=int, default=30)
    wait_parser.add_argument("--interval", type=float, default=1.0)

    reverse_parser = subparsers.add_parser("reverse", help="Create adb reverse mappings")
    reverse_parser.add_argument("ports", nargs="+")

    watch_parser = subparsers.add_parser("watch-reverse", help="Recreate adb reverse mappings after reconnect")
    watch_parser.add_argument("ports", nargs="+")
    watch_parser.add_argument("--interval", type=float, default=2.0)

    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.command == "wait":
        wait_for_online_device(attempts=args.attempts, interval=args.interval)
        return 0

    if args.command == "reverse":
        ensure_reverse_ports(args.ports)
        return 0

    watch_reverse(args.ports, poll_interval=args.interval)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
