// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createIntelPanel, renderIntelPanel } from "./intel-panel";
import { magiInitial, magiStart, magiApplyEvent } from "../../magi/state";
import type { MagiStageId } from "../../magi/types";

describe("renderIntelPanel", () => {
  it("shows the TASK/SOURCE/HANDOFF/CONF header for the active stage", () => {
    const panel = createIntelPanel(document);
    let s = magiStart(magiInitial());
    s = magiApplyEvent(s, {
      kind: "STAGE_UPDATE",
      stage: "planning",
      patch: { sourceSet: "PRD", handoffDelta: 3, confidence: "HIGH" }
    });
    renderIntelPanel(panel, s);
    const text = panel.root.textContent ?? "";
    expect(text).toMatch(/TASK.*PLANNING/);
    expect(text).toMatch(/SOURCE.*PRD/);
    expect(text).toMatch(/HANDOFF.*3/);
    expect(text).toMatch(/CONF.*HIGH/);
  });

  it("appends up to 4 summary lines", () => {
    const panel = createIntelPanel(document);
    let s = magiStart(magiInitial());
    ["A", "B", "C", "D", "E"].forEach((line) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { summaryAppend: line } });
    });
    renderIntelPanel(panel, s);
    const lines = panel.root.querySelectorAll(".magi-intel-summary-line");
    expect(lines).toHaveLength(4);
    expect(lines[0].textContent).toBe("B");
    expect(lines[3].textContent).toBe("E");
  });

  it("shows the rework reason line when the active stage is in a rework loop", () => {
    const panel = createIntelPanel(document);
    let s = magiStart(magiInitial());
    (["planning", "execution"] as MagiStageId[]).forEach((id) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id, patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id, verdict: "承認" });
    });
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 1 } });
    s = magiApplyEvent(s, {
      kind: "EVAL_REJECT", severity: "MEDIUM", upstream: "execution", reason: "STATE_COVER incomplete"
    });
    renderIntelPanel(panel, s);
    expect(panel.root.querySelector(".magi-intel-rework-reason")?.textContent)
      .toMatch(/STATE_COVER incomplete/);
  });
});
