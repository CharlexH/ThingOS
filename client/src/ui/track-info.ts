import type { PlaybackSnapshot } from "../types";

var MARQUEE_PAUSE_SECONDS = 1.5;
var MARQUEE_PIXELS_PER_SECOND = 12;
var MARQUEE_EASING = "cubic-bezier(0.42, 0, 0.18, 1)";
var marqueeStates = new WeakMap<
  HTMLElement,
  {
    animation: Animation | null;
    signature: string;
  }
>();

export interface TrackInfoElements {
  album: HTMLElement;
  albumText: HTMLElement;
  artist: HTMLElement;
  artistText: HTMLElement;
  title: HTMLElement;
  titleText: HTMLElement;
}

export function createTrackInfoElements(documentRef: Document): TrackInfoElements {
  var titleField = createMarqueeField(documentRef, "h1", "track-title", "track-title-text");
  var artistField = createMarqueeField(documentRef, "p", "track-meta", "track-meta-text");
  var albumField = createMarqueeField(documentRef, "p", "track-meta", "track-meta-text");

  return {
    album: albumField.root,
    albumText: albumField.text,
    artist: artistField.root,
    artistText: artistField.text,
    title: titleField.root,
    titleText: titleField.text
  };
}

export function renderTrackInfo(elements: TrackInfoElements, snapshot: PlaybackSnapshot): void {
  elements.titleText.textContent = snapshot.track || "Nothing playing";
  elements.artistText.textContent = snapshot.artist || "Spotify idle";
  elements.albumText.textContent = snapshot.album || "";
  syncMarquee(elements.title, elements.titleText, "track-title-scrolling");
  syncMarquee(elements.artist, elements.artistText, "track-meta-scrolling");
  syncMarquee(elements.album, elements.albumText, "track-meta-scrolling");
}

export function computeMarqueeTiming(overflow: number): {
  durationCss: string;
  moveMs: number;
  pauseMs: number;
  totalMs: number;
} {
  var pauseMs = Math.round(MARQUEE_PAUSE_SECONDS * 1000);
  var moveMs = Math.round((overflow / MARQUEE_PIXELS_PER_SECOND) * 1000);
  var totalMs = pauseMs * 2 + moveMs * 2;

  return {
    durationCss: String(Math.round((totalMs / 1000) * 10) / 10) + "s",
    moveMs: moveMs,
    pauseMs: pauseMs,
    totalMs: totalMs
  };
}

function createMarqueeField(
  documentRef: Document,
  tagName: string,
  rootClassName: string,
  textClassName: string
): { root: HTMLElement; text: HTMLElement } {
  var root = documentRef.createElement(tagName);
  var text = documentRef.createElement("span");

  root.className = rootClassName;
  text.className = textClassName;
  root.appendChild(text);

  return { root: root, text: text };
}

function syncMarquee(root: HTMLElement, text: HTMLElement, scrollingClassName: string): void {
  var availableWidth = root.clientWidth;
  var contentWidth = text.scrollWidth;
  var overflow = Math.max(0, contentWidth - availableWidth);
  var timing = overflow > 0 ? computeMarqueeTiming(overflow) : null;
  var signature = [text.textContent || "", availableWidth, contentWidth, overflow].join("|");
  var previousState = marqueeStates.get(root) || { animation: null, signature: "" };

  root.classList.toggle(scrollingClassName, overflow > 0);
  root.style.setProperty("--track-title-shift", String(overflow) + "px");
  root.style.setProperty(
    "--track-title-duration",
    timing ? timing.durationCss : "0s"
  );

  if (previousState.signature === signature) {
    return;
  }

  if (previousState.animation) {
    previousState.animation.cancel();
  }

  text.style.transform = "translateX(0)";

  if (!timing || typeof text.animate !== "function") {
    marqueeStates.set(root, { animation: null, signature: signature });
    return;
  }

  marqueeStates.set(root, {
    animation: text.animate(
      [
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: timing.pauseMs / timing.totalMs, easing: MARQUEE_EASING },
        {
          transform: "translateX(calc(var(--track-title-shift) * -1))",
          offset: (timing.pauseMs + timing.moveMs) / timing.totalMs
        },
        {
          transform: "translateX(calc(var(--track-title-shift) * -1))",
          offset: (timing.pauseMs * 2 + timing.moveMs) / timing.totalMs,
          easing: MARQUEE_EASING
        },
        { transform: "translateX(0)", offset: 1 }
      ],
      {
        duration: timing.totalMs,
        fill: "both",
        iterations: Infinity
      }
    ),
    signature: signature
  });
}
