// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { assertMagiInvariants } from "./invariants";
import {
  magiInitial,
  magiStart,
  magiToggleType,
  magiTogglePause
} from "./state";

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
