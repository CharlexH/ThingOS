# ThingPlayer App Switching Design

**Date:** 2026-04-06

**Goal:** Restore the four hardware preset buttons as app-switch buttons, make Home a network-synced clock page, and move Spotify transport controls into on-screen touch buttons.

## Summary

The device currently behaves as a single Spotify remote view. Hardware `preset1-4` button presses are translated server-side into Spotify commands such as previous, next, shuffle, and repeat. The new behavior is:

- `preset1` switches to the Spotify remote page.
- `preset2`, `preset3`, and `preset4` switch to the Home page.
- The Home page shows a centered 24-hour clock on a black background with white text.
- Spotify transport controls move into the display as touch buttons: previous, play/pause, next, and repeat.

This change keeps playback polling and command execution intact while moving page selection to the client UI state.

## Recommended Approach

Use a client-owned app state with two views: `spotify` and `home`.

Why this approach:

- Page switching is purely a presentation concern, so it should live in the client.
- The websocket protocol already forwards hardware button events to the client.
- The server only needs one behavioral change: stop mapping `preset1-4` to Spotify commands.
- This keeps the protocol small and avoids making the backend responsible for UI navigation.

## Behavior

### Hardware buttons

- `knob_press` remains a low-latency play/pause toggle handled server-side.
- `preset1-4` continue to be broadcast as button events to the client.
- `preset1` selects the Spotify page.
- `preset2-4` select the Home page.
- `preset1-4` no longer trigger Spotify actions directly on the server.

### Spotify page

- Preserve the existing album artwork, track metadata, progress bar, and wheel-based volume input.
- Add four large touch buttons inside the screen:
  - Previous
  - Play/Pause
  - Next
  - Repeat
- Buttons send the existing websocket commands (`previous`, `playpause`, `next`, `repeat`).
- Play/Pause and Repeat should reflect current playback state visually.

### Home page

- Render a full-screen black background with white centered time text.
- Show time in 24-hour format (`HH:MM`).
- Keep the layout intentionally minimal.

## Time Sync

The Home clock should follow device/system time that has already been synchronized over the network. To keep the implementation small and robust:

- Include a `serverTimeMs` timestamp in websocket `state` messages.
- The client uses the latest server timestamp as its clock anchor.
- Between websocket updates or reconnects, the client advances the displayed clock locally.
- Reconnects or fresh state messages re-anchor the clock automatically.

This avoids introducing an external NTP dependency into the app while still giving the UI a stable network-synced time source.

## Architecture

### Server

Files affected:

- `server/ws_server.py`
- tests under `tests/`

Responsibilities:

- Continue polling Spotify state and broadcasting snapshots/deltas.
- Include `serverTimeMs` in full state messages.
- Keep broadcasting `button` events for hardware input.
- Remove direct Spotify command handling from `preset1-4`.
- Keep `knob_press` mapped to `playpause`.

### Client state and protocol

Files affected:

- `client/src/types.ts`
- `client/src/state.ts`
- `client/src/ws-client.ts`
- tests under `client/src/`

Responsibilities:

- Extend client state with:
  - `activeApp`
  - clock anchor data derived from `serverTimeMs`
- Handle hardware button events by switching apps.
- Preserve existing playback snapshot storage behavior.

### Client rendering

Files affected:

- `client/src/main.ts`
- `client/src/ui/renderer.ts`
- new UI helpers as needed
- `client/src/styles/layout.css`
- `client/src/styles/components.css`
- `client/src/styles/theme.css`

Responsibilities:

- Render either the Spotify page or the Home page from the same shell.
- Add touch controls with pointer/click handlers.
- Render the Home clock and update it using anchored time.

## Error Handling

- If Spotify is idle or unavailable, the Spotify page still renders existing fallback metadata behavior.
- The Home page should not depend on Spotify availability.
- If the websocket disconnects, the clock may drift temporarily using the last anchor, then re-sync on reconnect.

## Testing Strategy

### Server tests

- Verify `preset1-4` are broadcast but do not invoke Spotify commands.
- Verify `knob_press` still triggers `playpause`.
- Verify full websocket state messages include `serverTimeMs`.

### Client tests

- Verify the playback store tracks `activeApp`.
- Verify button events switch between `spotify` and `home`.
- Verify websocket state parsing captures `serverTimeMs`.
- Verify renderer creates touch controls and their handlers send the expected commands.
- Verify Home clock formatting uses 24-hour output and anchored time.

## Out of Scope

- Adding more app pages beyond Spotify and Home.
- Pulling time from a third-party network API.
- Reworking the volume wheel interaction beyond compatibility adjustments needed for the new layout.
