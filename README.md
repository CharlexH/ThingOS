# ThingOS

ThingOS turns a Spotify Car Thing into a compact three-mode console for macOS over USB.

![ThingOS on Car Thing](docs/screenshot.png)

## What It Does

- **Spotify player**: browse now playing info, control playback, and adjust volume from the hardware knob.
- **Pomodoro timer**: run a focused countdown workflow directly on the device with the same physical controls.
- **Harness controller (MAGI edition)**: provide a MAGI-inspired control surface for harness sessions and status feedback.

## How It Works

```text
Car Thing UI <──USB / adb reverse──> macOS bridge <──AppleScript / local services──> Spotify + device features
```

The device runs a static web UI. A local Python bridge publishes state over WebSocket, proxies artwork over HTTP, and keeps the Car Thing connected after USB reconnects.

## Quick Start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements.txt
cd client && npm install && cd ..
scripts/setup-device.sh
python setup.py py2app
cp -R dist/ThingOS.app /Applications/
open /Applications/ThingOS.app
```

## Development

- `scripts/dev.sh` runs the local bridge plus client development workflow.
- `scripts/deploy.sh` builds the client and pushes static assets to the device.
- `python -m server.main` runs the bridge without the menubar app.

See [docs/pitfalls.md](docs/pitfalls.md) for device quirks, Chromium 69 constraints, and ADB stability notes.

## v0.2.0 — MAGI Harness Console

- New app `magi` bound to top preset-3 (previously mapped to Home). Preset-2 remains the Home shortcut.
- While inside MAGI, the scroll wheel toggles model `TYPE` (`CLD` ↔ `CDX`), the knob press starts / pauses the run, and the back button opens an on-screen voice-input mock (press knob to commit, back again to cancel). Touch input is unused.
- Exits from MAGI happen only via preset-1 (Spotify), preset-2 (Home), or preset-4 (Settings).
- Harness data is mocked client-side in this release; no server changes.

## License

MIT
