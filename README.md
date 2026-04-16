# ThingOS

ThingOS turns a Spotify Car Thing into a compact four-page console for macOS over USB.

![ThingOS on Car Thing](docs/screenshot.png)

## What It Does

- **Spotify player**: browse now playing info, control playback, and adjust volume from the hardware knob.
- **Clock + Pomodoro timer**: use the Home page as a clock by default, then enter a countdown / work-rest loop with the same physical controls.
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
- `scripts/deploy.sh` builds the client, pushes static assets to the device, clears Chromium cache, and restarts the device browser.
- `python -m server.main` runs the bridge without the menubar app.

See [docs/pitfalls.md](docs/pitfalls.md) for device quirks, Chromium 69 constraints, and ADB stability notes.

## Current Button Layout

- `preset1` → `Home` (clock / pomodoro)
- `preset2` → `Spotify`
- `preset3` → `MAGI`
- `preset4` → `Settings`

On the Home page:
- rotate right from the clock to enter countdown setup
- press the knob to start / pause / resume
- when Pomodoro is enabled from the macOS menubar, the timer supports a `work -> rest -> loop` flow
- `work` flashes black/white in the final 3 seconds
- `rest` flashes green/white in the final 3 seconds
- both phases switch immediately at `0`

## Release Notes For Contributors

Before calling a build "released" for this repo, do all of the following:

```bash
cd client && npm test -- src/state.test.ts src/ui/home-clock.test.ts src/ui/renderer.test.ts src/input.test.ts src/ws-client.test.ts
python3 -m unittest tests.test_server_device_setup tests.test_server_ws_server tests.test_server_agent tests.test_agent_menu -v
python setup.py py2app
bash scripts/deploy.sh
```

Then verify:
- `/Applications/ThingOS.app` has been refreshed if server-side code changed
- the device is connected over ADB
- the device DevTools page at port `2222` is loading `file:///usr/share/qt-superbird-app/webapp/index.html`
- the live UI reflects the latest preset order and timer behavior

## v0.2.0 — MAGI Harness Console

- New app `magi` bound to top preset-3. Home now lives on preset-1 and Spotify on preset-2.
- While inside MAGI, the scroll wheel toggles model `TYPE` (`CLD` ↔ `CDX`), the knob press starts / pauses the run, and the back button opens an on-screen voice-input mock (press knob to commit, back again to cancel). Touch input is unused.
- Exits from MAGI happen only via preset-1 (Spotify), preset-2 (Home), or preset-4 (Settings).
- Harness data is mocked client-side in this release; no server changes.

## License

MIT
