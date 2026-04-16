import { pickTranscript } from "./transcripts";
import type {
  MagiEvent,
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
