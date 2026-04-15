import type { MagiState } from "./types";

export function assertMagiInvariants(state: MagiState): void {
  const stages = [state.stages.planning, state.stages.execution, state.stages.evaluation];
  const anyActive = stages.some((s) => s.status === "ACTIVE");

  // Rule 1: if any hexagon is ACTIVE, global must be RUNNING, REWORK, or HALTED
  if (anyActive && state.global !== "RUNNING" && state.global !== "REWORK" && state.global !== "HALTED") {
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
