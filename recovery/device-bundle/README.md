# Device Bundle Recovery Notes

Recovered on 2026-04-06 from the connected Car Thing device via `adb`.

## Files recovered

- `index.html`
- `index-Cq2XCnXj.js`
- `index-Cq2XCnXj.pretty.js`
- `index-KwI7wV77.css`

## What these files represent

The device currently contains two frontend entry paths:

1. `assets/app.js` + `assets/app.css`
   - This is the newer bundle deployed from the current local repository during the recent change.
   - It contains the Home clock screen and on-screen Spotify transport buttons.

2. `assets/index-Cq2XCnXj.js` + `assets/index-KwI7wV77.css`
   - This is an older hashed bundle that remained on disk after deploy.
   - `index.html` was temporarily repointed back to this pair as a safety rollback.

## Features identified in the recovered old hashed bundle

- Single Spotify page only
- Wheel-based volume control
- Keyboard shortcuts:
  - `Enter` -> `playpause`
  - `1` -> `previous`
  - `2` -> `next`
  - `3` -> `shuffle`
  - `4` -> `repeat`
- Track metadata, progress bar, and volume overlay

## Important finding

No richer historical frontend bundle was found on the device filesystem beyond:

- the current `app.js` / `app.css`, and
- the older `index-Cq2XCnXj.js` / `index-KwI7wV77.css`.

That means the exact "Claude-repaired" UI state the user remembers is not recoverable from the currently accessible on-device webapp files alone, unless it also exists somewhere else off-device.

## Checks performed

- Searched `/var/lib/thingplayer` and `/usr/share/qt-superbird-app/webapp`
- Searched for other matching `app.js`, `index-*.js`, `*.css`, `*.html`, `*.map` files
- Grepped recovered assets for distinguishing UI features

## Next practical options

1. Merge the recovered old-bundle behaviors back into the current source tree selectively.
2. Locate the actual richer source tree from another local directory, backup, or chat workspace.
