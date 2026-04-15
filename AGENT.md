# ThingOS Agent Guide

This file is the handoff document for any future agent working in this repo.

## What This Project Is

ThingOS turns a Spotify Car Thing into a compact console with a Spotify player, a Pomodoro timer, and a MAGI-style harness surface.

Current high-level behavior:
- `preset1` switches to the Spotify page.
- `preset2`, `preset3` switch to the Home page (clock + countdown timer).
- `preset4` switches to the Settings page.
- `knob_press` (Enter) is context-sensitive: play/pause on Spotify, timer start/pause/resume on Home.
- `back` (Escape) is context-sensitive: timer reset/exit on Home, navigate back on Settings.
- Rotary knob adjusts volume on Spotify (±5 per tick), adjusts timer minutes on Home.
- The on-screen transport row controls previous, play/pause, next, and single-track repeat.
- The Home page is a centered 24-hour clock on black, with an optional countdown timer.
- The Settings page has Bluetooth, Display, Device, and Developer sections.

### Running the App

**Preferred: macOS menubar app (`.app` bundle)**

```bash
open /Applications/ThingOS.app
```

Or build and install from source:
```bash
source .venv/bin/activate && python setup.py py2app
cp -R dist/ThingOS.app /Applications/
```

The `.app` starts a menubar-only process (no Dock icon) that:
- Runs the WebSocket server (8765) and artwork proxy (8766)
- Auto-reconnects when device is unplugged/replugged (via InputBridge reconnect loop)
- Re-establishes `adb reverse` ports on reconnection
- Shows status in the menubar dropdown (Connected/Idle/Waiting)

**Alternative: command-line server**

```bash
source .venv/bin/activate && python -m server.main
```

Note: command-line mode requires manual `adb reverse` setup.

## Repo Layout

- `client/`: device UI, built to static assets.
- `server/`: local Mac bridge for Spotify state, artwork proxy, websocket server, ADB helpers, menubar agent, and settings service.
- `server/agent.py`: macOS menubar app that wraps the full server.
- `server/settings.py`: device settings (Bluetooth, display brightness, developer tools) via ADB.
- `server/input_bridge.py`: reads hardware button events from `/dev/input/event0` via ADB.
- `scripts/`: device setup, dev workflow, and deployment helpers.
- `tests/`: Python server tests.
- `resources/`: menubar icon assets.
- `docs/pitfalls.md`: **accumulated hardware/platform pitfalls and lessons learned — read this first.**
- `docs/plans/`: existing design and implementation notes from the app-switching work.
- `recovery/device-bundle/`: pulled bundle artifacts from the device during recovery work.
- `mac_agent_app.py`: entry point for the menubar app.
- `setup.py`: py2app configuration for building a standalone .app bundle.

## How The System Actually Works

There are four separate moving parts:

1. The device browser loads static files from `/usr/share/qt-superbird-app/webapp`.
2. `server/device_setup.py` bind-mounts `/var/lib/thingplayer` over that system webapp path and restarts Chromium.
3. A local Mac process serves:
   - WebSocket state on `127.0.0.1:8765`
   - Artwork proxy on `127.0.0.1:8766`
   - Hardware button events via `InputBridge` (reads `/dev/input/event0` through ADB)
4. The menubar agent (`mac_agent_app.py`) wraps all of the above and auto-maintains ADB reverse ports.

The device reaches Mac ports through `adb reverse`.

**Important:** `adb push dist/ /target/` creates a `dist/` subdirectory inside the target. Push individual files instead. See `docs/pitfalls.md`.

If the UI looks updated but state is stale, assume the frontend and backend are out of sync until proven otherwise.

## The Two Main Workflows

### Full Dev Workflow

Use:

```bash
scripts/dev.sh
```

This does all of the following:
- runs device setup
- sets `adb reverse 8765 8766`
- starts a reverse watcher
- starts `python -m server.main`
- starts the client dev server

### Deploy Workflow

Use:

```bash
scripts/deploy.sh
```

Important: `deploy.sh` only:
- builds `client/dist`
- pushes the built assets to `/var/lib/thingplayer`
- reruns device setup

It does **not** restart `python -m server.main`.

If you change anything in `server/`, restarting the local server is your job.

## Critical Known Pitfalls

### 1. `deploy.sh` does not restart the local backend

This is the most important trap in the repo.

Symptoms:
- Device UI updates, but data shape still behaves like old code.
- Frontend expects a new field, but websocket payloads do not contain it.
- Timezone or artist-enrichment changes appear to "not work".

Fix:
- restart `python -m server.main`
- then reconnect to `ws://127.0.0.1:8765` and inspect the first state message

### 2. The device browser is Chromium 69

Treat it as legacy Chromium with limited CSS and JS support. See `docs/pitfalls.md` for the full compatibility table.

Confirmed incompatibilities that already caused production bugs:
- no `globalThis`
- no `Element.replaceChildren`
- no flexbox `gap`
- no CSS `inset` shorthand (Chrome 87+)
- empty `<img>` without `src` renders a visible broken-image border

Practical rules:
- prefer old-school DOM APIs
- avoid relying on modern global helpers
- do not use flex `gap`; use margins
- use `top:0;right:0;bottom:0;left:0` instead of `inset:0`
- hide empty `<img>` elements with `visibility: hidden` when no `src`
- be conservative with syntax in raw DevTools expressions

### 3. Hardware buttons use Chromium keydown as the PRIMARY input path

**This is the most important input architecture fact in the project.**

ALL hardware buttons reach Chromium as native keyboard events. This is the primary, reliable input path:
- Preset 1-4 → keys `"1"` `"2"` `"3"` `"4"`
- Back button → `"Escape"`
- Knob press → `"Enter"`
- Rotary turn → `WheelEvent` (deltaX)

The `InputBridge` (server-side, via `adb shell cat /dev/input/event0`) is a **secondary/redundant** path that broadcasts button events over WebSocket. It may lag or lose connection.

**Rule:** All button behavior must be implemented in the keydown/wheel handler (`client/src/input.ts`). The `socket.onButton` handler in `main.ts` is a fallback only.

### 4. `knob_press` is routed client-side, NOT server-side

The server does NOT trigger playpause on `knob_press`. It only broadcasts the button event.

The client's keydown Enter handler decides what to do based on `activeApp`:
- **Spotify** → `sendCommand("playpause")`
- **Home** → timer start/pause/resume (based on `homeTimer.mode`)

Similarly, the Escape handler routes the back button:
- **Home timer** → reset or exit timer
- **Settings** → navigate back or exit to Home

Be careful not to re-add server-side playpause on `knob_press` — it would break the Home timer.

### 5. ADB stability: do NOT poll while InputBridge is running

The `InputBridge` holds a persistent `adb shell` pipe. Running concurrent ADB commands (`adb devices`, `adb reverse`) causes `protocol fault` errors that crash the ADB daemon and disconnect the device.

**Rules:**
- Never poll `adb devices` on a timer. Detect device presence via InputBridge's connection state.
- Only run `adb reverse` when InputBridge reports a successful reconnect, with delays between commands.
- py2app strips PATH — must explicitly add `/opt/homebrew/bin` to `os.environ["PATH"]` at server startup.
- InputBridge must auto-reconnect with a 5-second retry loop.

See `docs/pitfalls.md` § "ADB Stability" for the full story.

### 6. Top-level screen hiding can be broken by CSS

This bug already happened.

Cause:
- `.app-shell { display: grid; }` overrode native `[hidden]` semantics
- Spotify stayed visible even when `shell.hidden = true`
- Home existed, but got pushed below the viewport and looked "frozen"

Current guardrail:
- `client/src/styles/layout.css` includes `#app > [hidden] { display: none !important; }`

Do not remove that rule unless you replace it with an equivalent top-level hiding mechanism.

### 7. Flex gap is not supported on device

Grid gap works.
Flex gap does not.

Known fixed cases:
- `volume-overlay`
- `info-panel-footer`

When adjusting spacing in flex layouts, use sibling margins, not `gap`.

### 8. Artwork must never show stale cover art

Current intended behavior:
- new artwork is not shown until the new image has successfully loaded
- when track artwork changes, old cover is cleared immediately
- if the new image is missing or fails, the artwork panel falls back to `#111`

This policy exists to avoid showing artwork from the previous track.
Do not regress it.

### 9. Home clock must use Mac timezone, not device timezone

The device browser timezone may differ from the Mac timezone.

Current fix:
- server sends `serverTimeMs`
- server also sends `serverTimezoneOffsetMinutes`
- frontend stores both in `clockAnchor`
- `client/src/ui/home-clock.ts` formats time from server timestamp plus server offset, not the device timezone

If the clock is wrong after a backend change, check whether the running websocket server actually includes `serverTimezoneOffsetMinutes`.

### 10. Full Python test discovery is not currently clean

Known red area:
- `tests/test_server_commands.py` imports `build_repeat_toggle_script`
- current `server/spotify.py` does not define that function

This means:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

is not a trustworthy "all green" command right now.

Use targeted backend suites instead:

```bash
python3 -m unittest tests.test_server_spotify tests.test_server_ws_server tests.test_server_artwork_proxy -v
```

If you touch repeat-command behavior, you must reconcile `tests/test_server_commands.py` with the actual implementation.

## Home Timer Feature

The Home page has a countdown timer accessible via the rotary knob.

### State Machine

```
clock → (rotary right) → timer_set → (knob press) → timer_running → (reaches 00:00) → timer_done
                                         ↑ (knob press)    ↓ (knob press)                    ↓ (knob press)
                                         +←← timer_paused ←+                                 → timer_running (restart)
```

### Interaction

| State | Display | Rotary | Knob press | Back |
|-------|---------|--------|------------|------|
| clock | 14:03 / TUE·7·APR | right → timer_set(01:00) | — | — |
| timer_set | 03:00 / COUNTDOWN | ±1 min (left past 00:00 → clock) | start timer | exit → clock |
| timer_running | 02:47 / COUNTDOWN | — | pause | reset → timer_set |
| timer_paused | 01:23 / PAUSED | — | resume | reset → timer_set |
| timer_done | 03:00 / TIME'S UP | right → timer_set | restart | exit → clock |

### Flash Effect

When countdown reaches 00:00, the screen flashes black/white for 3 seconds (250ms per phase). During flash: displays "00:00" / "TIME'S UP". After flash: shows original set time / "TIME'S UP".

### Key Files

- `client/src/types.ts` — `HomeTimerState` type, `HomeMode` union
- `client/src/state.ts` — timer state methods (timerAdjust, timerStart, timerPause, timerResume, timerDone, timerReset, timerExit)
- `client/src/ui/home-clock.ts` — rendering logic for all timer modes + flash effect
- `client/src/input.ts` — keydown Enter routes to `handleKnobPress`, Escape routes to `handleBackButton`, wheel routes to `adjustTimer`
- `client/src/ui/renderer.ts` — 250ms interval checks for timer completion (anchorRemaining - elapsed ≤ 0 → store.timerDone())

## Current UI/Behavior Assumptions

These are intentional as of now:

- app root has `24px` rounded corners for the faux rounded-screen look
- artwork panel is fixed at `360x360`
- artwork corners are `16px`
- entire app background is black; Spotify page also renders a blurred artwork background scene
- song title is `36px`
- artist and album use weight `200`
- title, artist, and album all use the same single-line marquee logic
- marquee speed is unified across fields and configured in frontend code
- progress bar uses transform-based animation, not width writes
- transport buttons have no border
- inactive transport button background is white at `8%`
- active repeat button background is white at `24%`
- play/pause does not get an active background style
- volume overlay is hidden by default and only appears during recent volume changes

## Device Debugging Checklist

When the device looks wrong, check these in order.

### ADB and Port Plumbing

```bash
adb devices
python3 -m server.adb reverse 8765 8766
```

If the device drops off ADB, nothing else matters.

### Local Server Health

```bash
lsof -nP -iTCP:8765 -sTCP:LISTEN
lsof -nP -iTCP:8766 -sTCP:LISTEN
# Preferred: menubar app (no Dock icon, auto ADB reverse)
source .venv/bin/activate && python3 mac_agent_app.py
# Alternative: headless server
source .venv/bin/activate && python3 -m server.main
```

If ports are already in use from a previous crash:
```bash
lsof -ti:8765 -ti:8766 | xargs kill 2>/dev/null
```

For quick payload inspection:

```bash
python3 - <<'PY'
import asyncio, json, websockets
async def main():
    async with websockets.connect('ws://127.0.0.1:8765') as ws:
        print(json.dumps(json.loads(await ws.recv()), indent=2, ensure_ascii=False))
asyncio.run(main())
PY
```

### Device Webapp Mount

`server/device_setup.py` bind-mounts:
- source: `/var/lib/thingplayer`
- target: `/usr/share/qt-superbird-app/webapp`

If the wrong UI is showing, verify the bind mount happened and Chromium was restarted.

### Remote Browser Debugging

The device Chromium exposes DevTools on port `2222`.

Typical flow:

```bash
adb forward tcp:2222 tcp:2222
curl http://127.0.0.1:2222/json/list
```

Use the returned `webSocketDebuggerUrl` to inspect:
- DOM hidden states
- computed layout
- console errors
- screenshots via `Page.captureScreenshot`

This is the fastest way to resolve "it looks frozen" vs. "the DOM thinks it switched pages".

## Validation Commands

Frontend:

```bash
cd client && npm test
cd client && npm run build
```

Useful focused frontend suites:

```bash
cd client && npm test -- src/ui/renderer.test.ts
cd client && npm test -- src/styles/components.test.ts
cd client && npm test -- src/ui/home-clock.test.ts src/state.test.ts
```

Backend:

```bash
python3 -m unittest tests.test_server_spotify tests.test_server_ws_server tests.test_server_artwork_proxy -v
```

## Safe Change Strategy

If you are changing:

- `client/` only:
  - run frontend tests
  - run `scripts/deploy.sh`

- `server/` only:
  - run targeted backend tests
  - restart `python -m server.main`
  - verify websocket first payload

- protocol fields shared by client and server:
  - update both sides
  - restart `python -m server.main`
  - redeploy frontend
  - inspect live websocket payload from `8765`

## If You Need To Recover The Previous Device UI

Recovered artifacts from the device are stored in:

- `recovery/device-bundle/`

These are not authoritative source code, only extracted built assets from an older on-device bundle.

## Bottom Line

When in doubt, remember this sequence:

1. verify ADB
2. verify `adb reverse`
3. verify local server process
4. verify websocket first payload
5. verify device DOM through DevTools

Most failures in this project are not pure frontend bugs. They are usually mismatches between:
- pushed device assets
- running local backend code
- browser capability on the device
- actual input path for a given control

**Read `docs/pitfalls.md` before making changes.** It contains hard-won knowledge about the Car Thing hardware, Chromium 69 quirks, ADB deployment gotchas, and server-side optimizations.
