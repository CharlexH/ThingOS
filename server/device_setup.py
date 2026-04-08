from __future__ import annotations

import subprocess
from typing import Callable, List


THINGPLAYER_DIR = "/var/lib/thingplayer"
WEBAPP_DIR = "/usr/share/qt-superbird-app/webapp"

Runner = Callable[[List[str]], subprocess.CompletedProcess]


def needs_bind_mount(mount_output: str) -> bool:
    for line in mount_output.splitlines():
        if " on {0} ".format(WEBAPP_DIR) in line:
            return " (rw" not in line
    return True


def ensure_bind_mount(run: Runner | None = None) -> None:
    runner = run or _run
    mounted = runner(["mount"])
    if needs_bind_mount(mounted.stdout):
        runner(["mount", "-o", "bind", THINGPLAYER_DIR, WEBAPP_DIR])


def restart_chromium(run: Runner | None = None) -> None:
    runner = run or _run
    try:
        runner(["supervisorctl", "restart", "chromium"])
    except subprocess.CalledProcessError as error:
        if error.returncode != 7:
            raise
        runner(["supervisorctl", "start", "chromium"])


def _run(command: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True)


def main() -> int:
    ensure_bind_mount()
    restart_chromium()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
