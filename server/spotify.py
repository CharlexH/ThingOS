from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from html import unescape
import re
import subprocess
import threading
import time
from typing import Dict, Optional, Set
from urllib.parse import quote
from urllib.request import urlopen

from .types import EMPTY_STATE, PlaybackState


STATUS_MAP = {
    "OK": "ok",
    "IDLE": "idle",
    "SPOTIFY_NOT_RUNNING": "spotify_not_running",
    "NO_TRACK": "no_track",
    "ERROR": "error",
}

FETCH_FIELDS = [
    "(name of current track as text)",
    "(artist of current track as text)",
    "(album of current track as text)",
    "(artwork url of current track as text)",
    "((player state is playing) as text)",
    "(((player position * 1000) as integer) as text)",
    "((duration of current track) as text)",
    "(sound volume as text)",
    "(shuffling as text)",
    "(repeating as text)",
    "(spotify url of current track as text)",
]


def parse_state_payload(payload: str, timestamp_ms: int) -> PlaybackState:
    parts = payload.split("\t") if payload else ["ERROR"]
    raw_status = parts[0]
    status = STATUS_MAP.get(raw_status, "error")

    if raw_status != "OK":
        return PlaybackState(
            status=status,
            track="",
            artist="",
            album="",
            artwork_url="",
            playing=False,
            position=0,
            duration=0,
            volume=0,
            shuffle=False,
            repeat=False,
            connected=True,
            ts=timestamp_ms,
        )

    return PlaybackState(
        status=status,
        track=parts[1],
        artist=parts[2],
        album=parts[3],
        artwork_url=parts[4],
        playing=parts[5] == "true",
        position=int(parts[6]),
        duration=int(parts[7]),
        volume=int(parts[8]),
        shuffle=parts[9] == "true",
        repeat=parts[10] == "true",
        connected=True,
        ts=timestamp_ms,
    )


def compute_delta(previous: PlaybackState, current: PlaybackState) -> Optional[Dict[str, int]]:
    if _same_snapshot(previous, current) and previous.position != current.position:
        return {"position": current.position, "ts": current.ts}
    return None


def serialize_state_message(state: PlaybackState, artwork_base_url: str) -> Dict[str, object]:
    artwork_url = ""
    if state.artwork_url:
        artwork_url = "{base}/artwork?url={url}".format(
            base=artwork_base_url.rstrip("/"),
            url=quote(state.artwork_url, safe=""),
        )

    return {
        "type": "state",
        "data": {
            "status": state.status,
            "track": state.track,
            "artist": state.artist,
            "album": state.album,
            "artworkUrl": artwork_url,
            "playing": state.playing,
            "position": state.position,
            "duration": state.duration,
            "volume": state.volume,
            "shuffle": state.shuffle,
            "repeat": state.repeat,
            "connected": state.connected,
            "ts": state.ts,
            "serverTimeMs": state.ts,
            "serverTimezoneOffsetMinutes": _local_timezone_offset_minutes(),
        },
    }


def _local_timezone_offset_minutes() -> int:
    offset = datetime.now().astimezone().utcoffset()
    if offset is None:
        return 0
    return int(offset.total_seconds() / 60)


class SpotifyController:
    def __init__(self) -> None:
        self._artist_cache: Dict[str, str] = {}
        self._artist_fetch_inflight: Set[str] = set()
        self._artist_lock = threading.Lock()

    def get_state(self) -> PlaybackState:
        timestamp_ms = int(time.time() * 1000)
        try:
            output = _run_osascript(build_fetch_script())
        except subprocess.CalledProcessError:
            return PlaybackState(
                **{**EMPTY_STATE.__dict__, "status": "spotify_not_running", "connected": False, "ts": timestamp_ms}
            )

        payload = output.strip()
        state = parse_state_payload(payload, timestamp_ms=timestamp_ms)
        spotify_url = extract_spotify_url(payload)

        if state.status != "ok" or not spotify_url:
            return state

        with self._artist_lock:
            cached_artist = self._artist_cache.get(spotify_url)
        if cached_artist:
            return replace(state, artist=cached_artist)

        self._start_artist_enrichment(spotify_url)
        return state

    def execute_command(self, action: str, value: Optional[int] = None) -> None:
        _run_osascript(build_command_script(action, value))

    def _start_artist_enrichment(self, spotify_url: str) -> None:
        with self._artist_lock:
            if spotify_url in self._artist_cache or spotify_url in self._artist_fetch_inflight:
                return
            self._artist_fetch_inflight.add(spotify_url)

        thread = threading.Thread(
            target=self._populate_artist_cache,
            args=(spotify_url,),
            daemon=True,
        )
        thread.start()

    def _populate_artist_cache(self, spotify_url: str) -> None:
        try:
            artist_text = fetch_artist_text_for_spotify_url(spotify_url)
            if artist_text:
                with self._artist_lock:
                    self._artist_cache[spotify_url] = artist_text
        finally:
            with self._artist_lock:
                self._artist_fetch_inflight.discard(spotify_url)


def build_command_script(action: str, value: Optional[int] = None) -> str:
    if action == "playpause":
        body = "playpause"
    elif action == "next":
        body = "next track"
    elif action == "previous":
        body = "previous track"
    elif action == "volume":
        body = "set sound volume to {value}".format(value=int(value or 0))
    elif action == "seek":
        body = "set player position to {value}".format(value=int(value or 0) / 1000)
    elif action == "shuffle":
        body = "set shuffling to not shuffling"
    elif action == "repeat":
        body = "\n".join(
            [
                "if player state is stopped then",
                "  set repeating to not repeating",
                "else",
                "  set repeating to not repeating",
                "end if",
            ]
        )
    else:
        raise ValueError("Unsupported action: {action}".format(action=action))

    return "\n".join(
        [
            'tell application "Spotify"',
            "  {body}".format(body=body),
            "end tell",
        ]
    )


def build_fetch_script() -> str:
    joined_fields = " & tab & ".join(FETCH_FIELDS)
    return "\n".join(
        [
            'if application "Spotify" is not running then',
            '  return "SPOTIFY_NOT_RUNNING"',
            "end if",
            'tell application "Spotify"',
            "  if player state is stopped then",
            '    return "IDLE"',
            "  end if",
            '  return "OK" & tab & {fields}'.format(fields=joined_fields),
            "end tell",
        ]
    )


def extract_spotify_url(payload: str) -> str:
    parts = payload.split("\t") if payload else []
    if len(parts) > 11:
        return parts[11]
    return ""


def fetch_artist_text_for_spotify_url(spotify_url: str) -> str:
    track_id = spotify_url.replace("spotify:track:", "", 1).strip()
    if not track_id:
        return ""

    page_url = "https://open.spotify.com/track/{track_id}".format(track_id=track_id)

    try:
        with urlopen(page_url, timeout=3) as response:
            html = response.read().decode("utf-8", "ignore")
    except Exception:
        return ""

    return resolve_artist_text_from_track_page(html)


def resolve_artist_text_from_track_page(html: str) -> str:
    match = re.search(
        r'<meta\s+name="music:musician_description"\s+content="([^"]+)"',
        html,
        re.IGNORECASE,
    )
    if not match:
        return ""

    return unescape(match.group(1)).strip()


def _same_snapshot(previous: PlaybackState, current: PlaybackState) -> bool:
    return (
        previous.status == current.status
        and previous.track == current.track
        and previous.artist == current.artist
        and previous.album == current.album
        and previous.artwork_url == current.artwork_url
        and previous.playing == current.playing
        and previous.duration == current.duration
        and previous.volume == current.volume
        and previous.shuffle == current.shuffle
        and previous.repeat == current.repeat
        and previous.connected == current.connected
    )


def _run_osascript(script: str) -> str:
    completed = subprocess.run(
        ["osascript", "-e", script],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout
