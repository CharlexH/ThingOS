import type {
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
