// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProgressElements,
  interpolateProgressPosition,
  renderProgress
} from "./progress";

describe("interpolateProgressPosition", () => {
  it("advances progress using elapsed time while playing", () => {
    expect(interpolateProgressPosition(1000, 1000, 1500, true, 5000)).toBe(1500);
  });

  it("never exceeds the track duration", () => {
    expect(interpolateProgressPosition(4900, 1000, 1500, true, 5000)).toBe(5000);
  });
});

describe("renderProgress", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders elapsed and total time in separate left and right labels", () => {
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(2500);
    const elements = createProgressElements(document);

    renderProgress(
      elements,
      {
        status: "ok",
        track: "Track",
        artist: "Artist",
        album: "Album",
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
      },
      1000
    );

    expect(elements.elapsed.textContent).toBe("0:02");
    expect(elements.duration.textContent).toBe("0:05");
    expect(elements.root.textContent).toContain("0:02");
    expect(elements.root.textContent).toContain("0:05");

    dateNow.mockRestore();
  });

  it("renders progress fill with sub-percent precision for smooth animation", () => {
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(1025);
    const elements = createProgressElements(document);
    let frameCallback: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1;
    });

    Object.defineProperty(document, "defaultView", {
      value: { requestAnimationFrame, setTimeout },
      configurable: true
    });

    renderProgress(
      elements,
      {
        status: "ok",
        track: "Track",
        artist: "Artist",
        album: "Album",
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
      },
      1000
    );

    expect(elements.fill.style.transform).toContain("0.205");
    expect(elements.fill.style.transition).toBe("none");
    expect(requestAnimationFrame).toHaveBeenCalled();

    frameCallback?.(0);

    expect(elements.fill.style.transform).toBe("scaleX(1)");
    expect(elements.fill.style.transition).toContain("3975");

    dateNow.mockRestore();
  });

  it("only rewrites the elapsed label when the displayed second changes", () => {
    const dateNow = vi.spyOn(Date, "now");
    const elements = createProgressElements(document);
    let elapsedAssignments = 0;
    let durationAssignments = 0;
    let elapsedValue = "";
    let durationValue = "";

    Object.defineProperty(elements.elapsed, "textContent", {
      configurable: true,
      get() {
        return elapsedValue;
      },
      set(value) {
        elapsedAssignments += 1;
        elapsedValue = String(value ?? "");
      }
    });
    Object.defineProperty(elements.duration, "textContent", {
      configurable: true,
      get() {
        return durationValue;
      },
      set(value) {
        durationAssignments += 1;
        durationValue = String(value ?? "");
      }
    });

    dateNow.mockReturnValue(1500);
    renderProgress(
      elements,
      {
        status: "ok",
        track: "Track",
        artist: "Artist",
        album: "Album",
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
      },
      1000
    );

    dateNow.mockReturnValue(1750);
    renderProgress(
      elements,
      {
        status: "ok",
        track: "Track",
        artist: "Artist",
        album: "Album",
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
      },
      1000
    );

    expect(elapsedAssignments).toBe(1);
    expect(durationAssignments).toBe(1);

    dateNow.mockRestore();
  });
});
