#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

cd "$ROOT_DIR"

bash "$ROOT_DIR/scripts/setup-device.sh"
"${PYTHON_BIN}" -m server.adb reverse 8765 8766
"${PYTHON_BIN}" -m server.adb watch-reverse 8765 8766 --interval 2 &
ADB_WATCH_PID=$!

"${PYTHON_BIN}" -m server.main &
SERVER_PID=$!

cleanup() {
  kill "$ADB_WATCH_PID" >/dev/null 2>&1 || true
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "$ROOT_DIR/client"
npm run dev -- --host 0.0.0.0
