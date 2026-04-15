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
