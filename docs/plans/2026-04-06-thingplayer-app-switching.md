# ThingPlayer App Switching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore hardware preset buttons as app switches, add a Home clock page, and move Spotify transport controls into on-screen touch buttons.

**Architecture:** The server keeps broadcasting Spotify state and hardware button events, but only `knob_press` remains a direct Spotify shortcut. The client owns page selection with a small `activeApp` state, renders either the Spotify or Home view, and uses a server-provided time anchor to display a 24-hour clock.

**Tech Stack:** Python 3, websockets, TypeScript, Vitest, Vite, DOM rendering, CSS

---

### Task 1: Lock in server button behavior

**Files:**
- Modify: `tests/test_server_ws_server.py`
- Modify: `server/ws_server.py`

**Step 1: Write the failing test**

```python
async def test_preset_buttons_only_broadcast_events() -> None:
    server = ThingPlayerServer(fake_spotify)

    server._on_hardware_button("preset2", True)

    assert broadcast_payloads == [{"type": "button", "data": {"button": "preset2"}}]
    assert executed_actions == []
```

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_server_ws_server.py -q`
Expected: FAIL because `preset2` still schedules a Spotify command.

**Step 3: Write minimal implementation**

```python
if button == "knob_press":
    asyncio.ensure_future(self._handle_command({"action": "playpause"}))
```

Remove the `preset1-4` command branches while keeping the button broadcast.

**Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_server_ws_server.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_server_ws_server.py server/ws_server.py
git commit -m "test: stop preset buttons from issuing spotify commands"
```

### Task 2: Add a server time anchor to websocket state

**Files:**
- Modify: `tests/test_server_spotify.py`
- Modify: `server/spotify.py`

**Step 1: Write the failing test**

```python
def test_serialized_state_includes_server_time_ms() -> None:
    message = serialize_state_message(state, "http://127.0.0.1:8766")
    assert message["data"]["serverTimeMs"] == state.ts
```

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_server_spotify.py::SerializeStateMessageTests::test_serialized_state_includes_server_time_ms -q`
Expected: FAIL because `serverTimeMs` is missing.

**Step 3: Write minimal implementation**

```python
"serverTimeMs": state.ts,
```

Add the field to serialized websocket state messages.

**Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_server_spotify.py::SerializeStateMessageTests::test_serialized_state_includes_server_time_ms -q`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_server_spotify.py server/spotify.py
git commit -m "feat: expose server time in websocket state"
```

### Task 3: Extend client state for app switching and time anchors

**Files:**
- Modify: `client/src/state.test.ts`
- Modify: `client/src/types.ts`
- Modify: `client/src/state.ts`

**Step 1: Write the failing test**

```ts
it("defaults to the home page and tracks the latest server time anchor", () => {
  const store = createPlaybackStore();

  store.applyState({
    ...snapshot,
    ts: 1000,
    serverTimeMs: 2000
  });

  expect(store.getState().activeApp).toBe("home");
  expect(store.getState().clockAnchor.serverTimeMs).toBe(2000);
});
```

Add a second test for switching apps:

```ts
it("switches apps from hardware preset events", () => {
  const store = createPlaybackStore();

  store.switchApp("spotify");
  expect(store.getState().activeApp).toBe("spotify");

  store.switchApp("home");
  expect(store.getState().activeApp).toBe("home");
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/state.test.ts`
Expected: FAIL because `activeApp`, `clockAnchor`, and `switchApp` do not exist.

**Step 3: Write minimal implementation**

```ts
export type AppId = "spotify" | "home";

export interface ClockAnchor {
  serverTimeMs: number;
  receivedAtMs: number;
}
```

Extend `PlaybackStoreState`, initialize `activeApp` to `"home"`, persist the latest clock anchor in `applyState`, and expose `switchApp(app: AppId)`.

**Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/state.test.ts client/src/types.ts client/src/state.ts
git commit -m "feat: add app switching state and clock anchors"
```

### Task 4: Route hardware button events to app changes in the client

**Files:**
- Modify: `client/src/ws-client.test.ts`
- Modify: `client/src/main.ts`
- Modify: `client/src/ws-client.ts`

**Step 1: Write the failing test**

```ts
it("passes hardware preset buttons to the registered handler", () => {
  const buttons: string[] = [];
  const store = createPlaybackStore();

  applyIncomingMessage(store, { type: "button", data: { button: "preset1" } }, (button) => {
    buttons.push(button);
  });

  expect(buttons).toEqual(["preset1"]);
});
```

Add a main-level behavior test or extraction test for mapping:

```ts
expect(mapPresetToApp("preset1")).toBe("spotify");
expect(mapPresetToApp("preset3")).toBe("home");
```

**Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/ws-client.test.ts`
Expected: FAIL because the helper path does not support the new handler flow or mapping helper.

**Step 3: Write minimal implementation**

```ts
if (button === "preset1") {
  store.switchApp("spotify");
} else if (button === "preset2" || button === "preset3" || button === "preset4") {
  store.switchApp("home");
}
```

Keep the existing websocket button callback behavior and move the mapping into a small reusable helper if needed.

**Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/ws-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/ws-client.test.ts client/src/main.ts client/src/ws-client.ts
git commit -m "feat: switch client apps from preset buttons"
```

### Task 5: Add the Home clock view and Spotify touch controls

**Files:**
- Create: `client/src/ui/home-clock.ts`
- Create: `client/src/ui/transport-controls.ts`
- Modify: `client/src/ui/renderer.ts`
- Modify: `client/src/styles/layout.css`
- Modify: `client/src/styles/components.css`
- Modify: `client/src/styles/theme.css`

**Step 1: Write the failing test**

Create a renderer-focused test such as `client/src/ui/renderer.test.ts`:

```ts
it("renders the home clock when the active app is home", () => {
  const view = createRenderer(document, store, sendCommand);
  store.switchApp("home");
  view.render(store.getState());

  expect(document.body.textContent).toContain("13:45");
});
```

Add a second test:

```ts
it("sends spotify transport commands from touch buttons", () => {
  const commands: string[] = [];
  const view = createRenderer(document, store, (action) => commands.push(action));

  view.render({ ...state, activeApp: "spotify" });
  clickButton("Next");

  expect(commands).toEqual(["next"]);
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/ui/renderer.test.ts`
Expected: FAIL because the clock and touch controls do not exist.

**Step 3: Write minimal implementation**

```ts
if (state.activeApp === "home") {
  renderHomeClock(clockElements, state.clockAnchor);
  spotifyRoot.hidden = true;
  homeRoot.hidden = false;
  return;
}
```

Create renderer helpers for:

- formatting anchored `HH:MM` time
- building transport buttons
- toggling visible view roots

Style the Home view as centered white-on-black and place the four Spotify touch buttons in the display area.

**Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/ui/renderer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/ui/home-clock.ts client/src/ui/transport-controls.ts client/src/ui/renderer.ts client/src/ui/renderer.test.ts client/src/styles/layout.css client/src/styles/components.css client/src/styles/theme.css
git commit -m "feat: add home clock and touch transport controls"
```

### Task 6: Wire the renderer command path and run focused verification

**Files:**
- Modify: `client/src/main.ts`
- Modify: `client/src/input.ts`
- Modify: any touched tests from earlier tasks

**Step 1: Write the failing test**

Add or update a focused test ensuring the renderer can receive `sendCommand` without breaking wheel input:

```ts
it("preserves wheel-based volume control while using renderer commands", () => {
  const sent: Array<[string, number | undefined]> = [];
  bindInputHandlers(fakeWindow, (action, value) => sent.push([action, value]), () => 50);
  // dispatch wheel event
  expect(sent).toEqual([["volume", 52]]);
});
```

If the project already has this coverage, write a regression test around the new `createRenderer(document, store, sendCommand)` signature instead.

**Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/input.test.ts src/ui/renderer.test.ts`
Expected: FAIL because the wiring is incomplete.

**Step 3: Write minimal implementation**

Pass `sendCommand` into `createRenderer`, keep wheel input bound, and ensure click handlers call the same websocket command path as existing controls.

**Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/input.test.ts src/state.test.ts src/ws-client.test.ts src/ui/renderer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/main.ts client/src/input.ts client/src/input.test.ts client/src/state.test.ts client/src/ws-client.test.ts client/src/ui/renderer.test.ts
git commit -m "test: verify app switching and touch controls"
```

### Task 7: Run end-to-end project verification

**Files:**
- Modify: any files needed to fix issues found by the full suite

**Step 1: Run Python tests**

Run: `python3 -m pytest tests -q`
Expected: PASS

**Step 2: Run client tests**

Run: `cd client && npm test`
Expected: PASS

**Step 3: Build the client bundle**

Run: `cd client && npm run build`
Expected: PASS and emits `dist/`

**Step 4: Sanity-check deployment path**

Run: `scripts/deploy.sh`
Expected: device webapp assets are updated successfully if ADB remains connected

**Step 5: Commit**

```bash
git add .
git commit -m "feat: restore app switching and add home clock"
```
