import { describe, expect, it } from "vitest";

import { applyIncomingMessage } from "./ws-client";
import { createPlaybackStore } from "./state";

describe("applyIncomingMessage", () => {
  it("applies full state messages to the store", () => {
    const store = createPlaybackStore();

    applyIncomingMessage(
      store,
      {
        type: "state",
        data: {
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
        }
      }
    );

    expect(store.getState().current.track).toBe("Track Name");
  });

  it("applies delta messages to the existing snapshot", () => {
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

    applyIncomingMessage(store, {
      type: "delta",
      data: { position: 1300, ts: 1300 }
    });

    expect(store.getState().current.position).toBe(1300);
  });

  it("forwards hardware button events to the registered handler", () => {
    const store = createPlaybackStore();
    const buttons: string[] = [];

    applyIncomingMessage(
      store,
      {
        type: "button",
        data: { button: "preset1" }
      },
      (button) => {
        buttons.push(button);
      }
    );

    expect(buttons).toEqual(["preset1"]);
  });

  it("applies settings state messages to the store", () => {
    const store = createPlaybackStore();

    applyIncomingMessage(store, {
      type: "settings_state",
      data: {
        bluetooth: {
          enabled: true,
          discovering: false,
          pairedDevices: [],
          scannedDevices: []
        },
        display: {
          brightness: 120,
          maxBrightness: 255,
          autoBrightness: false,
          ambientLux: 4
        },
        device: {
          model: "Car Thing",
          systemVersion: "Buildroot 2019.02.1",
          serial: "ABC123",
          ipAddress: "192.168.1.2",
          adbConnected: true,
          wsConnected: true
        },
        developer: {
          adbConnected: true,
          reversePorts: ["8765", "8766"],
          bluetoothDaemonRunning: true
        }
      }
    });

    expect(store.getState().settings.data?.display.brightness).toBe(120);
    expect(store.getState().settings.loading).toBe(false);
  });

  it("tracks settings action results in the store", () => {
    const store = createPlaybackStore();

    applyIncomingMessage(store, {
      type: "settings_result",
      data: {
        ok: true,
        action: "restart_chromium",
        message: "Chromium restarted"
      }
    });

    expect(store.getState().settings.actionStatus).toEqual({
      kind: "success",
      action: "restart_chromium",
      message: "Chromium restarted"
    });
  });

  it("applies preferences state messages to the store", () => {
    const store = createPlaybackStore();

    applyIncomingMessage(store, {
      type: "preferences_state",
      data: {
        pomodoroEnabled: true
      }
    } as any);

    expect((store.getState() as any).preferences).toEqual({
      pomodoroEnabled: true
    });
  });
});
