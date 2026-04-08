import threading
import time
import unittest
from unittest.mock import patch

from server.spotify import (
    SpotifyController,
    build_fetch_script,
    compute_delta,
    parse_state_payload,
    resolve_artist_text_from_track_page,
    serialize_state_message,
)


class ParseStatePayloadTests(unittest.TestCase):
    def test_parses_active_track_payload(self) -> None:
        payload = "\t".join(
            [
                "OK",
                "Track Name",
                "Artist Name",
                "Album Name",
                "https://i.scdn.co/image/abc123",
                "true",
                "106738",
                "325907",
                "49",
                "true",
                "false",
            ]
        )

        state = parse_state_payload(payload, timestamp_ms=1712345678901)

        self.assertEqual(state.status, "ok")
        self.assertEqual(state.track, "Track Name")
        self.assertEqual(state.artist, "Artist Name")
        self.assertEqual(state.album, "Album Name")
        self.assertEqual(state.artwork_url, "https://i.scdn.co/image/abc123")
        self.assertTrue(state.playing)
        self.assertEqual(state.position, 106738)
        self.assertEqual(state.duration, 325907)
        self.assertEqual(state.volume, 49)
        self.assertTrue(state.shuffle)
        self.assertFalse(state.repeat)
        self.assertTrue(state.connected)
        self.assertEqual(state.ts, 1712345678901)

    def test_maps_idle_status_without_track_data(self) -> None:
        state = parse_state_payload("IDLE", timestamp_ms=1712345678901)

        self.assertEqual(state.status, "idle")
        self.assertEqual(state.track, "")
        self.assertEqual(state.artist, "")
        self.assertFalse(state.playing)
        self.assertEqual(state.position, 0)
        self.assertEqual(state.duration, 0)


class ComputeDeltaTests(unittest.TestCase):
    def test_returns_position_only_delta(self) -> None:
        previous = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Track Name",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/abc123",
                    "true",
                    "106738",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345678901,
        )
        current = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Track Name",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/abc123",
                    "true",
                    "107200",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345679401,
        )

        self.assertEqual(
            compute_delta(previous, current),
            {"position": 107200, "ts": 1712345679401},
        )

    def test_returns_none_when_full_state_should_be_resent(self) -> None:
        previous = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Track Name",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/abc123",
                    "true",
                    "106738",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345678901,
        )
        current = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Another Track",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/xyz789",
                    "true",
                    "1000",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345679401,
        )

        self.assertIsNone(compute_delta(previous, current))


class SerializeStateMessageTests(unittest.TestCase):
    def test_rewrites_artwork_url_for_device_proxy(self) -> None:
        state = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Track Name",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/abc123",
                    "true",
                    "106738",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345678901,
        )

        message = serialize_state_message(state, "http://127.0.0.1:8766")

        self.assertEqual(message["type"], "state")
        self.assertEqual(
            message["data"]["artworkUrl"],
            "http://127.0.0.1:8766/artwork?url=https%3A%2F%2Fi.scdn.co%2Fimage%2Fabc123",
        )

    def test_includes_server_time_ms(self) -> None:
        state = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Track Name",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/abc123",
                    "true",
                    "106738",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345678901,
        )

        message = serialize_state_message(state, "http://127.0.0.1:8766")

        self.assertEqual(message["data"]["serverTimeMs"], 1712345678901)

    def test_includes_server_timezone_offset_minutes(self) -> None:
        state = parse_state_payload(
            "\t".join(
                [
                    "OK",
                    "Track Name",
                    "Artist Name",
                    "Album Name",
                    "https://i.scdn.co/image/abc123",
                    "true",
                    "106738",
                    "325907",
                    "49",
                    "true",
                    "false",
                ]
            ),
            timestamp_ms=1712345678901,
        )

        with patch("server.spotify._local_timezone_offset_minutes", return_value=480):
            message = serialize_state_message(state, "http://127.0.0.1:8766")

        self.assertEqual(message["data"]["serverTimezoneOffsetMinutes"], 480)


class BuildFetchScriptTests(unittest.TestCase):
    def test_wraps_boolean_and_position_fields_for_applescript_type_safety(self) -> None:
        script = build_fetch_script()

        self.assertIn("((player state is playing) as text)", script)
        self.assertIn("(((player position * 1000) as integer) as text)", script)
        self.assertIn("(sound volume as text)", script)
        self.assertIn("(spotify url of current track as text)", script)


class ResolveArtistTextFromTrackPageTests(unittest.TestCase):
    def test_reads_all_artist_names_from_spotify_track_meta(self) -> None:
        html = """
        <html>
          <head>
            <meta name="music:musician_description" content="Claude Debussy, Alain Planès, Third Artist" />
          </head>
        </html>
        """

        self.assertEqual(
            resolve_artist_text_from_track_page(html),
            "Claude Debussy, Alain Planès, Third Artist",
        )


class SpotifyControllerArtistEnrichmentTests(unittest.TestCase):
    def test_returns_base_state_without_waiting_for_artist_enrichment(self) -> None:
        controller = SpotifyController()
        payload = "\t".join(
            [
                "OK",
                "Track Name",
                "Base Artist",
                "Album Name",
                "https://i.scdn.co/image/abc123",
                "true",
                "106738",
                "325907",
                "49",
                "true",
                "false",
                "spotify:track:abc123",
            ]
        )
        fetch_started = threading.Event()

        def fake_fetch(spotify_url: str) -> str:
            self.assertEqual(spotify_url, "spotify:track:abc123")
            fetch_started.set()
            time.sleep(0.2)
            return "Base Artist, Featured Artist"

        with patch("server.spotify._run_osascript", return_value=payload), patch(
            "server.spotify.fetch_artist_text_for_spotify_url",
            side_effect=fake_fetch,
        ):
            started_at = time.perf_counter()
            state = controller.get_state()
            elapsed = time.perf_counter() - started_at

        self.assertEqual(state.artist, "Base Artist")
        self.assertLess(elapsed, 0.1)
        self.assertTrue(fetch_started.is_set())

    def test_uses_cached_artist_text_after_background_enrichment_finishes(self) -> None:
        controller = SpotifyController()
        payload = "\t".join(
            [
                "OK",
                "Track Name",
                "Base Artist",
                "Album Name",
                "https://i.scdn.co/image/abc123",
                "true",
                "106738",
                "325907",
                "49",
                "true",
                "false",
                "spotify:track:abc123",
            ]
        )
        fetch_finished = threading.Event()

        def fake_fetch(_: str) -> str:
            time.sleep(0.05)
            fetch_finished.set()
            return "Base Artist, Featured Artist"

        with patch("server.spotify._run_osascript", return_value=payload), patch(
            "server.spotify.fetch_artist_text_for_spotify_url",
            side_effect=fake_fetch,
        ):
            first_state = controller.get_state()
            self.assertEqual(first_state.artist, "Base Artist")
            self.assertTrue(fetch_finished.wait(0.5))

            second_state = controller.get_state()

        self.assertEqual(second_state.artist, "Base Artist, Featured Artist")


if __name__ == "__main__":
    unittest.main()
