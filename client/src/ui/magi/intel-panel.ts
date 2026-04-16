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
  panel.header.textContent =
    `TASK: ${STAGE_TITLE[active]}   SOURCE: ${stage.source || "—"}   HANDOFF: ${stage.handoff}   CONF: ${stage.confidence}`;

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
