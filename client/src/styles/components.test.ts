import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

const componentsCss = fs.readFileSync(
  path.resolve(import.meta.dirname, "./components.css"),
  "utf8"
);

describe("components css", () => {
  it("uses a 16px artwork corner radius on the image layer", () => {
    expect(componentsCss).toContain(".artwork-image {");
    expect(componentsCss).toContain("border-radius: 16px;");
  });

  it("styles transport buttons as centered icons without widening the screen", () => {
    expect(componentsCss).toContain(".transport-button");
    expect(componentsCss).toContain("background: rgba(255, 255, 255, 0.08);");
    expect(componentsCss).toContain("border: none;");
    expect(componentsCss).toContain("min-width: 0;");
    expect(componentsCss).toContain("font-size: 30px;");
    expect(componentsCss).toContain("padding: 0;");
    expect(componentsCss).toContain(".transport-button-icon");
    expect(componentsCss).toContain("fill: currentColor;");
  });

  it("uses shared single-line marquee field styling without ellipsis on metadata", () => {
    expect(componentsCss).toContain(".track-title,");
    expect(componentsCss).toContain(".track-meta {");
    expect(componentsCss).toContain("overflow: hidden;");
    expect(componentsCss).toContain("white-space: nowrap;");
    expect(componentsCss).not.toContain("text-overflow: ellipsis;");
  });

  it("styles the volume overlay as a hidden horizontal black panel", () => {
    expect(componentsCss).toContain(".volume-overlay {");
    expect(componentsCss).toContain("background: #000;");
    expect(componentsCss).toContain("align-items: center;");
    expect(componentsCss).toContain("justify-content: center;");
    expect(componentsCss).toContain("width: 100%;");
    expect(componentsCss).toContain("max-width: 520px;");
    expect(componentsCss).toContain(".volume-overlay > * + * {");
    expect(componentsCss).toContain("margin-left: 8px;");
    expect(componentsCss).toContain("opacity: 0;");
    expect(componentsCss).toContain("visibility: hidden;");
    expect(componentsCss).toContain("display: none;");
    expect(componentsCss).toContain(".volume-overlay-visible {");
    expect(componentsCss).toContain("display: flex;");
    expect(componentsCss).toContain("visibility: visible;");
  });

  it("keeps active transport buttons neutral instead of using a green background", () => {
    expect(componentsCss).toContain(".transport-button-active {");
    expect(componentsCss).toContain("background: rgba(255, 255, 255, 0.24);");
    expect(componentsCss).not.toContain("30, 215, 96");
    expect(componentsCss).not.toContain("#d9ffe6");
  });

  it("removes the browser focus ring from transport buttons", () => {
    expect(componentsCss).toContain(".transport-button:focus");
    expect(componentsCss).toContain("outline: none;");
    expect(componentsCss).toContain("box-shadow: none;");
    expect(componentsCss).toContain("-webkit-tap-highlight-color: transparent;");
  });

  it("uses an 8px playback progress rail", () => {
    expect(componentsCss).toContain(".progress-rail {");
    expect(componentsCss).toContain("height: 8px;");
  });

  it("uses the updated track typography", () => {
    expect(componentsCss).toContain(".track-title {");
    expect(componentsCss).toContain("font-size: 36px;");
    expect(componentsCss).toContain(".track-meta {");
    expect(componentsCss).toContain("font-weight: 200;");
  });

  it("aligns volume overlay width with the transport control block", () => {
    expect(componentsCss).toContain(".transport-controls {");
    expect(componentsCss).toContain("max-width: 520px;");
    expect(componentsCss).toContain("width: 100%;");
  });

  it("styles a transient top preset hint row with a brighter active label", () => {
    expect(componentsCss).toContain(".preset-hint-overlay {");
    expect(componentsCss).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(componentsCss).toContain("pointer-events: none;");
    expect(componentsCss).toContain(".preset-hint-overlay-visible {");
    expect(componentsCss).toContain(".preset-hint-item {");
    expect(componentsCss).toContain("color: rgba(255, 255, 255, 0.6);");
    expect(componentsCss).toContain(".preset-hint-item-active {");
    expect(componentsCss).toContain("color: rgba(255, 255, 255, 1);");
  });

  it("styles settings list rows and actions for touch input", () => {
    expect(componentsCss).toContain(".settings-home-item");
    expect(componentsCss).toContain(".settings-action");
    expect(componentsCss).toContain("background: rgba(255, 255, 255, 0.08);");
    expect(componentsCss).toContain(".settings-slider");
    expect(componentsCss).toContain(".settings-device-row");
  });
});
