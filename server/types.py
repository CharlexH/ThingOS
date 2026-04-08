from dataclasses import dataclass


@dataclass(frozen=True)
class PlaybackState:
    status: str
    track: str
    artist: str
    album: str
    artwork_url: str
    playing: bool
    position: int
    duration: int
    volume: int
    shuffle: bool
    repeat: bool
    connected: bool
    ts: int


EMPTY_STATE = PlaybackState(
    status="idle",
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
    connected=False,
    ts=0,
)
