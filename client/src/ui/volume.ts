export interface VolumeOverlayElements {
  bar: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
  lastVolume: number | null;
  root: HTMLElement;
  value: HTMLElement;
  visibleUntilMs: number;
}

export function createVolumeOverlay(documentRef: Document): VolumeOverlayElements {
  var root = documentRef.createElement("div");
  var label = documentRef.createElement("div");
  var bar = documentRef.createElement("div");
  var fill = documentRef.createElement("div");
  var value = documentRef.createElement("div");

  root.className = "volume-overlay";
  label.className = "volume-label";
  bar.className = "volume-bar";
  fill.className = "volume-fill";
  value.className = "volume-value";

  label.textContent = "Volume";
  bar.appendChild(fill);
  root.appendChild(label);
  root.appendChild(bar);
  root.appendChild(value);

  return {
    bar: bar,
    fill: fill,
    label: label,
    lastVolume: null,
    root: root,
    value: value,
    visibleUntilMs: 0
  };
}

export function renderVolumeOverlay(elements: VolumeOverlayElements, volume: number): void {
  var now = Date.now();

  if (elements.lastVolume === null) {
    elements.lastVolume = volume;
  } else if (elements.lastVolume !== volume) {
    elements.lastVolume = volume;
    elements.visibleUntilMs = now + 3000;
  }

  elements.fill.style.width = String(volume) + "%";
  elements.value.textContent = String(volume);
  elements.root.classList.toggle("volume-overlay-visible", now <= elements.visibleUntilMs);
}
