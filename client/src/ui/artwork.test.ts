// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { createArtworkElements, renderArtwork } from "./artwork";

function fireImageEvent(image: HTMLImageElement, type: "error" | "load"): void {
  var handler = type === "load" ? image.onload : image.onerror;

  if (handler) {
    handler.call(image, new Event(type));
  }
}

describe("artwork", () => {
  it("waits for the next artwork image to load before switching", () => {
    var elements = createArtworkElements(document);

    renderArtwork(elements, "http://127.0.0.1:8766/artwork?url=one");

    expect(elements.primary.src).toBe("");
    expect(elements.secondary.src).toContain("url=one");

    fireImageEvent(elements.secondary, "load");

    expect(elements.primary.src).toContain("url=one");
    expect(elements.activeUrl).toContain("url=one");
  });

  it("clears the artwork when the snapshot has no artwork url", () => {
    var elements = createArtworkElements(document);

    renderArtwork(elements, "http://127.0.0.1:8766/artwork?url=one");
    fireImageEvent(elements.secondary, "load");

    renderArtwork(elements, "");

    expect(elements.primary.src).toBe("");
    expect(elements.secondary.src).toBe("");
    expect(elements.activeUrl).toBe("");
  });

  it("falls back to the default panel color when artwork loading fails", () => {
    var elements = createArtworkElements(document);

    renderArtwork(elements, "http://127.0.0.1:8766/artwork?url=one");
    fireImageEvent(elements.secondary, "load");

    renderArtwork(elements, "http://127.0.0.1:8766/artwork?url=broken");
    fireImageEvent(elements.secondary, "error");

    expect(elements.primary.src).toBe("");
    expect(elements.secondary.src).toBe("");
    expect(elements.activeUrl).toBe("");
  });
});
