import { describe, expect, it, vi } from "vitest";

import { createPlaybackStore } from "./state";

describe("createPlaybackStore", () => {
  it("starts from a default volume baseline of 50 before the first server sync", () => {
    const store = createPlaybackStore();

    expect(store.getState().current.volume).toBe(50);
    expect(store.getState().display.volume).toBe(50);
  });

  it("defaults to the home page and tracks the latest server time anchor", () => {
    const store = createPlaybackStore();
    const now = vi.spyOn(Date, "now").mockReturnValue(5000);

    store.applyState({
      status: "ok",
      track: "Track Name",
      artist: "Artist Name",
      album: "Album Name",
      artworkUrl: "http://127.0.0.1:8766/artwork?url=abc",
      playing: true,
      position: 1200,
      duration: 3200,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1000,
      serverTimeMs: 2000
    });

    expect(store.getState().activeApp).toBe("spotify");
    expect(store.getState().clockAnchor).toEqual({
      serverTimeMs: 2000,
      receivedAtMs: 5000,
      timezoneOffsetMinutes: -new Date(2000).getTimezoneOffset()
    });

    now.mockRestore();
  });

  it("switches apps explicitly", () => {
    const store = createPlaybackStore();

    store.switchApp("spotify");
    expect(store.getState().activeApp).toBe("spotify");

    store.switchApp("home");
    expect(store.getState().activeApp).toBe("home");
  });

  it("tracks the last good song when the server enters an idle state", () => {
    const store = createPlaybackStore();

    store.applyState({
      status: "ok",
      track: "Track Name",
      artist: "Artist Name",
      album: "Album Name",
      artworkUrl: "http://127.0.0.1:8766/artwork?url=abc",
      playing: true,
      position: 1200,
      duration: 3200,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1000,
      serverTimeMs: 1000
    });
    store.applyState({
      status: "idle",
      track: "",
      artist: "",
      album: "",
      artworkUrl: "",
      playing: false,
      position: 0,
      duration: 0,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1500,
      serverTimeMs: 1500
    });

    expect(store.getState().display.track).toBe("Track Name");
    expect(store.getState().status).toBe("idle");
  });

  it("applies position deltas without losing the current track snapshot", () => {
    const store = createPlaybackStore();

    store.applyState({
      status: "ok",
      track: "Track Name",
      artist: "Artist Name",
      album: "Album Name",
      artworkUrl: "http://127.0.0.1:8766/artwork?url=abc",
      playing: true,
      position: 1000,
      duration: 3200,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1000,
      serverTimeMs: 1000
    });
    store.applyDelta({ position: 1400, ts: 1500 });

    expect(store.getState().current.position).toBe(1400);
    expect(store.getState().display.track).toBe("Track Name");
    expect(store.getState().progressAnchorTs).toBe(1500);
  });
});

describe("createPlaybackStore — MAGI slice", () => {
  it("initialises a MAGI slice in IDLE", () => {
    const store = createPlaybackStore();
    expect(store.getState().magi.global).toBe("IDLE");
    expect(store.getState().magi.modelType).toBe("CLD");
  });

  it("magiDispatch notifies subscribers and produces a new slice", () => {
    const store = createPlaybackStore();
    const seen: string[] = [];
    store.subscribe((s) => seen.push(s.magi.global));
    store.magiDispatch((s) => ({ ...s, global: "RUNNING" as const }));
    expect(store.getState().magi.global).toBe("RUNNING");
    expect(seen).toContain("RUNNING");
  });
});
