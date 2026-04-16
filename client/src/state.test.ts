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

    expect(store.getState().activeApp).toBe("home");
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

describe("createPlaybackStore — pomodoro timer", () => {
  it("tracks pomodoro preferences in the store", () => {
    const store = createPlaybackStore();
    const applyPreferences = (store as any).applyPreferences;

    expect(typeof applyPreferences).toBe("function");
    if (typeof applyPreferences !== "function") {
      return;
    }

    applyPreferences({ pomodoroEnabled: true });

    expect((store.getState() as any).preferences).toEqual({
      pomodoroEnabled: true
    });
  });

  it("opens rest setup after work setup when pomodoro is enabled", () => {
    const store = createPlaybackStore();
    const applyPreferences = (store as any).applyPreferences;
    const primaryAction = (store as any).timerPrimaryAction;

    expect(typeof applyPreferences).toBe("function");
    expect(typeof primaryAction).toBe("function");
    if (typeof applyPreferences !== "function" || typeof primaryAction !== "function") {
      return;
    }

    applyPreferences({ pomodoroEnabled: true });
    store.timerAdjust(60);
    primaryAction();

    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "set",
      settingTarget: "rest",
      workSeconds: 60,
      restSeconds: 0,
      remainingMs: 0
    });
  });

  it("returns from empty rest setup back to work setup", () => {
    const store = createPlaybackStore();
    const applyPreferences = (store as any).applyPreferences;
    const primaryAction = (store as any).timerPrimaryAction;

    expect(typeof applyPreferences).toBe("function");
    expect(typeof primaryAction).toBe("function");
    if (typeof applyPreferences !== "function" || typeof primaryAction !== "function") {
      return;
    }

    applyPreferences({ pomodoroEnabled: true });
    store.timerAdjust(60);
    primaryAction();
    store.timerAdjust(-60);

    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "set",
      settingTarget: "work",
      workSeconds: 60,
      restSeconds: 0,
      remainingMs: 60000
    });
  });

  it("loops from work into rest and back into work when rest is configured", () => {
    const store = createPlaybackStore();
    const applyPreferences = (store as any).applyPreferences;
    const primaryAction = (store as any).timerPrimaryAction;
    const timerTick = (store as any).timerTick;

    expect(typeof applyPreferences).toBe("function");
    expect(typeof primaryAction).toBe("function");
    expect(typeof timerTick).toBe("function");
    if (
      typeof applyPreferences !== "function" ||
      typeof primaryAction !== "function" ||
      typeof timerTick !== "function"
    ) {
      return;
    }

    applyPreferences({ pomodoroEnabled: true });
    store.timerAdjust(120);
    primaryAction();
    store.timerAdjust(60);
    primaryAction(1000);

    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "running",
      phase: "work",
      workSeconds: 120,
      restSeconds: 60,
      remainingMs: 120000
    });

    timerTick(118000);
    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "running",
      phase: "work",
      remainingMs: 3000,
      flashKind: "countdown_done"
    });

    timerTick(121000);
    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "running",
      phase: "rest",
      remainingMs: 60000,
      flashKind: "none"
    });

    timerTick(178000);
    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "running",
      phase: "rest",
      remainingMs: 3000,
      flashKind: "rest_done",
    });

    timerTick(181000);
    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "running",
      phase: "work",
      remainingMs: 120000,
      flashKind: "none"
    });
  });

  it("falls back to a one-shot countdown when rest is zero", () => {
    const store = createPlaybackStore();
    const primaryAction = (store as any).timerPrimaryAction;
    const timerTick = (store as any).timerTick;

    expect(typeof primaryAction).toBe("function");
    expect(typeof timerTick).toBe("function");
    if (typeof primaryAction !== "function" || typeof timerTick !== "function") {
      return;
    }

    store.timerAdjust(60);
    primaryAction(1000);
    timerTick(58000);

    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "running",
      phase: "work",
      remainingMs: 3000,
      flashKind: "countdown_done",
      nextPhaseAfterFlash: "none"
    });

    timerTick(61000);
    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "done",
      workSeconds: 60,
      restSeconds: 0
    });
  });

  it("backs out of a running pomodoro to work setup while preserving durations", () => {
    const store = createPlaybackStore();
    const applyPreferences = (store as any).applyPreferences;
    const primaryAction = (store as any).timerPrimaryAction;
    const timerBack = (store as any).timerBack;

    expect(typeof applyPreferences).toBe("function");
    expect(typeof primaryAction).toBe("function");
    expect(typeof timerBack).toBe("function");
    if (
      typeof applyPreferences !== "function" ||
      typeof primaryAction !== "function" ||
      typeof timerBack !== "function"
    ) {
      return;
    }

    applyPreferences({ pomodoroEnabled: true });
    store.timerAdjust(180);
    primaryAction();
    store.timerAdjust(60);
    primaryAction(1000);
    timerBack();

    expect((store.getState().homeTimer as any)).toMatchObject({
      mode: "set",
      settingTarget: "work",
      workSeconds: 180,
      restSeconds: 60,
      remainingMs: 180000
    });
  });
});
