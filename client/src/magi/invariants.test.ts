import { describe, expect, it } from "vitest";

import { assertMagiInvariants } from "./invariants";
import type { MagiState } from "./types";

const BASE: MagiState = {
  global: "IDLE",
  stages: {
    planning:   { id: "planning",   status: "PENDING", progress: 0, verdict: "NONE", handoff: 0, confidence: "MED", source: "",            summary: [] },
    execution:  { id: "execution",  status: "PENDING", progress: 0, verdict: "NONE", handoff: 0, confidence: "MED", source: "",            summary: [] },
    evaluation: { id: "evaluation", status: "PENDING", progress: 0, verdict: "NONE", handoff: 0, confidence: "MED", source: "",            summary: [] }
  },
  retryCount: 0,
  health: "ONLINE",
  modelType: "CLD",
  voice: { open: false, typedChars: 0, transcript: "", cursor: 0 },
  activeStage: null,
  runStartedAtMs: 0,
  pausedAtMs: 0
};

describe("assertMagiInvariants", () => {
  it("accepts an IDLE state with all stages pending", () => {
    expect(() => assertMagiInvariants(BASE)).not.toThrow();
  });

  it("rejects ACTIVE stage while global is IDLE (§3.4 rule 1 contrapositive)", () => {
    const bad: MagiState = {
      ...BASE,
      stages: { ...BASE.stages, planning: { ...BASE.stages.planning, status: "ACTIVE" } }
    };
    expect(() => assertMagiInvariants(bad)).toThrow(/rule 1/);
  });

  it("rejects global RUNNING when all stages are 承認 stamped (§3.4 rule 2)", () => {
    const bad: MagiState = {
      ...BASE,
      global: "RUNNING",
      stages: {
        planning:   { ...BASE.stages.planning,   status: "STAMPED", progress: 1, verdict: "承認" },
        execution:  { ...BASE.stages.execution,  status: "STAMPED", progress: 1, verdict: "承認" },
        evaluation: { ...BASE.stages.evaluation, status: "STAMPED", progress: 1, verdict: "承認" }
      }
    };
    expect(() => assertMagiInvariants(bad)).toThrow(/rule 2/);
  });

  it("rejects RUNNING when evaluation is 否定 stamped (§3.4 rule 3)", () => {
    const bad: MagiState = {
      ...BASE,
      global: "RUNNING",
      stages: {
        ...BASE.stages,
        evaluation: { ...BASE.stages.evaluation, status: "STAMPED", progress: 1, verdict: "否定" }
      }
    };
    expect(() => assertMagiInvariants(bad)).toThrow(/rule 3/);
  });

  it("rejects non-empty progress when global is IDLE (§3.4 rule 4)", () => {
    const bad: MagiState = {
      ...BASE,
      stages: { ...BASE.stages, planning: { ...BASE.stages.planning, progress: 0.5 } }
    };
    expect(() => assertMagiInvariants(bad)).toThrow(/rule 4/);
  });

  it("rejects verdict on active stage when HALTED (§3.4 rule 5)", () => {
    const bad: MagiState = {
      ...BASE,
      global: "HALTED",
      stages: { ...BASE.stages, planning: { ...BASE.stages.planning, status: "ACTIVE", progress: 0.4, verdict: "承認" } }
    };
    expect(() => assertMagiInvariants(bad)).toThrow(/rule 5/);
  });
});
