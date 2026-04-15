// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPlaybackStore } from "../state";
import { createRenderer } from "./renderer";

describe("createRenderer", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it("renders the home clock when the active app is home", () => {
    const now = new Date(2026, 3, 6, 13, 45, 0, 0).getTime();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});

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
      ts: now,
      serverTimeMs: now
    });
    store.switchApp("home");
    renderer.render(store.getState());

    expect(document.querySelector(".home-screen")).not.toBeNull();
    expect(document.querySelector(".home-clock-time")?.textContent).toBe("13:45");

    dateNow.mockRestore();
  });

  it("shows a 2-second preset hint row with the active module highlighted", () => {
    vi.useFakeTimers();
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});

    renderer.showPresetHint("preset3");

    const overlay = document.querySelector(".preset-hint-overlay") as HTMLElement;
    const items = Array.from(document.querySelectorAll(".preset-hint-item")) as HTMLElement[];

    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains("preset-hint-overlay-visible")).toBe(true);
    expect(items.map((item) => item.textContent)).toEqual(["Spotify", "Home", "Home", "Settings"]);
    expect(items[2].classList.contains("preset-hint-item-active")).toBe(true);
    expect(items[0].classList.contains("preset-hint-item-active")).toBe(false);

    vi.advanceTimersByTime(2000);

    expect(overlay.classList.contains("preset-hint-overlay-visible")).toBe(false);
    vi.useRealTimers();
  });

  it("renders a settings home page and lets touch input open a settings section", () => {
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {}, {
      requestSettingsState: () => {},
      sendSettingsSet: () => {},
      sendSettingsAction: () => {}
    });

    store.applySettingsState({
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
    });
    store.switchApp("settings");
    renderer.render(store.getState());

    const root = document.querySelector(".settings-screen") as HTMLElement;
    const items = Array.from(document.querySelectorAll(".settings-home-item")) as HTMLButtonElement[];

    expect(root.hidden).toBe(false);
    expect(items.map((item) => item.textContent)).toEqual([
      "Bluetooth",
      "Display",
      "Device",
      "Developer"
    ]);

    items[1].click();
    renderer.render(store.getState());

    expect(store.getState().settings.section).toBe("display");
    expect(document.querySelector(".settings-title")?.textContent).toBe("Display");
  });

  it("sends spotify transport commands from touch buttons", () => {
    const commands: string[] = [];
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, (action) => {
      commands.push(action);
    });

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
      repeat: true,
      connected: true,
      ts: 1000,
      serverTimeMs: 1000
    });
    store.switchApp("spotify");
    renderer.render(store.getState());

    (document.querySelector('[data-action="previous"]') as HTMLButtonElement).click();
    (document.querySelector('[data-action="playpause"]') as HTMLButtonElement).click();
    (document.querySelector('[data-action="next"]') as HTMLButtonElement).click();
    (document.querySelector('[data-action="repeat"]') as HTMLButtonElement).click();

    expect(commands).toEqual(["previous", "playpause", "next", "repeat"]);
  });

  it("reflects playing and repeat state in spotify controls", () => {
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});

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
      repeat: true,
      connected: true,
      ts: 1000,
      serverTimeMs: 1000
    });
    store.switchApp("spotify");
    renderer.render(store.getState());

    expect(
      document
        .querySelector('[data-action="previous"]')
        ?.firstElementChild?.getAttribute("data-icon")
    ).toBe("previous");
    expect(
      document
        .querySelector('[data-action="playpause"]')
        ?.firstElementChild?.getAttribute("data-icon")
    ).toBe("pause");
    expect(document.querySelector('[data-action="playpause"]')?.getAttribute("aria-label")).toBe("Pause");
    expect(
      document
        .querySelector('[data-action="next"]')
        ?.firstElementChild?.getAttribute("data-icon")
    ).toBe("next");
    expect(
      document
        .querySelector('[data-action="repeat"]')
        ?.firstElementChild?.getAttribute("data-icon")
    ).toBe("repeat-one");
    expect(
      document
        .querySelector('[data-action="playpause"]')
        ?.classList.contains("transport-button-active")
    ).toBe(false);
    expect(
      document
        .querySelector('[data-action="repeat"]')
        ?.classList.contains("transport-button-active")
    ).toBe(true);
    expect(document.querySelector(".info-panel-main")).not.toBeNull();
    expect(document.querySelector(".info-panel-footer")).not.toBeNull();
    expect(document.querySelector(".info-panel-main")?.lastElementChild?.className).toContain(
      "status-badge"
    );
    expect(document.querySelector(".info-panel-footer")?.firstElementChild?.className).toContain(
      "volume-overlay"
    );
    expect(document.querySelector(".info-panel-footer")?.lastElementChild?.className).toContain(
      "transport-controls"
    );
  });

  it("renders a spotify-only background scene that follows the current artwork", () => {
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});

    store.applyState({
      status: "ok",
      track: "Track Name",
      artist: "Artist Name",
      album: "Album Name",
      artworkUrl: "http://127.0.0.1:8766/artwork?url=artwork-1",
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
    store.switchApp("spotify");
    renderer.render(store.getState());

    expect(document.querySelector(".spotify-background")).not.toBeNull();
    expect(
      Array.from(document.querySelectorAll(".spotify-background-image")).some(function (image) {
        return (image as HTMLImageElement).src.indexOf("artwork-1") >= 0;
      })
    ).toBe(true);

    store.switchApp("home");
    renderer.render(store.getState());

    expect((document.querySelector(".app-shell") as HTMLElement).hidden).toBe(true);
    expect((document.querySelector(".home-screen") as HTMLElement).hidden).toBe(false);
  });

  it("uses the document window timer host instead of relying on globalThis", () => {
    const localDocument = document.implementation.createHTMLDocument("ThingOS");
    const app = localDocument.createElement("div");
    const timerHost = {
      setInterval: vi.fn(() => 1)
    };

    app.id = "app";
    localDocument.body.appendChild(app);
    Object.defineProperty(localDocument, "defaultView", {
      value: timerHost,
      configurable: true
    });

    const originalSetInterval = globalThis.setInterval;
    // Simulate the old Chromium environment where `globalThis` is unavailable to app code.
    Object.defineProperty(globalThis, "setInterval", {
      value: undefined,
      configurable: true
    });

    try {
      expect(() => createRenderer(localDocument, createPlaybackStore(), () => {})).not.toThrow();
      expect(timerHost.setInterval).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "setInterval", {
        value: originalSetInterval,
        configurable: true
      });
    }
  });

  it("advances the progress bar and elapsed label between server deltas", () => {
    const localDocument = document.implementation.createHTMLDocument("ThingOS");
    const app = localDocument.createElement("div");
    let labelTick: (() => void) | undefined;
    let frameTick: ((timestamp?: number) => void) | undefined;
    const timerHost = {
      requestAnimationFrame: vi.fn((callback: (timestamp?: number) => void) => {
        frameTick = callback;
        return 1;
      }),
      setInterval: vi.fn((callback: () => void) => {
        labelTick = callback;
        return 1;
      })
    };

    app.id = "app";
    localDocument.body.appendChild(app);
    Object.defineProperty(localDocument, "defaultView", {
      value: timerHost,
      configurable: true
    });

    const dateNow = vi.spyOn(Date, "now");
    dateNow.mockReturnValue(1000);

    const store = createPlaybackStore();
    const renderer = createRenderer(localDocument, store, () => {});

    store.applyState({
      status: "ok",
      track: "Track Name",
      artist: "Artist Name",
      album: "Album Name",
      artworkUrl: "",
      playing: true,
      position: 1000,
      duration: 5000,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1000,
      serverTimeMs: 1000
    });
    store.switchApp("spotify");
    renderer.render(store.getState());

    expect(timerHost.requestAnimationFrame).toHaveBeenCalled();

    const fill = localDocument.querySelector(".progress-fill") as HTMLElement;
    const elapsed = localDocument.querySelector(".progress-label-elapsed") as HTMLElement;

    expect(fill.style.transform).toContain("0.200");
    expect(elapsed.textContent).toBe("0:01");

    dateNow.mockReturnValue(2500);
    frameTick?.(2500);
    labelTick?.();

    expect(fill.style.transform).toContain("1");
    expect(elapsed.textContent).toBe("0:02");

    dateNow.mockRestore();
  });

  it("shows optimistic volume changes immediately before server state catches up", () => {
    const now = vi.spyOn(Date, "now");
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});

    now.mockReturnValue(1000);
    store.applyState({
      status: "ok",
      track: "Track Name",
      artist: "Artist Name",
      album: "Album Name",
      artworkUrl: "",
      playing: true,
      position: 1000,
      duration: 5000,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1000,
      serverTimeMs: 1000
    });
    store.switchApp("spotify");
    renderer.render(store.getState());

    renderer.previewVolume(53);

    expect(document.querySelector(".volume-value")?.textContent).toBe("53");
    expect(document.querySelector(".volume-fill")?.getAttribute("style")).toContain("53%");
    expect(document.querySelector(".volume-overlay")?.classList.contains("volume-overlay-visible")).toBe(true);

    now.mockReturnValue(1200);
    renderer.render(store.getState());
    expect(document.querySelector(".volume-value")?.textContent).toBe("53");

    now.mockReturnValue(1300);
    store.applyState({
      ...store.getState().current,
      volume: 53,
      ts: 1300,
      serverTimeMs: 1300
    });
    renderer.render(store.getState());
    expect(document.querySelector(".volume-value")?.textContent).toBe("53");

    now.mockRestore();
  });
});
