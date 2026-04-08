// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKGROUND_COLORS,
  buildBackgroundGradient,
  createBackgroundElements,
  extractGradientPalette,
  renderBackground,
} from "./background";

function fireImageEvent(image: HTMLImageElement, type: "error" | "load"): void {
  var handler = type === "load" ? image.onload : image.onerror;

  if (handler) {
    handler.call(image, new Event(type));
  }
}

describe("background helpers", () => {
  it("falls back to the default palette when no pixels are available", () => {
    expect(extractGradientPalette(new Uint8ClampedArray())).toEqual(DEFAULT_BACKGROUND_COLORS);
  });

  it("extracts multiple representative colors from vivid artwork pixels", () => {
    var pixels = new Uint8ClampedArray([
      255, 64, 64, 255,
      240, 72, 72, 255,
      64, 128, 255, 255,
      72, 136, 240, 255,
      255, 184, 64, 255,
      240, 176, 72, 255,
      40, 40, 40, 255,
      48, 48, 48, 255
    ]);

    var palette = extractGradientPalette(pixels);

    expect(palette.length).toBe(4);
    expect(new Set(palette).size).toBeGreaterThan(2);
    expect(palette).not.toEqual(DEFAULT_BACKGROUND_COLORS);
  });

  it("builds a layered radial gradient string from the palette", () => {
    var gradient = buildBackgroundGradient([
      "rgba(255, 0, 0, 0.7)",
      "rgba(0, 255, 0, 0.6)",
      "rgba(0, 0, 255, 0.5)",
      "rgba(255, 255, 0, 0.4)"
    ]);

    expect(gradient).toContain("radial-gradient(");
    expect(gradient).toContain("circle at 18% 22%");
    expect(gradient).toContain("circle at 82% 18%");
    expect(gradient).toContain("circle at 50% 82%");
  });

  it("keeps the background images hidden until the next artwork finishes loading", () => {
    var elements = createBackgroundElements(document);

    renderBackground(document, elements, "http://127.0.0.1:8766/artwork?url=one");

    expect(elements.primary.src).toBe("");
    expect(elements.secondary.src).toContain("url=one");
    expect(elements.primary.classList.contains("spotify-background-image-visible")).toBe(false);
    expect(elements.secondary.classList.contains("spotify-background-image-visible")).toBe(false);

    fireImageEvent(elements.secondary, "load");

    expect(elements.primary.src).toContain("url=one");
    expect(elements.primary.classList.contains("spotify-background-image-visible")).toBe(true);
  });

  it("falls back to the default palette when background artwork fails to load", () => {
    var elements = createBackgroundElements(document);

    renderBackground(document, elements, "http://127.0.0.1:8766/artwork?url=broken");
    fireImageEvent(elements.secondary, "error");

    expect(elements.primary.src).toBe("");
    expect(elements.secondary.src).toBe("");
    expect(elements.primary.classList.contains("spotify-background-image-visible")).toBe(false);
    expect(elements.secondary.classList.contains("spotify-background-image-visible")).toBe(false);
    expect(elements.gradient.style.background).toContain("rgba(44, 58, 82, 0.48)");
  });
});
