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
    seg.style.setProperty("--magi-segment-progress", String(stage.progress));
    seg.setAttribute("data-active", String(state.activeStage === id));
    // Rework: stage re-entered after EVAL_REJECT (global REWORK and stage is now active again).
    const inRework = state.global === "REWORK" && state.activeStage === id;
    seg.classList.toggle("magi-segment-rework", inRework);
  });

  const activeIdx = state.activeStage ? SEGMENTS.indexOf(state.activeStage) : -1;
  const pct = activeIdx >= 0 ? (activeIdx / (SEGMENTS.length - 1)) * 100 : 100;
  tl.caret.style.left = `${pct}%`;
}
