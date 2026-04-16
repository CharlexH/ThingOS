from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger("thingos.preferences")

DEFAULT_CONFIG_DIR = Path.home() / ".thingos"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.json"
DEFAULT_POMODORO_ENABLED = False


class PreferencesService:
    def __init__(self, config_path: Path = DEFAULT_CONFIG_FILE) -> None:
        self._path = config_path
        self._pomodoro_enabled = DEFAULT_POMODORO_ENABLED
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to load preferences: %s", exc)
            return

        self._pomodoro_enabled = bool(raw.get("pomodoro.enabled", DEFAULT_POMODORO_ENABLED))

    def _save(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"pomodoro.enabled": self._pomodoro_enabled}
            self._path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to save preferences: %s", exc)

    def get_pomodoro_enabled(self) -> bool:
        return self._pomodoro_enabled

    def set_pomodoro_enabled(self, enabled: bool) -> None:
        self._pomodoro_enabled = bool(enabled)
        self._save()

    def to_client_payload(self) -> dict[str, bool]:
        return {"pomodoroEnabled": self._pomodoro_enabled}
