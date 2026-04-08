# ThingPlayer

Turn your Spotify Car Thing into a dedicated Spotify remote for macOS.

ThingPlayer replaces the Car Thing's stock firmware UI with a clean, fast interface that talks to Spotify on your Mac over USB.

![ThingPlayer on Car Thing](docs/screenshot.png)

## Features

- **Now Playing** - album art, track info, progress bar, transport controls
- **Volume knob** - rotary knob controls Mac Spotify volume
- **Home clock** - 24-hour clock with countdown timer
- **App switching** - preset buttons switch between Spotify, Home, and Settings
- **Menubar app** - runs silently in the macOS menubar, auto-reconnects on USB replug

## How It Works

```
Car Thing (Chromium 69)  <──USB──>  Mac (Python server)  <──AppleScript──>  Spotify
         ↕ WebSocket (8765)              ↕ HTTP (8766)
      ThingPlayer UI              Artwork proxy server
```

The Car Thing runs a static web app in its built-in Chromium browser. A Python server on Mac bridges Spotify state over WebSocket and proxies album artwork. `adb reverse` makes Mac ports accessible to the device over USB.

## Requirements

- macOS
- Spotify desktop app
- Spotify Car Thing (with [superbird-tool](https://github.com/bishopdynamics/superbird-tool) custom setup)
- Android Debug Bridge (`brew install android-platform-tools`)
- Python 3.9+
- Node.js 18+

## Quick Start

### 1. Install dependencies

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements.txt
cd client && npm install && cd ..
```

### 2. Set up the device

Connect Car Thing via USB, then:

```bash
scripts/setup-device.sh
```

This pushes the web app to the device and configures Chromium to load it.

### 3. Run the server

**Option A: macOS menubar app (recommended)**

```bash
source .venv/bin/activate
python setup.py py2app
cp -R dist/ThingPlayer.app /Applications/
open /Applications/ThingPlayer.app
```

The app runs in the menubar with no Dock icon. It auto-reconnects when you unplug/replug the device.

**Option B: Command line**

```bash
source .venv/bin/activate
python -m server.main
# In another terminal:
adb reverse tcp:8765 tcp:8765
adb reverse tcp:8766 tcp:8766
```

### 4. Deploy UI updates

After changing client code:

```bash
scripts/deploy.sh
```

## Controls

| Input | Spotify page | Home page |
|-------|-------------|-----------|
| Rotary turn | Volume +/- | Timer minutes +/- |
| Knob press | Play / Pause | Start / Pause / Resume timer |
| Back button | - | Reset / Exit timer |
| Preset 1 | Switch to Spotify | Switch to Spotify |
| Preset 2-3 | Switch to Home | Switch to Home |
| Preset 4 | Switch to Settings | Switch to Settings |

## Project Structure

```
client/          Frontend (TypeScript, Vite, static build)
server/          Python backend (WebSocket, Spotify bridge, ADB helpers)
  agent.py       macOS menubar app wrapper
  ws_server.py   WebSocket server
  spotify.py     Spotify controller (AppleScript)
  input_bridge.py  Hardware button reader (ADB)
  artwork_proxy.py HTTP artwork proxy
scripts/         Device setup and deployment helpers
tests/           Python server tests
docs/            Pitfalls, design docs
```

## Debugging

```bash
# Check device connection
adb devices

# Forward Chrome DevTools
adb forward tcp:2222 tcp:2222
# Then open http://localhost:2222 in Chrome

# Check server health
lsof -nP -iTCP:8765 -sTCP:LISTEN
```

See [docs/pitfalls.md](docs/pitfalls.md) for hardware quirks, Chromium 69 compatibility notes, and ADB stability tips.

## License

MIT
