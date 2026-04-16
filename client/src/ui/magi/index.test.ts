// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createMagiElements, renderMagi } from "./index";
import { magiInitial, magiStart } from "../../magi/state";

describe("createMagiElements", () => {
  it("creates a .magi-screen with six always-on zones and a voice overlay", () => {
    const elements = createMagiElements(document);
    expect(elements.root.classList.contains("magi-screen")).toBe(true);
    expect(elements.root.querySelector(".magi-zone-status-badge")).not.toBeNull();
    expect(elements.root.querySelector(".magi-zone-hex-cluster")).not.toBeNull();
    expect(elements.root.querySelector(".magi-zone-intel-panel")).not.toBeNull();
    expect(elements.root.querySelector(".magi-zone-timeline")).not.toBeNull();
    expect(elements.root.querySelector(".magi-zone-system-health")).not.toBeNull();
    expect(elements.root.querySelector(".magi-zone-model-type")).not.toBeNull();
    expect(elements.root.querySelector(".magi-voice-overlay")).not.toBeNull();
  });
});

describe("renderMagi — simple zones", () => {
  it("renders the 待機 glyph when global is IDLE", () => {
    const elements = createMagiElements(document);
    renderMagi(elements, magiInitial());
    const badge = elements.root.querySelector(".magi-zone-status-badge") as HTMLElement;
    expect(badge.textContent).toContain("待機");
  });

  it("renders 審議中 when global is RUNNING", () => {
    const elements = createMagiElements(document);
    renderMagi(elements, magiStart(magiInitial()));
    const badge = elements.root.querySelector(".magi-zone-status-badge") as HTMLElement;
    expect(badge.textContent).toContain("審議中");
  });

  it("reflects the current model type and health", () => {
    const elements = createMagiElements(document);
    renderMagi(elements, { ...magiInitial(), modelType: "CDX", health: "DEGRADED" });
    expect(elements.root.querySelector(".magi-zone-model-type")?.textContent).toContain("CDX");
    expect(elements.root.querySelector(".magi-zone-system-health")?.textContent).toContain("DEGRADED");
  });

  it("shows an IDLE placeholder hint on the intel panel", () => {
    const elements = createMagiElements(document);
    renderMagi(elements, magiInitial());
    const intel = elements.root.querySelector(".magi-zone-intel-panel") as HTMLElement;
    expect(intel.textContent).toMatch(/press.+knob.+begin/i);
  });
});
