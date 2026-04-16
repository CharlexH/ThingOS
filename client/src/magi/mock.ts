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
  // Halt mid-planning (before the 25s STAGE_VERDICT) so the active stage
  // is frozen with verdict NONE per §3.4 rule 5.
  const out = HAPPY.filter((e) => e.atMs < 20000).slice();
  out.push({ atMs: 20000, event: { kind: "HALT", reason: "ws drop exceeded reconnect budget" } });
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
    next = magiApplyEvent(next, se.event);
  }
  return next;
}
