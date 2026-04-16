import type { MagiStage, MagiStageId, MagiState } from "../../magi/types";

const STAGE_LABELS: Record<MagiStageId, { number: string; codename: string }> = {
  planning:   { number: "1", codename: "MELCHIOR" },
  execution:  { number: "2", codename: "BALTHASAR" },
  evaluation: { number: "3", codename: "CASPER" }
};

// Visual order: BALTHASAR (top/center), MELCHIOR (bottom-left), CASPER (bottom-right).
const STAGE_ORDER: readonly MagiStageId[] = ["execution", "planning", "evaluation"] as const;

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
