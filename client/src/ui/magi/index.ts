import type { MagiGlobalStatus, MagiState } from "../../magi/types";
import { createHexCluster, renderHexCluster, type HexClusterElements } from "./hexagons";

export interface MagiElements {
  root: HTMLElement;
  statusBadge: HTMLElement;
  hexCluster: HTMLElement;
  hexClusterImpl: HexClusterElements;
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
  const hexClusterImpl = createHexCluster(doc);
  hexClusterImpl.root.classList.add("magi-zone-hex-cluster");
  const hexCluster = hexClusterImpl.root;
  const intelPanel = zone(doc, "magi-zone-intel-panel");
  const timeline = zone(doc, "magi-zone-timeline");
  const systemHealth = zone(doc, "magi-zone-system-health");
  const modelType = zone(doc, "magi-zone-model-type");
  const voiceOverlay = zone(doc, "magi-voice-overlay");
  voiceOverlay.hidden = true;

  [header, statusBadge, hexCluster, intelPanel, timeline, systemHealth, modelType, voiceOverlay]
    .forEach((el) => root.appendChild(el));

  return { root, header, statusBadge, hexCluster, hexClusterImpl, intelPanel, timeline, systemHealth, modelType, voiceOverlay };
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
  renderHexCluster(elements.hexClusterImpl, state);
  // Timeline, intel panel (non-IDLE), voice overlay handled in Tasks 11–13.
}
