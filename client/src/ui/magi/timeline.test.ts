// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createTimeline, renderTimeline } from "./timeline";
import { magiInitial, magiStart, magiApplyEvent } from "../../magi/state";
import type { MagiStageId } from "../../magi/types";

describe("createTimeline", () => {
  it("has three segments in stage order", () => {
    const tl = createTimeline(document);
    const segs = tl.root.querySelectorAll(".magi-timeline-segment");
    expect(segs).toHaveLength(3);
    expect(segs[0].getAttribute("data-stage")).toBe("planning");
    expect(segs[1].getAttribute("data-stage")).toBe("execution");
    expect(segs[2].getAttribute("data-stage")).toBe("evaluation");
  });
});

describe("renderTimeline", () => {
  it("marks the active stage and sets the progress var", () => {
    const tl = createTimeline(document);
    let s = magiStart(magiInitial());
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 0.3 } });
    renderTimeline(tl, s);
    const planning = tl.root.querySelector('[data-stage="planning"]') as HTMLElement;
    expect(planning.getAttribute("data-active")).toBe("true");
    expect(planning.style.getPropertyValue("--magi-segment-progress")).toBe("0.3");
  });

  it("applies the rework class when a stage is re-entered after 否定", () => {
    const tl = createTimeline(document);
    let s = magiStart(magiInitial());
    (["planning", "execution"] as MagiStageId[]).forEach((id) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id, patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id, verdict: "承認" });
    });
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 1 } });
    s = magiApplyEvent(s, {
      kind: "EVAL_REJECT", severity: "MEDIUM", upstream: "execution", reason: "r"
    });
    renderTimeline(tl, s);
    expect(tl.root.querySelector('[data-stage="execution"]')?.classList.contains("magi-segment-rework"))
      .toBe(true);
  });
});
