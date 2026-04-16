import type { MagiGlobalStatus, MagiState } from "../../magi/types";
import { createHexCluster, renderHexCluster, type HexClusterElements } from "./hexagons";
import { createIntelPanel, renderIntelPanel, type IntelPanelElements } from "./intel-panel";
import { createTimeline, renderTimeline, type TimelineElements } from "./timeline";

export interface MagiElements {
  root: HTMLElement;
  statusBadge: HTMLElement;
  hexCluster: HTMLElement;
  hexClusterImpl: HexClusterElements;
  intelPanel: HTMLElement;
  intelPanelImpl: IntelPanelElements;
  timeline: HTMLElement;
  timelineImpl: TimelineElements;
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
  const intelPanelImpl = createIntelPanel(doc);
  intelPanelImpl.root.classList.add("magi-zone-intel-panel");
  const intelPanel = intelPanelImpl.root;
  const timelineImpl = createTimeline(doc);
  timelineImpl.root.classList.add("magi-zone-timeline");
  const timeline = timelineImpl.root;
  const systemHealth = zone(doc, "magi-zone-system-health");
  const modelType = zone(doc, "magi-zone-model-type");
  const voiceOverlay = zone(doc, "magi-voice-overlay");
  voiceOverlay.hidden = true;

  [header, statusBadge, hexCluster, intelPanel, timeline, systemHealth, modelType, voiceOverlay]
    .forEach((el) => root.appendChild(el));

  return {
    root,
    header,
    statusBadge,
    hexCluster,
    hexClusterImpl,
    intelPanel,
    intelPanelImpl,
    timeline,
    timelineImpl,
    systemHealth,
    modelType,
    voiceOverlay
  };
}

export function renderMagi(elements: MagiElements, state: MagiState): void {
  elements.statusBadge.textContent = STATUS_GLYPH[state.global];
  elements.statusBadge.setAttribute("data-status", state.global);

  elements.systemHealth.textContent = state.health;
  elements.systemHealth.setAttribute("data-health", state.health);

  elements.modelType.textContent = `TYPE / ${state.modelType}`;
  elements.modelType.setAttribute("data-model", state.modelType);

  renderHexCluster(elements.hexClusterImpl, state);
  renderIntelPanel(elements.intelPanelImpl, state);
  renderTimeline(elements.timelineImpl, state);
  // Voice overlay handled in Task 13.
}
