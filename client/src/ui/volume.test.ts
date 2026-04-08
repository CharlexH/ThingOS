// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVolumeOverlay, renderVolumeOverlay } from "./volume";

describe("renderVolumeOverlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("stays hidden on the initial volume sync", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const elements = createVolumeOverlay(document);

    renderVolumeOverlay(elements, 50);

    expect(elements.label.textContent).toBe("Volume");
    expect(elements.value.textContent).toBe("50");
    expect(elements.root.classList.contains("volume-overlay-visible")).toBe(false);

    now.mockRestore();
  });

  it("shows on volume change and hides three seconds after adjustments stop", () => {
    const now = vi.spyOn(Date, "now");
    const elements = createVolumeOverlay(document);

    now.mockReturnValue(1000);
    renderVolumeOverlay(elements, 50);

    now.mockReturnValue(1500);
    renderVolumeOverlay(elements, 52);
    expect(elements.root.classList.contains("volume-overlay-visible")).toBe(true);
    expect(elements.value.textContent).toBe("52");

    now.mockReturnValue(4400);
    renderVolumeOverlay(elements, 52);
    expect(elements.root.classList.contains("volume-overlay-visible")).toBe(true);

    now.mockReturnValue(4501);
    renderVolumeOverlay(elements, 52);
    expect(elements.root.classList.contains("volume-overlay-visible")).toBe(false);

    now.mockRestore();
  });
});
