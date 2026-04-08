#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

cd "$ROOT_DIR/client"
npm run build

cd "$ROOT_DIR"
"${PYTHON_BIN}" -m server.adb wait --attempts 60 --interval 1
adb shell mkdir -p /var/lib/thingplayer
adb push "$ROOT_DIR/client/dist/." /var/lib/thingplayer/
bash "$ROOT_DIR/scripts/setup-device.sh"
