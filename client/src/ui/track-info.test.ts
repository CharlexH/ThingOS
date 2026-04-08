// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { computeMarqueeTiming, createTrackInfoElements, renderTrackInfo } from "./track-info";

describe("track info marquee", () => {
  it("computes marquee timing from a fixed 12px per second travel speed", () => {
    expect(computeMarqueeTiming(200)).toEqual({
      durationCss: "36.3s",
      moveMs: 16667,
      pauseMs: 1500,
      totalMs: 36334
    });
  });

  it("keeps the title on one line and renders the text through the inner element", () => {
    const elements = createTrackInfoElements(document);

    renderTrackInfo(elements, {
      status: "ok",
      track: "A Very Long Song Title",
      artist: "Artist",
      album: "Album",
      artworkUrl: "",
      playing: true,
      position: 0,
      duration: 1000,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1,
      serverTimeMs: 1
    });

    expect(elements.titleText.textContent).toBe("A Very Long Song Title");
    expect(elements.artistText.textContent).toBe("Artist");
    expect(elements.albumText.textContent).toBe("Album");
    expect(elements.title.classList.contains("track-title-scrolling")).toBe(false);
    expect(elements.artist.classList.contains("track-meta-scrolling")).toBe(false);
    expect(elements.album.classList.contains("track-meta-scrolling")).toBe(false);
  });

  it("starts marquee for title, artist, and album only when each field overflows", () => {
    const elements = createTrackInfoElements(document);
    document.body.appendChild(elements.title);
    document.body.appendChild(elements.artist);
    document.body.appendChild(elements.album);

    Object.defineProperty(elements.title, "clientWidth", {
      value: 220,
      configurable: true
    });
    Object.defineProperty(elements.artist, "clientWidth", {
      value: 220,
      configurable: true
    });
    Object.defineProperty(elements.album, "clientWidth", {
      value: 220,
      configurable: true
    });
    Object.defineProperty(elements.titleText, "scrollWidth", {
      value: 420,
      configurable: true
    });
    Object.defineProperty(elements.artistText, "scrollWidth", {
      value: 420,
      configurable: true
    });
    Object.defineProperty(elements.albumText, "scrollWidth", {
      value: 420,
      configurable: true
    });

    renderTrackInfo(elements, {
      status: "ok",
      track: "An Extremely Long Song Title That Cannot Fit On One Row",
      artist: "An Extremely Long Artist Name That Cannot Fit On One Row",
      album: "An Extremely Long Album Name That Cannot Fit On One Row",
      artworkUrl: "",
      playing: true,
      position: 0,
      duration: 1000,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1,
      serverTimeMs: 1
    });

    expect(elements.title.classList.contains("track-title-scrolling")).toBe(true);
    expect(elements.artist.classList.contains("track-meta-scrolling")).toBe(true);
    expect(elements.album.classList.contains("track-meta-scrolling")).toBe(true);
    expect(elements.title.style.getPropertyValue("--track-title-shift")).toBe("200px");
    expect(elements.title.style.getPropertyValue("--track-title-duration")).toBe("36.3s");
    expect(elements.artist.style.getPropertyValue("--track-title-duration")).toBe("36.3s");
    expect(elements.album.style.getPropertyValue("--track-title-duration")).toBe("36.3s");
    expect(elements.artist.style.getPropertyValue("--track-title-shift")).toBe("200px");
    expect(elements.album.style.getPropertyValue("--track-title-shift")).toBe("200px");
  });

  it("stops marquee when the title, artist, and album fit again", () => {
    const elements = createTrackInfoElements(document);
    document.body.appendChild(elements.title);
    document.body.appendChild(elements.artist);
    document.body.appendChild(elements.album);

    Object.defineProperty(elements.title, "clientWidth", {
      value: 220,
      configurable: true
    });
    Object.defineProperty(elements.artist, "clientWidth", {
      value: 220,
      configurable: true
    });
    Object.defineProperty(elements.album, "clientWidth", {
      value: 220,
      configurable: true
    });
    Object.defineProperty(elements.titleText, "scrollWidth", {
      value: 180,
      configurable: true
    });
    Object.defineProperty(elements.artistText, "scrollWidth", {
      value: 180,
      configurable: true
    });
    Object.defineProperty(elements.albumText, "scrollWidth", {
      value: 180,
      configurable: true
    });

    renderTrackInfo(elements, {
      status: "ok",
      track: "Short Title",
      artist: "Artist",
      album: "Album",
      artworkUrl: "",
      playing: true,
      position: 0,
      duration: 1000,
      volume: 50,
      shuffle: false,
      repeat: false,
      connected: true,
      ts: 1,
      serverTimeMs: 1
    });

    expect(elements.title.classList.contains("track-title-scrolling")).toBe(false);
    expect(elements.artist.classList.contains("track-meta-scrolling")).toBe(false);
    expect(elements.album.classList.contains("track-meta-scrolling")).toBe(false);
    expect(elements.title.style.getPropertyValue("--track-title-shift")).toBe("0px");
    expect(elements.artist.style.getPropertyValue("--track-title-shift")).toBe("0px");
    expect(elements.album.style.getPropertyValue("--track-title-shift")).toBe("0px");
  });
});
