# MAGI Harness Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MAGI-style AI design-harness console as a new CarThing app bound to `preset3`, rendered from a deterministic mock so the screen feels like a live agentic workflow while the real harness is out of scope.

**Architecture:** A new `magi` app id, a pure MAGI state slice (global status + three stages + verdict + retry count + TYPE toggle + voice overlay), a deterministic mock timeline that advances the slice over time, MAGI-specific input routing (wheel→TYPE toggle, knob→start/pause, back→voice overlay, touch ignored), and a MAGI renderer with six always-on zones plus an on-demand voice-input drawer. All changes live client-side; no server / WS protocol changes.

**Tech Stack:** TypeScript strict, Vite, Vitest + happy-dom. No new runtime deps.

**Reference design:** [2026-04-15-magi-harness-console-design.md](2026-04-15-magi-harness-console-design.md) — consult §3 for state logic, §5 for mock timeline, §7 for risk mitigations. This plan implements that design 1-to-1.

---

## File Structure

Created:

- `client/src/magi/types.ts` — MAGI-specific types: `MagiGlobalStatus`, `MagiStageId`, `MagiVerdict`, `MagiSeverity`, `MagiStage`, `MagiState`, `MagiVoiceOverlay`, `MagiModelType`, `MagiHealth`, `MagiEvent`.
- `client/src/magi/invariants.ts` — `assertMagiInvariants(state)` — enforces §3.4 rules; used in reducer and tests.
- `client/src/magi/invariants.test.ts`
- `client/src/magi/state.ts` — pure reducer functions: `magiInitial`, `magiStart`, `magiTick`, `magiApplyEvent`, `magiTogglePause`, `magiToggleType`, `magiVoiceOpen`, `magiVoiceCancel`, `magiVoiceCommit`, `magiResolveIntervention`.
- `client/src/magi/state.test.ts`
- `client/src/magi/mock.ts` — deterministic timeline: `MockBranch`, `getMockEvents(branch)`, `advanceMock(state, startMs, nowMs, branch)`.
- `client/src/magi/mock.test.ts`
- `client/src/magi/transcripts.ts` — voice transcript pool + `createTranscriptCursor()`.
- `client/src/magi/transcripts.test.ts`
- `client/src/magi/input.ts` — MAGI-specific input router: `createMagiInputRouter(store)` with `handleWheel`, `handleKnobPress`, `handleBackButton`.
- `client/src/magi/input.test.ts`
- `client/src/ui/magi/index.ts` — MAGI renderer entry: `createMagiElements`, `renderMagi`.
- `client/src/ui/magi/index.test.ts`
- `client/src/ui/magi/hexagons.ts` — zone B (hex cluster + angular progress + verdict stamp).
- `client/src/ui/magi/hexagons.test.ts`
- `client/src/ui/magi/timeline.ts` — zone D.
- `client/src/ui/magi/timeline.test.ts`
- `client/src/ui/magi/intel-panel.ts` — zone C.
- `client/src/ui/magi/intel-panel.test.ts`
- `client/src/ui/magi/voice-overlay.ts` — zone G.
- `client/src/ui/magi/voice-overlay.test.ts`

Modified:

- `client/src/types.ts` — add `"magi"` to `AppId`; add `magi: MagiState` to `PlaybackStoreState`; extend `PlaybackStore` with MAGI action methods.
- `client/src/state.ts` — wire MAGI slice into the store.
- `client/src/state.test.ts` — new tests covering MAGI slice defaults and delegation.
- `client/src/app-switching.ts` — remap `preset3 → "magi"`.
- `client/src/app-switching.test.ts` — updated expectation.
- `client/src/input.ts` — add `isMagiActive` / `magiRouter` params; short-circuit wheel + back + knob when in MAGI; ignore touch.
- `client/src/input.test.ts` — new regression tests (back-in-MAGI ≠ exit, wheel-in-MAGI ≠ volume).
- `client/src/ui/renderer.ts` — register MAGI renderer, hide/show `.magi-screen`, update preset-hint labels (`Spotify / Home / MAGI / Settings`).
- `client/src/ui/renderer.test.ts` — new tests for MAGI shell mounting and preset-hint labels.
- `client/src/main.ts` — create mock ticker for MAGI, wire MAGI input router, update preset-hint flow.
- `client/src/styles/components.css` — MAGI zone styles (hex geometry, glyph tokens, rework hatching, intervention pulse, voice overlay drawer).
- `client/src/styles/components.test.ts` — assert new class selectors exist.
- `README.md` — add release note about `preset3` remap and in-MAGI input semantics (scroll→TYPE, back→voice).

---

## Conventions

- New modules use `const` / `let`, match colocated test style (`describe` / `it` / `expect`).
- Tests run under `happy-dom` via `// @vitest-environment happy-dom` at the top of DOM-touching files; pure-logic tests do not need the directive.
- Timestamps in tests: use `vi.spyOn(Date, "now").mockReturnValue(...)` (matches existing patterns in `state.test.ts`).
- Run the full test suite with `cd client && npm test`. Run a single file with `cd client && npx vitest run <path>`.
- Commit cadence: one commit per task, message prefix follows project style (`feat:`, `test:`, `refactor:`, etc.).

---

## Task 1: MAGI types and invariant validator

**Files:**
- Create: `client/src/magi/types.ts`
- Create: `client/src/magi/invariants.ts`
- Create: `client/src/magi/invariants.test.ts`

- [ ] **Step 1: Write the failing invariant tests**

Create `client/src/magi/invariants.test.ts`:

```typescript
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
  voice: { open: false, typedChars: 0, transcript: "", cursor: 0 }
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd client && npx vitest run src/magi/invariants.test.ts
```

Expected: all 6 tests fail with module-not-found / `assertMagiInvariants` not exported.

- [ ] **Step 3: Create `client/src/magi/types.ts`**

```typescript
export type MagiGlobalStatus =
  | "IDLE"          // 待機
  | "RUNNING"       // 審議中
  | "REWORK"        // 再審中
  | "INTERVENTION"  // 介入要請
  | "DONE"          // 決議終了
  | "HALTED";       // 異常停止

export type MagiStageId = "planning" | "execution" | "evaluation";

export type MagiStageStatus = "PENDING" | "ACTIVE" | "STAMPED" | "PENDING_REWORK";

export type MagiVerdict = "NONE" | "承認" | "否定";

export type MagiSeverity = "LOW" | "MEDIUM" | "HIGH";

export type MagiConfidence = "LOW" | "MED" | "HIGH";

export type MagiHealth = "ONLINE" | "STABLE" | "DEGRADED" | "RELINK" | "OFFLINE";

export type MagiModelType = "CLD" | "CDX";

export interface MagiStage {
  id: MagiStageId;
  status: MagiStageStatus;
  progress: number;   // 0.0 – 1.0
  verdict: MagiVerdict;
  handoff: number;
  confidence: MagiConfidence;
  source: string;
  summary: readonly string[];   // capped at 4 dynamic lines + TASK/SOURCE/HANDOFF/CONF headers rendered by UI
  rejectionReason?: string;     // present when verdict = 否定 (evaluation only)
}

export interface MagiVoiceOverlay {
  open: boolean;
  transcript: string;   // full transcript text for the current invocation
  typedChars: number;   // how many characters have been revealed so far
  cursor: number;       // round-robin pool index for the next invocation
}

export interface MagiState {
  global: MagiGlobalStatus;
  stages: {
    planning: MagiStage;
    execution: MagiStage;
    evaluation: MagiStage;
  };
  retryCount: number;   // cumulative 否定 count in the current run (§3.5, cap = 2)
  health: MagiHealth;
  modelType: MagiModelType;
  voice: MagiVoiceOverlay;
  activeStage: MagiStageId | null;   // which stage to mirror in zone C; null when IDLE/DONE/HALTED
  runStartedAtMs: number;            // 0 when not running
  pausedAtMs: number;                // 0 when not paused
}

export interface MagiStageUpdate {
  progressDelta?: number;
  handoffDelta?: number;
  confidence?: MagiConfidence;
  sourceSet?: string;
  summaryAppend?: string;   // appended with 4-line cap
}

export type MagiEvent =
  | { kind: "STAGE_ENTER"; stage: MagiStageId; source: string }
  | { kind: "STAGE_UPDATE"; stage: MagiStageId; patch: MagiStageUpdate }
  | { kind: "STAGE_VERDICT"; stage: MagiStageId; verdict: "承認" }
  | { kind: "EVAL_REJECT"; severity: MagiSeverity; upstream: "planning" | "execution"; reason: string }
  | { kind: "HEALTH"; health: MagiHealth }
  | { kind: "HALT"; reason: string };
```

- [ ] **Step 4: Create `client/src/magi/invariants.ts`**

```typescript
import type { MagiState } from "./types";

export function assertMagiInvariants(state: MagiState): void {
  const stages = [state.stages.planning, state.stages.execution, state.stages.evaluation];
  const anyActive = stages.some((s) => s.status === "ACTIVE");

  // Rule 1: if any hexagon is ACTIVE, global must be RUNNING or REWORK
  if (anyActive && state.global !== "RUNNING" && state.global !== "REWORK") {
    throw new Error(`MAGI invariant rule 1 violated: stage ACTIVE while global=${state.global}`);
  }

  // Rule 2: if all three STAMPED with 承認, global must be DONE
  const allStampedApproved =
    stages.every((s) => s.status === "STAMPED" && s.verdict === "承認");
  if (allStampedApproved && state.global !== "DONE") {
    throw new Error(`MAGI invariant rule 2 violated: all 承認 but global=${state.global}`);
  }

  // Rule 3: if evaluation is STAMPED with 否定, global must be REWORK or INTERVENTION
  const evalRejected =
    state.stages.evaluation.status === "STAMPED" && state.stages.evaluation.verdict === "否定";
  if (evalRejected && state.global !== "REWORK" && state.global !== "INTERVENTION") {
    throw new Error(`MAGI invariant rule 3 violated: eval 否定 but global=${state.global}`);
  }

  // Rule 4: if global is IDLE, all progress must be 0 and verdict NONE
  if (state.global === "IDLE") {
    const dirty = stages.some((s) => s.progress !== 0 || s.verdict !== "NONE" || s.status !== "PENDING");
    if (dirty) {
      throw new Error("MAGI invariant rule 4 violated: IDLE state has non-pending stages");
    }
  }

  // Rule 5: if HALTED, the active stage must not carry a verdict
  if (state.global === "HALTED") {
    const bad = stages.find((s) => s.status === "ACTIVE" && s.verdict !== "NONE");
    if (bad) {
      throw new Error(`MAGI invariant rule 5 violated: HALTED with verdict on ACTIVE stage ${bad.id}`);
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd client && npx vitest run src/magi/invariants.test.ts
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add client/src/magi/types.ts client/src/magi/invariants.ts client/src/magi/invariants.test.ts
git commit -m "feat(magi): add types and §3.4 invariant validator"
```

---

## Task 2: MAGI reducer slice — initial state, start, pause, TYPE toggle

**Files:**
- Create: `client/src/magi/state.ts`
- Create: `client/src/magi/state.test.ts`

- [ ] **Step 1: Write failing reducer tests (init/start/toggle/pause)**

```typescript
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
```

- [ ] **Step 2: Verify tests fail**

```bash
cd client && npx vitest run src/magi/state.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement `client/src/magi/state.ts` for these four reducers**

```typescript
import type {
  MagiConfidence,
  MagiGlobalStatus,
  MagiHealth,
  MagiModelType,
  MagiStage,
  MagiStageId,
  MagiState
} from "./types";

const BLANK_STAGE = (id: MagiStageId): MagiStage => ({
  id,
  status: "PENDING",
  progress: 0,
  verdict: "NONE",
  handoff: 0,
  confidence: "MED",
  source: "",
  summary: []
});

export function magiInitial(): MagiState {
  return {
    global: "IDLE",
    stages: {
      planning: BLANK_STAGE("planning"),
      execution: BLANK_STAGE("execution"),
      evaluation: BLANK_STAGE("evaluation")
    },
    retryCount: 0,
    health: "ONLINE",
    modelType: "CLD",
    voice: { open: false, transcript: "", typedChars: 0, cursor: 0 },
    activeStage: null,
    runStartedAtMs: 0,
    pausedAtMs: 0
  };
}

export function magiStart(state: MagiState): MagiState {
  if (state.global !== "IDLE") return state;
  return {
    ...state,
    global: "RUNNING",
    activeStage: "planning",
    runStartedAtMs: Date.now(),
    stages: {
      ...state.stages,
      planning: { ...state.stages.planning, status: "ACTIVE" }
    }
  };
}

export function magiToggleType(state: MagiState): MagiState {
  const next: MagiModelType = state.modelType === "CLD" ? "CDX" : "CLD";
  return { ...state, modelType: next };
}

export function magiTogglePause(state: MagiState): MagiState {
  if (state.global === "IDLE" || state.global === "DONE" || state.global === "HALTED") {
    return state;
  }
  if (state.pausedAtMs === 0) {
    return { ...state, pausedAtMs: Date.now() };
  }
  const pausedFor = Date.now() - state.pausedAtMs;
  return { ...state, pausedAtMs: 0, runStartedAtMs: state.runStartedAtMs + pausedFor };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
cd client && npx vitest run src/magi/state.test.ts
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add client/src/magi/state.ts client/src/magi/state.test.ts
git commit -m "feat(magi): reducer slice — init, start, type toggle, pause"
```

---

## Task 3: MAGI reducer slice — event application (progress, verdict, rework, intervention, halt)

**Files:**
- Modify: `client/src/magi/state.ts`
- Modify: `client/src/magi/state.test.ts`

- [ ] **Step 1: Append failing tests for `magiApplyEvent`**

Append to `client/src/magi/state.test.ts`:

```typescript
import { magiApplyEvent } from "./state";
import type { MagiEvent } from "./types";

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
```

- [ ] **Step 2: Verify the new tests fail**

```bash
cd client && npx vitest run src/magi/state.test.ts
```

Expected: the new `magiApplyEvent`-based tests fail (import missing / function undefined).

- [ ] **Step 3: Extend `client/src/magi/state.ts`**

Append:

```typescript
import type { MagiEvent, MagiStageId, MagiState, MagiStage } from "./types";

const STAGE_ORDER: readonly MagiStageId[] = ["planning", "execution", "evaluation"] as const;
const RETRY_CAP = 2;   // §3.5 — 3rd rejection (retryCount would become 3) → INTERVENTION

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function updateStage(state: MagiState, id: MagiStageId, patch: Partial<MagiStage>): MagiState {
  return { ...state, stages: { ...state.stages, [id]: { ...state.stages[id], ...patch } } };
}

export function magiApplyEvent(state: MagiState, event: MagiEvent): MagiState {
  switch (event.kind) {
    case "HEALTH":
      return { ...state, health: event.health };

    case "HALT": {
      const active = state.activeStage;
      if (!active) return { ...state, global: "HALTED" };
      return {
        ...updateStage(state, active, { verdict: "NONE" }),
        global: "HALTED"
      };
    }

    case "STAGE_ENTER": {
      return updateStage(state, event.stage, {
        status: "ACTIVE",
        progress: 0,
        verdict: "NONE",
        source: event.source
      });
    }

    case "STAGE_UPDATE": {
      if (event.stage !== state.activeStage) return state;
      const stage = state.stages[event.stage];
      const next: Partial<MagiStage> = {};
      if (event.patch.progressDelta !== undefined) {
        next.progress = clamp01(stage.progress + event.patch.progressDelta);
      }
      if (event.patch.handoffDelta !== undefined) {
        next.handoff = stage.handoff + event.patch.handoffDelta;
      }
      if (event.patch.confidence !== undefined) {
        next.confidence = event.patch.confidence;
      }
      if (event.patch.sourceSet !== undefined) {
        next.source = event.patch.sourceSet;
      }
      if (event.patch.summaryAppend !== undefined) {
        const summary = [...stage.summary, event.patch.summaryAppend];
        next.summary = summary.length > 4 ? summary.slice(summary.length - 4) : summary;
      }
      return updateStage(state, event.stage, next);
    }

    case "STAGE_VERDICT": {
      const stamped = updateStage(state, event.stage, {
        status: "STAMPED",
        verdict: "承認",
        progress: 1
      });
      const idx = STAGE_ORDER.indexOf(event.stage);
      if (idx < STAGE_ORDER.length - 1) {
        const nextId = STAGE_ORDER[idx + 1];
        return {
          ...updateStage(stamped, nextId, { status: "ACTIVE", progress: 0, verdict: "NONE" }),
          activeStage: nextId
        };
      }
      // evaluation stamped 承認 → DONE
      return { ...stamped, global: "DONE", activeStage: null };
    }

    case "EVAL_REJECT": {
      const retryNext = state.retryCount + 1;
      const stamped = updateStage(state, "evaluation", {
        status: "STAMPED",
        verdict: "否定",
        progress: 1,
        rejectionReason: event.reason
      });

      if (event.severity === "HIGH" || retryNext > RETRY_CAP) {
        return { ...stamped, global: "INTERVENTION", retryCount: retryNext };
      }
      // MEDIUM within retry budget → REWORK loop
      const reopened = updateStage(stamped, event.upstream, {
        status: "ACTIVE",
        progress: 0,
        verdict: "NONE"
      });
      return { ...reopened, global: "REWORK", retryCount: retryNext, activeStage: event.upstream };
    }

    default:
      return state;
  }
}
```

- [ ] **Step 4: Verify all tests pass**

```bash
cd client && npx vitest run src/magi/state.test.ts src/magi/invariants.test.ts
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add client/src/magi/state.ts client/src/magi/state.test.ts
git commit -m "feat(magi): event reducer — progress, verdict, rework, intervention, halt"
```

---

## Task 4: Voice overlay reducers and transcript pool

**Files:**
- Create: `client/src/magi/transcripts.ts`
- Create: `client/src/magi/transcripts.test.ts`
- Modify: `client/src/magi/state.ts`
- Modify: `client/src/magi/state.test.ts`

- [ ] **Step 1: Write failing transcript tests**

Create `client/src/magi/transcripts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { MAGI_TRANSCRIPTS, pickTranscript } from "./transcripts";

describe("MAGI_TRANSCRIPTS", () => {
  it("has 5 plausible dictation lines", () => {
    expect(MAGI_TRANSCRIPTS).toHaveLength(5);
    MAGI_TRANSCRIPTS.forEach((line) => {
      expect(line.length).toBeGreaterThan(20);
      expect(line.length).toBeLessThan(120);
    });
  });
});

describe("pickTranscript", () => {
  it("round-robins through the pool", () => {
    expect(pickTranscript(0)).toBe(MAGI_TRANSCRIPTS[0]);
    expect(pickTranscript(1)).toBe(MAGI_TRANSCRIPTS[1]);
    expect(pickTranscript(4)).toBe(MAGI_TRANSCRIPTS[4]);
    expect(pickTranscript(5)).toBe(MAGI_TRANSCRIPTS[0]);
    expect(pickTranscript(12)).toBe(MAGI_TRANSCRIPTS[2]);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
cd client && npx vitest run src/magi/transcripts.test.ts
```

- [ ] **Step 3: Implement `client/src/magi/transcripts.ts`**

```typescript
export const MAGI_TRANSCRIPTS: readonly string[] = [
  "tighten evaluation rubric around state coverage",
  "add a loading skeleton to the hex cluster",
  "reduce handoff count budget to two",
  "switch backend to codex for the next pass",
  "mark this run as a design exploration not a ship candidate"
] as const;

export function pickTranscript(cursor: number): string {
  const n = MAGI_TRANSCRIPTS.length;
  const idx = ((cursor % n) + n) % n;
  return MAGI_TRANSCRIPTS[idx];
}
```

- [ ] **Step 4: Write failing voice-overlay reducer tests**

Append to `client/src/magi/state.test.ts`:

```typescript
import { magiVoiceOpen, magiVoiceTick, magiVoiceCancel, magiVoiceCommit } from "./state";

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
```

- [ ] **Step 5: Verify failure**

- [ ] **Step 6: Implement voice reducers in `client/src/magi/state.ts`**

Append:

```typescript
import { pickTranscript } from "./transcripts";

export function magiVoiceOpen(state: MagiState): MagiState {
  const transcript = pickTranscript(state.voice.cursor);
  return {
    ...state,
    voice: { open: true, transcript, typedChars: 0, cursor: state.voice.cursor + 1 }
  };
}

export function magiVoiceTick(state: MagiState, charsDelta: number): MagiState {
  if (!state.voice.open) return state;
  const max = state.voice.transcript.length;
  const next = Math.min(max, state.voice.typedChars + charsDelta);
  if (next === state.voice.typedChars) return state;
  return { ...state, voice: { ...state.voice, typedChars: next } };
}

export function magiVoiceCancel(state: MagiState): MagiState {
  if (!state.voice.open) return state;
  return { ...state, voice: { ...state.voice, open: false, typedChars: 0 } };
}

export function magiVoiceCommit(state: MagiState): MagiState {
  if (!state.voice.open) return state;
  const closed: MagiState = { ...state, voice: { ...state.voice, open: false, typedChars: 0 } };
  if (!state.activeStage) return closed;
  const line = `VOICE: "${state.voice.transcript}"`;
  return magiApplyEvent(closed, {
    kind: "STAGE_UPDATE",
    stage: state.activeStage,
    patch: { summaryAppend: line }
  });
}
```

- [ ] **Step 7: Verify all tests pass**

```bash
cd client && npx vitest run src/magi
```

- [ ] **Step 8: Commit**

```bash
git add client/src/magi/transcripts.ts client/src/magi/transcripts.test.ts client/src/magi/state.ts client/src/magi/state.test.ts
git commit -m "feat(magi): voice overlay reducers and transcript pool"
```

---

## Task 5: Deterministic mock timeline driver

**Files:**
- Create: `client/src/magi/mock.ts`
- Create: `client/src/magi/mock.test.ts`

The mock drives a MAGI state through a scripted run (§5.2–5.8). `advanceMock` is pure: given a starting state, a start time, a "now" time, and a branch selector, it applies every event whose scheduled offset ≤ `now − startMs` and returns the resulting state. This makes tests deterministic and the UI tick loop trivially replaceable by a real WS feed later.

- [ ] **Step 1: Write failing mock tests**

Create `client/src/magi/mock.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceMock, MOCK_HAPPY_PATH_DURATION_MS } from "./mock";
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
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/magi/mock.ts`**

```typescript
import { magiApplyEvent } from "./state";
import type { MagiEvent, MagiState } from "./types";

export type MockBranch = "happy" | "intervention" | "halted";

interface ScheduledEvent {
  atMs: number;
  event: MagiEvent;
}

// Happy path: Planning (25s) → Execution (40s) → Evaluation reject MEDIUM
// → Execution rework (20s) → Evaluation approve (15s).
const HAPPY: readonly ScheduledEvent[] = (() => {
  const out: ScheduledEvent[] = [];
  // --- Planning (0 – 25s)
  out.push({ atMs:    0, event: { kind: "STAGE_ENTER", stage: "planning", source: "PRD" } });
  for (let i = 1; i <= 25; i++) {
    out.push({ atMs: i * 1000, event: { kind: "STAGE_UPDATE", stage: "planning", patch: { progressDelta: 1 / 25 } } });
  }
  out.push({ atMs:  6000, event: { kind: "STAGE_UPDATE", stage: "planning", patch: { handoffDelta: 1, summaryAppend: "PARSED 1× PRD, 1× BRIEF" } } });
  out.push({ atMs: 11000, event: { kind: "STAGE_UPDATE", stage: "planning", patch: { confidence: "MED" } } });
  out.push({ atMs: 16000, event: { kind: "STAGE_UPDATE", stage: "planning", patch: { confidence: "HIGH", summaryAppend: "DRAFTED 3 ALT FLOWS, 1 SELECTED" } } });
  out.push({ atMs: 21000, event: { kind: "STAGE_UPDATE", stage: "planning", patch: { handoffDelta: 2, summaryAppend: "RISKS 2 OPEN (AUTH, OFFLINE)" } } });
  out.push({ atMs: 25000, event: { kind: "STAGE_VERDICT", stage: "planning", verdict: "承認" } });

  // --- Execution (25 – 65s)
  out.push({ atMs: 25000, event: { kind: "STAGE_ENTER", stage: "execution", source: "PLAN_V1" } });
  for (let i = 1; i <= 40; i++) {
    // non-linear: plateau at ~35% (10s) and ~70% (10s)
    const gain = (i >= 14 && i <= 16) || (i >= 28 && i <= 30) ? 0 : 1 / 34;
    out.push({ atMs: 25000 + i * 1000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { progressDelta: gain } } });
  }
  out.push({ atMs: 40000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { summaryAppend: "COMPONENT: HEX_CLUSTER, STATUS_BADGE", handoffDelta: 1 } } });
  out.push({ atMs: 55000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { summaryAppend: "TOKENS 42 APPLIED", confidence: "MED" } } });
  out.push({ atMs: 65000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { progressDelta: 1 } } });   // clamp to 1
  out.push({ atMs: 65000, event: { kind: "STAGE_VERDICT", stage: "execution", verdict: "承認" } });

  // --- Evaluation first pass (65 – 85s) ends with 否定 MEDIUM
  out.push({ atMs: 65000, event: { kind: "STAGE_ENTER", stage: "evaluation", source: "PROTOTYPE_V1" } });
  for (let i = 1; i <= 20; i++) {
    out.push({ atMs: 65000 + i * 1000, event: { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 1 / 20 } } });
  }
  out.push({ atMs: 75000, event: { kind: "STAGE_UPDATE", stage: "evaluation", patch: { summaryAppend: "STATE_COVER FAIL", confidence: "LOW" } } });
  out.push({ atMs: 85000, event: { kind: "EVAL_REJECT", severity: "MEDIUM", upstream: "execution", reason: "STATE_COVER incomplete on HEX_CLUSTER" } });

  // --- Execution rework (85 – 105s)
  for (let i = 1; i <= 20; i++) {
    out.push({ atMs: 85000 + i * 1000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { progressDelta: 1 / 20 } } });
  }
  out.push({ atMs: 90000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { summaryAppend: "ADDED empty/loading/error states" } } });
  out.push({ atMs: 100000, event: { kind: "STAGE_UPDATE", stage: "execution", patch: { summaryAppend: "TESTED 8/8 RUBRIC PASS", confidence: "HIGH" } } });
  out.push({ atMs: 105000, event: { kind: "STAGE_VERDICT", stage: "execution", verdict: "承認" } });

  // --- Evaluation second pass (105 – 120s) → DONE
  out.push({ atMs: 105000, event: { kind: "STAGE_ENTER", stage: "evaluation", source: "PROTOTYPE_V2" } });
  for (let i = 1; i <= 15; i++) {
    out.push({ atMs: 105000 + i * 1000, event: { kind: "STAGE_UPDATE", stage: "evaluation", patch: { progressDelta: 1 / 15 } } });
  }
  out.push({ atMs: 115000, event: { kind: "STAGE_UPDATE", stage: "evaluation", patch: { summaryAppend: "RUBRIC ALL PASS", confidence: "HIGH" } } });
  out.push({ atMs: 120000, event: { kind: "STAGE_VERDICT", stage: "evaluation", verdict: "承認" } });

  return out;
})();

const INTERVENTION: readonly ScheduledEvent[] = (() => {
  const out = HAPPY.filter((e) => e.atMs < 85000).slice();
  out.push({
    atMs: 85000,
    event: { kind: "EVAL_REJECT", severity: "HIGH", upstream: "execution", reason: "policy violation in consent flow" }
  });
  return out;
})();

const HALTED: readonly ScheduledEvent[] = (() => {
  const out = HAPPY.filter((e) => e.atMs < 30000).slice();
  out.push({ atMs: 30000, event: { kind: "HALT", reason: "ws drop exceeded reconnect budget" } });
  return out;
})();

const SCHEDULES: Record<MockBranch, readonly ScheduledEvent[]> = {
  happy: HAPPY,
  intervention: INTERVENTION,
  halted: HALTED
};

export const MOCK_HAPPY_PATH_DURATION_MS = 120_000;

export function advanceMock(
  state: MagiState,
  startMs: number,
  nowMs: number,
  branch: MockBranch
): MagiState {
  const elapsed = Math.max(0, nowMs - startMs);
  const schedule = SCHEDULES[branch];
  let next = state;
  for (const se of schedule) {
    if (se.atMs > elapsed) break;
    // Skip events that would only replay progress already present after a previous advanceMock.
    // In this simple model we fire every event once per call; callers pass a starting state
    // produced by the previous call, so events past a STAGE_ENTER re-fire only if caller passed
    // the same earlier state. For tests we drive from a fresh started() state, so this is fine.
    next = magiApplyEvent(next, se.event);
  }
  return next;
}
```

NOTE on "replay": `advanceMock` is called with an increasing `nowMs`, driven by a 100 ms ticker in `main.ts`. Since the runtime store is mutated across ticks, firing the full schedule each time would double-count updates. The production wiring in Task 12 uses a **cursor-based** advance instead; the pure function above is kept deterministic for tests where the starting state is always fresh. Task 12 introduces `createMockDriver` around this module.

- [ ] **Step 4: Verify tests pass**

```bash
cd client && npx vitest run src/magi/mock.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add client/src/magi/mock.ts client/src/magi/mock.test.ts
git commit -m "feat(magi): deterministic mock timeline for happy/intervention/halted"
```

---

## Task 6: MAGI input router (pure)

**Files:**
- Create: `client/src/magi/input.ts`
- Create: `client/src/magi/input.test.ts`

- [ ] **Step 1: Write failing router tests**

```typescript
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createMagiInputRouter } from "./input";
import { magiInitial } from "./state";
import type { MagiState } from "./types";

function mkStore() {
  let state: MagiState = magiInitial();
  return {
    get: () => state,
    apply: (fn: (s: MagiState) => MagiState) => { state = fn(state); }
  };
}

describe("createMagiInputRouter", () => {
  it("wheel toggles TYPE (debounced at ~200 ms)", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);

    router.handleWheel(1);
    expect(store.get().modelType).toBe("CDX");

    // Second tick inside debounce window: ignored.
    vi.spyOn(Date, "now").mockReturnValue(1100);
    router.handleWheel(1);
    expect(store.get().modelType).toBe("CDX");

    // Outside debounce: toggle again.
    vi.spyOn(Date, "now").mockReturnValue(1300);
    router.handleWheel(-1);
    expect(store.get().modelType).toBe("CLD");
  });

  it("knob press starts the run when IDLE", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleKnobPress();
    expect(store.get().global).toBe("RUNNING");
  });

  it("knob press pauses/resumes a running run", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleKnobPress();   // start
    vi.spyOn(Date, "now").mockReturnValue(2000);
    router.handleKnobPress();   // pause
    expect(store.get().pausedAtMs).toBe(2000);
    vi.spyOn(Date, "now").mockReturnValue(4000);
    router.handleKnobPress();   // resume
    expect(store.get().pausedAtMs).toBe(0);
  });

  it("back opens voice overlay, back again cancels", () => {
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleBackButton();
    expect(store.get().voice.open).toBe(true);
    router.handleBackButton();
    expect(store.get().voice.open).toBe(false);
  });

  it("knob press commits voice overlay when open", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleKnobPress();     // start run
    router.handleBackButton();    // open voice
    expect(store.get().voice.open).toBe(true);
    router.handleKnobPress();     // commit
    expect(store.get().voice.open).toBe(false);
    expect(store.get().stages.planning.summary.length).toBe(1);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/magi/input.ts`**

```typescript
import {
  magiStart,
  magiTogglePause,
  magiToggleType,
  magiVoiceOpen,
  magiVoiceCancel,
  magiVoiceCommit
} from "./state";
import type { MagiState } from "./types";

const WHEEL_DEBOUNCE_MS = 200;

export interface MagiInputRouter {
  handleWheel(delta: number): void;
  handleKnobPress(): void;
  handleBackButton(): void;
}

export interface MagiStoreHandle {
  get(): MagiState;
  apply(fn: (s: MagiState) => MagiState): void;
}

export function createMagiInputRouter(store: MagiStoreHandle): MagiInputRouter {
  let lastWheelMs = 0;

  return {
    handleWheel(): void {
      const now = Date.now();
      if (now - lastWheelMs < WHEEL_DEBOUNCE_MS) return;
      lastWheelMs = now;
      store.apply(magiToggleType);
    },
    handleKnobPress(): void {
      const state = store.get();
      if (state.voice.open) {
        store.apply(magiVoiceCommit);
        return;
      }
      if (state.global === "IDLE") {
        store.apply(magiStart);
        return;
      }
      store.apply(magiTogglePause);
    },
    handleBackButton(): void {
      const state = store.get();
      if (state.voice.open) {
        store.apply(magiVoiceCancel);
        return;
      }
      store.apply(magiVoiceOpen);
    }
  };
}
```

- [ ] **Step 4: Verify tests pass**

- [ ] **Step 5: Commit**

```bash
git add client/src/magi/input.ts client/src/magi/input.test.ts
git commit -m "feat(magi): input router — wheel/knob/back mapping"
```

---

## Task 7: Remap `preset3` to MAGI and extend `AppId`

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/app-switching.ts`
- Modify: `client/src/app-switching.test.ts`

- [ ] **Step 1: Update failing test**

Edit `client/src/app-switching.test.ts` so it expects preset3 → magi:

```typescript
  it("routes preset2 to home and preset3 to magi", () => {
    expect(mapHardwareButtonToApp("preset2")).toBe("home");
    expect(mapHardwareButtonToApp("preset3")).toBe("magi");
  });
```

Remove the earlier expectation that preset3 → home.

- [ ] **Step 2: Verify failure**

```bash
cd client && npx vitest run src/app-switching.test.ts
```

Expected: preset3 test fails.

- [ ] **Step 3: Extend `AppId` in `client/src/types.ts`**

Change:

```typescript
export type AppId = "spotify" | "home" | "settings";
```

to:

```typescript
export type AppId = "spotify" | "home" | "magi" | "settings";
```

- [ ] **Step 4: Update `client/src/app-switching.ts`**

```typescript
import type { AppId } from "./types";

export function mapHardwareButtonToApp(button: string): AppId | null {
  if (button === "preset1") return "spotify";
  if (button === "preset2") return "home";
  if (button === "preset3") return "magi";
  if (button === "preset4") return "settings";
  return null;
}
```

- [ ] **Step 5: Verify tests pass**

```bash
cd client && npx vitest run src/app-switching.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add client/src/types.ts client/src/app-switching.ts client/src/app-switching.test.ts
git commit -m "feat(magi): route preset3 to magi app"
```

---

## Task 8: Wire MAGI slice into the main playback store

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/state.ts`
- Modify: `client/src/state.test.ts`

- [ ] **Step 1: Write failing store-integration tests**

Append to `client/src/state.test.ts`:

```typescript
describe("createPlaybackStore — MAGI slice", () => {
  it("initialises a MAGI slice in IDLE", () => {
    const store = createPlaybackStore();
    expect(store.getState().magi.global).toBe("IDLE");
    expect(store.getState().magi.modelType).toBe("CLD");
  });

  it("magiDispatch notifies subscribers and produces a new slice", () => {
    const store = createPlaybackStore();
    const seen: string[] = [];
    store.subscribe((s) => seen.push(s.magi.global));
    store.magiDispatch((s) => ({ ...s, global: "RUNNING" as const }));
    expect(store.getState().magi.global).toBe("RUNNING");
    expect(seen).toContain("RUNNING");
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Extend `PlaybackStoreState` and `PlaybackStore` in `client/src/types.ts`**

Add import at top:

```typescript
import type { MagiState } from "./magi/types";
```

Extend:

```typescript
export interface PlaybackStoreState {
  current: PlaybackSnapshot;
  display: PlaybackSnapshot;
  status: PlaybackStatus;
  progressAnchorTs: number;
  activeApp: AppId;
  clockAnchor: ClockAnchor;
  homeTimer: HomeTimerState;
  settings: SettingsViewState;
  preferences: Preferences;
  magi: MagiState;
}

export interface PlaybackStore {
  // …existing members…
  magiDispatch(fn: (s: MagiState) => MagiState): void;
}
```

- [ ] **Step 4: Wire into `client/src/state.ts`**

At top:

```typescript
import { magiInitial } from "./magi/state";
import type { MagiState } from "./magi/types";
```

Inside `createPlaybackStore`, add:

```typescript
let magi: MagiState = magiInitial();
```

Include `magi` in the `snapshot()` return. Add the method:

```typescript
    magiDispatch(fn: (s: MagiState) => MagiState): void {
      magi = fn(magi);
      publish();
    },
```

- [ ] **Step 5: Verify all store tests pass**

```bash
cd client && npx vitest run src/state.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add client/src/types.ts client/src/state.ts client/src/state.test.ts
git commit -m "feat(magi): integrate magi slice into playback store"
```

---

## Task 9: MAGI renderer shell + fixed zones (badges, health, type, header)

**Files:**
- Create: `client/src/ui/magi/index.ts`
- Create: `client/src/ui/magi/index.test.ts`

The hex cluster, timeline, intel panel, and voice overlay are their own modules built in Tasks 10–13. This task scaffolds the shell + simple zones.

- [ ] **Step 1: Write failing shell test**

```typescript
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
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/ui/magi/index.ts`**

```typescript
import type { MagiGlobalStatus, MagiState } from "../../magi/types";

export interface MagiElements {
  root: HTMLElement;
  statusBadge: HTMLElement;
  hexCluster: HTMLElement;
  intelPanel: HTMLElement;
  timeline: HTMLElement;
  systemHealth: HTMLElement;
  modelType: HTMLElement;
  voiceOverlay: HTMLElement;
  header: HTMLElement;
}

const STATUS_GLYPH: Record<MagiGlobalStatus, string> = {
  IDLE: "待機",
  RUNNING: "審議中",
  REWORK: "再審中",
  INTERVENTION: "介入要請",
  DONE: "決議終了",
  HALTED: "異常停止"
};

function zone(doc: Document, cls: string): HTMLElement {
  const el = doc.createElement("div");
  el.className = cls;
  return el;
}

export function createMagiElements(doc: Document): MagiElements {
  const root = zone(doc, "magi-screen");
  const header = zone(doc, "magi-zone-header");
  header.textContent = "SESSION: MAGI DESIGN HARNESS 01 / ACCESS MODE: SUPERVISER";

  const statusBadge = zone(doc, "magi-zone-status-badge");
  const hexCluster = zone(doc, "magi-zone-hex-cluster");
  const intelPanel = zone(doc, "magi-zone-intel-panel");
  const timeline = zone(doc, "magi-zone-timeline");
  const systemHealth = zone(doc, "magi-zone-system-health");
  const modelType = zone(doc, "magi-zone-model-type");
  const voiceOverlay = zone(doc, "magi-voice-overlay");
  voiceOverlay.hidden = true;

  [header, statusBadge, hexCluster, intelPanel, timeline, systemHealth, modelType, voiceOverlay]
    .forEach((el) => root.appendChild(el));

  return { root, header, statusBadge, hexCluster, intelPanel, timeline, systemHealth, modelType, voiceOverlay };
}

export function renderMagi(elements: MagiElements, state: MagiState): void {
  elements.statusBadge.textContent = STATUS_GLYPH[state.global];
  elements.statusBadge.setAttribute("data-status", state.global);

  elements.systemHealth.textContent = state.health;
  elements.systemHealth.setAttribute("data-health", state.health);

  elements.modelType.textContent = `TYPE / ${state.modelType}`;
  elements.modelType.setAttribute("data-model", state.modelType);

  if (state.global === "IDLE") {
    elements.intelPanel.textContent = "PRESS KNOB TO BEGIN RUN";
  }
  // Hex cluster, timeline, intel panel (non-IDLE) and voice overlay handled in Tasks 10–13.
}
```

- [ ] **Step 4: Verify tests pass**

- [ ] **Step 5: Commit**

```bash
git add client/src/ui/magi/index.ts client/src/ui/magi/index.test.ts
git commit -m "feat(magi): renderer shell + fixed zones (badges, health, type)"
```

---

## Task 10: Hex cluster (zone B) — progress sweep + verdict stamp

**Files:**
- Create: `client/src/ui/magi/hexagons.ts`
- Create: `client/src/ui/magi/hexagons.test.ts`
- Modify: `client/src/ui/magi/index.ts` to mount the cluster

- [ ] **Step 1: Write failing hex tests**

```typescript
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
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/ui/magi/hexagons.ts`**

```typescript
import type { MagiStage, MagiStageId, MagiState } from "../../magi/types";

const STAGE_LABELS: Record<MagiStageId, { number: string; codename: string }> = {
  planning:   { number: "1", codename: "MELCHIOR" },
  execution:  { number: "2", codename: "BALTHASAR" },
  evaluation: { number: "3", codename: "CASPER" }
};

const STAGE_ORDER: readonly MagiStageId[] = ["execution", "planning", "evaluation"] as const;
// Cluster visual order: BALTHASAR (center/top), MELCHIOR (left), CASPER (right) per Figma.
// Note: screen uses (left, center, right) = (planning #1 label, execution #2 label, evaluation #3 label)
// but the number labels read 1/2/3 — adjust once Figma is confirmed.

export interface HexClusterElements {
  root: HTMLElement;
  hexagons: Record<MagiStageId, HTMLElement>;
}

export function createHexCluster(doc: Document): HexClusterElements {
  const root = doc.createElement("div");
  root.className = "magi-hex-cluster";
  const hexagons = {} as Record<MagiStageId, HTMLElement>;

  STAGE_ORDER.forEach((id) => {
    const hex = doc.createElement("div");
    hex.className = "magi-hexagon";
    hex.setAttribute("data-stage", id);
    hex.setAttribute("data-status", "PENDING");
    hex.setAttribute("data-verdict", "NONE");

    const number = doc.createElement("span");
    number.className = "magi-hex-number";
    number.textContent = STAGE_LABELS[id].number;

    const codename = doc.createElement("span");
    codename.className = "magi-hex-codename";
    codename.textContent = STAGE_LABELS[id].codename;

    const stamp = doc.createElement("span");
    stamp.className = "magi-hex-stamp";
    stamp.hidden = true;

    hex.appendChild(number);
    hex.appendChild(codename);
    hex.appendChild(stamp);
    root.appendChild(hex);
    hexagons[id] = hex;
  });

  return { root, hexagons };
}

function renderHex(el: HTMLElement, stage: MagiStage, isActive: boolean): void {
  el.setAttribute("data-status", stage.status);
  el.setAttribute("data-verdict", stage.verdict);
  el.style.setProperty("--magi-progress", stage.progress.toFixed(2));
  el.classList.toggle("magi-hex-focused", isActive);

  const stamp = el.querySelector(".magi-hex-stamp") as HTMLElement;
  if (stage.verdict === "NONE") {
    stamp.hidden = true;
    stamp.textContent = "";
  } else {
    stamp.hidden = false;
    stamp.textContent = stage.verdict;
  }
}

export function renderHexCluster(cluster: HexClusterElements, state: MagiState): void {
  (Object.keys(cluster.hexagons) as MagiStageId[]).forEach((id) => {
    renderHex(cluster.hexagons[id], state.stages[id], state.activeStage === id);
  });
}
```

- [ ] **Step 4: Mount into `client/src/ui/magi/index.ts`**

Import and use in `createMagiElements` and `renderMagi`:

```typescript
import { createHexCluster, renderHexCluster, type HexClusterElements } from "./hexagons";
```

Add `hexCluster: HexClusterElements` to the internal shape stored alongside elements (or attach via a closure). Simplest: add a field to `MagiElements`:

```typescript
export interface MagiElements {
  // …existing fields…
  hexClusterImpl: HexClusterElements;
}
```

Inside `createMagiElements`, replace `const hexCluster = zone(doc, "magi-zone-hex-cluster");` with:

```typescript
const hexClusterImpl = createHexCluster(doc);
hexClusterImpl.root.classList.add("magi-zone-hex-cluster");
const hexCluster = hexClusterImpl.root;
```

Return `hexClusterImpl` in the object. In `renderMagi`, call `renderHexCluster(elements.hexClusterImpl, state)`.

- [ ] **Step 5: Verify tests pass**

```bash
cd client && npx vitest run src/ui/magi
```

- [ ] **Step 6: Commit**

```bash
git add client/src/ui/magi/hexagons.ts client/src/ui/magi/hexagons.test.ts client/src/ui/magi/index.ts
git commit -m "feat(magi): hex cluster with progress sweep and verdict stamp"
```

---

## Task 11: Timeline (zone D)

**Files:**
- Create: `client/src/ui/magi/timeline.ts`
- Create: `client/src/ui/magi/timeline.test.ts`
- Modify: `client/src/ui/magi/index.ts`

- [ ] **Step 1: Write failing timeline tests**

```typescript
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createTimeline, renderTimeline } from "./timeline";
import { magiInitial, magiStart, magiApplyEvent } from "../../magi/state";

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
    // Planning & Execution complete, Evaluation rejects execution MEDIUM.
    ["planning", "execution"].forEach((id) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id as any, patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id as any, verdict: "承認" });
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
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/ui/magi/timeline.ts`**

```typescript
import type { MagiStageId, MagiState } from "../../magi/types";

const SEGMENTS: readonly MagiStageId[] = ["planning", "execution", "evaluation"] as const;

export interface TimelineElements {
  root: HTMLElement;
  segments: Record<MagiStageId, HTMLElement>;
  caret: HTMLElement;
}

export function createTimeline(doc: Document): TimelineElements {
  const root = doc.createElement("div");
  root.className = "magi-timeline";
  const segments = {} as Record<MagiStageId, HTMLElement>;

  SEGMENTS.forEach((id) => {
    const seg = doc.createElement("div");
    seg.className = "magi-timeline-segment";
    seg.setAttribute("data-stage", id);
    seg.setAttribute("data-active", "false");
    seg.style.setProperty("--magi-segment-progress", "0");
    root.appendChild(seg);
    segments[id] = seg;
  });

  const caret = doc.createElement("div");
  caret.className = "magi-timeline-caret";
  root.appendChild(caret);

  return { root, segments, caret };
}

export function renderTimeline(tl: TimelineElements, state: MagiState): void {
  SEGMENTS.forEach((id) => {
    const stage = state.stages[id];
    const seg = tl.segments[id];
    seg.style.setProperty("--magi-segment-progress", stage.progress.toFixed(2));
    seg.setAttribute("data-active", String(state.activeStage === id));
    // Rework: stage was re-entered after an EVAL_REJECT (retryCount > 0 AND the stage is upstream-active or previously stamped but now active again).
    const inRework = state.global === "REWORK" && state.activeStage === id;
    seg.classList.toggle("magi-segment-rework", inRework);
  });

  // Caret position maps stage id → 0 / 50 / 100% left
  const activeIdx = state.activeStage ? SEGMENTS.indexOf(state.activeStage) : -1;
  const pct = activeIdx >= 0 ? (activeIdx / (SEGMENTS.length - 1)) * 100 : 100;
  tl.caret.style.left = `${pct}%`;
}
```

- [ ] **Step 4: Mount into `index.ts`**

Same pattern as hex cluster: replace the plain `zone(doc, "magi-zone-timeline")` call with `createTimeline(doc)` and expose `timelineImpl` on `MagiElements`. Call `renderTimeline` inside `renderMagi`.

- [ ] **Step 5: Verify tests pass**

- [ ] **Step 6: Commit**

```bash
git add client/src/ui/magi/timeline.ts client/src/ui/magi/timeline.test.ts client/src/ui/magi/index.ts
git commit -m "feat(magi): bottom timeline with rework pattern"
```

---

## Task 12: Intel panel (zone C)

**Files:**
- Create: `client/src/ui/magi/intel-panel.ts`
- Create: `client/src/ui/magi/intel-panel.test.ts`
- Modify: `client/src/ui/magi/index.ts`

- [ ] **Step 1: Write failing intel-panel tests**

```typescript
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createIntelPanel, renderIntelPanel } from "./intel-panel";
import { magiInitial, magiStart, magiApplyEvent } from "../../magi/state";

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
    ["planning", "execution"].forEach((id) => {
      s = magiApplyEvent(s, { kind: "STAGE_UPDATE", stage: id as any, patch: { progressDelta: 1 } });
      s = magiApplyEvent(s, { kind: "STAGE_VERDICT", stage: id as any, verdict: "承認" });
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
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/ui/magi/intel-panel.ts`**

```typescript
import type { MagiStage, MagiState, MagiStageId } from "../../magi/types";

const STAGE_TITLE: Record<MagiStageId, string> = {
  planning: "PLANNING",
  execution: "EXECUTION",
  evaluation: "EVALUATION"
};

export interface IntelPanelElements {
  root: HTMLElement;
  header: HTMLElement;
  summary: HTMLElement;
  reworkReason: HTMLElement;
  idlePlaceholder: HTMLElement;
}

export function createIntelPanel(doc: Document): IntelPanelElements {
  const root = doc.createElement("section");
  root.className = "magi-intel-panel";

  const header = doc.createElement("div");
  header.className = "magi-intel-header";

  const summary = doc.createElement("ul");
  summary.className = "magi-intel-summary";

  const reworkReason = doc.createElement("div");
  reworkReason.className = "magi-intel-rework-reason";
  reworkReason.hidden = true;

  const idlePlaceholder = doc.createElement("div");
  idlePlaceholder.className = "magi-intel-idle";
  idlePlaceholder.textContent = "AWAITING RUN — PRESS KNOB TO BEGIN";

  root.appendChild(header);
  root.appendChild(reworkReason);
  root.appendChild(summary);
  root.appendChild(idlePlaceholder);

  return { root, header, summary, reworkReason, idlePlaceholder };
}

export function renderIntelPanel(panel: IntelPanelElements, state: MagiState): void {
  const active = state.activeStage;
  const inIdle = state.global === "IDLE" || active === null;

  panel.idlePlaceholder.hidden = !inIdle;
  panel.header.hidden = inIdle;
  panel.summary.hidden = inIdle;
  if (inIdle) {
    panel.reworkReason.hidden = true;
    return;
  }

  const stage: MagiStage = state.stages[active];
  panel.header.textContent = `TASK: ${STAGE_TITLE[active]}   SOURCE: ${stage.source || "—"}   HANDOFF: ${stage.handoff}   CONF: ${stage.confidence}`;

  const doc = panel.root.ownerDocument;
  panel.summary.innerHTML = "";
  stage.summary.forEach((line) => {
    const li = doc.createElement("li");
    li.className = "magi-intel-summary-line";
    li.textContent = line;
    panel.summary.appendChild(li);
  });

  const evalRejected = state.global === "REWORK" &&
    state.stages.evaluation.verdict === "否定" &&
    state.stages.evaluation.rejectionReason;
  if (evalRejected) {
    panel.reworkReason.hidden = false;
    panel.reworkReason.textContent = `REWORK REASON: ${state.stages.evaluation.rejectionReason}`;
  } else {
    panel.reworkReason.hidden = true;
    panel.reworkReason.textContent = "";
  }
}
```

- [ ] **Step 4: Mount into `index.ts`**

Replace the plain `intelPanel` zone with a `createIntelPanel(doc)` call, expose `intelPanelImpl`, call `renderIntelPanel` in `renderMagi`. Remove the old inline "PRESS KNOB TO BEGIN" line from `renderMagi` since it now lives inside the panel itself.

- [ ] **Step 5: Verify tests pass**

- [ ] **Step 6: Commit**

```bash
git add client/src/ui/magi/intel-panel.ts client/src/ui/magi/intel-panel.test.ts client/src/ui/magi/index.ts client/src/ui/magi/index.test.ts
git commit -m "feat(magi): intel panel following active stage"
```

(Remove any now-failing duplicate-IDLE-hint assertion in `index.test.ts` if it clashes; the placeholder assertion should now live in `intel-panel.test.ts`.)

---

## Task 13: Voice overlay (zone G)

**Files:**
- Create: `client/src/ui/magi/voice-overlay.ts`
- Create: `client/src/ui/magi/voice-overlay.test.ts`
- Modify: `client/src/ui/magi/index.ts`

- [ ] **Step 1: Write failing overlay tests**

```typescript
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createVoiceOverlay, renderVoiceOverlay } from "./voice-overlay";
import type { MagiVoiceOverlay } from "../../magi/types";

const BLANK: MagiVoiceOverlay = { open: false, transcript: "", typedChars: 0, cursor: 0 };

describe("renderVoiceOverlay", () => {
  it("is hidden when voice is closed", () => {
    const el = createVoiceOverlay(document);
    renderVoiceOverlay(el, BLANK);
    expect(el.root.hidden).toBe(true);
  });

  it("reveals only the typed prefix of the transcript", () => {
    const el = createVoiceOverlay(document);
    renderVoiceOverlay(el, { open: true, transcript: "hello world", typedChars: 5, cursor: 1 });
    expect(el.root.hidden).toBe(false);
    expect(el.transcript.textContent).toBe("hello");
  });

  it("shows the keymap hint", () => {
    const el = createVoiceOverlay(document);
    renderVoiceOverlay(el, { open: true, transcript: "x", typedChars: 0, cursor: 1 });
    expect(el.hint.textContent).toMatch(/KNOB.*COMMIT/);
    expect(el.hint.textContent).toMatch(/BACK.*CANCEL/);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `client/src/ui/magi/voice-overlay.ts`**

```typescript
import type { MagiVoiceOverlay } from "../../magi/types";

export interface VoiceOverlayElements {
  root: HTMLElement;
  waveform: HTMLElement;
  transcript: HTMLElement;
  hint: HTMLElement;
}

export function createVoiceOverlay(doc: Document): VoiceOverlayElements {
  const root = doc.createElement("div");
  root.className = "magi-voice-overlay";
  root.hidden = true;

  const waveform = doc.createElement("div");
  waveform.className = "magi-voice-waveform";

  const transcript = doc.createElement("div");
  transcript.className = "magi-voice-transcript";

  const hint = doc.createElement("div");
  hint.className = "magi-voice-hint";
  hint.textContent = "KNOB: COMMIT   BACK: CANCEL";

  root.appendChild(waveform);
  root.appendChild(transcript);
  root.appendChild(hint);

  return { root, waveform, transcript, hint };
}

export function renderVoiceOverlay(el: VoiceOverlayElements, voice: MagiVoiceOverlay): void {
  el.root.hidden = !voice.open;
  if (!voice.open) {
    el.transcript.textContent = "";
    return;
  }
  el.transcript.textContent = voice.transcript.slice(0, voice.typedChars);
}
```

- [ ] **Step 4: Mount into `index.ts`**

Replace the plain `voiceOverlay` zone with `createVoiceOverlay(doc)`. Expose `voiceOverlayImpl`, call `renderVoiceOverlay(elements.voiceOverlayImpl, state.voice)` in `renderMagi`.

- [ ] **Step 5: Verify tests pass**

- [ ] **Step 6: Commit**

```bash
git add client/src/ui/magi/voice-overlay.ts client/src/ui/magi/voice-overlay.test.ts client/src/ui/magi/index.ts
git commit -m "feat(magi): voice overlay with reveal-typing transcript"
```

---

## Task 14: Wire MAGI screen into main renderer + preset hint labels

**Files:**
- Modify: `client/src/ui/renderer.ts`
- Modify: `client/src/ui/renderer.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Add to `client/src/ui/renderer.test.ts`:

```typescript
  it("mounts a MAGI shell and hides it by default", () => {
    const store = createPlaybackStore();
    createRenderer(document, store, () => {});
    const magi = document.querySelector(".magi-screen") as HTMLElement;
    expect(magi).not.toBeNull();
    expect(magi.hidden).toBe(true);
  });

  it("shows the MAGI shell when activeApp=magi and hides spotify/home/settings", () => {
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});
    store.switchApp("magi");
    renderer.render(store.getState());
    expect((document.querySelector(".magi-screen") as HTMLElement).hidden).toBe(false);
    expect((document.querySelector(".app-shell") as HTMLElement).hidden).toBe(true);
    expect((document.querySelector(".home-screen") as HTMLElement).hidden).toBe(true);
  });

  it("labels the preset-3 hint as MAGI", () => {
    const store = createPlaybackStore();
    const renderer = createRenderer(document, store, () => {});
    renderer.showPresetHint("preset3");
    const items = Array.from(document.querySelectorAll(".preset-hint-item")) as HTMLElement[];
    expect(items.map((i) => i.textContent)).toEqual(["Spotify", "Home", "MAGI", "Settings"]);
  });
```

And update the existing test that asserts `["Spotify", "Home", "Home", "Settings"]` to the new labels.

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Update `client/src/ui/renderer.ts`**

Import at top:

```typescript
import { createMagiElements, renderMagi, type MagiElements } from "./magi";
```

Change `presetHintLabels`:

```typescript
var presetHintLabels = ["Spotify", "Home", "MAGI", "Settings"];
```

Inside `createRenderer`:

```typescript
var magiScreen: MagiElements = createMagiElements(documentRef);
app.appendChild(magiScreen.root);
magiScreen.root.hidden = true;
```

In the `render` function:

```typescript
magiScreen.root.hidden = state.activeApp !== "magi";
if (state.activeApp === "magi") {
  renderMagi(magiScreen, state.magi);
  return;
}
```

Place this block before the existing Spotify-specific rendering, next to the `home` and `settings` short-circuits.

- [ ] **Step 4: Add `client/src/ui/magi/index.ts` default export barrel**

Optional: add a re-export line `export * from "./voice-overlay"; …` etc. Keep named imports in renderer.

- [ ] **Step 5: Verify tests pass**

```bash
cd client && npx vitest run src/ui/renderer.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add client/src/ui/renderer.ts client/src/ui/renderer.test.ts
git commit -m "feat(magi): mount magi renderer into app shell"
```

---

## Task 15: Input wiring — MAGI input routing from `input.ts`

**Files:**
- Modify: `client/src/input.ts`
- Modify: `client/src/input.test.ts`

- [ ] **Step 1: Write failing regression tests**

Append to `client/src/input.test.ts` two tests inside the existing `describe("bindInputHandlers", ...)` — `wheel in MAGI does not touch volume` and `back in MAGI does not trigger back handler / switchApp`.

```typescript
  it("routes wheel to the MAGI input router when MAGI is active and does not send volume", () => {
    const sent: Array<[string, number | undefined]> = [];
    const magiWheelCalls: number[] = [];
    const listeners = new Map<string, (event: any) => void>();
    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
      clearTimeout() {},
      setTimeout() { return 1; }
    } as unknown as Window;

    bindInputHandlers(
      fakeWindow,
      (action, value) => { sent.push([action, value]); },
      () => {},
      () => {},
      () => 50,
      () => false,
      () => {},
      () => false,
      () => "clock",
      () => {},
      () => {},
      () => {},
      () => {},
      () => true,                                // isMagiActive
      { handleWheel(delta) { magiWheelCalls.push(delta); },
        handleKnobPress() {},
        handleBackButton() {} }
    );

    const wheel = listeners.get("wheel") as (e: any) => void;
    wheel({ deltaX: 0, deltaY: 5, preventDefault() {} });
    expect(magiWheelCalls).toEqual([5]);
    expect(sent).toEqual([]);   // no volume send
  });

  it("routes Escape to the MAGI router and not to the generic back handler when MAGI is active", () => {
    const backHandlerCalls: number[] = [];
    const magiBackCalls: number[] = [];
    const listeners = new Map<string, (event: any) => void>();
    const fakeWindow = {
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
      clearTimeout() {},
      setTimeout() { return 1; }
    } as unknown as Window;

    bindInputHandlers(
      fakeWindow,
      () => {},
      () => {},
      () => {},
      () => 50,
      () => false,
      () => {},
      () => false,
      () => "clock",
      () => {},
      () => {},
      () => {},
      () => { backHandlerCalls.push(1); },
      () => true,
      { handleWheel() {}, handleKnobPress() {}, handleBackButton() { magiBackCalls.push(1); } }
    );

    const keydown = listeners.get("keydown") as (e: any) => void;
    keydown({ key: "Escape", preventDefault() {} });
    expect(magiBackCalls).toEqual([1]);
    expect(backHandlerCalls).toEqual([]);
  });
```

Both tests extend the existing `bindInputHandlers` signature with two new tail parameters: `isMagiActive` and `magiRouter`. Update the existing passing tests in `input.test.ts` to pass `() => false` and a no-op router so they keep compiling.

- [ ] **Step 2: Verify failures**

- [ ] **Step 3: Extend `client/src/input.ts` signature**

Add parameters:

```typescript
export function bindInputHandlers(
  target: Window,
  sendCommand: (action: string, value?: number) => void,
  handlePresetButton: (button: string) => void,
  previewVolume: (volume: number) => void,
  readVolume: () => number,
  isSettingsActive: () => boolean,
  scrollSettings: (delta: number) => void,
  isHomeActive: () => boolean,
  getHomeTimerMode: () => string,
  adjustTimer: (deltaSec: number) => void,
  handleKnobPress: () => void,
  adjustPomoBreak: ((deltaSec: number) => void) | undefined,
  handleBackButton: () => void,
  isMagiActive: () => boolean,
  magiRouter: {
    handleWheel(delta: number): void;
    handleKnobPress(): void;
    handleBackButton(): void;
  }
): void {
```

(Note: this tightens the existing looser ordering — keep the exact current ordering and append `isMagiActive` + `magiRouter` at the end. The snippet above reorders for readability. Keep the real diff minimal.)

At the top of the wheel handler, before any other branch:

```typescript
    if (isMagiActive()) {
      magiRouter.handleWheel(delta);
      return;
    }
```

At the top of the keydown handler:

```typescript
    if (isMagiActive()) {
      if (event.key === "Escape") {
        event.preventDefault();
        magiRouter.handleBackButton();
      } else if (event.key === "Enter") {
        event.preventDefault();
        magiRouter.handleKnobPress();
      }
      // preset1/2/4 handled below (app switching). preset3 is MAGI itself — no-op.
      if (event.key === "1") { event.preventDefault(); handlePresetButton("preset1"); return; }
      if (event.key === "2") { event.preventDefault(); handlePresetButton("preset2"); return; }
      if (event.key === "4") { event.preventDefault(); handlePresetButton("preset4"); return; }
      return;
    }
```

- [ ] **Step 4: Verify tests pass**

- [ ] **Step 5: Commit**

```bash
git add client/src/input.ts client/src/input.test.ts
git commit -m "feat(magi): route wheel/knob/back through MAGI router when active"
```

---

## Task 16: Main wiring — mock ticker, MAGI input router, store-driven voice tick

**Files:**
- Modify: `client/src/main.ts`

There are no new tests here — the modules this wiring uses have their own tests. The main.ts change is purely integration glue.

- [ ] **Step 1: Wire MAGI in `client/src/main.ts`**

Add imports:

```typescript
import { createMagiInputRouter } from "./magi/input";
import { advanceMock, MOCK_HAPPY_PATH_DURATION_MS } from "./magi/mock";
import { magiVoiceTick } from "./magi/state";
```

Build a router handle bound to the store's `magiDispatch`:

```typescript
const magiRouter = createMagiInputRouter({
  get: () => store.getState().magi,
  apply: (fn) => store.magiDispatch(fn)
});
```

Add a cursor-tracking tick loop that advances mock events and voice reveal:

```typescript
let magiMockCursor = 0;   // index into schedule already applied
let magiRunStartedAt = 0;

window.setInterval(() => {
  const state = store.getState();
  if (state.activeApp !== "magi") return;
  const magi = state.magi;

  // Start anchor
  if (magi.global === "RUNNING" && magiRunStartedAt === 0) {
    magiRunStartedAt = Date.now();
    magiMockCursor = 0;
  }
  if (magi.global === "IDLE") {
    magiRunStartedAt = 0;
    magiMockCursor = 0;
  }

  // Advance mock (happy branch by default)
  if (magi.global === "RUNNING" || magi.global === "REWORK") {
    if (magi.pausedAtMs === 0 && magiRunStartedAt > 0) {
      const next = advanceMock(magi, magiRunStartedAt, Date.now(), "happy");
      if (next !== magi) {
        store.magiDispatch(() => next);
      }
    }
  }

  // Voice reveal
  if (magi.voice.open) {
    const charsPerTick = 2;   // ≈ 20 chars/sec at 100 ms tick
    store.magiDispatch((s) => magiVoiceTick(s, charsPerTick));
  }
}, 100);
```

NOTE: the `advanceMock` implementation in Task 5 fires every past event on each call — for production use we need idempotency. Update `advanceMock` in that module to skip events by **cursor** instead of replaying. Cleanest fix: add a `startCursor` parameter that returns a new cursor alongside the state, and track the cursor in main.ts. If Task 5 already handles this (verify), skip this NOTE.

Add MAGI handling to the existing `socket.onButton(...)` flow: `"knob_press"` while `state.activeApp === "magi"` → `magiRouter.handleKnobPress()`; `"back"` while `state.activeApp === "magi"` → `magiRouter.handleBackButton()`; `preset3` → `store.switchApp("magi"); renderer.showPresetHint("preset3");` (already handled generically via `mapHardwareButtonToApp`, so no extra branch needed — confirm).

Extend the call to `bindInputHandlers(...)` with the two new tail args:

```typescript
  () => store.getState().activeApp === "magi",
  magiRouter
```

- [ ] **Step 2: Before committing — run the full suite**

```bash
cd client && npm test
```

Expected: all green. Fix any integration drift.

- [ ] **Step 3: Also type-check**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/main.ts
git commit -m "feat(magi): wire magi input router, mock ticker, voice reveal"
```

---

## Task 17: Fix `advanceMock` idempotency for runtime ticks

**Files:**
- Modify: `client/src/magi/mock.ts`
- Modify: `client/src/magi/mock.test.ts`
- Modify: `client/src/main.ts`

Problem: the `advanceMock` signature written in Task 5 replays every past event on each call, which was fine for its tests but wrong for a ticker. Switch to cursor-based advance.

- [ ] **Step 1: Add cursor-test**

Append to `mock.test.ts`:

```typescript
describe("advanceMock — cursor-based", () => {
  it("returns a new cursor so callers can avoid replaying events", () => {
    const a = magiStart(magiInitial());
    const first = advanceMockCursor(a, 0, 30_000, "happy", 0);
    expect(first.cursor).toBeGreaterThan(0);
    const second = advanceMockCursor(first.state, 0, 60_000, "happy", first.cursor);
    expect(second.state.stages.planning.verdict).toBe("承認");
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Add `advanceMockCursor` next to `advanceMock`**

```typescript
export interface MockAdvanceResult { state: MagiState; cursor: number; }

export function advanceMockCursor(
  state: MagiState,
  startMs: number,
  nowMs: number,
  branch: MockBranch,
  cursor: number
): MockAdvanceResult {
  const elapsed = Math.max(0, nowMs - startMs);
  const schedule = SCHEDULES[branch];
  let next = state;
  let c = cursor;
  while (c < schedule.length && schedule[c].atMs <= elapsed) {
    next = magiApplyEvent(next, schedule[c].event);
    c += 1;
  }
  return { state: next, cursor: c };
}
```

Keep `advanceMock` as the pure replay function for the existing tests (they rely on it).

- [ ] **Step 4: Update `main.ts` to use `advanceMockCursor`**

```typescript
import { advanceMockCursor } from "./magi/mock";
// …
let magiMockCursor = 0;
// …
const { state: next, cursor } = advanceMockCursor(magi, magiRunStartedAt, Date.now(), "happy", magiMockCursor);
magiMockCursor = cursor;
if (next !== magi) { store.magiDispatch(() => next); }
```

Reset `magiMockCursor = 0` on IDLE as before.

- [ ] **Step 5: Verify all tests pass**

- [ ] **Step 6: Commit**

```bash
git add client/src/magi/mock.ts client/src/magi/mock.test.ts client/src/main.ts
git commit -m "fix(magi): cursor-based mock advance to prevent event replay"
```

---

## Task 18: Styles — MAGI zone CSS

**Files:**
- Modify: `client/src/styles/components.css`
- Modify: `client/src/styles/components.test.ts`

Focus areas: layout grid for the MAGI screen, hexagon geometry (clip-path or SVG mask), angular progress sweep driven by `--magi-progress`, verdict stamp styling (承認 green, 否定 red), rework hatch pattern on timeline segments, intervention pulse on the status badge, voice overlay slide-up drawer, kanji-glyph font (stay with existing font stack unless Figma specifies otherwise).

- [ ] **Step 1: Write failing selector test**

Append to `client/src/styles/components.test.ts`:

```typescript
it("defines MAGI-zone selectors", () => {
  const css = readFileSync(path.resolve(__dirname, "components.css"), "utf8");
  expect(css).toMatch(/\.magi-screen\b/);
  expect(css).toMatch(/\.magi-hex-cluster\b/);
  expect(css).toMatch(/\.magi-hexagon\b/);
  expect(css).toMatch(/\.magi-timeline-segment\b/);
  expect(css).toMatch(/\.magi-segment-rework\b/);
  expect(css).toMatch(/\.magi-intel-panel\b/);
  expect(css).toMatch(/\.magi-voice-overlay\b/);
  expect(css).toMatch(/\.magi-zone-status-badge\[data-status="INTERVENTION"\]/);
  expect(css).toMatch(/--magi-progress\b/);
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Append CSS to `client/src/styles/components.css`**

```css
/* ============================ MAGI ============================ */

.magi-screen {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-areas:
    "header header header"
    "intel  hex    status"
    "intel  hex    model"
    "health timeline timeline";
  grid-template-columns: 220px 1fr 180px;
  grid-template-rows: auto 1fr 1fr 56px;
  background: #06080c;
  color: #e6f2ff;
  font-family: var(--magi-font, "NotoSansMono", monospace);
}

.magi-zone-header       { grid-area: header; padding: 6px 12px; font-size: 11px; opacity: 0.72; }
.magi-zone-intel-panel,
.magi-intel-panel       { grid-area: intel; padding: 12px; border-right: 1px solid #1a2230; }
.magi-zone-hex-cluster  { grid-area: hex; display: flex; align-items: center; justify-content: center; }
.magi-zone-status-badge { grid-area: status; padding: 8px 12px; font-size: 18px; font-weight: 700; text-align: right; }
.magi-zone-model-type   { grid-area: model; padding: 8px 12px; text-align: right; font-size: 14px; }
.magi-zone-system-health{ grid-area: health; padding: 12px; font-size: 12px; }
.magi-zone-timeline,
.magi-timeline          { grid-area: timeline; display: flex; align-items: stretch; position: relative; border-top: 1px solid #1a2230; }

/* Status badge — intervention pulse (§6.5) */
.magi-zone-status-badge[data-status="INTERVENTION"] {
  color: #ff7a5a;
  animation: magi-pulse 1.25s ease-in-out infinite;
}
.magi-zone-status-badge[data-status="HALTED"] { color: #ff7a5a; }
.magi-zone-status-badge[data-status="DONE"]   { color: #8ef0a9; }
.magi-zone-status-badge[data-status="REWORK"] { color: #f4c15a; }
@keyframes magi-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}

/* Hex cluster */
.magi-hex-cluster { display: flex; gap: 24px; }
.magi-hexagon {
  --magi-progress: 0;
  width: 128px; aspect-ratio: 1;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: conic-gradient(from -90deg, #f4c15a calc(var(--magi-progress) * 360deg), #1a2230 0);
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  opacity: 0.55;
  transition: opacity 180ms ease;
}
.magi-hex-focused { opacity: 1; }
.magi-hexagon[data-status="STAMPED"][data-verdict="承認"] {
  background: conic-gradient(from -90deg, #8ef0a9 360deg, #1a2230 0);
}
.magi-hexagon[data-status="STAMPED"][data-verdict="否定"] {
  background: conic-gradient(from -90deg, #ff7a5a 360deg, #1a2230 0);
}
.magi-hex-number   { font-size: 32px; font-weight: 800; }
.magi-hex-codename { font-size: 12px; letter-spacing: 0.12em; opacity: 0.8; }
.magi-hex-stamp    { margin-top: 6px; padding: 2px 6px; font-size: 14px; border: 2px solid currentColor; }

/* Timeline */
.magi-timeline-segment {
  flex: 1; position: relative; border-right: 1px solid #1a2230;
  background: linear-gradient(to right,
    rgba(244, 193, 90, 0.6) calc(var(--magi-segment-progress, 0) * 100%),
    rgba(26, 34, 48, 0.8) 0);
}
.magi-timeline-segment[data-active="true"]::after {
  content: ""; position: absolute; inset: 0;
  background: repeating-linear-gradient(90deg, transparent 0 6px, rgba(255,255,255,0.04) 6px 8px);
  animation: magi-scan 1.4s linear infinite;
}
.magi-segment-rework {
  background-image: repeating-linear-gradient(45deg,
    rgba(244, 193, 90, 0.35) 0 4px, rgba(26, 34, 48, 0.4) 4px 10px);
}
.magi-timeline-caret {
  position: absolute; top: -6px; width: 10px; height: 10px;
  transform: translateX(-50%) rotate(45deg);
  background: #f4c15a;
  transition: left 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes magi-scan {
  from { background-position: 0 0; }
  to   { background-position: 8px 0; }
}

/* Intel panel */
.magi-intel-header { font-size: 11px; letter-spacing: 0.08em; opacity: 0.85; margin-bottom: 8px; }
.magi-intel-summary { list-style: none; padding: 0; margin: 0; font-size: 12px; }
.magi-intel-summary-line { padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); }
.magi-intel-rework-reason { color: #ff7a5a; font-size: 12px; margin-bottom: 6px; }
.magi-intel-idle { opacity: 0.55; font-size: 13px; padding-top: 16px; }

/* System health & model type — color-code states */
.magi-zone-system-health[data-health="OFFLINE"]  { color: #ff7a5a; }
.magi-zone-system-health[data-health="DEGRADED"] { color: #f4c15a; }
.magi-zone-system-health[data-health="RELINK"]   { color: #f4c15a; }

/* Voice overlay drawer */
.magi-voice-overlay {
  position: absolute; left: 0; right: 0; bottom: 0; height: 40%;
  background: rgba(6, 8, 12, 0.94);
  border-top: 1px solid #1a2230;
  padding: 16px;
  display: flex; flex-direction: column; gap: 8px;
  transform: translateY(0);
  transition: transform 200ms ease, opacity 200ms ease;
}
.magi-voice-overlay[hidden] { display: none; }
.magi-voice-waveform { height: 24px; background: repeating-linear-gradient(90deg, #1a2230 0 2px, transparent 2px 6px); }
.magi-voice-transcript { font-size: 16px; min-height: 1.4em; }
.magi-voice-hint { font-size: 11px; opacity: 0.6; }
```

- [ ] **Step 4: Verify tests pass**

```bash
cd client && npx vitest run src/styles/components.test.ts
```

- [ ] **Step 5: Visual sanity in browser**

```bash
cd client && npm run dev
```

Navigate to the MAGI app (press `3` key in dev → triggers preset3 → MAGI). Walk through: press Enter to start, wait for Planning to progress, watch Execution plateau, see Evaluation reject & execution rework, reach 決議終了. Press Escape (back) to open the voice overlay, Enter to commit, see a new line appear in the intel panel.

- [ ] **Step 6: Commit**

```bash
git add client/src/styles/components.css client/src/styles/components.test.ts
git commit -m "feat(magi): styles for zones, hexagons, timeline, voice overlay"
```

---

## Task 19: Release note and preset-3 remap documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Recent changes" or "v0.2.0" section**

Example text (adapt to the repo's existing README structure):

```markdown
## v0.2.0 — MAGI Harness Console

- New app `magi` bound to top preset-3 (previously mapped to Home). Preset-2 remains the Home shortcut.
- While inside MAGI, the scroll wheel toggles model `TYPE` (`CLD` ↔ `CDX`), the knob press starts / pauses the run, and the back button opens an on-screen voice-input mock (press knob to commit, back again to cancel). Touch input is unused.
- Exits from MAGI happen only via preset-1 (Spotify), preset-2 (Home), or preset-4 (Settings).
- Harness data is mocked client-side in this release; no server changes.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: release note for magi console and preset-3 remap"
```

---

## Self-review checklist (run after all tasks complete)

1. **Spec coverage.** Walk the design doc:
   - §1 Screen role → covered by the status badge (Task 9) + active-stage panel (Task 12).
   - §2 zones A–G → Tasks 9, 10, 11, 12, 13.
   - §3 state machine → Tasks 1, 2, 3, 4; invariants tested in Task 1 and replayed in Tasks 3, 5.
   - §4 interaction logic → Tasks 6, 15, 16.
   - §5 mock data → Tasks 5 (timeline), 4 (transcripts), 17 (idempotent runtime).
   - §6 visual behavior → Task 18 (CSS) + animation cues embedded in renderers.
   - §7 risks → mitigated: §7.3 4-line summary cap (Task 3), §7.4 non-monotonic progress in mock (Task 5 plateau handling), §7.10 back-in-MAGI regression test (Task 15), §7.11 wheel debounce (Task 6).

2. **Placeholder scan.** Search plan for: `TBD`, `TODO`, `implement later`, `similar to Task`. None should remain.

3. **Type consistency:**
   - `MagiStageId` is the same string union across types, reducer, renderer.
   - `MagiVerdict = "NONE" | "承認" | "否定"` everywhere.
   - `advanceMockCursor` signature matches between `mock.ts` and `main.ts`.
   - `MagiElements` fields added in Tasks 10–13 (`hexClusterImpl`, `timelineImpl`, `intelPanelImpl`, `voiceOverlayImpl`) are spelled identically.

4. **Command correctness:**
   - All `npx vitest run <path>` commands use the `client/` cwd.
   - CSS assertion regex properly escapes `[` / `]` where used.

5. **Final full run:**
   ```bash
   cd client && npm test && npx tsc --noEmit && npm run build
   ```
   Expected: green.
