#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

cd "${ROOT_DIR}"

"${PYTHON_BIN}" -m pip install py2app >/dev/null
rm -rf build dist
"${PYTHON_BIN}" setup.py py2app

echo "Built: ${ROOT_DIR}/dist/ThingPlayer.app"
