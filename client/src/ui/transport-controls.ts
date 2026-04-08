import type { PlaybackSnapshot } from "../types";

export interface TransportControlsElements {
  playpause: HTMLButtonElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  repeat: HTMLButtonElement;
  root: HTMLElement;
}

type SendCommand = (action: string, value?: number) => void;

function createTransportIcon(documentRef: Document, icon: string): SVGSVGElement {
  var svg = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
  var pathA = documentRef.createElementNS("http://www.w3.org/2000/svg", "path");
  var pathB = documentRef.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.classList.add("transport-button-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-icon", icon);
  svg.setAttribute("viewBox", "0 0 24 24");

  if (icon === "previous") {
    pathA.setAttribute("d", "M6 5h2v14H6z");
    pathB.setAttribute("d", "M18 6v12L9 12z");
  } else if (icon === "pause") {
    pathA.setAttribute("d", "M7 5h4v14H7z");
    pathB.setAttribute("d", "M13 5h4v14h-4z");
  } else if (icon === "play") {
    pathA.setAttribute("d", "M8 6v12l10-6z");
  } else if (icon === "next") {
    pathA.setAttribute("d", "M16 5h2v14h-2z");
    pathB.setAttribute("d", "M6 6v12l9-6z");
  } else if (icon === "repeat-one") {
    pathA.setAttribute(
      "d",
      "M8 7h8l-2.5-2.5L15 3l5 5-5 5-1.5-1.5L16 9H8a2 2 0 0 0-2 2v1H4v-1a4 4 0 0 1 4-4zM20 12v1a4 4 0 0 1-4 4H8l2.5 2.5L9 21l-5-5 5-5 1.5 1.5L8 15h8a2 2 0 0 0 2-2v-1z"
    );
    pathB.setAttribute("d", "M12 10h-1v-1h3v6h-2z");
  }

  if (pathA.getAttribute("d")) {
    svg.appendChild(pathA);
  }
  if (pathB.getAttribute("d")) {
    svg.appendChild(pathB);
  }

  return svg;
}

function setTransportButtonIcon(
  documentRef: Document,
  button: HTMLButtonElement,
  icon: string,
  label: string
): void {
  while (button.firstChild) {
    button.removeChild(button.firstChild);
  }
  button.appendChild(createTransportIcon(documentRef, icon));
  button.setAttribute("aria-label", label);
}

function createTransportButton(
  documentRef: Document,
  action: string,
  label: string,
  icon: string,
  sendCommand: SendCommand
): HTMLButtonElement {
  var button = documentRef.createElement("button");

  button.className = "transport-button";
  button.dataset.action = action;
  button.type = "button";
  setTransportButtonIcon(documentRef, button, icon, label);
  button.addEventListener("click", function () {
    sendCommand(action);
  });

  return button;
}

export function createTransportControls(
  documentRef: Document,
  sendCommand: SendCommand
): TransportControlsElements {
  var root = documentRef.createElement("div");
  var previous = createTransportButton(documentRef, "previous", "Previous", "previous", sendCommand);
  var playpause = createTransportButton(documentRef, "playpause", "Play", "play", sendCommand);
  var next = createTransportButton(documentRef, "next", "Next", "next", sendCommand);
  var repeat = createTransportButton(documentRef, "repeat", "Repeat one", "repeat-one", sendCommand);

  root.className = "transport-controls";
  root.appendChild(previous);
  root.appendChild(playpause);
  root.appendChild(next);
  root.appendChild(repeat);

  return {
    playpause: playpause,
    previous: previous,
    next: next,
    repeat: repeat,
    root: root
  };
}

export function renderTransportControls(
  elements: TransportControlsElements,
  snapshot: PlaybackSnapshot
): void {
  setTransportButtonIcon(
    elements.playpause.ownerDocument,
    elements.playpause,
    snapshot.playing ? "pause" : "play",
    snapshot.playing ? "Pause" : "Play"
  );
  elements.playpause.classList.remove("transport-button-active");
  elements.repeat.classList.toggle("transport-button-active", snapshot.repeat);
}
