// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createHexCluster, renderHexCluster } from "./hexagons";
import { magiInitial, magiStart, magiApplyEvent } from "../../magi/state";

describe("createHexCluster", () => {
  it("creates three hexagons keyed by stage id", () => {
    const cluster = createHexCluster(document);
    expect(cluster.root.querySelectorAll(".magi-hexagon")).toHaveLength(3);
    expect(cluster.root.querySelector('[data-stage="planning"]')).not.toBeNull();
    expect(cluster.root.querySelector('[data-stage="execution"]')).not.toBeNull();
    expect(cluster.root.querySelector('[data-stage="evaluation"]')).not.toBeNull();
  });
});

describe("renderHexCluster", () => {
  it("sets progress style on the active stage", () => {
    const cluster = createHexCluster(document);
    let s = magiStart(magiInitial());
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 0.42 } });
    renderHexCluster(cluster, s);
    const planning = cluster.root.querySelector('[data-stage="planning"]') as HTMLElement;
    expect(planning.getAttribute("data-status")).toBe("ACTIVE");
    expect(planning.style.getPropertyValue("--magi-progress")).toBe("0.42");
  });

  it("renders the 承認 stamp when a stage is STAMPED", () => {
    const cluster = createHexCluster(document);
    let s = magiStart(magiInitial());
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 1 } });
    s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: "planning", verdict: "承認" });
    renderHexCluster(cluster, s);
    const planning = cluster.root.querySelector('[data-stage="planning"]') as HTMLElement;
    expect(planning.getAttribute("data-verdict")).toBe("承認");
    expect(planning.querySelector(".magi-hex-stamp")?.textContent).toBe("承認");
  });

  it("marks the active stage for focus styling", () => {
    const cluster = createHexCluster(document);
    const s = magiStart(magiInitial());
    renderHexCluster(cluster, s);
    expect(cluster.root.querySelector('[data-stage="planning"]')?.classList.contains("magi-hex-focused")).toBe(true);
    expect(cluster.root.querySelector('[data-stage="execution"]')?.classList.contains("magi-hex-focused")).toBe(false);
  });
});
