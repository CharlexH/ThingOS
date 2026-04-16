import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceMock, advanceMockCursor, MOCK_HAPPY_PATH_DURATION_MS } from "./mock";
import { assertMagiInvariants } from "./invariants";
import { magiInitial, magiStart } from "./state";

describe("advanceMock — happy path", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(0);
  });

  it("is a no-op before any event fires", () => {
    const a = magiStart(magiInitial());
    const b = advanceMock(a, 0, 100, "happy");
    expect(b.stages.planning.progress).toBeGreaterThanOrEqual(0);
    expect(b.global).toBe("RUNNING");
  });

  it("reaches DONE by the end of the happy-path timeline and is invariant-clean", () => {
    const a = magiStart(magiInitial());
    const b = advanceMock(a, 0, MOCK_HAPPY_PATH_DURATION_MS + 1000, "happy");
    expect(b.global).toBe("DONE");
    expect(b.stages.planning.verdict).toBe("承認");
    expect(b.stages.execution.verdict).toBe("承認");
    expect(b.stages.evaluation.verdict).toBe("承認");
    expect(b.retryCount).toBe(1);   // 1 mid-run rework per §5 script
    expect(() => assertMagiInvariants(b)).not.toThrow();
  });

  it("is monotonic with respect to nowMs (applying a prefix then the suffix == applying the full range)", () => {
    const a = magiStart(magiInitial());
    const mid = Math.floor(MOCK_HAPPY_PATH_DURATION_MS / 2);
    const viaPrefix = advanceMock(advanceMock(a, 0, mid, "happy"), 0, MOCK_HAPPY_PATH_DURATION_MS + 100, "happy");
    const viaFull = advanceMock(a, 0, MOCK_HAPPY_PATH_DURATION_MS + 100, "happy");
    expect(viaPrefix.global).toBe(viaFull.global);
    expect(viaPrefix.retryCount).toBe(viaFull.retryCount);
    expect(viaPrefix.stages.evaluation.verdict).toBe(viaFull.stages.evaluation.verdict);
  });
});

describe("advanceMock — intervention branch", () => {
  it("reaches INTERVENTION via HIGH severity rejection", () => {
    const a = magiStart(magiInitial());
    const b = advanceMock(a, 0, 120_000, "intervention");
    expect(b.global).toBe("INTERVENTION");
  });
});

describe("advanceMock — halted branch", () => {
  it("reaches HALTED with active stage frozen", () => {
    const a = magiStart(magiInitial());
    const b = advanceMock(a, 0, 120_000, "halted");
    expect(b.global).toBe("HALTED");
    expect(b.stages.planning.verdict).toBe("NONE");
  });
});

describe("advanceMock — cursor-based", () => {
  it("returns a new cursor so callers can avoid replaying events", () => {
    const a = magiStart(magiInitial());
    const first = advanceMockCursor(a, 0, 30_000, "happy", 0);
    expect(first.cursor).toBeGreaterThan(0);
    const second = advanceMockCursor(first.state, 0, 60_000, "happy", first.cursor);
    expect(second.state.stages.planning.verdict).toBe("承認");
  });
});
