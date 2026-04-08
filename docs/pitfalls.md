# ThingPlayer Pitfalls & Lessons Learned

Accumulated from real debugging sessions on the Car Thing hardware.

---

## Hardware & Platform

### Car Thing runs 32-bit userspace on 64-bit kernel

The kernel is ARM64 but Buildroot userspace is 32-bit. This affects:
- **Linux input_event struct is 16 bytes, not 24.** Format: `IIHHi` (two 32-bit timeval fields, not 64-bit). Using 24 bytes causes event parsing to drift and produce garbage key codes.
- Verified via `hexdump -C /dev/input/event0` showing 16-byte aligned events.

### ALL hardware buttons reach Chromium as keyboard events

Contrary to initial assumptions, **all** physical buttons on Car Thing generate keyboard events that reach Chromium:

| Hardware | Linux key code | Chromium `event.key` |
|----------|---------------|---------------------|
| Preset 1 | KEY_1 (2) | `"1"` |
| Preset 2 | KEY_2 (3) | `"2"` |
| Preset 3 | KEY_3 (4) | `"3"` |
| Preset 4 | KEY_4 (5) | `"4"` |
| Back button | KEY_ESC (1) | `"Escape"` |
| Knob press | KEY_ENTER (28) | `"Enter"` |
| Rotary turn | REL_HWHEEL | `WheelEvent` (deltaX) |

**This means the primary input path is through Chromium's native keyboard/wheel events, not through the WebSocket button channel.** The `InputBridge` server-side path exists as a secondary/redundant path but is not the one the frontend relies on for real-time interaction.

**Critical lesson:** When adding new button behavior (e.g., timer controls on the Home page), the keydown handler in `input.ts` is what must be updated — not just the `socket.onButton` callback in `main.ts`. The WebSocket button events may arrive late or not at all if the input bridge has connection issues.

### Rotary wheel maps to deltaX, not deltaY

Car Thing's `REL_HWHEEL` becomes `event.deltaX` in Chromium 69, not `event.deltaY`. Each tick produces `deltaX = ±53`. Use `event.deltaX || event.deltaY` to handle both.

### Key code mapping (verified on hardware)

| Key code | Linux name | Hardware |
|----------|-----------|----------|
| 1 | KEY_ESC | Back button |
| 2 | KEY_1 | Preset 1 (leftmost) |
| 3 | KEY_2 | Preset 2 |
| 4 | KEY_3 | Preset 3 |
| 5 | KEY_4 | Preset 4 (rightmost) |
| 28 | KEY_ENTER | Knob press |

### No screencap on device

`screencap` binary doesn't exist. No `/dev/fb0` (uses DRM/KMS). To take screenshots, use Chrome DevTools Protocol:

```bash
adb forward tcp:2222 tcp:2222
# Then use Page.captureScreenshot via CDP WebSocket
```

---

## Chromium 69 Compatibility

### Confirmed broken features

| Feature | Status | Workaround |
|---------|--------|------------|
| `?.` optional chaining | Not supported | Vite transpiles with target chrome69 |
| `??` nullish coalescing | Not supported | Vite transpiles |
| `globalThis` | Not supported | Use `window` |
| `Element.replaceChildren` | Not supported | Manual DOM clearing loop |
| Flexbox `gap` | Not supported | Use margins on children |
| CSS `inset: 0` shorthand | Not supported (Chrome 87+) | Use `top:0;right:0;bottom:0;left:0` |
| CSS `aspect-ratio` | Not supported | Use explicit dimensions |
| CSS `clamp()` | Not supported | Use `min()`/`max()` or fixed values |
| CSS `:is()` | Not supported | Write selectors explicitly |

### Confirmed working features

Grid `gap`, CSS custom properties, `object-fit`, CSS Grid, `ResizeObserver`, ES2015 classes/arrows/template literals, `fetch`, `WebSocket`, `requestAnimationFrame`, CSS transitions, `transform: scaleX()`.

### Empty `<img>` renders a visible border

In Chromium 69, an `<img>` without a `src` attribute but with `opacity: 1` renders a broken-image placeholder with a visible border. Fix:

```css
.artwork-image:not([src]),
.artwork-image[src=""] {
  visibility: hidden;
}
```

---

## ADB & Deployment

### `adb push dir/` creates a subdirectory

`adb push dist/ /target/webapp/` pushes into `/target/webapp/dist/`, not into `/target/webapp/`. Push individual files instead:

```bash
adb push dist/index.html /usr/share/qt-superbird-app/webapp/index.html
adb push dist/assets/app.css /usr/share/qt-superbird-app/webapp/assets/app.css
adb push dist/assets/app.js /usr/share/qt-superbird-app/webapp/assets/app.js
```

### DevTools port is 2222, not 9222

Chromium on Car Thing uses `--remote-debugging-port=2222` (configured in supervisord.conf), not the default 9222.

```bash
adb forward tcp:2222 tcp:2222
curl -s http://127.0.0.1:2222/json/list
```

### Cache survives page reload

`Page.reload` with `ignoreCache: true` via CDP does not always clear CSS/JS cache. Use `Network.clearBrowserCache` before reloading, or navigate away and back:

```python
await ws.send(json.dumps({'method': 'Network.clearBrowserCache', ...}))
await ws.send(json.dumps({'method': 'Page.navigate', 'params': {'url': '...'}}))
```

---

## Server-Side

### Volume command latency optimization

The default `_handle_command` flow is: execute osascript → re-poll full state → broadcast. For volume changes this adds ~80ms of osascript latency for the re-poll.

Optimization: for `volume` commands, update the local state directly with `dataclasses.replace()` and broadcast immediately, skipping the re-poll. The next poll cycle will reconcile.

### asyncio.ensure_future for callbacks within async context

`InputBridge._read_loop` is an async task. When calling `self._on_button(action, pressed)`, the callback (`_on_hardware_button`) uses `asyncio.ensure_future()` to schedule async work. Do NOT use `loop.call_soon_threadsafe()` here — that's for cross-thread calls, and using it within the same event loop causes issues.

### Port conflicts from lingering processes

After a crash, `server/main.py` may leave orphan processes holding ports 8765/8766. Always check before starting:

```bash
lsof -ti:8765 -ti:8766 | xargs kill 2>/dev/null
```

---

## macOS Menubar App

### Python Dock icon kills menubar app

Running `python3 mac_agent_app.py` shows Python in the Dock. Quitting from Dock kills the entire process including the menubar icon.

Fix: set activation policy before rumps starts:

```python
from AppKit import NSApplication, NSApplicationActivationPolicyAccessory
NSApplication.sharedApplication().setActivationPolicy_(NSApplicationActivationPolicyAccessory)
```

This hides from Dock; quit only via menubar → Quit.

---

## Input Routing Architecture

### Dual input paths: keydown (primary) vs WebSocket button (secondary)

Every hardware button press arrives via **two independent paths**:

1. **Chromium keydown** (primary, reliable): kernel → Weston → Chromium → `keydown` event in JS
2. **WebSocket button** (secondary): kernel → `adb shell cat /dev/input/event0` → Python server → WebSocket broadcast → client `onButton` callback

The keydown path is synchronous and reliable. The WebSocket path depends on the `InputBridge` adb pipe staying alive.

**Rule:** All interactive behavior (play/pause, timer start/pause, back navigation, app switching) **must** be handled in the keydown handler (`input.ts`). The `socket.onButton` handler in `main.ts` is a fallback that duplicates the same logic for cases where WebSocket events arrive.

### knob_press must NOT trigger server-side playpause

Originally, the server's `_on_hardware_button` both broadcast the button event AND called `playpause` directly. This caused issues when adding client-side features (like the Home timer) that need to intercept knob_press:

- Server fires playpause unconditionally → music pauses even on the Home/timer page
- Client has no way to prevent the server-side action

**Fix:** Server only broadcasts button events. The client decides what action to take based on `activeApp`. The keydown Enter handler routes to playpause (Spotify) or timer actions (Home).

---

## ADB Stability

### Do NOT poll `adb devices` while InputBridge is running

The `InputBridge` holds a persistent `adb shell cat /dev/input/event0` pipe. Running **any** other ADB command (`adb devices`, `adb reverse`, etc.) concurrently with this pipe causes `protocol fault (couldn't read status length)` errors. After a few faults, the ADB daemon crashes and the device disconnects entirely.

**Symptom:** device appears in `adb devices`, then disappears after a few seconds. `adb reverse --list` returns `protocol fault`. Eventually `adb devices` returns empty.

**Root cause in ThingPlayer:** `agent.py` originally polled `adb devices` + `adb reverse` × 2 every 3 seconds in `_on_tick`. Combined with the InputBridge pipe, this created 3+ concurrent ADB operations per tick cycle.

**Fix:** Remove all ADB polling from `_on_tick`. Instead, detect device presence via InputBridge's connection state. Only run `adb reverse` when InputBridge reports a successful reconnect, with a 2-second delay and 1-second gap between each reverse command to avoid contention.

### Serialize ADB commands with delays

When multiple ADB commands must run (e.g., `adb reverse` for two ports), add a 1-second sleep between them. Never fire multiple ADB commands in parallel — the ADB protocol is not concurrency-safe when a persistent shell pipe is open.

### py2app strips PATH — `adb` becomes invisible

py2app-built `.app` bundles run with a minimal environment. `/opt/homebrew/bin` (where Homebrew installs `adb`) is not on PATH. This causes `InputBridge` to fail silently on every `adb shell` attempt, then retry every 5 seconds — creating a storm of failed subprocess spawns.

**Symptom:** `.app` launches fine, menubar icon shows, but device never connects. Running the same code from terminal works perfectly.

**Fix:** At server startup, explicitly add `/opt/homebrew/bin` and `/usr/local/bin` to `os.environ["PATH"]`:

```python
path = os.environ.get("PATH", "")
for p in ("/opt/homebrew/bin", "/usr/local/bin"):
    if p not in path:
        os.environ["PATH"] = p + ":" + path
        path = os.environ["PATH"]
```

### InputBridge must auto-reconnect

The `adb shell` pipe will break whenever:
- USB cable is unplugged/replugged
- Device reboots
- ADB daemon restarts
- Mac goes to sleep/wake

The InputBridge must wrap its `adb shell` call in a reconnect loop with a delay (5 seconds) between attempts. On successful reconnect, it should notify the agent to re-establish `adb reverse` ports.

---

## Design Decisions (intentional, not bugs)

- `#app { border-radius: 24px }` clips screen corners — this is the desired faux-rounded-screen look
- Preset buttons 1-4 switch apps (Spotify/Home/Settings), NOT Spotify commands (prev/next/shuffle/repeat)
- `knob_press` = play/pause only on Spotify page (client-side routing)
- Volume step = 5 per rotary tick
- Artwork panel background is `transparent` (no visible box when nothing is playing)
