// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { assertMagiInvariants } from "./invariants";
import {
  magiApplyEvent,
  magiInitial,
  magiStart,
  magiToggleType,
  magiTogglePause,
  magiVoiceCancel,
  magiVoiceCommit,
  magiVoiceOpen,
  magiVoiceTick
} from "./state";
import type { MagiStageId } from "./types";

describe("magiInitial", () => {
  it("returns an IDLE state with all stages PENDING and passes invariants", () => {
    const s = magiInitial();
    expect(s.global).toBe("IDLE");
    expect(s.stages.planning.status).toBe("PENDING");
    expect(s.stages.execution.status).toBe("PENDING");
    expect(s.stages.evaluation.status).toBe("PENDING");
    expect(s.retryCount).toBe(0);
    expect(s.modelType).toBe("CLD");
    expect(s.health).toBe("ONLINE");
    expect(s.voice.open).toBe(false);
    expect(s.activeStage).toBeNull();
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });
});

describe("magiStart", () => {
  it("transitions IDLE → RUNNING, planning ACTIVE, timestamps run start", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const s = magiStart(magiInitial());
    expect(s.global).toBe("RUNNING");
    expect(s.stages.planning.status).toBe("ACTIVE");
    expect(s.activeStage).toBe("planning");
    expect(s.runStartedAtMs).toBe(1000);
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });

  it("is a no-op when not IDLE", () => {
    const running = magiStart(magiInitial());
    const again = magiStart(running);
    expect(again).toBe(running);
  });
});

describe("magiToggleType", () => {
  it("flips CLD ↔ CDX without touching any run state", () => {
    const a = magiInitial();
    const b = magiToggleType(a);
    expect(b.modelType).toBe("CDX");
    expect(b.global).toBe(a.global);
    expect(b.stages).toBe(a.stages);

    const c = magiToggleType(b);
    expect(c.modelType).toBe("CLD");
  });
});

describe("magiTogglePause", () => {
  it("pauses a RUNNING run and resumes it", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const running = magiStart(magiInitial());

    vi.spyOn(Date, "now").mockReturnValue(2000);
    const paused = magiTogglePause(running);
    expect(paused.pausedAtMs).toBe(2000);
    expect(paused.global).toBe("RUNNING"); // paused is a local attr, global stays RUNNING

    vi.spyOn(Date, "now").mockReturnValue(5000);
    const resumed = magiTogglePause(paused);
    expect(resumed.pausedAtMs).toBe(0);
    expect(resumed.runStartedAtMs).toBe(4000); // run start shifted forward by pause duration
  });

  it("is a no-op when IDLE", () => {
    const s = magiInitial();
    expect(magiTogglePause(s)).toBe(s);
  });
});

function started(): ReturnType<typeof magiStart> {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  return magiStart(magiInitial());
}

describe("magiApplyEvent — STAGE_UPDATE", () => {
  it("advances progress and clamps at 1.0", () => {
    const a = started();
    const b = magiApplyEvent(a, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 0.6 } });
    expect(b.stages.planning.progress).toBeCloseTo(0.6);
    const c = magiApplyEvent(b, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 0.8 } });
    expect(c.stages.planning.progress).toBe(1);
  });

  it("caps summary at 4 lines, FIFO", () => {
    let s = started();
    ["A", "B", "C", "D", "E"].forEach((line) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { summaryAppend: line } });
    });
    expect(s.stages.planning.summary).toEqual(["B", "C", "D", "E"]);
  });

  it("ignores events for non-active stages (noise protection)", () => {
    const a = started();
    const b = magiApplyEvent(a, { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 0.3 } });
    expect(b.stages.evaluation.progress).toBe(0);
  });
});

describe("magiApplyEvent — STAGE_VERDICT 承認", () => {
  it("stamps planning 承認 and advances active stage to execution", () => {
    let s = started();
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 1 } });
    s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: "planning", verdict: "承認" });
    expect(s.stages.planning.status).toBe("STAMPED");
    expect(s.stages.planning.verdict).toBe("承認");
    expect(s.stages.execution.status).toBe("ACTIVE");
    expect(s.activeStage).toBe("execution");
    expect(s.global).toBe("RUNNING");
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });

  it("stamps evaluation 承認 and reaches DONE", () => {
    let s = started();
    const pump = (id: "planning" | "execution" | "evaluation"): void => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id, patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id, verdict: "承認" });
    };
    pump("planning");
    pump("execution");
    pump("evaluation");
    expect(s.global).toBe("DONE");
    expect(s.activeStage).toBeNull();
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });
});

describe("magiApplyEvent — EVAL_REJECT", () => {
  it("MEDIUM severity → REWORK, upstream stage re-enters ACTIVE, retry count +1", () => {
    let s = started();
    const pump = (id: "planning" | "execution" | "evaluation"): void => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id, patch: { progressDelta: 1 } });
      if (id !== "evaluation") {
        s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id, verdict: "承認" });
      }
    };
    pump("planning");
    pump("execution");
    pump("evaluation");
    s = magiApplyEvent(s, {
      kind: "EVAL_REJECT",
      severity: "MEDIUM",
      upstream: "execution",
      reason: "state coverage incomplete"
    });
    expect(s.global).toBe("REWORK");
    expect(s.retryCount).toBe(1);
    expect(s.stages.evaluation.status).toBe("STAMPED");
    expect(s.stages.evaluation.verdict).toBe("否定");
    expect(s.stages.evaluation.rejectionReason).toMatch(/state coverage/);
    expect(s.stages.execution.status).toBe("ACTIVE");
    expect(s.stages.execution.progress).toBe(0);
    expect(s.activeStage).toBe("execution");
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });

  it("HIGH severity → INTERVENTION directly (no rework loop)", () => {
    let s = started();
    ["planning", "execution"].forEach((id) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id as MagiStageId, patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id as MagiStageId, verdict: "承認" });
    });
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 1 } });
    s = magiApplyEvent(s, {
      kind: "EVAL_REJECT",
      severity: "HIGH",
      upstream: "execution",
      reason: "policy violation"
    });
    expect(s.global).toBe("INTERVENTION");
    expect(s.retryCount).toBe(1);
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });

  it("third MEDIUM rejection hits retry cap → INTERVENTION", () => {
    let s = started();
    const reject = (): void => {
      ["planning", "execution"].forEach((id) => {
        s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id as MagiStageId, patch: { progressDelta: 1 } });
        if (s.stages[id as MagiStageId].status !== "STAMPED") {
          s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id as MagiStageId, verdict: "承認" });
        }
      });
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, {
        kind: "EVAL_REJECT", severity: "MEDIUM", upstream: "execution", reason: "retry"
      });
    };
    reject(); // retry=1, REWORK
    reject(); // retry=2, REWORK
    reject(); // retry=3, forced INTERVENTION
    expect(s.global).toBe("INTERVENTION");
    expect(s.retryCount).toBe(3);
  });
});

describe("magiApplyEvent — HALT", () => {
  it("freezes active stage progress and clears its verdict", () => {
    let s = started();
    s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 0.5 } });
    s = magiApplyEvent(s, { kind: "HALT", reason: "ws_drop" });
    expect(s.global).toBe("HALTED");
    expect(s.stages.planning.status).toBe("ACTIVE");
    expect(s.stages.planning.verdict).toBe("NONE");
    expect(s.stages.planning.progress).toBeCloseTo(0.5);
    expect(() => assertMagiInvariants(s)).not.toThrow();
  });
});

describe("magiApplyEvent — HEALTH", () => {
  it("updates health field without touching run state", () => {
    const a = started();
    const b = magiApplyEvent(a, { kind: "HEALTH", health: "DEGRADED" });
    expect(b.health).toBe("DEGRADED");
    expect(b.global).toBe(a.global);
  });
});

describe("voice overlay reducers", () => {
  it("magiVoiceOpen populates transcript from cursor, advances cursor, zeros typedChars", () => {
    const a = magiInitial();
    const b = magiVoiceOpen(a);
    expect(b.voice.open).toBe(true);
    expect(b.voice.typedChars).toBe(0);
    expect(b.voice.transcript.length).toBeGreaterThan(0);
    expect(b.voice.cursor).toBe(1);

    const c = magiVoiceOpen(b);
    expect(c.voice.transcript).not.toBe(b.voice.transcript);
    expect(c.voice.cursor).toBe(2);
  });

  it("magiVoiceTick reveals characters over time, capped at transcript length", () => {
    const a = magiVoiceOpen(magiInitial());
    const b = magiVoiceTick(a, 8);       // 8 chars revealed
    expect(b.voice.typedChars).toBe(8);
    const done = magiVoiceTick(b, 10_000);
    expect(done.voice.typedChars).toBe(done.voice.transcript.length);
  });

  it("magiVoiceCancel closes overlay without touching active-stage summary", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    let s = magiStart(magiInitial());
    s = magiVoiceOpen(s);
    const closed = magiVoiceCancel(s);
    expect(closed.voice.open).toBe(false);
    expect(closed.stages.planning.summary).toEqual([]);
  });

  it("magiVoiceCommit closes overlay and appends VOICE line to active stage summary", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    let s = magiStart(magiInitial());
    s = magiVoiceOpen(s);
    const transcript = s.voice.transcript;
    const committed = magiVoiceCommit(s);
    expect(committed.voice.open).toBe(false);
    expect(committed.stages.planning.summary).toEqual([`VOICE: "${transcript}"`]);
  });

  it("magiVoiceCommit with no active stage closes overlay but appends nothing", () => {
    const s = magiVoiceOpen(magiInitial()); // IDLE — no active stage
    const c = magiVoiceCommit(s);
    expect(c.voice.open).toBe(false);
    expect(c.stages.planning.summary).toEqual([]);
  });
});
