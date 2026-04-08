import type { PlaybackSnapshot } from "../types";

export function interpolateProgressPosition(
  anchorPosition: number,
  anchorTs: number,
  nowTs: number,
  playing: boolean,
  duration: number
): number {
  if (!playing) {
    return anchorPosition;
  }

  return Math.min(duration, anchorPosition + Math.max(0, nowTs - anchorTs));
}

export interface ProgressElements {
  duration: HTMLElement;
  elapsed: HTMLElement;
  fill: HTMLElement;
  lastDurationLabel: string;
  lastElapsedLabel: string;
  labels: HTMLElement;
  root: HTMLElement;
  transitionToken: number;
}

export function createProgressElements(documentRef: Document): ProgressElements {
  var root = documentRef.createElement("footer");
  var rail = documentRef.createElement("div");
  var fill = documentRef.createElement("div");
  var labels = documentRef.createElement("div");
  var elapsed = documentRef.createElement("div");
  var duration = documentRef.createElement("div");

  root.className = "progress-root";
  rail.className = "progress-rail";
  fill.className = "progress-fill";
  labels.className = "progress-labels";
  elapsed.className = "progress-label progress-label-elapsed";
  duration.className = "progress-label progress-label-duration";

  rail.appendChild(fill);
  labels.appendChild(elapsed);
  labels.appendChild(duration);
  root.appendChild(rail);
  root.appendChild(labels);

  return {
    duration: duration,
    elapsed: elapsed,
    fill: fill,
    labels: labels,
    lastDurationLabel: "",
    lastElapsedLabel: "",
    root: root,
    transitionToken: 0
  };
}

export function syncProgressAnimation(
  elements: ProgressElements,
  snapshot: PlaybackSnapshot,
  anchorTs: number
): void {
  var nowTs = Date.now();
  var position = interpolateProgressPosition(
    snapshot.position,
    anchorTs,
    nowTs,
    snapshot.playing,
    snapshot.duration
  );
  var ratio = snapshot.duration > 0 ? position / snapshot.duration : 0;
  var token = elements.transitionToken + 1;
  var timerHost = elements.fill.ownerDocument.defaultView || window;
  var requestFrame =
    typeof timerHost.requestAnimationFrame === "function"
      ? timerHost.requestAnimationFrame.bind(timerHost)
      : function (callback: FrameRequestCallback): number {
          return timerHost.setTimeout(callback, 0);
        };

  elements.transitionToken = token;
  elements.fill.style.transition = "none";
  elements.fill.style.transform = "scaleX(" + ratio.toFixed(6) + ")";

  if (!snapshot.playing || snapshot.duration <= 0 || position >= snapshot.duration) {
    updateProgressLabels(elements, snapshot, anchorTs);
    return;
  }

  void elements.fill.offsetWidth;
  requestFrame(function () {
    if (elements.transitionToken !== token) {
      return;
    }
    elements.fill.style.transition = "transform " + String(Math.max(0, snapshot.duration - position)) + "ms linear";
    elements.fill.style.transform = "scaleX(1)";
  });
  updateProgressLabels(elements, snapshot, anchorTs);
}

export function updateProgressLabels(
  elements: ProgressElements,
  snapshot: PlaybackSnapshot,
  anchorTs: number
): void {
  var nowTs = Date.now();
  var position = interpolateProgressPosition(
    snapshot.position,
    anchorTs,
    nowTs,
    snapshot.playing,
    snapshot.duration
  );
  var elapsedLabel = formatMs(position);
  var durationLabel = formatMs(snapshot.duration);

  if (elements.lastElapsedLabel !== elapsedLabel) {
    elements.elapsed.textContent = elapsedLabel;
    elements.lastElapsedLabel = elapsedLabel;
  }
  if (elements.lastDurationLabel !== durationLabel) {
    elements.duration.textContent = durationLabel;
    elements.lastDurationLabel = durationLabel;
  }
}

export function renderProgress(
  elements: ProgressElements,
  snapshot: PlaybackSnapshot,
  anchorTs: number
): void {
  syncProgressAnimation(elements, snapshot, anchorTs);
  updateProgressLabels(elements, snapshot, anchorTs);
}

function formatMs(value: number): string {
  var totalSeconds = Math.floor(value / 1000);
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;

  return String(minutes) + ":" + String(seconds).padStart(2, "0");
}
